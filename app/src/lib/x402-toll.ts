import { build402 } from '@mandate/shared';
import type { Address } from 'viem';

/**
 * x402 pay-per-query toll, settled with a SCOPED ERC-7710 Erc20TransferAmount delegation.
 * The analyst's context feed charges 1 MVOTE per query; the buyer signs a delegation that lets
 * the seller pull AT MOST the toll, to itself, and nothing else. Mirrors packages/shared/x402.ts.
 */
export const TOLL_PRICE_ATOMS = 10n ** 18n; // 1 MVOTE per query (18 decimals)
export const TOLL_DECIMALS = 18;
export const TOLL_SYMBOL = 'MVOTE';
export const TOLL_RESOURCE = '/context/proposal-42';

/** The 402 -> sign-scope -> settle -> 200 toll lifecycle, shown as an animated stepper. */
export const X402_PHASES = [
  { key: 'require', code: 402 },
  { key: 'sign', code: null },
  { key: 'settle', code: null },
  { key: 'data', code: 200 },
] as const;

export type X402PhaseKey = (typeof X402_PHASES)[number]['key'];

/** Atoms -> trimmed decimal string (1500000000000000000n,18 -> "1.5"; 10n**18n,18 -> "1"). */
export function formatTokenAmount(atoms: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = atoms / base;
  const frac = atoms % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Build the real x402 (scheme erc7710) 402 challenge for the per-query data toll. */
export function tollChallenge(opts: { asset: Address; payTo: Address; chainId: number }) {
  return build402({
    asset: opts.asset,
    payTo: opts.payTo,
    amount: TOLL_PRICE_ATOMS,
    chainId: opts.chainId,
    resource: TOLL_RESOURCE,
  });
}
