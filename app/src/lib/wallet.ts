import {
  createPublicClient,
  http,
  type Address,
  type Hex,
  type WalletClient,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  getSmartAccountsEnvironment,
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';
import { buildPaymentDelegation, buildStandingVoteDelegation, withVotingPolicy, type Delegation } from '@mandate/shared';
import { CHAIN_ID, DEMO_PROPOSAL, RPC_URL } from './config';
import { DEFAULT_QUERY_BUDGET, TOLL_PRICE_ATOMS } from './x402-toll';

export type SmartAccount = Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;

/**
 * Derive the user's MetaMask smart account from a connected wagmi/viem WalletClient.
 * RainbowKit + wagmi own the EOA connection and EIP-6963 wallet selection; we wrap
 * that EOA wallet client as the signer for the Hybrid smart account.
 */
export async function deriveSmartAccount(walletClient: WalletClient): Promise<SmartAccount> {
  const address = walletClient.account?.address;
  if (!address) throw new Error('Wallet client has no account.');
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  // one physical viem, but the app + SAK resolve it via different pnpm symlinks → bridge with a cast
  return toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [address, [], [], []],
    deploySalt: '0x',
    signer: { walletClient },
  } as unknown as Parameters<typeof toMetaMaskSmartAccount>[0]);
}

export interface GrantTarget {
  governor: Address;
  proposalId: string;
  orchestratorSA: Address;
  /** the mUSDC token the AI's x402 budget is denominated in. */
  paymentToken: Address;
  /** the data-feed seller (analyst) that redeems the x402 budget. */
  analyst: Address;
  /** The proposal text the analyst privately evaluates in the Venice TEE (defaults to DEMO_PROPOSAL). */
  proposalText?: string;
  /** Standing-grant guardrails — user-configurable; omit one to bound only by the other. Baked on-chain. */
  maxVotes?: number;
  ttlDays?: number;
  /** Optional owner voting policy (from a preset) — joins the proposal text the TEE analyst weighs. */
  policy?: string;
}

/**
 * Build the root delegation (FunctionCall castVote scope: proposalId locked, support free) and
 * sign it with the connected wallet. Returns the grant payload to POST to the orchestrator.
 */
export async function signGrant(userSA: SmartAccount, target: GrantTarget) {
  const environment = getSmartAccountsEnvironment(CHAIN_ID);
  // STANDING grant: any proposal on this board, vote-only, revocable — bounded by the user's chosen
  // vote cap + validity window (baked into the caveats and enforced on-chain).
  const expiry = target.ttlDays != null ? Math.floor(Date.now() / 1000) + target.ttlDays * 24 * 60 * 60 : undefined;
  const root = buildStandingVoteDelegation({
    governor: target.governor,
    delegate: target.orchestratorSA,
    delegator: userSA.address,
    environment,
    maxVotes: target.maxVotes,
    expiry,
  });
  const signature = (await userSA.signDelegation({ delegation: root })) as Hex;
  const rootDelegation: Delegation = { ...root, signature };

  // SECOND signature — the AI's x402 budget: a CUMULATIVE Erc20TransferAmount delegation that lets the
  // data-feed seller pull AT MOST (maxVotes ?? DEFAULT_QUERY_BUDGET) x 1 mUSDC from YOUR smart account,
  // to the seller, and nothing else. Reused for every vote's toll; MVOTE voting power is never touched.
  const budgetQueries = BigInt(target.maxVotes ?? DEFAULT_QUERY_BUDGET);
  const payment = buildPaymentDelegation({
    buyer: userSA.address,
    seller: target.analyst,
    asset: target.paymentToken,
    amount: budgetQueries * TOLL_PRICE_ATOMS,
    environment,
  });
  const paymentSignature = (await userSA.signDelegation({ delegation: payment })) as Hex;
  const paymentDelegation: Delegation = { ...payment, signature: paymentSignature };

  return {
    chainId: CHAIN_ID,
    governor: target.governor,
    proposalId: target.proposalId,
    proposalText: withVotingPolicy(target.proposalText ?? DEMO_PROPOSAL, target.policy),
    rootDelegation,
    paymentDelegation,
  };
}
