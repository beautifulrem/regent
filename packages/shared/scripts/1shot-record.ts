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
  buildPaymentDelegation,
  buildSend7710Params,
  DEMO_PROPOSAL_ID,
  delegationManagerAddress,
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
  settlePaymentCalldata,
  statusTxHash,
  synthesizeVerdict,
  toVeniceTrace,
  withVotingPolicy,
  type Delegation,
  type LensInput,
  type LensVerdict,
  type VeniceConfig,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const STATELESS_7702_IMPL = getAddress('0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B');
const CASTVOTE_ABI = parseAbi(['function castVote(uint256 proposalId, uint8 support) returns (uint256)']);
// A realistic mainnet x402 micro-toll: 0.001 USDC per query (1,000 atoms of a 6-decimal token). Kept
// distinct from the orchestrator's TOLL_ATOMS (1 mUSDC) — 1 real USDC/query would misrepresent x402.
const MAINNET_TOLL_ATOMS = 1_000n;
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
  voteBoard?: Address;
}

function network(mainnet: boolean): Network {
  if (mainnet) {
    const a = ADDRESSES.baseMainnet;
    if (!a.governor || !a.token || !a.proposalId) throw new Error('ADDRESSES.baseMainnet.{governor,token,proposalId} not set');
    return {
      chainId: 8453, chain: base, name: 'base',
      rpc: process.env.BASE_MAINNET_RPC_URL || 'https://base-rpc.publicnode.com',
      relayerUrl: 'https://relayer.1shotapi.com/relayers', relayer: 'mainnet',
      basescan: 'https://basescan.org', governor: a.governor, token: a.token, proposalId: a.proposalId, voteBoard: a.voteBoard,
    };
  }
  const a = ADDRESSES.baseSepolia;
  if (!a.governor || !a.token || !a.proposalId) throw new Error('ADDRESSES.baseSepolia.{governor,token,proposalId} not set');
  return {
    chainId: 84532, chain: baseSepolia, name: 'base-sepolia',
    rpc: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
    relayerUrl: 'https://relayer.1shotapi.dev/relayers', relayer: 'testnet',
    basescan: 'https://sepolia.basescan.org', governor: a.governor, token: a.token, proposalId: a.proposalId, voteBoard: a.voteBoard,
  };
}

function envKey(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
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

/**
 * Settle ONE real mainnet x402 toll: the BURNER (a 7702 SA, the agent's USDC budget) signs an
 * Erc20TransferAmount delegation to the analyst (seller), who redeems it pulling MAINNET_TOLL_ATOMS
 * (0.001 USDC). Prints the toll receipt JSON to merge into MAINNET_SNAPSHOT. The analyst pays the
 * redeem gas (fund it with a little ETH first). One-shot; spends 0.001 USDC.
 */
async function settleX402(net: Network): Promise<void> {
  const client = createPublicClient({ chain: net.chain, transport: http(net.rpc) }) as PublicClient;
  const caps = (await getCapabilities(net.chainId, net.relayerUrl))[String(net.chainId)];
  const usdc = pickPaymentToken({ [String(net.chainId)]: caps }, net.chainId, 'USDC');
  const burnerEoa = privateKeyToAccount(envKey('ONESHOT_BURNER_PK'));
  const burnerSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Stateless7702, address: burnerEoa.address, signer: { account: burnerEoa },
  });
  const analyst = privateKeyToAccount(envKey('ANALYST_PK'));
  const dm = delegationManagerAddress(net.chainId);

  console.log(`● x402: buyer(burner) ${burnerSA.address} → seller(analyst) ${analyst.address} · USDC ${usdc.address}`);
  const before = (await client.readContract({ address: usdc.address, abi: erc20Abi, functionName: 'balanceOf', args: [analyst.address] })) as bigint;

  // 1) the burner signs a scoped Erc20TransferAmount delegation (cap 0.1 USDC) to the analyst.
  const cap = parseUnits('0.1', Number(usdc.decimals));
  const del = buildPaymentDelegation({ buyer: burnerSA.address, seller: analyst.address, asset: usdc.address, amount: cap, environment: burnerSA.environment });
  const paymentDel = { ...del, signature: await burnerSA.signDelegation({ delegation: del }) } as Delegation;

  // 2) the analyst redeems it, pulling the 0.001 USDC micro-toll (analyst pays the gas).
  const analystWallet = createWalletClient({ account: analyst, chain: net.chain, transport: http(net.rpc) });
  const txHash = await analystWallet.sendTransaction({ to: dm, data: settlePaymentCalldata(paymentDel, usdc.address, analyst.address, MAINNET_TOLL_ATOMS) });
  console.log(`● x402: settle tx ${txHash} — waiting…`);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error('x402 settlement reverted');
  const after = (await client.readContract({ address: usdc.address, abi: erc20Abi, functionName: 'balanceOf', args: [analyst.address] })) as bigint;

  const toll = {
    txHash, asset: usdc.address, buyer: burnerSA.address, seller: analyst.address,
    amount: MAINNET_TOLL_ATOMS.toString(), sellerBalance: after.toString(),
    resource: `/context/proposal-${DEMO_PROPOSAL_ID.toString().slice(-6)}`,
  };
  console.log(`\n✅ x402 settled: analyst USDC ${Number(before) / 1e6} → ${Number(after) / 1e6} (+${Number(after - before) / 1e6})`);
  const out = path.join(REPO_ROOT, 'oneshot-x402-toll.json');
  fs.writeFileSync(out, JSON.stringify(toll, null, 2));
  console.log(`📄 toll receipt → ${out}\n   merge it into MAINNET_SNAPSHOT.toll\n`);
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const estimateOnly = process.argv.includes('--estimate');
  const reseed = process.argv.includes('--reseed');
  // --x402: settle a real mainnet x402 micro-toll (burner → analyst, 0.001 USDC) and dump the receipt.
  if (process.argv.includes('--x402')) {
    await settleX402(network(process.argv.includes('--mainnet')));
    return;
  }
  // --board: cast the AI's vote on the (windowless) VoteBoard at DEMO_PROPOSAL_ID instead of the Governor,
  // so the relayed 1Shot vote becomes the 6th real voter alongside the 5 seeded personas.
  const board = process.argv.includes('--board');
  // --finalize <voteTx> --proposal <id>: skip reseed + relay, reuse an ALREADY-CAST 1Shot vote and just
  // re-run Venice (no broadcast) to assemble the snapshot. For recovering a run whose relay succeeded.
  const finalizeTx = argValue('--finalize') as Hex | undefined;
  const proposalOverride = argValue('--proposal');
  const net = network(process.argv.includes('--mainnet'));

  if (board && !net.voteBoard) throw new Error('--board needs ADDRESSES.*.voteBoard set');
  const voteTarget: Address = board ? (net.voteBoard as Address) : net.governor;

  console.log(`\n● network: ${net.name} (${net.chainId}) · relayer ${net.relayer} · target ${board ? 'VoteBoard' : 'Governor'} ${voteTarget}`);

  // The displayed/Venice-analyzed proposal == PROPOSALS[0] ("Renew core-dev team budget"). The on-chain
  // castVote targets: --board → VoteBoard at DEMO_PROPOSAL_ID; else the Governor proposalId.
  const proposal = PROPOSALS[0];
  const proposalText = proposal.body.en;

  const client = createPublicClient({ chain: net.chain, transport: http(net.rpc) }) as PublicClient;
  const proposalId = board
    ? DEMO_PROPOSAL_ID
    : finalizeTx
      ? BigInt(proposalOverride ?? net.proposalId)
      : reseed
        ? await reseedAndWaitActive(client, net)
        : BigInt(net.proposalId);
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
    scope: { type: ScopeType.FunctionCall, targets: [usdc.address, voteTarget], selectors: ['transfer(address,uint256)', 'castVote(uint256,uint8)'] },
  } as Parameters<typeof createDelegation>[0]);
  const signedDelegation = { ...delegation, signature: await burnerSA.signDelegation({ delegation }) };

  const castVoteData = encodeFunctionData({ abi: CASTVOTE_ABI, functionName: 'castVote', args: [proposalId, support] });
  const minFeeAtoms = parseUnits('0.01', Number(usdc.decimals));
  const execs = (fee: bigint) => [
    { target: usdc.address, value: '0', data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [feeCollector, fee] }) as Hex },
    { target: voteTarget, value: '0', data: castVoteData },
  ];

  let voteTx: Hex;
  let feeAtoms = minFeeAtoms;
  if (finalizeTx) {
    // recovery: the relay already happened; just reuse the on-chain vote tx (no broadcast).
    voteTx = finalizeTx;
    console.log(`● finalize: reusing already-cast 1Shot vote ${voteTx} (no broadcast)`);
  } else {
    const estParams = buildSend7710Params({ chainId: net.chainId, permissionContext: [signedDelegation], executions: execs(minFeeAtoms), authorizationList });
    const est = await estimate7710Transaction(estParams, net.relayerUrl);
    if (!est.success) throw new Error(`estimate failed: ${JSON.stringify(est.error)}`);
    feeAtoms = floorFee(BigInt(est.requiredPaymentAmount ?? '0'), minFeeAtoms);
    console.log(`● estimate ok: fee ${Number(feeAtoms) / 10 ** Number(usdc.decimals)} USDC`);

    if (estimateOnly) {
      console.log('\n--estimate only — no broadcast. Re-run without --estimate to relay + record.\n');
      return;
    }

    const sendParams = { ...buildSend7710Params({ chainId: net.chainId, permissionContext: [signedDelegation], executions: execs(feeAtoms), authorizationList }), context: est.context };
    const taskId = await send7710Transaction(sendParams, net.relayerUrl);
    console.log(`● submitted — taskId ${taskId}`);

    let tx: Hex | undefined;
    for (let i = 0; i < 60; i++) {
      const st = await getStatus(taskId, net.relayerUrl);
      const h = statusTxHash(st);
      console.log(`   ${relayStatusLabel(st.status)} (${st.status})${h ? ` · ${h}` : ''}`);
      if (isTerminalStatus(st.status)) {
        if (st.status !== 200) throw new Error(`relay ${relayStatusLabel(st.status)}: ${st.message ?? ''}`);
        tx = h;
        break;
      }
      await sleep(3000);
    }
    if (!tx) throw new Error('relay confirmed but no tx hash returned');
    voteTx = tx;
  }

  const receipt = await client.getTransactionReceipt({ hash: voteTx });
  const upgraded = is7702Upgraded((await client.getCode({ address: burnerEoa.address })) as Hex);
  console.log(`\n✅ ${net.name} castVote relayed via 1Shot — tx ${voteTx} · 7702-upgraded ${upgraded}`);

  // ── 3) DUMP the MainnetSnapshot JSON ──────────────────────────────────────────────────────────
  const snapshot = {
    recordedAt: new Date().toISOString(),
    chain: { id: net.chainId, name: net.name, rpc: net.rpc, basescan: net.basescan },
    relayer: net.relayer,
    proposal: { id: proposalId.toString(), title: proposal.title, body: proposal.body },
    ...(board ? { voteBoard: voteTarget } : {}),
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
