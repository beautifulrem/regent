import type { Address, Hex } from 'viem';

export interface Seven702Code {
  upgraded: boolean;
  implementation?: string;
}

/** EIP-7702 upgraded account code is `0xef0100 || <20-byte delegate>`. Extract the delegate. */
export function parse7702Code(code: string | null | undefined): Seven702Code {
  if (typeof code === 'string' && code.toLowerCase().startsWith('0xef0100') && code.length >= 48) {
    return { upgraded: true, implementation: ('0x' + code.slice(8, 48)).toLowerCase() };
  }
  return { upgraded: false };
}

/**
 * Pinned, REAL Base-mainnet evidence from the live 1Shot permissionless relay (see EVIDENCE.md).
 * The finale replays it honestly: the eth_getCode 7702 check is genuinely live (free, read-only,
 * no wallet, no gas); the castVote tx + USDC fee are the real on-chain artifacts.
 */
export const MAINNET_PROOF = {
  chainId: 8453,
  rpc: 'https://base-rpc.publicnode.com',
  basescan: 'https://basescan.org',
  burner: '0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991' as Address,
  castVoteTx: '0x3b5448aaac605e1416be48e238c12a755532b762d392dd70f4025e5a152a6a07' as Hex,
  governor: '0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5' as Address,
  delegationManager: '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3' as Address,
  feeUsdc: '0.01',
} as const;

/** 1Shot relay status phases (codes mirror oneshot.ts STATUS_LABEL) shown in the stepper. */
export const RELAY_PHASES = [
  { code: 100, key: 'pending' },
  { code: 110, key: 'submitted' },
  { code: 200, key: 'confirmed' },
] as const;
