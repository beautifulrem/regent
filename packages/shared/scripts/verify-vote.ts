/**
 * VB-7 end-to-end verification: run the full judge flow with FAUCET_PK (a funded test wallet)
 * against the live orchestrator + deployed VoteBoard, so the whole path is proven without a
 * browser/MetaMask step. Provisions the SA, signs the scoped one-vote grant, posts it, polls the
 * run, and reads the on-chain tally before/after.
 *
 *   FAUCET_PK=0x… ORCH=http://localhost:8787 pnpm tsx packages/shared/scripts/verify-vote.ts
 */
import { createPublicClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  getSmartAccountsEnvironment,
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';
import {
  ADDRESSES,
  DEMO_PROPOSAL_ID,
  VOTE_BOARD_ABI,
  VOTE_BOARD_ADDRESS,
  buildVoteDelegation,
  type Delegation,
} from '../src/index.js';

const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';
const ORCH = process.env.ORCH || 'http://localhost:8787';
const PK = process.env.FAUCET_PK as Hex;

const PROPOSAL_TEXT =
  'Proposal: renew the core-dev team budget at 12,000 USDC/quarter, released against public ' +
  'monthly milestone reports via a 2-of-3 multisig, with an unspent-funds clawback. Approve?';

async function tally(client: ReturnType<typeof createPublicClient>) {
  const [against, forV, abstain] = (await client.readContract({
    address: VOTE_BOARD_ADDRESS,
    abi: VOTE_BOARD_ABI,
    functionName: 'getTally',
    args: [DEMO_PROPOSAL_ID],
  })) as [bigint, bigint, bigint];
  const count = (await client.readContract({
    address: VOTE_BOARD_ADDRESS,
    abi: VOTE_BOARD_ABI,
    functionName: 'voterCount',
    args: [DEMO_PROPOSAL_ID],
  })) as bigint;
  return { against: Number(against), for: Number(forV), abstain: Number(abstain), voters: Number(count) };
}

async function main() {
  if (!PK) throw new Error('FAUCET_PK not set');
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
  const eoa = privateKeyToAccount(PK);
  const sa = await toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Hybrid,
    deployParams: [eoa.address, [], [], []],
    deploySalt: '0x',
    signer: { account: eoa },
  });
  console.log(`judge EOA ${eoa.address}  ->  SA ${sa.address}`);
  console.log(`VoteBoard ${VOTE_BOARD_ADDRESS}`);

  console.log('\n[1/5] tally BEFORE:', await tally(client));

  console.log('[2/5] provision (deploy SA)…');
  const prov = await fetch(`${ORCH}/provision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eoa: eoa.address }),
  }).then((r) => r.json());
  console.log('       ', prov);

  console.log('[3/5] sign one-vote grant scoped to VoteBoard…');
  const environment = getSmartAccountsEnvironment(baseSepolia.id);
  const root = buildVoteDelegation({
    governor: VOTE_BOARD_ADDRESS,
    proposalId: DEMO_PROPOSAL_ID,
    delegate: ADDRESSES.accounts.orchestrator as Address,
    delegator: sa.address,
    environment,
  });
  const signature = (await sa.signDelegation({ delegation: root })) as Hex;
  const rootDelegation: Delegation = { ...root, signature };

  console.log('[4/5] POST /grant…');
  const { runId } = await fetch(`${ORCH}/grant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chainId: 84532,
      governor: VOTE_BOARD_ADDRESS,
      proposalId: DEMO_PROPOSAL_ID.toString(),
      proposalText: PROPOSAL_TEXT,
      rootDelegation,
    }),
  }).then((r) => r.json());
  console.log('        runId', runId);

  for (let i = 0; i < 45; i++) {
    const run = await fetch(`${ORCH}/run/${runId}`).then((r) => r.json());
    const extra = run.vote?.txHash ? `vote ${run.vote.txHash}` : run.error ? JSON.stringify(run.error) : '';
    console.log(`        status=${run.status} ${run.venice?.decision ?? ''} ${extra}`);
    if (['voted', 'failed', 'revoked'].includes(run.status)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  const myVote = (await client.readContract({
    address: VOTE_BOARD_ADDRESS,
    abi: VOTE_BOARD_ABI,
    functionName: 'getVote',
    args: [DEMO_PROPOSAL_ID, sa.address],
  })) as number;
  const labels = ['not voted', 'Against', 'For', 'Abstain'];
  console.log('\n[5/5] tally AFTER :', await tally(client));
  console.log(`       your SA vote: ${labels[Number(myVote)] ?? myVote}`);
}

main().catch((e) => {
  console.error('verify-vote FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
