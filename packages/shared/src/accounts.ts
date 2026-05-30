/**
 * The demo accounts Mandate needs, how each is derived, and how each must be funded.
 *
 * Pure helpers (role config + EOA derivation) are unit-tested. Smart-account derivation
 * and balance/funding live in the bootstrap script (needs an RPC + the user's keys).
 */
import { privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex, PublicClient } from 'viem';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

export type AccountKind = 'smartAccount' | 'eoa';

export interface AccountRole {
  /** stable id used in env + addresses.ts */
  id: string;
  /** human label */
  label: string;
  /** env var holding this account's private key */
  envKey: string;
  /** a plain EOA, or an EOA that signs a derived MetaMask smart account */
  kind: AccountKind;
  /** minimum Base Sepolia ETH to fund (for gas) */
  fundEthMin: number;
  /** minimum Base Sepolia USDC to fund (0 if none) */
  fundUsdcMin: number;
  /** why this account exists in the flow */
  purpose: string;
}

/** The five accounts the demo flow needs. Order is stable (used by the bootstrap script). */
export const ACCOUNT_ROLES: readonly AccountRole[] = [
  {
    id: 'userDemo', label: 'User (demo)', envKey: 'USER_DEMO_PK', kind: 'smartAccount',
    fundEthMin: 0.02, fundUsdcMin: 0,
    purpose: 'root delegator — grants the governance delegation and holds voting power at the proposal snapshot',
  },
  {
    id: 'orchestrator', label: 'Orchestrator agent', envKey: 'ORCHESTRATOR_PK', kind: 'smartAccount',
    fundEthMin: 0.02, fundUsdcMin: 0,
    purpose: 'signs the attenuated redelegation to the analyst (must be a smart account)',
  },
  {
    id: 'analyst', label: 'Analyst agent', envKey: 'ANALYST_PK', kind: 'eoa',
    fundEthMin: 0.02, fundUsdcMin: 0,
    purpose: 'leaf delegate — submits redeemDelegations to cast the vote',
  },
  {
    id: 'veniceWallet', label: 'Venice USDC wallet', envKey: 'VENICE_WALLET_PK', kind: 'eoa',
    fundEthMin: 0.005, fundUsdcMin: 5,
    purpose: 'funds Venice inference via prepaid x402 top-up',
  },
  {
    id: 'oneShotBurner', label: '1Shot burner EOA', envKey: 'ONESHOT_BURNER_PK', kind: 'eoa',
    fundEthMin: 0, fundUsdcMin: 0,
    purpose: 'fresh EOA upgraded to a 7702 smart account THROUGH 1Shot on the mainnet leg (gas paid in USDC)',
  },
] as const;

/** Pure: the checksummed EOA address for a private key. */
export function eoaAddress(privateKey: Hex): Address {
  return privateKeyToAccount(privateKey).address;
}

/** Look up a role by id. Throws if unknown. */
export function getRole(id: string): AccountRole {
  const role = ACCOUNT_ROLES.find((r) => r.id === id);
  if (!role) throw new Error(`Unknown account role: ${id}`);
  return role;
}

/** A role's current on-chain balances (human units, not wei). */
export interface AccountBalance {
  eth: number;
  usdc: number;
}

/** What one role still needs before the demo can run. */
export interface FundingNeed {
  id: string;
  label: string;
  address?: Address;
  needEth: number;
  needUsdc: number;
  funded: boolean;
}

/**
 * Pure: given each role's derived address and current balances, compute the
 * funding matrix — how much ETH/USDC each account still needs. Missing balances
 * are treated as zero (i.e. "needs the full minimum").
 */
export function fundingPlan(
  addresses: Partial<Record<string, Address>>,
  balances: Partial<Record<string, AccountBalance>>,
): FundingNeed[] {
  return ACCOUNT_ROLES.map((role) => {
    const balance = balances[role.id] ?? { eth: 0, usdc: 0 };
    const needEth = Math.max(0, round6(role.fundEthMin - balance.eth));
    const needUsdc = Math.max(0, round6(role.fundUsdcMin - balance.usdc));
    return {
      id: role.id,
      label: role.label,
      address: addresses[role.id],
      needEth,
      needUsdc,
      funded: needEth === 0 && needUsdc === 0,
    };
  });
}

/** Avoid float dust (e.g. 0.02 - 0.0199999) showing up as a tiny positive need. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Derive the counterfactual MetaMask Hybrid smart-account address for a signer key.
 * (Address is deterministic; the account is deployed on first redemption.)
 */
export async function deriveSmartAccountAddress(
  client: PublicClient,
  signerPrivateKey: Hex,
): Promise<Address> {
  const account = privateKeyToAccount(signerPrivateKey);
  const smartAccount = await toMetaMaskSmartAccount({
    client,
    implementation: Implementation.Hybrid,
    deployParams: [account.address, [], [], []],
    deploySalt: '0x',
    signer: { account },
  });
  return smartAccount.address;
}
