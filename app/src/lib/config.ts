export const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? 'http://localhost:8787';
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-sepolia-rpc.publicnode.com';
export const CHAIN_ID = 84532;
export const BASESCAN = 'https://sepolia.basescan.org';

/** The governance proposal the analyst privately evaluates in the Venice TEE. */
export const DEMO_PROPOSAL =
  'Proposal: renew the core-dev team budget at 12,000 USDC/quarter, released against public ' +
  'monthly milestone reports via a 2-of-3 multisig, with an unspent-funds clawback. ' +
  'Should the DAO approve?';

export const shortHex = (s?: string, n = 4): string =>
  s ? `${s.slice(0, 2 + n)}…${s.slice(-n)}` : '—';
