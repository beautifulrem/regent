import { describe, expect, it } from 'vitest';
import { grantDisabled } from './flow';

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
