'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Address } from 'viem';
import { PROPOSALS, type RunStatus } from '@mandate/shared';
import type { Dict, Lang } from './i18n';
import { ORDER } from './runState';
import type { DemoConfig } from './orchestrator';
import type { SmartAccount } from './wallet';
import type { TallySource } from './useLiveTally';
import { MAINNET_SNAPSHOT } from './mainnet-snapshot';
import type { MissionVM } from '../components/MissionControl';

const STAGE_MS = 1500; // mirrors MissionControl's STAGE_MS so the replay paces identically
const RESET_MS = 120;

/**
 * Drives a fake run status that, on replay(), dips to 'granted' then jumps to 'voted' with running=true
 * — exactly the shape of a live cast, so MissionControl's existing ratchet animates the graph + TEE
 * console in lockstep. At rest it sits at 'voted' (the finished run), so the screen shows the completed
 * mainnet vote until the user clicks replay.
 */
function useReplayClock(active: boolean): { status: string; running: boolean; replay: () => void } {
  // start low when active so entering mainnet animates from the first stage (no finished-graph flash)
  const [status, setStatus] = useState<string>(active ? 'granted' : 'voted');
  const [running, setRunning] = useState(active);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const replay = useCallback(() => {
    clear();
    setStatus('granted'); // drop the target low so the cockpit ratchet snaps back, then re-climbs
    setRunning(true);
    timers.current.push(setTimeout(() => setStatus('voted'), RESET_MS));
    timers.current.push(setTimeout(() => setRunning(false), RESET_MS + ORDER.length * STAGE_MS + 700));
  }, []);
  // Auto-play the full run every time we ENTER the mainnet view (active false → true).
  const prevActive = useRef(active);
  useEffect(() => {
    if (active && !prevActive.current) replay();
    prevActive.current = active;
  }, [active, replay]);
  useEffect(() => () => clear(), []);
  return { status, running, replay };
}

/**
 * The mainnet-replay view-model: a completed Base-mainnet 1Shot run rebuilt from MAINNET_SNAPSHOT,
 * with a replay clock that re-animates it on demand. No wallet, no orchestrator — the graph, the TEE
 * typewriter console, and the live VoteBoard tally all read this like any finished run. Returns null
 * when no snapshot is recorded yet (the caller then stays on the live testnet flow).
 */
export function useMainnetReplay(statics: {
  lang: Lang;
  t: Dict;
  toggleLang: () => void;
  graphStageRef: RefObject<HTMLDivElement | null>;
  /** true while the mainnet view is on screen — entering it auto-plays the full run. */
  active: boolean;
}): MissionVM | null {
  const clock = useReplayClock(statics.active);
  const snap = MAINNET_SNAPSHOT;
  if (!snap) return null;

  const burner = snap.oneshot.burner;
  const proposal = PROPOSALS[0];
  const board = (snap.voteBoard ?? '0x0000000000000000000000000000000000000000') as Address;

  const run = {
    runId: 'mainnet-replay',
    chainId: snap.chain.id,
    governor: board,
    proposalId: snap.proposal.id,
    status: 'voted',
    delegations: {
      rootHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      participants: { user: burner, orchestrator: burner, analyst: burner },
    },
    lenses: snap.lenses,
    venice: snap.venice,
    vote: { txHash: snap.vote.txHash, support: snap.vote.support, blockNumber: snap.vote.blockNumber, relay: '1shot' },
    updatedAt: snap.recordedAt,
  } as unknown as RunStatus;

  const cfg = {
    chainId: snap.chain.id,
    governor: board,
    token: board,
    paymentToken: board,
    proposalId: snap.proposal.id,
    orchestratorSA: burner,
    analyst: burner,
  } as DemoConfig;

  const tallySource: TallySource = { board, rpc: snap.chain.rpc, mainnet: true };

  const noop = () => {};

  return {
    lang: statics.lang,
    t: statics.t,
    toggleLang: statics.toggleLang,
    cfg,
    activeIdx: 0,
    setActiveIdx: noop,
    activeProposal: proposal,
    proposalCount: 1,
    address: burner,
    isConnected: true,
    userSA: { address: burner } as unknown as SmartAccount,
    run,
    s: clock.status,
    venice: snap.venice as RunStatus['venice'],
    lenses: snap.lenses,
    rootDel: null,
    grantedProposalId: BigInt(snap.proposal.id),
    grantRunId: 'mainnet-replay',
    votesUsed: 1,
    grantedAt: Date.parse(snap.recordedAt) || null,
    voteLog: [],
    youAddr: burner,
    orchAddr: burner,
    analystAddr: snap.toll?.seller ?? burner,
    burnerAddr: burner,
    killed: false,
    terminal: true,
    runOnActive: true,
    running: clock.running,
    statusKey: 'voted',
    authorityPct: 100,
    maxVotes: 10,
    setMaxVotes: noop,
    ttlDays: 30,
    setTtlDays: noop,
    boundMode: 'both',
    setBoundMode: noop,
    presetKey: null,
    applyPreset: noop,
    busy: false,
    recalling: false,
    recallTx: null,
    error: null,
    graphStageRef: statics.graphStageRef,
    onGrant: noop,
    onVoteActive: noop,
    onRecall: noop,
    // replay extras
    replayMode: true,
    replaying: clock.running,
    onReplay: clock.replay,
    tallySource,
    relayInfo: {
      basescan: snap.chain.basescan,
      tollTx: snap.toll?.txHash,
      castTx: snap.vote.txHash,
      tollUsdc: snap.toll ? (Number(snap.toll.amount) / 1e6).toString() : '0.001',
      feeUsdc: snap.oneshot.feeUsdc,
    },
  };
}
