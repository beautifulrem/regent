// Voting-stance presets — one-click "give your AI voter a stance". Each sets sensible bounds AND an
// owner voting policy passed to the Venice TEE analyst as decision context (the model still decides
// For/Against/Abstain; the policy is a preference it weighs). The policy text is English — it joins
// the proposal text the analyst evaluates, which is sent in English. The "default" stance is the
// no-policy baseline (decide on merits) and is handled in page.tsx, so it isn't listed here.
//
// The set is intentionally two opposing pairs so the stance visibly changes the vote: fiscal ↔ growth
// disagree on big spends; security ↔ participation disagree on lowering the quorum.

export type PresetKey = 'fiscal' | 'growth' | 'security' | 'participation';

export interface VotePreset {
  key: PresetKey;
  maxVotes: number;
  ttlDays: number;
  policy: string;
}

export const VOTE_PRESETS: VotePreset[] = [
  {
    key: 'fiscal',
    maxVotes: 10,
    ttlDays: 30,
    policy:
      'Act as a treasury guardian: favour lean, milestone-gated, clawback-protected spending; lean Against unaudited, open-ended or oversized spends.',
  },
  {
    key: 'growth',
    maxVotes: 10,
    ttlDays: 30,
    policy:
      'Act as a growth advocate: favour credible, accountable proposals that grow liquidity, ecosystem activity or participation; lean For on accountable growth spends.',
  },
  {
    key: 'security',
    maxVotes: 10,
    ttlDays: 30,
    policy:
      'Act as a protocol-security reviewer: favour audits, conservative parameters and safety controls; lean Against changes that raise systemic or smart-contract risk.',
  },
  {
    key: 'participation',
    maxVotes: 10,
    ttlDays: 30,
    policy:
      'Act as a participation advocate: favour lower barriers, broader voter access and responsible delegation, while preserving clear accountability.',
  },
];

export const presetFor = (key: string | null): VotePreset | undefined =>
  VOTE_PRESETS.find((p) => p.key === key);
