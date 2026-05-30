/**
 * T7b — autonomous A2A orchestration: one command runs the whole loop with NO hardcoded vote.
 *
 *   grant (user→orch root) → orchestrator attenuated-redelegates to analyst →
 *   analyst privately analyses the proposal in a Venice TEE and DECIDES support →
 *   analyst redeems the chain → real castVote on the deployed Governor
 *
 * The cast support is whatever Venice decided (For/Against/Abstain) — proven on-chain by which
 * tally bucket receives the votes. Signs with the funded .env keys; testnet gas only.
 *
 *   pnpm tsx packages/shared/scripts/orchestrate.ts ["<proposal text>"]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

import {
  ADDRESSES,
  analyzeProposal,
  buildVoteDelegation,
  delegationManagerAddress,
  demoProposalAction,
  fetchAttestation,
  fetchProposalWindow,
  GOVERNOR_ABI,
  redeemVoteCalldata,
  redelegateVote,
  reseedProposal,
  supportToDecision,
  toVeniceTrace,
  type Delegation,
  type SmartAccountsEnvironment,
  type Support,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TALLY = ['Against', 'For', 'Abstain'] as const; // index = support code

const DEFAULT_PROPOSAL =
  'Proposal: allocate 5,000 USDC from the treasury to an independently audited public-goods ' +
  'grant, released over three 30-day milestones, each gated on a public deliverable, with an ' +
  'unspent-funds clawback to the treasury. Decide whether the DAO should approve.';

const GOV_READ = parseAbi([
  'function hasVoted(uint256 proposalId, address account) view returns (bool)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 against, uint256 forVotes, uint256 abstain)',
]);

function env(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const proposalText = process.argv[2] || DEFAULT_PROPOSAL;
  const governor = ADDRESSES.baseSepolia.governor;
  const token = ADDRESSES.baseSepolia.token;
  if (!governor || !token) throw new Error('deploy first (addresses.ts.baseSepolia empty)');
  const veniceCfg = {
    apiUrl: process.env.VENICE_API_URL || 'https://api.venice.ai/api/v1',
    apiKey: process.env.VENICE_API_KEY || '',
    model: process.env.VENICE_MODEL || undefined,
  };
  if (!veniceCfg.apiKey) throw new Error('VENICE_API_KEY missing in .env');

  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) }) as PublicClient;
  const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(baseSepolia.id);
  const dm = delegationManagerAddress(baseSepolia.id);

  const userEoa = privateKeyToAccount(env('USER_DEMO_PK'));
  const orchEoa = privateKeyToAccount(env('ORCHESTRATOR_PK'));
  const analystEoa = privateKeyToAccount(env('ANALYST_PK'));
  const deployer = privateKeyToAccount(env('DEPLOYER_PK'));

  const userSA = await toMetaMaskSmartAccount({ client, implementation: Implementation.Hybrid, deployParams: [userEoa.address, [], [], []], deploySalt: '0x', signer: { account: userEoa } });
  const orchSA = await toMetaMaskSmartAccount({ client, implementation: Implementation.Hybrid, deployParams: [orchEoa.address, [], [], []], deploySalt: '0x', signer: { account: orchEoa } });
  if (!(await userSA.isDeployed()) || !(await orchSA.isDeployed())) {
    throw new Error('run vote-2hop once first to deploy the smart accounts');
  }

  // (1) fresh proposal whose on-chain description IS the text the analyst will judge.
  console.log('› reseeding a fresh proposal…');
  const deployerWallet = createWalletClient({ account: deployer, chain: baseSepolia, transport: http(RPC) });
  const proposeTx = await reseedProposal(deployerWallet, deployer, governor, token, proposalText);
  await client.waitForTransactionReceipt({ hash: proposeTx });
  const { targets, values, calldatas } = demoProposalAction(token);
  const proposalId = (await client.readContract({ address: governor, abi: GOVERNOR_ABI, functionName: 'hashProposal', args: [targets as Address[], values as bigint[], calldatas as Hex[], keccak256(stringToHex(proposalText))] })) as bigint;
  for (;;) {
    const { window } = await fetchProposalWindow(client, governor, proposalId);
    if (window.phase === 'active') break;
    if (window.phase === 'closed') throw new Error('closed before active');
    await sleep(5000);
  }
  console.log(`  proposalId ${proposalId} Active\n`);

  // (2) GRANT + REDELEGATE (no vote chosen yet — support stays free in the scope).
  const root: Delegation = buildVoteDelegation({ governor, proposalId, delegate: orchSA.address, delegator: userSA.address, environment });
  const rootSigned: Delegation = { ...root, signature: await userSA.signDelegation({ delegation: root }) };
  const redel: Delegation = redelegateVote({ governor, proposalId, delegate: analystEoa.address, delegator: orchSA.address, environment, parentDelegation: rootSigned });
  const redelSigned: Delegation = { ...redel, signature: await orchSA.signDelegation({ delegation: redel }) };
  console.log('› grant + redelegation signed (user→orch→analyst); support left OPEN for the analyst');

  // (3) ANALYST decides support privately in the Venice TEE.
  console.log('› analyst analysing the proposal in a Venice TEE…');
  const analysis = await analyzeProposal(veniceCfg, proposalText);
  const attestation = await fetchAttestation(veniceCfg, analysis.model).catch(() => undefined);
  const trace = toVeniceTrace(analysis, attestation);
  const support = analysis.decision.support as Support;
  console.log(`  Venice → ${analysis.decision.decision} (support ${support}) · tee=${analysis.tee.verified} · "${analysis.decision.rationale}"`);

  // (4) analyst casts EXACTLY what Venice decided.
  const redeemData = redeemVoteCalldata({ chain: [redelSigned, rootSigned], governor, proposalId, support });
  const analystWallet = createWalletClient({ account: analystEoa, chain: baseSepolia, transport: http(RPC) });
  const voteTx = await analystWallet.sendTransaction({ to: dm, data: redeemData });
  const rcpt = await client.waitForTransactionReceipt({ hash: voteTx });
  console.log(`› analyst cast the vote — tx ${voteTx} (${rcpt.status})`);

  // (5) prove the on-chain tally bucket matches the Venice decision.
  const hasVoted = await client.readContract({ address: governor, abi: GOV_READ, functionName: 'hasVoted', args: [proposalId, userSA.address] });
  const tally = (await client.readContract({ address: governor, abi: GOV_READ, functionName: 'proposalVotes', args: [proposalId] })) as [bigint, bigint, bigint];
  const bucket = tally[support];
  console.log(`\n  hasVoted=${hasVoted} · tally[${TALLY[support]}]=${bucket} (Against=${tally[0]} For=${tally[1]} Abstain=${tally[2]})`);
  if (!hasVoted || rcpt.status !== 'success' || bucket === 0n || supportToDecision(support) !== analysis.decision.decision) {
    throw new Error('autonomous vote did not match the Venice decision');
  }
  console.log('\nVeniceTrace:', JSON.stringify(trace));
  console.log(`\n✅ autonomous: one grant → Venice TEE decided ${analysis.decision.decision} → real castVote in the ${TALLY[support]} bucket.`);
}

main().catch((e) => { console.error('\norchestrate FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; });
