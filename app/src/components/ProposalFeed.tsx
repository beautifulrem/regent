'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Ban, FileText, Lock, Undo2 } from 'lucide-react';
import { PROPOSALS } from '@mandate/shared';
import { shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import { Panel } from './ui/Panel';
import { Badge, StatusDot } from './ui/Badge';
import type { Dict, Lang } from '../lib/i18n';

/**
 * The living governance feed: a strip of the rotating proposals (the active one open for voting,
 * the rest selectable) over the active proposal card. New proposals "open" on a timer in page.tsx;
 * each carries its own DAO vote distribution, shown by the VoteTally below.
 */
export function ProposalFeed({
  activeIdx,
  onSelect,
  lang,
  t,
}: {
  activeIdx: number;
  onSelect: (i: number) => void;
  lang: Lang;
  t: Dict;
}) {
  const reduce = useReducedMotion();
  const active = PROPOSALS[activeIdx];

  return (
    <Panel pad="lg" className="mb-3.5">
      {/* proposal queue */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
          {t.feed.live}
        </span>
        {PROPOSALS.map((p, i) => (
          <button
            key={p.id.toString()}
            onClick={() => onSelect(i)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-chip border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              i === activeIdx
                ? 'border-brand/50 bg-brand/10 text-brand'
                : 'border-hairline bg-surface-2/60 text-ink-mute hover:text-ink',
            )}
          >
            {i === activeIdx && <StatusDot tone="ok" />}#{i + 1}
          </button>
        ))}
      </div>

      {/* active proposal — keyed so it remounts (enter-animates) when a new proposal opens */}
      <div>
        <motion.div
          key={active.id.toString()}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-hairline bg-surface-2 text-brand">
                <FileText className="size-[18px]" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ok">
                  <StatusDot tone="ok" /> {t.feed.voting}
                </div>
                <h3 className="font-display text-[15px] font-semibold leading-tight text-ink">{active.title[lang]}</h3>
              </div>
            </div>
            <span className="font-mono text-xs text-ink-mute">#{shortHex(active.id.toString(), 5)}</span>
          </div>
          <p className="text-[14px] leading-relaxed text-ink-soft">{active.body[lang]}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="brand">
              <Lock className="size-3" /> {t.scopeVote}
            </Badge>
            <Badge tone="brand">
              <Ban className="size-3" /> {t.scopeFunds}
            </Badge>
            <Badge tone="brand">
              <Undo2 className="size-3" /> {t.scopeRevocable}
            </Badge>
          </div>
        </motion.div>
      </div>
    </Panel>
  );
}
