import { describe, it, expect } from 'vitest';
import { LENSES, lensFor } from './lenses.js';
import { LENS_KEYS, LensVerdictSchema } from './api.js';
import { buildSynthesisUser } from './venice.js';

describe('lenses', () => {
  it('defines exactly the four LENS_KEYS, each with a non-empty policy + label', () => {
    expect(LENSES.map((l) => l.key)).toEqual([...LENS_KEYS]);
    for (const l of LENSES) {
      expect(l.policy.length).toBeGreaterThan(0);
      expect(l.label.length).toBeGreaterThan(0);
    }
  });

  it('lensFor resolves a known key and returns undefined otherwise', () => {
    expect(lensFor('security')?.label.toLowerCase()).toContain('security');
    expect(lensFor('nope')).toBeUndefined();
  });
});

describe('buildSynthesisUser', () => {
  it('includes the proposal and one line per lens verdict', () => {
    const user = buildSynthesisUser('Renew the budget?', [
      { label: 'Fiscal / treasury guardian', decision: 'For', rationale: 'milestone-gated' },
      { label: 'Protocol-security reviewer', decision: 'Against', rationale: 'no audit' },
    ]);
    expect(user).toContain('Renew the budget?');
    expect(user).toContain('Fiscal / treasury guardian: For — milestone-gated');
    expect(user).toContain('Protocol-security reviewer: Against — no audit');
  });

  it('tolerates an empty rationale', () => {
    const user = buildSynthesisUser('P', [{ label: 'Growth advocate', decision: 'Abstain', rationale: '' }]);
    expect(user).toContain('Growth advocate: Abstain — (no rationale)');
  });
});

describe('LensVerdictSchema', () => {
  it('accepts a consistent verdict', () => {
    const ok = LensVerdictSchema.safeParse({
      lens: 'fiscal', model: 'e2ee-x', support: 1, decision: 'For', rationale: 'ok', teeVerified: true,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a support/decision mismatch', () => {
    const bad = LensVerdictSchema.safeParse({
      lens: 'fiscal', model: 'e2ee-x', support: 0, decision: 'For', rationale: 'x', teeVerified: true,
    });
    expect(bad.success).toBe(false);
  });

  it('rejects an unknown lens key', () => {
    const bad = LensVerdictSchema.safeParse({
      lens: 'whatever', model: 'e2ee-x', support: 1, decision: 'For', rationale: 'x', teeVerified: true,
    });
    expect(bad.success).toBe(false);
  });
});
