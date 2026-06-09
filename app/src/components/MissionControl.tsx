'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { Address } from 'viem';
import { Activity, Coins, Rocket, Vote, Wallet } from 'lucide-react';
import { VOTE_BOARD_ADDRESS, type DaoProposal, type Delegation, type RunStatus } from '@mandate/shared';
import type { DemoConfig } from '../lib/orchestrator';
import type { SmartAccount } from '../lib/wallet';
import type { Dict, Lang } from '../lib/i18n';
import { ORDER, reached } from '../lib/runState';
import { useRatchet } from '../lib/useRatchet';
import { DEFAULT_QUERY_BUDGET } from '../lib/x402-toll';
import { decisionToSupport, useLiveTally, withOptimisticVote, type TallySource } from '../lib/useLiveTally';
import { ErrorToast } from './panels/ErrorToast';
import { type VoteRecord } from './panels/VoteLog';
import { NetworkField } from './mission/NetworkField';
import { TopBar } from './mission/TopBar';
import { IconRail, type PanelKey, type RailItem } from './mission/IconRail';
import { Popover } from './mission/Popover';
import { ProposalHUD } from './mission/ProposalHUD';
import { AuthorityChain } from './mission/AuthorityChain';
import { TeeConsole } from './mission/TeeConsole';
import { ScopeBlock } from './mission/ScopeBlock';
import { CapabilityDock } from './mission/CapabilityDock';
import { OneShotFinale } from './OneShotFinale';
import { PopoverBody } from './mission/popovers';

/**
 * The view-model the orchestrator (page.tsx) hands to the single-screen cockpit. It carries the
 * full run state, derived flags, grant-config, refs, and action callbacks — every region reads
 * from this so page.tsx stays a thin orchestrator and all business logic lives in one place.
 */
export interface MissionVM {
  // i18n
  lang: Lang;
  t: Dict;
  toggleLang: () => void;
  // config + proposal
  cfg: DemoConfig | null;
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  activeProposal: DaoProposal;
  proposalCount: number;
  // wallet
  address?: Address;
  isConnected: boolean;
  userSA: SmartAccount | null;
  // run
  run: RunStatus | null;
  s?: string;
  venice: RunStatus['venice'];
  lenses: RunStatus['lenses'];
  rootDel: Delegation | null;
  grantedProposalId: bigint | null;
  grantRunId: string | null;
  votesUsed: number;
  grantedAt: number | null;
  voteLog: VoteRecord[];
  youAddr?: string;
  orchAddr?: string;
  analystAddr?: string;
  /** the 7702 burner that casts via 1Shot (mainnet replay only). */
  burnerAddr?: string;
  killed: boolean;
  terminal: boolean;
  /** the latest run is for the proposal currently on screen (else the graph shows the resting mandate). */
  runOnActive: boolean;
  running: boolean;
  statusKey: string;
  authorityPct: number;
  // grant config
  maxVotes: number;
  setMaxVotes: (n: number) => void;
  ttlDays: number;
  setTtlDays: (n: number) => void;
  boundMode: 'votes' | 'days' | 'both';
  setBoundMode: (m: 'votes' | 'days' | 'both') => void;
  presetKey: string | null;
  applyPreset: (key: string) => void;
  // status flags
  busy: boolean;
  recalling: boolean;
  recallTx: string | null;
  error: string | null;
  // refs (fireSever origin = the graph stage)
  graphStageRef: RefObject<HTMLDivElement | null>;
  // actions
  onGrant: () => void;
  onVoteActive: () => void;
  onRecall: () => void;
  // mainnet replay (snapshot-driven; absent on the live testnet flow)
  replayMode?: boolean;
  replaying?: boolean;
  onReplay?: () => void;
  tallySource?: TallySource;
  // network switch (Base Sepolia live ↔ Base mainnet replay)
  network?: 'sepolia' | 'mainnet';
  toggleNetwork?: () => void;
  mainnetAvailable?: boolean;
}

const RAIL_TOP = 84;
const RAIL_STEP = 50;
// How long each reveal stage holds (ms). Deliberately slow (~1.5s) so the permission visibly flows
// You → Orchestrator → Analyst → VoteBoard one segment at a time and the segments feel time-balanced,
// even when the real run is faster. Drives the chain AND the TEE console (lockstep); never runs ahead
// of the real status, so 'analyzing' still waits out the genuine Venice decision.
const STAGE_MS = 1500;

/**
 * The immersive Mission-Control cockpit: a full-viewport canvas (drifting aurora + an ambient
 * network field + a central spotlight) with everything orbiting one focal column — the live
 * proposal HUD, the You→Orchestrator→Analyst→VoteBoard authority graph, the Venice-TEE reasoning
 * console, the scope/grant controls, and the x402 + 1Shot capability dock. A single right icon rail
 * opens content-height popover "bubbles" (Smart Account · DAO tally · x402 · 1Shot · Run) that float
 * over the canvas without squeezing the focal column. No desktop page scroll.
 */
export function MissionControl({ vm }: { vm: MissionVM }) {
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const { t } = vm;

  const runActive = !!vm.venice || !!vm.run;
  // x402 has a REAL per-vote settlement to show only once a toll has cleared; the bubble itself is
  // always openable (like the Run bubble) and simply shows a placeholder until then. Per-active: a toll
  // belongs to the proposal it settled for, so it clears when the user flips to a different proposal.
  const x402Settled = !!vm.run?.toll && vm.runOnActive && !vm.killed;

  const rail: RailItem[] = [
    { key: 'wallet', icon: Wallet, title: t.panels.wallet },
    { key: 'tally', icon: Vote, title: t.panels.tally },
    { key: 'x402', icon: Coins, title: t.panels.x402, dot: x402Settled },
    { key: 'oneshot', icon: Rocket, title: t.panels.oneshot },
    { key: 'run', icon: Activity, title: t.panels.run, dot: vm.running },
  ];

  const idx = panel ? rail.findIndex((r) => r.key === panel) : -1;
  const anchorTop = RAIL_TOP + (idx < 0 ? 0 : idx) * RAIL_STEP;
  const activeItem = rail.find((r) => r.key === panel);

  // Live on-chain tally for the active proposal (HUD bar + counts, the VoteBoard node pips, and the
  // tally popover all read this one source). Once the agent casts AS the user's smart account, the
  // vote shows here as a real 6th voter; until the next poll catches up, fold it in optimistically.
  const youVotedHere = !!vm.run?.vote && vm.run?.proposalId === vm.activeProposal.id.toString();
  // In replay the AI's vote is already a REAL voter on the live board, so never optimistically re-fold it
  // (that would double-count); the board's "voted" visual still uses youVotedHere. Live testnet folds the
  // just-cast vote until the next poll catches up.
  const foldOptimistic = youVotedHere && !vm.replayMode;
  const { tally, voters, live } = withOptimisticVote(
    useLiveTally(vm.activeProposal.id, vm.activeProposal.seed, vm.tallySource),
    vm.userSA?.address,
    decisionToSupport(vm.venice?.decision),
    foldOptimistic,
  );
  const pips = { for_: tally.for_, against: tally.against, abstain: tally.abstain };

  // ONE staged reveal index drives both the authority chain and the center TEE console, so the
  // console appears/decides on the chain's beat instead of the raw backend speed. targetIdx = how far
  // the real run has progressed; revealIdx ratchets toward it at STAGE_MS per stage (never ahead).
  // The graph + TEE console reflect the proposal ON SCREEN. The run state is global (one latest run),
  // so when it isn't for the active proposal, drive the reveal off the resting 'granted' mandate state
  // (the AI can still vote this proposal — it just hasn't yet) rather than the other proposal's run.
  // running/terminal stay global (they gate the vote button), so this only re-skins the display.
  // When SEVERED, the beams all render cut regardless of reveal level (Beam cuts on `killed`), so a
  // non-run proposal still shows the severed root + dead resting nodes — NOT the voted proposal's full
  // chain. The recall is a DAO-wide kill, so every proposal reads as severed, just not falsely "voted".
  const sEff = vm.runOnActive ? vm.s : vm.grantRunId ? 'granted' : undefined;
  let targetIdx = -1;
  for (let i = 0; i < ORDER.length; i++) if (reached(sEff, ORDER[i])) targetIdx = i;
  // Pace the staged reveal ONLY while a vote is actually in flight on the proposal ON SCREEN. In every
  // other case — resting, already-voted, viewing a different proposal, or severed — jump straight to the
  // target. So flipping BACK to a proposal you already voted shows the finished graph at once, never a
  // replay of the whole animation; only a live cast animates. (climbed snaps when !liveRun, so it stays
  // in sync; revealIdx returns targetIdx directly on the non-live frame to avoid the ratchet's 1-frame lag.)
  const liveRun = vm.running && vm.runOnActive && !vm.killed;
  const climbed = useRatchet(targetIdx, STAGE_MS, !liveRun);
  const revealIdx = liveRun ? climbed : targetIdx;

  const toggle = (key: PanelKey) => setPanel((c) => (c === key ? null : key));

  return (
    <div className="mc-root">
      <NetworkField />
      <div className="mc-spotlight" aria-hidden="true" />

      <TopBar lang={vm.lang} toggleLang={vm.toggleLang} t={t} network={vm.network} toggleNetwork={vm.toggleNetwork} mainnetAvailable={vm.mainnetAvailable} />
      <IconRail items={rail} active={panel} onSelect={toggle} />

      <main className="mc-center hud-scroll">
        <ProposalHUD
          proposal={vm.activeProposal}
          tally={tally}
          activeIdx={vm.activeIdx}
          count={vm.proposalCount}
          onSelect={vm.setActiveIdx}
          lang={vm.lang}
          t={t}
        />

        <div ref={vm.graphStageRef} className="flex w-full justify-center">
          <AuthorityChain
            t={t}
            parties={{ you: vm.youAddr, orch: vm.orchAddr, analyst: vm.analystAddr, board: VOTE_BOARD_ADDRESS, burner: vm.burnerAddr }}
            shownIdx={revealIdx}
            instant={!liveRun}
            status={sEff}
            killed={vm.killed}
            cutting={vm.recalling}
            connected={vm.isConnected}
            pips={pips}
            lenses={vm.runOnActive ? vm.lenses : undefined}
            synthDecision={vm.runOnActive ? vm.venice?.decision : undefined}
            votedHere={youVotedHere}
            paymentCap={vm.grantRunId ? (vm.boundMode === 'days' ? DEFAULT_QUERY_BUDGET : vm.maxVotes) : 0}
            tollSettled={!!vm.run?.toll && youVotedHere && !vm.killed}
            tollTxHash={vm.run?.toll?.txHash}
            oneShot={vm.replayMode}
          />
        </div>

        <TeeConsole venice={vm.runOnActive ? vm.venice : undefined} status={sEff} stageIdx={revealIdx} lenses={vm.runOnActive ? vm.lenses : undefined} txHash={vm.runOnActive ? vm.run?.vote?.txHash : undefined} killed={vm.killed} t={t} />

        <ScopeBlock vm={vm} />

        <CapabilityDock t={t} onOpen={setPanel} connected={vm.isConnected} revealIdx={revealIdx} killed={vm.killed} x402Settled={x402Settled} />

        {/* mainnet replay: the full 1Shot relay detail inline (relay lifecycle + live 7702 check + proof wall) */}
        {vm.replayMode && (
          <div className="w-full max-w-[560px]">
            <OneShotFinale t={t} bare autoRun focusRelay />
          </div>
        )}
      </main>

      <Popover side="right" open={!!panel} anchorTop={anchorTop} title={panel ? t.panels[panel] : ''} icon={activeItem?.icon} onClose={() => setPanel(null)}>
        {panel && <PopoverBody panel={panel} vm={vm} tally={tally} voters={voters} live={live} />}
      </Popover>

      <ErrorToast error={vm.error} />
    </div>
  );
}
