/**
 * @mandate/analyst — the analyst agent. It privately analyses a proposal in a Venice TEE,
 * decides the OZ `support`, and casts the vote by redeeming the delegation chain it was given.
 */
import type { Account, Address, PublicClient, WalletClient } from 'viem';
import {
  analyzeProposal,
  fetchAttestation,
  redeemVoteCalldata,
  toVeniceTrace,
  type Delegation,
  type VeniceConfig,
  type VeniceTrace,
  type VoteReceipt,
} from '@mandate/shared';

export interface AnalystDeps {
  publicClient: PublicClient;
  analystWallet: WalletClient;
  analystAccount: Account;
  delegationManager: Address;
  veniceCfg: VeniceConfig;
}

export interface AnalystRequest {
  /** the signed delegation chain, leaf→root (analyst is the leaf). */
  chain: Delegation[];
  governor: Address;
  proposalId: bigint;
  proposalText: string;
}

export interface AnalystResult {
  trace: VeniceTrace;
  vote: VoteReceipt;
}

/**
 * Decide support privately in the Venice TEE and cast it by redeeming the chain. The cast
 * support is exactly what Venice decided — never hardcoded.
 */
export async function runAnalystVote(deps: AnalystDeps, req: AnalystRequest): Promise<AnalystResult> {
  const analysis = await analyzeProposal(deps.veniceCfg, req.proposalText);
  const attestation = await fetchAttestation(deps.veniceCfg, analysis.model).catch(() => undefined);
  const trace = toVeniceTrace(analysis, attestation);

  const redeemData = redeemVoteCalldata({
    chain: req.chain,
    governor: req.governor,
    proposalId: req.proposalId,
    support: analysis.decision.support,
  });
  const txHash = await deps.analystWallet.sendTransaction({
    account: deps.analystAccount,
    chain: deps.analystWallet.chain,
    to: deps.delegationManager,
    data: redeemData,
  });
  const receipt = await deps.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error(`analyst vote tx reverted: ${txHash}`);

  const vote: VoteReceipt = {
    txHash,
    support: analysis.decision.support,
    blockNumber: receipt.blockNumber.toString(),
    relay: 'direct',
  };
  return { trace, vote };
}
