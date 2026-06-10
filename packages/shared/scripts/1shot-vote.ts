/**
 * T16 — relay a REAL Base mainnet castVote through the 1Shot permissionless relayer.
 *
 *   burner EOA --(EIP-7702 upgrade THROUGH 1Shot)--> 7702 stateless delegator
 *   burner 7702 SA --(ERC-7710 delegation to the relayer's targetAddress)-->
 *     relayer redeems a bundle [ USDC fee → feeCollector , Governor.castVote(proposalId, support) ]
 *   gas is paid by the relayer; the burner pays a stablecoin fee. Status via relayer_getStatus.
 *
 *   pnpm tsx packages/shared/scripts/1shot-vote.ts --estimate   # dry quote (free, no broadcast)
 *   pnpm tsx packages/shared/scripts/1shot-vote.ts              # real relay (spends mainnet USDC)
 *
 * Mainnet, ASK-FIRST: run --estimate first and confirm the fee before the real send.
 */
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
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import {
  createDelegation,
  getSmartAccountsEnvironment,
  Implementation,
  ScopeType,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';

import {
  ADDRESSES,
  buildSend7710Params,
  estimate7710Transaction,
  floorFee,
  getCapabilities,
  getStatus,
  is7702Upgraded,
  isTerminalStatus,
  pickPaymentToken,
  relayStatusLabel,
  send7710Transaction,
} from '../src/index.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CHAIN_ID = 8453;
const MAINNET_RPC = process.env.BASE_MAINNET_RPC_URL || 'https://base-rpc.publicnode.com';
const STATELESS_7702_IMPL = getAddress('0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B');
const CASTVOTE_ABI = parseAbi(['function castVote(uint256 proposalId, uint8 support) returns (uint256)']);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function envKey(name: string): Hex {
  const v = process.env[name];
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`missing/invalid ${name} in .env`);
  return v as Hex;
}

async function main(): Promise<void> {
  loadDotenv({ path: path.join(REPO_ROOT, '.env') });
  const estimateOnly = process.argv.includes('--estimate');
  const support = Number(process.argv.includes('--support') ? process.argv[process.argv.indexOf('--support') + 1] : '1');
  // --webhook <url> (or ONESHOT_WEBHOOK_URL): the relayer POSTs signed Ed25519 status events there
  // (e.g. the orchestrator's /webhooks/1shot) — the preferred status source over polling.
  const webhookUrl = process.argv.includes('--webhook')
    ? process.argv[process.argv.indexOf('--webhook') + 1]
    : process.env.ONESHOT_WEBHOOK_URL;

  const governor = ADDRESSES.baseMainnet.governor;
  const proposalIdStr = ADDRESSES.baseMainnet.proposalId;
  if (!governor || !proposalIdStr) throw new Error('deploy the mainnet Governor first (addresses.ts.baseMainnet empty) — run T15');
  const proposalId = BigInt(proposalIdStr);

  const client = createPublicClient({ chain: base, transport: http(MAINNET_RPC) }) as PublicClient;
  const caps = (await getCapabilities(CHAIN_ID))[String(CHAIN_ID)];
  const usdc = pickPaymentToken({ [String(CHAIN_ID)]: caps }, CHAIN_ID, 'USDC');
  const targetAddress = caps.targetAddress;
  const feeCollector = caps.feeCollector;
  console.log(`relayer target ${targetAddress} · feeCollector ${feeCollector} · USDC ${usdc.address}`);

  const burnerEoa = privateKeyToAccount(envKey('ONESHOT_BURNER_PK'));
  const burnerWallet = createWalletClient({ account: burnerEoa, chain: base, transport: http(MAINNET_RPC) });
  const burnerSA = await toMetaMaskSmartAccount({
    client, implementation: Implementation.Stateless7702, address: burnerEoa.address,
    signer: { account: burnerEoa },
  });
  console.log(`burner ${burnerEoa.address} (7702 SA = same address)`);

  // (1) EIP-7702 authorization — only on first use (if not already upgraded).
  const code = (await client.getCode({ address: burnerEoa.address })) ?? '0x';
  let authorizationList: unknown[] | undefined;
  if (!is7702Upgraded(code as Hex)) {
    const nonce = await client.getTransactionCount({ address: burnerEoa.address, blockTag: 'pending' });
    const auth = await burnerEoa.signAuthorization({ chainId: CHAIN_ID, contractAddress: STATELESS_7702_IMPL, nonce });
    authorizationList = [{ address: auth.address, chainId: auth.chainId, nonce: auth.nonce, r: auth.r, s: auth.s, yParity: auth.yParity }];
    console.log('EIP-7702 authorization signed (first-use upgrade through 1Shot)');
  } else {
    console.log('burner already 7702-upgraded (0xef0100…) — no authorization needed');
  }

  // (2) one ERC-7710 delegation to the relayer covering BOTH the fee transfer and the castVote.
  const delegation = createDelegation({
    to: targetAddress,
    from: burnerSA.address,
    environment: burnerSA.environment,
    scope: {
      type: ScopeType.FunctionCall,
      targets: [usdc.address, governor],
      selectors: ['transfer(address,uint256)', 'castVote(uint256,uint8)'],
    },
  } as Parameters<typeof createDelegation>[0]);
  const signedDelegation = { ...delegation, signature: await burnerSA.signDelegation({ delegation }) };

  const castVoteData = encodeFunctionData({ abi: CASTVOTE_ABI, functionName: 'castVote', args: [proposalId, support] });
  const minFeeAtoms = parseUnits('0.01', Number(usdc.decimals)); // relayer minFee floor
  const execs = (fee: bigint) => [
    { target: usdc.address, value: '0', data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [feeCollector, fee] }) as Hex },
    { target: governor as Address, value: '0', data: castVoteData },
  ];

  // (3) estimate (free) — locks the fee/context.
  const estParams = buildSend7710Params({ chainId: CHAIN_ID, permissionContext: [signedDelegation], executions: execs(minFeeAtoms), authorizationList });
  const est = await estimate7710Transaction(estParams);
  if (!est.success) throw new Error(`estimate failed: ${JSON.stringify(est.error)}`);
  const feeAtoms = floorFee(BigInt(est.requiredPaymentAmount ?? '0'), minFeeAtoms);
  console.log(`\nestimate: requiredPayment ${Number(feeAtoms) / 1e6} USDC · gasUsed ${JSON.stringify(est.gasUsed)}`);

  if (estimateOnly) {
    console.log('\n--estimate only — no broadcast. Re-run without --estimate to relay the real vote.');
    return;
  }

  // (4) real send (spends the burner's USDC fee). destinationUrl registers the relayer's signed
  // Ed25519 webhook feed (the preferred status source); memo correlates the events.
  const sendParams = {
    ...buildSend7710Params({
      chainId: CHAIN_ID,
      permissionContext: [signedDelegation],
      executions: execs(feeAtoms),
      authorizationList,
      destinationUrl: webhookUrl,
      memo: `mandate-castVote-${proposalIdStr.slice(0, 8)}`,
    }),
    context: est.context,
  };
  const taskId = await send7710Transaction(sendParams);
  console.log(`\nsubmitted — taskId ${taskId}`);
  if (webhookUrl) console.log(`  webhook status feed registered → ${webhookUrl} (Ed25519-signed events)`);

  // (5) poll status to terminal (when a webhook is registered it is the primary feed; this loop
  // stays as the CLI's own confirmation).
  for (let i = 0; i < 60; i++) {
    const st = await getStatus(taskId);
    console.log(`  ${relayStatusLabel(st.status)} (${st.status})${st.hash ? ` · ${st.hash}` : ''}`);
    if (isTerminalStatus(st.status)) {
      if (st.status !== 200) throw new Error(`relay ${relayStatusLabel(st.status)}: ${st.message ?? ''}`);
      const upgraded = is7702Upgraded((await client.getCode({ address: burnerEoa.address })) as Hex);
      console.log(`\n✅ mainnet castVote relayed via 1Shot — tx ${st.hash}`);
      console.log(`   burner 7702-upgraded (0xef0100…): ${upgraded} · gas paid in USDC by the relayer`);
      return;
    }
    await sleep(3000);
  }
  throw new Error('relay did not reach a terminal status in time');
}

main().catch((e) => { console.error('\n1shot-vote FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1; });
