'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, http, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  DEMO_PERSONAS,
  VOTE_BOARD_ABI,
  VOTE_BOARD_ADDRESS,
  decodeBallot,
  isVoteBoardLive,
} from '@mandate/shared';
import { RPC_URL } from './config';
import { tallyBreakdown, tallyFromSeed, type TallyBreakdown } from './voteboard-view';

export type Choice = 0 | 1 | 2 | null;
export interface VoterRow {
  address: string;
  support: Choice;
}

const personaIndex = (addr: string) =>
  DEMO_PERSONAS.findIndex((p) => p.address.toLowerCase() === addr.toLowerCase());

const seedVoters = (seed: readonly number[]): VoterRow[] =>
  DEMO_PERSONAS.map((p, i) => ({ address: p.address, support: (seed[i] ?? null) as Choice }));

/**
 * The ACTIVE proposal's live For/Against/Abstain tally + voter list. Until the VoteBoard is live (or
 * between rotations) it returns the proposal's seeded distribution; once live it reads that proposal's
 * on-chain tally every 3s — so a vote the agent casts AS the user's smart account shows up as a real
 * 6th voter. Lifted out of VoteTally so the proposal HUD, the VoteBoard graph node, and the tally
 * popover all read ONE source (no divergent counts, one poll).
 */
export function useLiveTally(
  proposalId: bigint,
  seed: readonly number[],
): { tally: TallyBreakdown; voters: VoterRow[]; live: boolean } {
  const live = isVoteBoardLive(VOTE_BOARD_ADDRESS);
  const [tally, setTally] = useState<TallyBreakdown>(() => tallyFromSeed(seed));
  const [voters, setVoters] = useState<VoterRow[]>(() => seedVoters(seed));

  // Snap to the new proposal's seeded fallback the instant the active proposal changes.
  useEffect(() => {
    setTally(tallyFromSeed(seed));
    setVoters(seedVoters(seed));
  }, [proposalId, seed]);

  useEffect(() => {
    if (!live) return;
    const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    let cancelled = false;
    const poll = async () => {
      try {
        const [against, forV, abstain] = (await client.readContract({
          address: VOTE_BOARD_ADDRESS,
          abi: VOTE_BOARD_ABI,
          functionName: 'getTally',
          args: [proposalId],
        })) as [bigint, bigint, bigint];
        const addrs = (await client.readContract({
          address: VOTE_BOARD_ADDRESS,
          abi: VOTE_BOARD_ABI,
          functionName: 'getVoters',
          args: [proposalId],
        })) as readonly Address[];
        // Personas reuse this proposal's seeded support; only an unknown voter (you) needs a read.
        const rows: VoterRow[] = [];
        for (const a of addrs) {
          const idx = personaIndex(a);
          if (idx >= 0) {
            rows.push({ address: a, support: (seed[idx] ?? null) as Choice });
          } else {
            const s = (await client.readContract({
              address: VOTE_BOARD_ADDRESS,
              abi: VOTE_BOARD_ABI,
              functionName: 'getVote',
              args: [proposalId, a],
            })) as number;
            rows.push({ address: a, support: decodeBallot(s) as Choice });
          }
        }
        if (cancelled) return;
        setTally(tallyBreakdown(Number(against), Number(forV), Number(abstain)));
        setVoters(rows);
      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[useLiveTally] poll failed', e);
      }
    };
    void poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [live, proposalId, seed]);

  return { tally, voters, live };
}

/** Map a Venice decision to a VoteBoard support value (0 Against · 1 For · 2 Abstain). */
export function decisionToSupport(decision?: string): Choice {
  if (decision === 'For') return 1;
  if (decision === 'Against') return 0;
  if (decision === 'Abstain') return 2;
  return null;
}

/**
 * Optimistically fold the user's just-cast vote into a live tally until the next on-chain poll
 * reflects it — keyed off `run.vote` (only set once the cast actually landed), and skipped if the
 * poll already lists the address, so it never double-counts.
 */
export function withOptimisticVote(
  base: { tally: TallyBreakdown; voters: VoterRow[]; live: boolean },
  you: string | undefined,
  support: Choice,
  applies: boolean,
): { tally: TallyBreakdown; voters: VoterRow[]; live: boolean } {
  if (!applies || !you || support == null) return base;
  if (base.voters.some((v) => v.address.toLowerCase() === you.toLowerCase())) return base;
  const voters = [...base.voters, { address: you, support }];
  const tally = tallyBreakdown(
    base.tally.against + (support === 0 ? 1 : 0),
    base.tally.for_ + (support === 1 ? 1 : 0),
    base.tally.abstain + (support === 2 ? 1 : 0),
  );
  return { tally, voters, live: base.live };
}
