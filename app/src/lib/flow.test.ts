import { describe, expect, it } from 'vitest';
import { grantDisabled, voteActiveDisabled } from './flow';

const base = { busy: false, hasConfig: true, connected: true, status: undefined as string | undefined, killed: false };

describe('grantDisabled', () => {
  it('disables Grant until a wallet is connected (the bug: it was clickable while disconnected)', () => {
    expect(grantDisabled({ ...base, connected: false })).toBe(true);
  });

  it('enables Grant once connected with config and no active run', () => {
    expect(grantDisabled(base)).toBe(false);
  });

  it('disables Grant while busy/signing', () => {
    expect(grantDisabled({ ...base, busy: true })).toBe(true);
  });

  it('disables while a run is in progress, re-enables to retry after a failed run', () => {
    expect(grantDisabled({ ...base, status: 'voting' })).toBe(true);
    expect(grantDisabled({ ...base, status: 'failed' })).toBe(false);
  });

  it('disables without demo config', () => {
    expect(grantDisabled({ ...base, hasConfig: false })).toBe(true);
  });

  it('stays disabled after the chain is killed', () => {
    expect(grantDisabled({ ...base, killed: true })).toBe(true);
  });
});

describe('voteActiveDisabled', () => {
  const base = { hasGrant: true, busy: false, running: false, killed: false };

  it('is disabled until a standing grant exists', () => {
    expect(voteActiveDisabled({ ...base, hasGrant: false })).toBe(true);
  });

  it('is enabled with a live grant and nothing in flight', () => {
    expect(voteActiveDisabled(base)).toBe(false);
  });

  it('is disabled while a vote is being posted', () => {
    expect(voteActiveDisabled({ ...base, busy: true })).toBe(true);
  });

  it('is disabled while a run is mid-flight (no double-fire)', () => {
    expect(voteActiveDisabled({ ...base, running: true })).toBe(true);
  });

  it('STAYS enabled after the chain is killed — the judge fires one more vote to watch it revert on-chain', () => {
    expect(voteActiveDisabled({ ...base, killed: true })).toBe(false);
    // killed overrides everything: even a lingering run does not lock the kill-switch proof
    expect(voteActiveDisabled({ ...base, killed: true, running: true })).toBe(false);
  });
});
