/**
 * Record a UNIFIED 1Shot run for the OneShotFinale replay: the Venice TEE committee (4 lenses +
 * synthesis) DECIDES the support, then that decided castVote is relayed through the 1Shot
 * permissionless relayer (EIP-7702 burner upgrade + ERC-7710 bundle, gas paid in USDC). Dumps a
 * MainnetSnapshot JSON — copy it into app/src/lib/mainnet-snapshot.ts to drive the replay.
 *
 *   pnpm tsx packages/shared/scripts/1shot-record.ts --estimate            # Sepolia .dev, dry quote (FREE)
 *   pnpm tsx packages/shared/scripts/1shot-record.ts                       # Sepolia .dev, real relay (testnet USDC)
 *   pnpm tsx packages/shared/scripts/1shot-record.ts --mainnet --estimate  # mainnet .com quote (FREE)
 *   pnpm tsx packages/shared/scripts/1shot-record.ts --mainnet             # mainnet .com real relay (REAL USDC, ask-first)
 *
 * Needs in .env: VENICE_API_KEY, ONESHOT_BURNER_PK. The burner needs a little of the relayer's fee
 * token (testnet USDC on Sepolia, real USDC on mainnet); gas is paid BY the relayer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  keccak256,
  parseAbi,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createDelegation,
  Implementation,
  ScopeType,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';

import {
  ADDRESSES,
  analyzeProposal,
  buildSend7710Params,
  demoProposalAction,
  estimate7710Transaction,
  fetchAttestation,
  fetchProposalWindow,
  floorFee,
  getCapabilities,
  getStatus,
  GOVERNOR_ABI,
  is7702Upgraded,
  isTerminalStatus,
  LENSES,
  PROPOSALS,
  pickPaymentToken,
  relayStatusLabel,
  reseedProposal,
  resolveModel,
  send7710Transaction,
  synthesizeVerdict,
  toVeniceTrace,
  withVotingPolicy,
  type LensInput,
  type LensVerdict,
  type VeniceConfig,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const STATELESS_7702_IMPL = getAddress('0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B');
const CASTVOTE_ABI = parseAbi(['function castVote(uint256 proposalId, uint8 support) returns (uint256)']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Network {
  chainId: number;
  chain: typeof base | typeof baseSepolia;
  name: string;
  rpc: string;
  relayerUrl: string;
  relayer: 'mainnet' | 'testnet';
  basescan: string;
  governor: Address;
  token: Address;
  proposalId: string;
}

function network(mainnet: boolean): Network {
  if (mainnet) {
    const a = ADDRESSES.baseMainnet;
    if (!a.governor || !a.token || !a.proposalId) throw new Error('ADDRESSES.baseMainnet.{governor,token,proposalId} not set');
    return {
      chainId: 8453, chain: base, name: 'base',
      rpc: process.env.BASE_MAINNET_RPC_URL || 'https://base-rpc.publicnode.com',
      relayerUrl: 'https://relayer.1shotapi.com/relayers', relayer: 'mainnet',
      basescan: 'https://basescan.org', governor: a.governor, token: a.token, proposalId: a.proposalId,
    };
  }
  const a = ADDRESSES.baseSepolia;
  if (!a.governor || !a.token || !a.proposalId) throw new Error('ADDRESSES.baseSepolia.{governor,token,proposalId} not set');
  return {
    chainId: 84532, chain: baseSepolia, name: 'base-sepolia',
    rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
    relayerUrl: 'https://relayer.1shotapi.dev/relayers', relayer: 'testnet',
    basescan: 'https://sepolia.basescan.org', governor: a.governor, token: a.token, proposalId: a.proposalId,
  };
}

function envKey(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

const sleepS = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

/**
 * Create a FRESH demo proposal on the governor (signed by DEPLOYER_PK) and poll until it is Active.
 * Returns the new proposalId. Needed because the Governor's Active window is only 300s — a stale
 * proposalId from addresses.ts will be 'closed' and castVote would revert.
 */
async function reseedAndWaitActive(client: PublicClient, net: Network): Promise<bigint> {
  const account = privateKeyToAccount(envKey('DEPLOYER_PK'));
  const wallet = createWalletClient({ account, chain: net.chain, transport: http(net.rpc) });
  const description = `Mandate 1Shot recording @ ${new Date().toISOString()}`;
  console.log('● reseed: creating a fresh proposal…');
  const txHash = await reseedProposal(wallet, account, net.governor, net.token, description);
  await client.waitForTransactionReceipt({ hash: txHash });
  const { targets, values, calldatas } = demoProposalAction(net.token);
  const descriptionHash = keccak256(stringToHex(description));
  const proposalId = (await client.readContract({
    address: net.governor, abi: GOVERNOR_ABI, functionName: 'hashProposal',
    args: [targets as Address[], values as bigint[], calldatas as Hex[], descriptionHash],
  })) as bigint;
  console.log(`● reseed: proposalId ${proposalId} (tx ${txHash}) — waiting for Active…`);
  for (let i = 0; i < 40; i++) {
    const { window } = await fetchProposalWindow(client, net.governor, proposalId);
    if (window.phase === 'active') {
      console.log(`● reseed: Active (${window.secondsRemaining}s left)\n`);
      return proposalId;
    }
    if (window.phase === 'closed') throw new Error('proposal closed before becoming active');
    process.stdout.write(`   pending — Active in ${window.secondsUntilActive}s\n`);
    await sleepS(5);
  }
  throw new Error('timed out waiting for Active');
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const estimateOnly = process.argv.includes('--estimate');
  const reseed = process.argv.includes('--reseed');
  const net = network(process.argv.includes('--mainnet'));

  console.log(`\n● network: ${net.name} (${net.chainId}) · relayer ${net.relayer} · governor ${net.governor}`);

  // The displayed/Venice-analyzed proposal == PROPOSALS[0] ("Renew core-dev team budget"); the on-chain
  // castVote targets the governor proposalId (a fresh Active one with --reseed, else addresses.ts's).
  const proposal = PROPOSALS[0];
  const proposalText = proposal.body.en;

  const client = createPublicClient({ chain: net.chain, transport: http(net.rpc) }) as PublicClient;
  const proposalId = reseed ? await reseedAndWaitActive(client, net) : BigInt(net.proposalId);
  console.log(`● proposal: "${proposal.title.en}"  on-chain id ${proposalId.toString().slice(0, 12)}…\n`);

  // ── 1) VENICE TEE: 4 lenses in parallel → synthesis → final support ───────────────────────────
  const veniceCfg: VeniceConfig = {
    apiUrl: process.env.VENICE_API_URL || 'https://api.venice.ai/api/v1',
    apiKey: process.env.VENICE_API_KEY || '',
    model: process.env.VENICE_MODEL || undefined,
  };
  if (!veniceCfg.apiKey) throw new Error('VENICE_API_KEY missing in .env');
  console.log('● Venice TEE: resolving model + running the 4-lens committee…');
  const model = await resolveModel(veniceCfg);
  const lensResults = await Promise.all(
    LENSES.map(async (lens) => ({ lens, analysis: await analyzeProposal(veniceCfg, withVotingPolicy(proposalText, lens.policy), model) })),
  );
  const lenses: LensVerdict[] = lensResults.map(({ lens, analysis }) => ({
    lens: lens.key, model: analysis.model, support: analysis.decision.support,
    decision: analysis.decision.decision, rationale: analysis.decision.rationale,
    reasoning: analysis.reasoning, teeVerified: analysis.tee.verified,
  }));
  for (const l of lenses) console.log(`   ${l.lens.padEnd(14)} ${l.decision}`);
  const inputs: LensInput[] = lensResults.map(({ lens, analysis }) => ({ label: lens.label, decision: analysis.decision.decision, rationale: analysis.decision.rationale }));
  const synthesis = await synthesizeVerdict(veniceCfg, proposalText, inputs, model);
  const attestation = await fetchAttestation(veniceCfg, synthesis.model).catch(() => undefined);
  const venice = toVeniceTrace(synthesis, attestation);
  const support = synthesis.decision.support;
  console.log(`● Venice decision: ${venice.decision} (support=${support}) · "${venice.rationale}"\n`);

  // ── 2) 1SHOT RELAY: burner 7702 upgrade + ERC-7710 bundle [ fee → feeCollector , castVote ] ────
  const caps = (await getCapabilities(net.chainId, net.relayerUrl))[String(net.chainId)];
  if (!caps) throw new Error(`relayer ${net.relayer} does not support chain ${net.chainId}`);
  const usdc = pickPaymentToken({ [String(net.chainId)]: caps }, net.chainId, 'USDC');
  const { targetAddress, feeCollector } = caps;
  console.log(`● 1Shot: target ${targetAddress} · feeCollector ${feeCollector} · USDC ${usdc.address}`);

  const burnerEoa = privateKeyToAccount(envKey('ONESHOT_BURNER_PK'));
  const burnerSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Stateless7702, address: burnerEoa.address, signer: { account: burnerEoa },
  });
  console.log(`● burner ${burnerEoa.address} (7702 SA = same address)`);

  const code = (await client.getCode({ address: burnerEoa.address })) ?? '0x';
  let authorizationList: unknown[] | undefined;
  if (!is7702Upgraded(code as Hex)) {
    const nonce = await client.getTransactionCount({ address: burnerEoa.address, blockTag: 'pending' });
    const auth = await burnerEoa.signAuthorization({ chainId: net.chainId, contractAddress: STATELESS_7702_IMPL, nonce });
    authorizationList = [{ address: auth.address, chainId: auth.chainId, nonce: auth.nonce, r: auth.r, s: auth.s, yParity: auth.yParity }];
    console.log('● EIP-7702 authorization signed (first-use upgrade through 1Shot)');
  } else {
    console.log('● burner already 7702-upgraded — no authorization needed');
  }

  const delegation = createDelegation({
    to: targetAddress, from: burnerSA.address, environment: burnerSA.environment,
    scope: { type: ScopeType.FunctionCall, targets: [usdc.address, net.governor], selectors: ['transfer(address,uint256)', 'castVote(uint256,uint8)'] },
  } as Parameters<typeof createDelegation>[0]);
  const signedDelegation = { ...delegation, signature: await burnerSA.signDelegation({ delegation }) };

  const castVoteData = encodeFunctionData({ abi: CASTVOTE_ABI, functionName: 'castVote', args: [proposalId, support] });
  const minFeeAtoms = parseUnits('0.01', Number(usdc.decimals));
  const execs = (fee: bigint) => [
    { target: usdc.address, value: '0', data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [feeCollector, fee] }) as Hex },
    { target: net.governor, value: '0', data: castVoteData },
  ];

  const estParams = buildSend7710Params({ chainId: net.chainId, permissionContext: [signedDelegation], executions: execs(minFeeAtoms), authorizationList });
  const est = await estimate7710Transaction(estParams, net.relayerUrl);
  if (!est.success) throw new Error(`estimate failed: ${JSON.stringify(est.error)}`);
  const feeAtoms = floorFee(BigInt(est.requiredPaymentAmount ?? '0'), minFeeAtoms);
  console.log(`● estimate ok: fee ${Number(feeAtoms) / 10 ** Number(usdc.decimals)} USDC`);

  if (estimateOnly) {
    console.log('\n--estimate only — no broadcast. Re-run without --estimate to relay + record.\n');
    return;
  }

  const sendParams = { ...buildSend7710Params({ chainId: net.chainId, permissionContext: [signedDelegation], executions: execs(feeAtoms), authorizationList }), context: est.context };
  const taskId = await send7710Transaction(sendParams, net.relayerUrl);
  console.log(`● submitted — taskId ${taskId}`);

  let voteTx: Hex | undefined;
  for (let i = 0; i < 60; i++) {
    const st = await getStatus(taskId, net.relayerUrl);
    console.log(`   ${relayStatusLabel(st.status)} (${st.status})${st.hash ? ` · ${st.hash}` : ''}`);
    if (isTerminalStatus(st.status)) {
      if (st.status !== 200) throw new Error(`relay ${relayStatusLabel(st.status)}: ${st.message ?? ''}`);
      voteTx = st.hash;
      break;
    }
    await sleep(3000);
  }
  if (!voteTx) throw new Error('relay did not reach a terminal status in time');

  const receipt = await client.getTransactionReceipt({ hash: voteTx });
  const upgraded = is7702Upgraded((await client.getCode({ address: burnerEoa.address })) as Hex);
  console.log(`\n✅ ${net.name} castVote relayed via 1Shot — tx ${voteTx} · 7702-upgraded ${upgraded}`);

  // ── 3) DUMP the MainnetSnapshot JSON ──────────────────────────────────────────────────────────
  const snapshot = {
    recordedAt: new Date().toISOString(),
    chain: { id: net.chainId, name: net.name, rpc: net.rpc, basescan: net.basescan },
    relayer: net.relayer,
    proposal: { id: net.proposalId, title: proposal.title, body: proposal.body },
    participants: { user: burnerSA.address, orchestrator: burnerSA.address, analyst: targetAddress },
    venice, lenses,
    vote: { txHash: voteTx, support, blockNumber: receipt.blockNumber.toString(), relay: '1shot' },
    oneshot: { burner: burnerEoa.address, feeUsdc: (Number(feeAtoms) / 10 ** Number(usdc.decimals)).toString(), gasUsed: Number(receipt.gasUsed) },
  };
  const out = path.join(REPO_ROOT, `oneshot-snapshot-${net.relayer}.json`);
  fs.writeFileSync(out, JSON.stringify(snapshot, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  console.log(`\n📄 snapshot written → ${out}`);
  console.log('   paste it into app/src/lib/mainnet-snapshot.ts (MAINNET_SNAPSHOT)\n');
}

main().catch((e) => { console.error('\n1shot-record FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; });
