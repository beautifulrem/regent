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
import { buildVoteDelegation, type Delegation } from '@mandate/shared';
import { CHAIN_ID, DEMO_PROPOSAL, RPC_URL } from './config';

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
  /** The proposal text the analyst privately evaluates in the Venice TEE (defaults to DEMO_PROPOSAL). */
  proposalText?: string;
}

/**
 * Build the root delegation (FunctionCall castVote scope: proposalId locked, support free) and
 * sign it with the connected wallet. Returns the grant payload to POST to the orchestrator.
 */
export async function signGrant(userSA: SmartAccount, target: GrantTarget) {
  const environment = getSmartAccountsEnvironment(CHAIN_ID);
  const root = buildVoteDelegation({
    governor: target.governor,
    proposalId: BigInt(target.proposalId),
    delegate: target.orchestratorSA,
    delegator: userSA.address,
    environment,
  });
  const signature = (await userSA.signDelegation({ delegation: root })) as Hex;
  const rootDelegation: Delegation = { ...root, signature };
  return {
    chainId: CHAIN_ID,
    governor: target.governor,
    proposalId: target.proposalId,
    proposalText: target.proposalText ?? DEMO_PROPOSAL,
    rootDelegation,
  };
}
