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
