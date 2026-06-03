// Pure run-state helpers shared by the orchestrator page, the authority chain, and panels.
// Lifted out of page.tsx so the mission components can import them without a cycle.

/** The happy-path run order. `reached` also treats 'revoked' as past every step. */
export const ORDER = ['granted', 'redelegated', 'analyzing', 'decided', 'voting', 'voted'] as const;

/** True once status `s` has reached or passed `target` (or has been revoked). */
export function reached(s: string | undefined, target: string): boolean {
  if (s == null) return false;
  if (s === 'revoked') return true;
  return ORDER.indexOf(s as (typeof ORDER)[number]) >= ORDER.indexOf(target as (typeof ORDER)[number]);
}

/** Venice verdict → tone (For=green, Against=red, Abstain=amber). */
export const decisionTone = (d?: string): 'ok' | 'bad' | 'warn' =>
  d === 'For' ? 'ok' : d === 'Against' ? 'bad' : 'warn';

/** Run status → tone for the status badge. */
export const statusTone = (status: string): 'ok' | 'bad' | 'warn' =>
  status === 'voted' ? 'ok' : status === 'failed' || status === 'revoked' ? 'bad' : 'warn';

/** Shared overshoot easing for mission-control motion. */
export const EASE_FLUID: [number, number, number, number] = [0.16, 1, 0.3, 1];
