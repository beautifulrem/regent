import { describe, expect, it } from 'vitest';
import { withVotingPolicy } from './venice.js';

describe('withVotingPolicy', () => {
  const proposal = 'Proposal: fund the X working group with 10k USDC for Q3.';

  it('returns the proposal unchanged when no policy is given (default flow is untouched)', () => {
    expect(withVotingPolicy(proposal)).toBe(proposal);
    expect(withVotingPolicy(proposal, '')).toBe(proposal);
    expect(withVotingPolicy(proposal, '   ')).toBe(proposal);
  });

  it('appends the owner mandate as clearly-labelled context, preserving the proposal text', () => {
    const out = withVotingPolicy(proposal, 'Favour spending discipline and milestone-gated releases.');
    expect(out.startsWith(proposal)).toBe(true);
    expect(out).toMatch(/owner/i);
    expect(out).toContain('Favour spending discipline and milestone-gated releases.');
    // the model is told it still decides — the policy is context, not a hardcoded vote
    expect(out).toMatch(/still decide/i);
  });

  it('trims the policy', () => {
    const out = withVotingPolicy(proposal, '  be cautious  ');
    expect(out).toContain('"be cautious"');
  });
});
