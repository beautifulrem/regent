'use client';

import { PROPOSALS } from '@mandate/shared';
import { CheckCircle2, ScrollText } from 'lucide-react';
import { BASESCAN, shortHex } from '../../lib/config';
import { decisionTone } from '../../lib/runState';
import { cn } from '../../lib/cn';
import type { Dict, Lang } from '../../lib/i18n';

/** One vote the standing mandate has cast (accumulated across proposals by page.tsx). */
export interface VoteRecord {
  runId: string;
  proposalId: string;
  decision?: string;
  rationale?: string;
  txHash: string;
  attested: boolean;
}

const TONE_BORDER = { ok: 'border-ok/60', bad: 'border-bad/60', warn: 'border-warn/60' } as const;
const TONE_TEXT = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn' } as const;

/**
 * The decision log: one row per vote the agent has cast under the CURRENT standing grant — the
 * decision, the proposal, the TEE-attested badge, the model's one-line rationale, and the on-chain
 * castVote tx. This is the "standing, multi-proposal mandate in action" that single-task agents
 * can't show (newest first; cleared when a fresh grant is signed).
 */
export function VoteLog({ records, lang, t }: { records: VoteRecord[]; lang: Lang; t: Dict }) {
  if (records.length === 0) return null;
  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-mute/80">
        <ScrollText className="size-3" /> {t.voteLogTitle}
        <span className="text-ink-mute/60">· {records.length}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {records.map((r) => {
          const p = PROPOSALS.find((x) => x.id.toString() === r.proposalId);
          const title = p ? p.title[lang] : `#${r.proposalId.slice(-6)}`;
          const tone = decisionTone(r.decision);
          return (
            <div key={r.runId} className={cn('border-l-2 pl-2.5', TONE_BORDER[tone])}>
              <div className="flex items-center gap-2 text-[12px]">
                <span className={cn('shrink-0 font-bold', TONE_TEXT[tone])}>{r.decision ?? '—'}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft" title={title}>
                  {title}
                </span>
                {r.attested && <CheckCircle2 className="size-3.5 shrink-0 text-ok" aria-label="TEE attested" />}
                <a
                  className="shrink-0 font-mono text-[11px] text-info hover:underline"
                  href={`${BASESCAN}/tx/${r.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortHex(r.txHash, 4)} ↗
                </a>
              </div>
              {r.rationale && <div className="mt-0.5 line-clamp-1 text-[11px] italic text-ink-mute/85">“{r.rationale}”</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
