'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { Address } from 'viem';
import { Users, Vote } from 'lucide-react';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { VOTE_BOARD_ADDRESS, personaFor } from '@mandate/shared';
import { BASESCAN, shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import type { TallyBreakdown } from '../lib/voteboard-view';
import type { VoterRow } from '../lib/useLiveTally';
import { NumberTicker } from './NumberTicker';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge, TrackTag } from './ui/Badge';
import type { Dict } from '../lib/i18n';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Live For/Against/Abstain tally + voter list for the ACTIVE proposal. Presentational: the
 * tally/voters come from `useLiveTally` (lifted to the cockpit so the HUD, the graph node and this
 * popover share one source), so a vote cast AS the user's smart account shows here as a real voter.
 */
export function VoteTally({
  tally,
  voters,
  live,
  you,
  t,
  bare = false,
}: {
  tally: TallyBreakdown;
  voters: VoterRow[];
  live: boolean;
  you?: Address;
  t: Dict;
  bare?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <Panel pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
      <PanelHeader
        icon={Vote}
        title={t.tally.title}
        track={
          <TrackTag tone="info" icon={Users}>
            {t.tally.track}
          </TrackTag>
        }
        right={
          <Badge tone="neutral">
            <Users className="size-3" /> <NumberTicker value={tally.total} /> {t.tally.voters}
          </Badge>
        }
      />

      <div className="space-y-2.5">
        <TallyBar label={t.tally.for} count={tally.for_} pct={tally.pct.for_} tone="ok" reduce={!!reduce} />
        <TallyBar label={t.tally.against} count={tally.against} pct={tally.pct.against} tone="bad" reduce={!!reduce} />
        <TallyBar label={t.tally.abstain} count={tally.abstain} pct={tally.pct.abstain} tone="mute" reduce={!!reduce} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {voters.map((v) => {
          const p = personaFor(v.address);
          const isYou = !!you && v.address.toLowerCase() === you.toLowerCase();
          const name = isYou ? t.tally.you : (p?.name ?? shortHex(v.address, 4));
          return (
            <motion.div
              key={v.address}
              initial={reduce ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              className={cn(
                'inline-flex items-center gap-2 rounded-chip border bg-surface-2/60 px-2.5 py-1.5',
                isYou ? 'border-brand/60 shadow-[0_0_16px_-6px_var(--color-brand)]' : 'border-hairline',
              )}
            >
              <Jazzicon diameter={18} seed={jsNumberForAddress(v.address)} />
              <span className={cn('text-xs font-semibold', isYou ? 'text-brand' : 'text-ink')}>{name}</span>
              {v.support !== null && <SupportPip support={v.support} t={t} />}
            </motion.div>
          );
        })}
      </div>

      {live ? (
        <a
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-mute transition-colors hover:text-info"
          href={`${BASESCAN}/address/${VOTE_BOARD_ADDRESS}`}
          target="_blank"
          rel="noreferrer"
        >
          VoteBoard {shortHex(VOTE_BOARD_ADDRESS, 4)} ↗
        </a>
      ) : (
        <div className="mt-3 text-[11px] text-ink-mute">{t.tally.pending}</div>
      )}
    </Panel>
  );
}

function TallyBar({
  label,
  count,
  pct,
  tone,
  reduce,
}: {
  label: string;
  count: number;
  pct: number;
  tone: 'ok' | 'bad' | 'mute';
  reduce: boolean;
}) {
  const bar = tone === 'ok' ? 'bg-ok' : tone === 'bad' ? 'bg-bad' : 'bg-ink-mute';
  const txt = tone === 'ok' ? 'text-ok' : tone === 'bad' ? 'text-bad' : 'text-ink-mute';
  return (
    <div className="flex items-center gap-3">
      <span className={cn('w-14 shrink-0 text-[12px] font-semibold', txt)}>{label}</span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-chip border border-hairline bg-surface-2">
        <motion.div
          className={cn('h-full rounded-chip', bar)}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduce ? 0 : 0.7, ease: EASE }}
        />
      </div>
      <span className="w-9 text-right font-mono text-sm font-bold tabular-nums text-ink">
        <NumberTicker value={count} />
      </span>
    </div>
  );
}

function SupportPip({ support, t }: { support: 0 | 1 | 2; t: Dict }) {
  const map = {
    0: { c: 'bg-bad', l: t.tally.against },
    1: { c: 'bg-ok', l: t.tally.for },
    2: { c: 'bg-ink-mute', l: t.tally.abstain },
  } as const;
  const m = map[support];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-ink-mute">
      <span className={cn('size-1.5 rounded-full', m.c)} />
      {m.l}
    </span>
  );
}
