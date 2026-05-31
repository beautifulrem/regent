import { describe, it, expect } from 'vitest';
import { tallyBreakdown, personaTally } from './voteboard-view';

describe('tallyBreakdown', () => {
  it('sums totals and rounds percentages', () => {
    const b = tallyBreakdown(1, 3, 1);
    expect(b.total).toBe(5);
    expect(b.pct.for_).toBe(60);
    expect(b.pct.against).toBe(20);
    expect(b.pct.abstain).toBe(20);
  });

  it('zero total yields zero percentages (no NaN)', () => {
    const b = tallyBreakdown(0, 0, 0);
    expect(b.total).toBe(0);
    expect(b.pct).toEqual({ against: 0, for_: 0, abstain: 0 });
  });
});

describe('personaTally', () => {
  it('matches the seeded 3 For / 1 Against / 1 Abstain', () => {
    const b = personaTally();
    expect(b.for_).toBe(3);
    expect(b.against).toBe(1);
    expect(b.abstain).toBe(1);
    expect(b.total).toBe(5);
  });
});
