'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Ban, Lock, Undo2 } from 'lucide-react';
import type { DaoProposal } from '@mandate/shared';
import { cn } from '../../lib/cn';
import { tallyFromSeed } from '../../lib/voteboard-view';
import { StatusDot } from '../ui/Badge';
import type { Dict, Lang } from '../../lib/i18n';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Frameless proposal HUD docked top-center — the subject the permission graph operates on.
 * NO card: a floating eyebrow (live status + N/M + #id) over the title + body, a one-line
 * scope summary, a slim For/Against/Abstain tally bar, and rotation dots. A new proposal
 * crossfades up every ~24s (rotation timing lives in page.tsx; paused while busy/run).
 */
export function ProposalDock({
  proposal,
  activeIdx,
  count,
  onSelect,
  lang,
  t,
}: {
  proposal: DaoProposal;
  activeIdx: number;
  count: number;
  onSelect: (i: number) => void;
  lang: Lang;
  t: Dict;
}) {
  const reduce = useReducedMotion();
  const tally = tallyFromSeed(proposal.seed);
  const segs = [
    { key: 'for', pct: tally.pct.for_, cls: 'bg-ok' },
    { key: 'against', pct: tally.pct.against, cls: 'bg-bad' },
    { key: 'abstain', pct: tally.pct.abstain, cls: 'bg-ink-mute' },
  ];

  return (
    <div className="pointer-events-none absolute left-1/2 top-[60px] z-[3] w-[min(92vw,620px)] -translate-x-1/2 px-4 text-center">
      {/* eyebrow — live status · position · id */}
      <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
        <StatusDot tone="ok" />
        <span className="text-ok">{t.feed.voting}</span>
        <span className="text-ink-mute/80">
          · {activeIdx + 1}/{count}
        </span>
        <span className="font-mono text-ink-mute/70">· #{proposal.id.toString().slice(-6)}</span>
      </div>

      {/* title + body — crossfade up when a new proposal opens */}
      <AnimatePresence mode="wait">
        <motion.div
          key={proposal.id.toString()}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <h2 className="mt-1 font-display text-[22px] font-semibold leading-tight text-ink [text-shadow:0_2px_20px_rgba(0,0,0,0.78)]">
            {proposal.title[lang]}
          </h2>
          <p className="mx-auto mt-1.5 line-clamp-2 max-w-[540px] text-[13px] leading-relaxed text-ink-soft/85 [text-shadow:0_1px_12px_rgba(0,0,0,0.7)]">
            {proposal.body[lang]}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* scope — one frameless line, the standing permission this graph carries */}
      <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1 text-brand/90">
          <Lock className="size-3" strokeWidth={2.2} />
          {t.scopeVote}
        </span>
        <span className="text-ink-mute/40">·</span>
        <span className="inline-flex items-center gap-1 text-ink-mute/75">
          <Ban className="size-3" strokeWidth={2.2} />
          {t.scopeFunds}
        </span>
        <span className="text-ink-mute/40">·</span>
        <span className="inline-flex items-center gap-1 text-ink-mute/75">
          <Undo2 className="size-3" strokeWidth={2.2} />
          {t.scopeRevocable}
        </span>
      </div>

      {/* tally summary — slim segmented bar + counts */}
      <div className="mx-auto mt-3 w-[280px]">
        <div className="flex h-1.5 w-full overflow-hidden rounded-chip bg-surface-2/50">
          {segs.map((sg) => (
            <motion.div
              key={sg.key}
              className={cn('h-full', sg.cls)}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${sg.pct}%` }}
              transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-3 text-[10.5px] font-semibold tabular-nums">
          <span className="text-ok">
            {tally.for_} {t.tally.for}
          </span>
          <span className="text-bad">
            {tally.against} {t.tally.against}
          </span>
          <span className="text-ink-mute">
            {tally.abstain} {t.tally.abstain}
          </span>
        </div>
      </div>

      {/* rotation dots — click to jump (pointer-events re-enabled just here) */}
      <div className="pointer-events-auto mt-3 flex items-center justify-center gap-1.5">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            aria-label={`${t.feed.live} ${i + 1}`}
            aria-current={i === activeIdx}
            className={cn(
              // globals.css's :where(button) base is UNLAYERED, so force the dot's size/colour with !important
              'h-1.5 rounded-full bg-none! p-0! shadow-none! transition-all duration-300 ease-fluid',
              i === activeIdx ? 'w-6 bg-brand!' : 'w-1.5 bg-line! hover:bg-ink-mute!',
            )}
          />
        ))}
      </div>
    </div>
  );
}
