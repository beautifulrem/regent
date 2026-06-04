/**
 * The four governance "lenses" the orchestrator fans a proposal out to before synthesizing the
 * final vote. Each is a specialist mandate the analyst evaluates the proposal under (folded into
 * the TEE prompt via withVotingPolicy). This is the CANONICAL source of the lens policies — the
 * app's one-click stance presets reuse the same text, so the two never drift.
 */
import type { LensKey } from './api.js';

export interface Lens {
  key: LensKey;
  /** short English label, used in the synthesis prompt + the UI's lens node. */
  label: string;
  /** the mandate the analyst weighs the proposal under. */
  policy: string;
}

export const LENSES: readonly Lens[] = [
  {
    key: 'fiscal',
    label: 'Fiscal / treasury guardian',
    policy:
      'Act as a treasury guardian: favour lean, milestone-gated, clawback-protected spending; lean Against unaudited, open-ended or oversized spends.',
  },
  {
    key: 'growth',
    label: 'Growth advocate',
    policy:
      'Act as a growth advocate: favour credible, accountable proposals that grow liquidity, ecosystem activity or participation; lean For on accountable growth spends.',
  },
  {
    key: 'security',
    label: 'Protocol-security reviewer',
    policy:
      'Act as a protocol-security reviewer: favour audits, conservative parameters and safety controls; lean Against changes that raise systemic or smart-contract risk.',
  },
  {
    key: 'participation',
    label: 'Participation advocate',
    policy:
      'Act as a participation advocate: favour lower barriers, broader voter access and responsible delegation, while preserving clear accountability.',
  },
] as const;

/** Look up a lens by key (undefined for an unknown key). */
export const lensFor = (key: string): Lens | undefined => LENSES.find((l) => l.key === key);
