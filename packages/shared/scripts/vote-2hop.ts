/**
 * T7 integration: a REAL 2-hop attenuated governance vote on the deployed Base Sepolia Governor.
 *
 *   user SA --(root: castVote scope, proposalId locked, support free)--> orchestrator SA
 *   orchestrator SA --(attenuated redelegation)--> analyst EOA
 *   analyst redeems the chain (leaf->root) -> DelegationManager executes castVote AS the user SA
 *
 * Run locally (signs with the funded test keys in .env, spends only testnet gas):
 *   pnpm tsx packages/shared/scripts/vote-2hop.ts [--support 0|1|2]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

import {
  ADDRESSES,
  buildVoteDelegation,
  delegationManagerAddress,
  fetchProposalWindow,
  redeemVoteCalldata,
  redelegateVote,
  reseedProposal,
  type Delegation,
  type SmartAccountsEnvironment,
} from '../src/index.js';
import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const GOV_READ_ABI = parseAbi([
  'function hasVoted(uint256 proposalId, address account) view returns (bool)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 against, uint256 forVotes, uint256 abstain)',
]);

function env(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

async function deploySmartAccountIfNeeded(
  client: PublicClient,
  deployer: ReturnType<typeof privateKeyToAccount>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sa: any,
  label: string,
): Promise<void> {
  if (await sa.isDeployed()) {
    console.log(`  ${label} already deployed: ${sa.address}`);
    return;
  }
  const { factory, factoryData } = await sa.getFactoryArgs();
  const wallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(RPC) });
  const hash = await wallet.sendTransaction({ to: factory as Address, data: factoryData as Hex });
  await client.waitForTransactionReceipt({ hash });
  console.log(`  deployed ${label}: ${sa.address} (tx ${hash})`);
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const support = Number(
    process.argv.includes('--support') ? process.argv[process.argv.indexOf('--support') + 1] : '1',
  );

  const governor = ADDRESSES.baseSepolia.governor;
  const token = ADDRESSES.baseSepolia.token;
  if (!governor || !token) throw new Error('deploy first (addresses.ts.baseSepolia empty)');

  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) }) as PublicClient;
  const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(baseSepolia.id);
  const dm = delegationManagerAddress(baseSepolia.id);

  const userEoa = privateKeyToAccount(env('USER_DEMO_PK'));
  const orchEoa = privateKeyToAccount(env('ORCHESTRATOR_PK'));
  const analystEoa = privateKeyToAccount(env('ANALYST_PK'));
  const deployer = privateKeyToAccount(env('DEPLOYER_PK'));

  const userSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Hybrid,
    deployParams: [userEoa.address, [], [], []], deploySalt: '0x', signer: { account: userEoa },
  });
  const orchSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Hybrid,
    deployParams: [orchEoa.address, [], [], []], deploySalt: '0x', signer: { account: orchEoa },
  });
  console.log(`user SA ${userSA.address}\norch SA ${orchSA.address}\nanalyst ${analystEoa.address}\n`);

  // (0) the user SA (root) must be deployed to execute castVote; the orch SA (intermediate
  //     delegator) must be deployed so its ERC-1271 delegation signature validates.
  console.log('› ensuring smart accounts are deployed…');
  await deploySmartAccountIfNeeded(client, deployer, userSA, 'user SA');
  await deploySmartAccountIfNeeded(client, deployer, orchSA, 'orch SA');

  // (1) reseed a fresh proposal so the whole flow runs inside one Active window.
  console.log('\n› reseeding a fresh proposal…');
  const description = `Mandate 2-hop vote @ ${new Date().toISOString()}`;
  const wallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(RPC) });
  const proposeTx = await reseedProposal(wallet, deployer, governor, token, description);
  await client.waitForTransactionReceipt({ hash: proposeTx });
  const { keccak256, stringToHex } = await import('viem');
  const { demoProposalAction, GOVERNOR_ABI } = await import('../src/proposal.js');
  const { targets, values, calldatas } = demoProposalAction(token);
  const proposalId = (await client.readContract({
    address: governor, abi: GOVERNOR_ABI, functionName: 'hashProposal',
    args: [targets as Address[], values as bigint[], calldatas as Hex[], keccak256(stringToHex(description))],
  })) as bigint;
  console.log(`  proposalId ${proposalId}`);

  console.log('› waiting for Active…');
  for (;;) {
    const { window } = await fetchProposalWindow(client, governor, proposalId);
    if (window.phase === 'active') { console.log(`  Active (${window.secondsRemaining}s left)`); break; }
    if (window.phase === 'closed') throw new Error('proposal closed before active');
    await sleep(5000);
  }

  // (2) ROOT delegation: user SA -> orch SA, castVote(proposalId, *) scope.
  const root: Delegation = buildVoteDelegation({
    governor, proposalId, delegate: orchSA.address, delegator: userSA.address, environment,
  });
  const rootSigned: Delegation = { ...root, signature: await userSA.signDelegation({ delegation: root }) };
  console.log('\n› (root) user→orch delegation signed');

  // (3) REDELEGATION: orch SA -> analyst, parentDelegation = rootSigned.
  const redel: Delegation = redelegateVote({
    governor, proposalId, delegate: analystEoa.address, delegator: orchSA.address,
    environment, parentDelegation: rootSigned,
  });
  const redelSigned: Delegation = { ...redel, signature: await orchSA.signDelegation({ delegation: redel }) };
  console.log('› (redelegate) orch→analyst delegation signed');

  // (4) REDEEM the chain LEAF→ROOT → DelegationManager executes castVote as the user SA.
  const redeemData = redeemVoteCalldata({ chain: [redelSigned, rootSigned], governor, proposalId, support });
  const analystWallet = createWalletClient({ account: analystEoa, chain: baseSepolia, transport: http(RPC) });
  const voteTx = await analystWallet.sendTransaction({ to: dm, data: redeemData });
  const rcpt = await client.waitForTransactionReceipt({ hash: voteTx });
  console.log(`› (redeem) analyst cast the vote — tx ${voteTx} status=${rcpt.status}`);

  // (5) verify on-chain
  const hasVoted = await client.readContract({ address: governor, abi: GOV_READ_ABI, functionName: 'hasVoted', args: [proposalId, userSA.address] });
  const [against, forVotes, abstain] = await client.readContract({ address: governor, abi: GOV_READ_ABI, functionName: 'proposalVotes', args: [proposalId] });
  console.log(`\n  hasVoted(userSA) = ${hasVoted}`);
  console.log(`  proposalVotes: For=${forVotes} Against=${against} Abstain=${abstain}`);
  if (!hasVoted || rcpt.status !== 'success') throw new Error('vote not recorded');
  console.log('\n✅ 2-hop attenuated delegation → real castVote on the deployed Governor.');
}

main().catch((e) => { console.error('\nvote-2hop FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; });
