// Voting-mandate presets (borrowed from DeleGate's agent presets, but stance-based). Each one is a
// one-click "hire this kind of voter": it sets sensible bounds AND an owner voting policy that is
// passed to the Venice TEE analyst as decision context (the model still decides For/Against/Abstain;
// the policy is a preference it weighs). The policy text is English — it joins the proposal text the
// analyst evaluates, which is sent in English.

export type PresetKey = 'treasury' | 'risk' | 'cautious';

export interface VotePreset {
  key: PresetKey;
  maxVotes: number;
  ttlDays: number;
  policy: string;
}

export const VOTE_PRESETS: VotePreset[] = [
  {
    key: 'treasury',
    maxVotes: 10,
    ttlDays: 30,
    policy:
      'Act as a treasury guardian: favour spending discipline, milestone-gated releases and unspent-funds clawbacks; lean Against unaudited, open-ended or oversized spends.',
  },
  {
    key: 'risk',
    maxVotes: 10,
    ttlDays: 30,
    policy:
      'Act as a protocol-risk reviewer: favour audits, conservative parameters and safety controls; lean Against changes that raise systemic or smart-contract risk.',
  },
  {
    key: 'cautious',
    maxVotes: 10,
    ttlDays: 30,
    policy: 'When a proposal is ambiguous, under-specified, or lacks evidence, prefer Abstain over guessing.',
  },
];

export const presetFor = (key: string | null): VotePreset | undefined =>
  VOTE_PRESETS.find((p) => p.key === key);
