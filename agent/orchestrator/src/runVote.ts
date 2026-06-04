/**
 * The orchestrator's autonomous loop for one grant. For each proposal it:
 *   1. signs a FRESH per-proposal-narrowed redelegation (orchestrator → analyst) that LOCKS this
 *      proposalId (support stays free) — real attenuation: the analyst only ever holds "vote on
 *      THIS proposal", while the broad standing root stays with the orchestrator;
 *   2. FANS OUT the proposal to the four governance lenses (fiscal / growth / security /
 *      participation), each a private Venice TEE analysis under that mandate;
 *   3. SYNTHESIZES the four verdicts into one final decision (the coordinator's TEE pass);
 *   4. hands the narrowed chain + final support to the analyst (caster) to redeem on-chain.
 *
 * The standing root + the orchestrator smart account are cached per runId, so further proposals
 * reuse them with NO new user signature — only the on-chain LimitedCalls + Timestamp caveats on the
 * root (and a revoke) bound/stop it.
 */
import { createPublicClient, createWalletClient, http, type Address, type Hex, type PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getSmartAccountsEnvironment, Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import {
  analyzeProposal,
  delegationHash,
  delegationManagerAddress,
  fetchAttestation,
  LENSES,
  redelegateVote,
  resolveModel,
  synthesizeVerdict,
  toVeniceTrace,
  withVotingPolicy,
  type Delegation,
  type GrantRequest,
  type LensInput,
  type LensVerdict,
  type TollReceipt,
  type VeniceConfig,
} from '@mandate/shared';
import { castVote } from '@mandate/analyst';
import type { RunStore } from './runStore.js';
import { settleToll } from './toll.js';

export interface OrchestratorConfig {
  rpcUrl: string;
  orchestratorPk: Hex;
  analystPk: Hex;
  /** the mUSDC token the x402 toll is paid in (the MVOTE voting token is never spent). */
  paymentToken: Address;
  veniceCfg: VeniceConfig;
}

type OrchSmartAccount = Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;

/** The standing chain for a grant: the broad root + the orchestrator SA that re-delegates from it.
 *  Cached so further proposals reuse them (no re-sign); each proposal still gets a fresh narrow redel. */
interface ChainBundle {
  root: Delegation;
  /** the user-signed CUMULATIVE x402 payment delegation (userSA -> analyst), reused for every toll. */
  paymentDelegation: Delegation;
  orchSA: OrchSmartAccount;
  governor: Address;
  chainId: number;
}
const chains = new Map<string, ChainBundle>();

/** The cached standing chain's metadata for a run (undefined if it can't vote-again). */
export function chainMeta(runId: string): { chainId: number; governor: Address } | undefined {
  const b = chains.get(runId);
  return b ? { chainId: b.chainId, governor: b.governor } : undefined;
}

/**
 * One proposal, end-to-end: narrow → fan-out → synthesize → cast.
 */
async function cast(
  store: RunStore,
  runId: string,
  bundle: ChainBundle,
  proposalId: bigint,
  proposalText: string,
  cfg: OrchestratorConfig,
): Promise<void> {
  const client = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) }) as PublicClient;
  const dm = delegationManagerAddress(bundle.chainId);
  const environment = getSmartAccountsEnvironment(bundle.chainId);
  const analystEoa = privateKeyToAccount(cfg.analystPk);

  // 1) PER-PROPOSAL NARROWING — sign a redel locked to THIS proposalId (support left free, so the
  //    analyst can only cast on this one proposal; the broad "any proposal" power stays at the root).
  const narrowRedel = redelegateVote({
    governor: bundle.governor,
    proposalId,
    delegate: analystEoa.address,
    delegator: bundle.orchSA.address,
    environment,
    parentDelegation: bundle.root,
  });
  const redelSigned = {
    ...narrowRedel,
    signature: (await bundle.orchSA.signDelegation({ delegation: narrowRedel })) as Hex,
  } as Delegation;
  store.patch(runId, { status: 'redelegated', redelegationHash: delegationHash(redelSigned, bundle.chainId, dm) });

  // 2) FAN-OUT — four governance lenses in parallel (one private TEE analysis each, under its mandate).
  //    Resolve the TEE model once and reuse it across all five completions (4 lenses + synthesis).
  store.patch(runId, { status: 'analyzing' });
  const model = await resolveModel(cfg.veniceCfg);
  const lensResults = await Promise.all(
    LENSES.map(async (lens) => ({
      lens,
      analysis: await analyzeProposal(cfg.veniceCfg, withVotingPolicy(proposalText, lens.policy), model),
    })),
  );
  const lenses: LensVerdict[] = lensResults.map(({ lens, analysis }) => ({
    lens: lens.key,
    model: analysis.model,
    support: analysis.decision.support,
    decision: analysis.decision.decision,
    rationale: analysis.decision.rationale,
    reasoning: analysis.reasoning,
    teeVerified: analysis.tee.verified,
  }));
  store.patch(runId, { lenses });

  // 3) SYNTHESIS — the coordinator's TEE pass reads the four verdicts + the proposal → final decision.
  const inputs: LensInput[] = lensResults.map(({ lens, analysis }) => ({
    label: lens.label,
    decision: analysis.decision.decision,
    rationale: analysis.decision.rationale,
  }));
  const synthesis = await synthesizeVerdict(cfg.veniceCfg, proposalText, inputs, model);
  const attestation = await fetchAttestation(cfg.veniceCfg, synthesis.model).catch(() => undefined);
  store.patch(runId, { status: 'decided', venice: toVeniceTrace(synthesis, attestation), lenses });

  // 4) CAST — the analyst (caster) pre-flights + broadcasts the synthesized support via the narrow chain.
  store.patch(runId, { status: 'voting' });
  const analystWallet = createWalletClient({ account: analystEoa, chain: baseSepolia, transport: http(cfg.rpcUrl) });
  const vote = await castVote(
    { publicClient: client, analystWallet, analystAccount: analystEoa, delegationManager: dm },
    { chain: [redelSigned, bundle.root], governor: bundle.governor, proposalId, support: synthesis.decision.support },
  );

  // 5) x402 PAY-PER-QUERY — settle the REAL toll for this query BEFORE flipping to 'voted', so the
  //    terminal status the client polls already carries it (the client stops polling once it sees
  //    'voted'). The analyst's context feed pulls 1 mUSDC from the USER's smart account via the
  //    cumulative scoped ERC-7710 delegation the user signed at grant. Non-fatal: a missing toll
  //    never blocks an already-cast vote (e.g. budget exhausted, or paymentToken not deployed yet).
  let toll: TollReceipt | undefined;
  try {
    toll = await settleToll(client, bundle.paymentDelegation, proposalId, {
      rpcUrl: cfg.rpcUrl,
      analystPk: cfg.analystPk,
      paymentToken: cfg.paymentToken,
      chainId: bundle.chainId,
    });
  } catch (err) {
    console.error('x402 toll settlement failed (non-fatal):', err instanceof Error ? err.message : err);
  }
  store.patch(runId, { status: 'voted', vote, ...(toll ? { toll } : {}) });
}

/** Establish the STANDING mandate for a grant: cache the broad chain (root + orchestrator SA). It does
 *  NOT cast a vote — granting the authority and exercising it are separated. The actual vote is an
 *  explicit user action ("let AI vote on this proposal") → voteAgain, which reuses this cached chain. */
export async function runVote(
  store: RunStore,
  runId: string,
  grant: GrantRequest,
  cfg: OrchestratorConfig,
): Promise<void> {
  try {
    const client = createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl) }) as PublicClient;
    const orchEoa = privateKeyToAccount(cfg.orchestratorPk);
    const orchSA = await toMetaMaskSmartAccount({
      client,
      implementation: Implementation.Hybrid,
      deployParams: [orchEoa.address, [], [], []],
      deploySalt: '0x',
      signer: { account: orchEoa },
    });
    const bundle: ChainBundle = {
      root: grant.rootDelegation as unknown as Delegation,
      paymentDelegation: grant.paymentDelegation as unknown as Delegation,
      orchSA,
      governor: grant.governor as Address,
      chainId: grant.chainId,
    };
    chains.set(runId, bundle);
    // Standing mandate established — the run rests at 'granted'. No vote is cast here; the user
    // triggers each vote explicitly via "let AI vote on this proposal" (→ voteAgain).
  } catch (err) {
    store.patch(runId, {
      status: 'failed',
      error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) },
    });
  }
}

/** Vote again on a NEW proposal reusing the cached standing chain — NO new user signature. A fresh
 *  per-proposal narrow redel is signed each time. Reverts on-chain (→ run 'failed') if the grant is
 *  exhausted (LimitedCalls), expired (Timestamp), or revoked (disableDelegation) — the kill switch. */
export async function voteAgain(
  store: RunStore,
  fromRunId: string,
  newRunId: string,
  proposalId: bigint,
  proposalText: string,
  cfg: OrchestratorConfig,
): Promise<void> {
  try {
    const bundle = chains.get(fromRunId);
    if (!bundle) throw new Error(`no standing chain cached for run ${fromRunId}`);
    chains.set(newRunId, bundle); // re-votes can continue from the new run too
    await cast(store, newRunId, bundle, proposalId, proposalText, cfg);
  } catch (err) {
    store.patch(newRunId, {
      status: 'failed',
      error: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) },
    });
  }
}
