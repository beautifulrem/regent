// Pure UI-gating logic for the Grant action, extracted so it can be unit-tested.
// The DOM/JSX wiring lives in page.tsx.

export interface GrantGateState {
  busy: boolean;
  hasConfig: boolean;
  connected: boolean;
  status?: string;
  killed: boolean;
}

/**
 * Whether the "Grant" button is disabled. It must require a connected wallet
 * first — otherwise the click silently triggered connect() and stuck the button
 * on "signing…" with no error — plus loaded demo config, no in-flight run, and a
 * live (non-killed) chain. A failed run re-enables it so the user can retry.
 */
export function grantDisabled({ busy, hasConfig, connected, status, killed }: GrantGateState): boolean {
  return busy || !hasConfig || !connected || (!!status && status !== 'failed') || killed;
}

export interface VoteActiveGateState {
  hasGrant: boolean;
  busy: boolean;
  running: boolean;
  killed: boolean;
}

/**
 * Whether the "let the agent vote this proposal" action is disabled. It needs an existing
 * standing grant and nothing in flight — BUT it stays ENABLED once the chain is killed, so the
 * judge can fire one more vote and watch the redemption get rejected on-chain (the kill-switch
 * proof). A killed chain therefore overrides the in-flight lock.
 */
export function voteActiveDisabled({ hasGrant, busy, running, killed }: VoteActiveGateState): boolean {
  if (!hasGrant) return true;
  if (busy) return true;
  if (killed) return false;
  return running;
}
