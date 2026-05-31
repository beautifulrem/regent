import { DEMO_PERSONAS, type Persona } from '@mandate/shared';

export interface TallyBreakdown {
  against: number;
  for_: number;
  abstain: number;
  total: number;
  pct: { against: number; for_: number; abstain: number };
}

/** Pure tally math for the live bars (rounded percentages, NaN-safe at zero total). */
export function tallyBreakdown(against: number, for_: number, abstain: number): TallyBreakdown {
  const total = against + for_ + abstain;
  const pctOf = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return {
    against,
    for_,
    abstain,
    total,
    pct: { against: pctOf(against), for_: pctOf(for_), abstain: pctOf(abstain) },
  };
}

/** Tally from a per-proposal seed array (0 Against, 1 For, 2 Abstain) — the pre-read fallback. */
export function tallyFromSeed(seed: readonly number[]): TallyBreakdown {
  let a = 0;
  let f = 0;
  let ab = 0;
  for (const s of seed) {
    if (s === 0) a++;
    else if (s === 1) f++;
    else ab++;
  }
  return tallyBreakdown(a, f, ab);
}

/** The seeded-persona tally — the fallback scene shown before the board is deployed/read. */
export function personaTally(personas: readonly Persona[] = DEMO_PERSONAS): TallyBreakdown {
  let a = 0;
  let f = 0;
  let ab = 0;
  for (const p of personas) {
    if (p.support === 0) a++;
    else if (p.support === 1) f++;
    else ab++;
  }
  return tallyBreakdown(a, f, ab);
}
