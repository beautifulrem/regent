'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createPublicClient, http, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { Users, Vote } from 'lucide-react';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import {
  DEMO_PERSONAS,
  DEMO_PROPOSAL_ID,
  VOTE_BOARD_ABI,
  VOTE_BOARD_ADDRESS,
  decodeBallot,
  isVoteBoardLive,
  personaFor,
} from '@mandate/shared';
import { BASESCAN, RPC_URL, shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import { personaTally, tallyBreakdown, type TallyBreakdown } from '../lib/voteboard-view';
import { NumberTicker } from './NumberTicker';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge, TrackTag } from './ui/Badge';
import type { Dict } from '../lib/i18n';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Choice = 0 | 1 | 2 | null;
interface VoterRow {
  address: string;
  support: Choice;
}

/**
 * The multi-voter DAO scene: a live For/Against/Abstain tally + voter list for the SHARED
 * VoteBoard proposal. Before the board is deployed it shows the seeded personas; once live it
 * polls the chain so a judge watches their own vote land in the same tally.
 */
export function VoteTally({ you, t }: { you?: Address; t: Dict }) {
  const reduce = useReducedMotion();
  const live = isVoteBoardLive(VOTE_BOARD_ADDRESS);
  const [tally, setTally] = useState<TallyBreakdown>(() => personaTally());
  const [voters, setVoters] = useState<VoterRow[]>(() =>
    DEMO_PERSONAS.map((p) => ({ address: p.address, support: p.support })),
  );

  useEffect(() => {
    if (!live) return; // keep the seeded fallback already in initial state
    const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    let cancelled = false;
    const poll = async () => {
      try {
        const [against, forV, abstain] = (await client.readContract({
          address: VOTE_BOARD_ADDRESS,
          abi: VOTE_BOARD_ABI,
          functionName: 'getTally',
          args: [DEMO_PROPOSAL_ID],
        })) as [bigint, bigint, bigint];
        const addrs = (await client.readContract({
          address: VOTE_BOARD_ADDRESS,
          abi: VOTE_BOARD_ABI,
          functionName: 'getVoters',
          args: [DEMO_PROPOSAL_ID],
        })) as readonly Address[];
        const supports = await Promise.all(
          addrs.map(
            (a) =>
              client.readContract({
                address: VOTE_BOARD_ADDRESS,
                abi: VOTE_BOARD_ABI,
                functionName: 'getVote',
                args: [DEMO_PROPOSAL_ID, a],
              }) as Promise<number>,
          ),
        );
        if (cancelled) return;
        setTally(tallyBreakdown(Number(against), Number(forV), Number(abstain)));
        setVoters(addrs.map((a, i) => ({ address: a, support: decodeBallot(supports[i]) as Choice })));
      } catch {
        /* transient RPC hiccup — keep the last good tally */
      }
    };
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [live]);

  return (
    <Panel pad="lg" className="mb-3.5">
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
