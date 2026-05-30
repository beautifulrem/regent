import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type Hex,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  getSmartAccountsEnvironment,
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';
import { buildVoteDelegation, type Delegation } from '@mandate/shared';
import { CHAIN_ID, DEMO_PROPOSAL, RPC_URL } from './config';

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function injected(): Eip1193 {
  const eth = (globalThis as unknown as { ethereum?: Eip1193 }).ethereum;
  if (!eth) throw new Error('MetaMask not found — install it to grant.');
  return eth;
}

type SmartAccount = Awaited<ReturnType<typeof toMetaMaskSmartAccount>>;

export interface Connection {
  address: Address;
  userSA: SmartAccount;
}

/** Connect MetaMask and derive the user's MetaMask smart account (signs via the wallet). */
export async function connect(): Promise<Connection> {
  const eth = injected();
  const [address] = await createWalletClient({ chain: baseSepolia, transport: custom(eth) }).requestAddresses();
  const walletClient = createWalletClient({ account: address, chain: baseSepolia, transport: custom(eth) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
  // one physical viem, but the app + SAK resolve it via different pnpm symlinks → bridge with a cast
  const userSA = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [address, [], [], []],
    deploySalt: '0x',
    signer: { walletClient },
  } as unknown as Parameters<typeof toMetaMaskSmartAccount>[0]);
  return { address, userSA };
}

export interface GrantTarget {
  governor: Address;
  proposalId: string;
  orchestratorSA: Address;
}

/**
 * Build the root delegation (FunctionCall castVote scope: proposalId locked, support free) and
 * sign it with MetaMask. Returns the grant payload to POST to the orchestrator.
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
    proposalText: DEMO_PROPOSAL,
    rootDelegation,
  };
}
