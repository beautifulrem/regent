import { beforeEach, describe, expect, it, vi } from 'vitest';

// Pure-logic coverage for the mute state machine + the no-window safety of every cue.
// Real audio output is verified manually in the browser (vitest runs in node, no AudioContext).

async function freshSfx() {
  vi.resetModules();
  return import('./sfx');
}

describe('sfx mute state', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to unmuted when no storage exists and toggles in memory', async () => {
    const sfx = await freshSfx();
    expect(sfx.sfxMuted()).toBe(false);
    expect(sfx.toggleSfxMuted()).toBe(true);
    expect(sfx.sfxMuted()).toBe(true);
    expect(sfx.toggleSfxMuted()).toBe(false);
  });

  it('notifies subscribers on toggle and stops after unsubscribe', async () => {
    const sfx = await freshSfx();
    const seen: boolean[] = [];
    const unsub = sfx.subscribeSfx(() => seen.push(sfx.sfxMuted()));
    sfx.toggleSfxMuted();
    expect(seen).toEqual([true]);
    unsub();
    sfx.toggleSfxMuted();
    expect(seen).toEqual([true]);
  });

  it('reads a persisted mute and writes the toggle back', async () => {
    const store = new Map<string, string>();
    store.set('mandate.sfx.muted', '1');
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const sfx = await freshSfx();
    expect(sfx.sfxMuted()).toBe(true);
    sfx.toggleSfxMuted();
    expect(store.get('mandate.sfx.muted')).toBe('0');
  });

  it('survives a throwing storage (private mode)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    const sfx = await freshSfx();
    expect(sfx.sfxMuted()).toBe(false);
    expect(() => sfx.toggleSfxMuted()).not.toThrow();
  });
});

describe('sfx cues without an AudioContext', () => {
  it('every cue is a safe no-op in node', async () => {
    const sfx = await freshSfx();
    expect(() => {
      sfx.sfxPress();
      sfx.sfxTick();
      sfx.sfxGrant();
      sfx.sfxVote();
      sfx.sfxCoin();
      sfx.sfxDenied();
      sfx.sfxSever();
      sfx.sfxRelay();
    }).not.toThrow();
  });
});
