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
import { decisionToSupport, useLiveTally, withOptimisticVote } from '../lib/useLiveTally';
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
  killed: boolean;
  terminal: boolean;
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
  // x402 is bound to a REAL per-vote settlement: it only activates once a vote has settled a toll
  // (which implies a standing grant + a completed on-chain vote). Until then it's inert + non-clickable.
  const x402Enabled = !!vm.run?.toll && !vm.killed;

  const rail: RailItem[] = [
    { key: 'wallet', icon: Wallet, title: t.panels.wallet },
    { key: 'tally', icon: Vote, title: t.panels.tally },
    { key: 'x402', icon: Coins, title: t.panels.x402, disabled: !x402Enabled },
    { key: 'oneshot', icon: Rocket, title: t.panels.oneshot },
    { key: 'run', icon: Activity, title: t.panels.run, dot: runActive },
  ];

  // close the x402 bubble if it loses eligibility while open (proposal switched away / chain severed)
  useEffect(() => {
    if (panel === 'x402' && !x402Enabled) setPanel(null);
  }, [panel, x402Enabled]);

  const idx = panel ? rail.findIndex((r) => r.key === panel) : -1;
  const anchorTop = RAIL_TOP + (idx < 0 ? 0 : idx) * RAIL_STEP;
  const activeItem = rail.find((r) => r.key === panel);

  // Live on-chain tally for the active proposal (HUD bar + counts, the VoteBoard node pips, and the
  // tally popover all read this one source). Once the agent casts AS the user's smart account, the
  // vote shows here as a real 6th voter; until the next poll catches up, fold it in optimistically.
  const youVotedHere = !!vm.run?.vote && vm.run?.proposalId === vm.activeProposal.id.toString();
  const { tally, voters, live } = withOptimisticVote(
    useLiveTally(vm.activeProposal.id, vm.activeProposal.seed),
    vm.userSA?.address,
    decisionToSupport(vm.venice?.decision),
    youVotedHere,
  );
  const pips = { for_: tally.for_, against: tally.against, abstain: tally.abstain };

  // ONE staged reveal index drives both the authority chain and the center TEE console, so the
  // console appears/decides on the chain's beat instead of the raw backend speed. targetIdx = how far
  // the real run has progressed; revealIdx ratchets toward it at STAGE_MS per stage (never ahead).
  let targetIdx = -1;
  for (let i = 0; i < ORDER.length; i++) if (reached(vm.s, ORDER[i])) targetIdx = i;
  const revealIdx = useRatchet(targetIdx, STAGE_MS, vm.killed);

  const toggle = (key: PanelKey) => setPanel((c) => (c === key ? null : key));

  return (
    <div className="mc-root">
      <NetworkField />
      <div className="mc-spotlight" aria-hidden="true" />

      <TopBar lang={vm.lang} toggleLang={vm.toggleLang} t={t} />
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
            parties={{ you: vm.youAddr, orch: vm.orchAddr, analyst: vm.analystAddr, board: VOTE_BOARD_ADDRESS }}
            shownIdx={revealIdx}
            status={vm.s}
            killed={vm.killed}
            cutting={vm.recalling}
            connected={vm.isConnected}
            pips={pips}
            lenses={vm.lenses}
            synthDecision={vm.venice?.decision}
            votedHere={youVotedHere}
            paymentCap={vm.grantRunId ? (vm.boundMode === 'days' ? DEFAULT_QUERY_BUDGET : vm.maxVotes) : 0}
            paymentSpent={vm.votesUsed}
            tollSettled={!!vm.run?.toll && youVotedHere && !vm.killed}
            tollTxHash={vm.run?.toll?.txHash}
          />
        </div>

        <TeeConsole venice={vm.venice} status={vm.s} stageIdx={revealIdx} lenses={vm.lenses} txHash={vm.run?.vote?.txHash} killed={vm.killed} t={t} />

        <ScopeBlock vm={vm} />

        <CapabilityDock t={t} onOpen={setPanel} connected={vm.isConnected} revealIdx={revealIdx} killed={vm.killed} x402Enabled={x402Enabled} />
      </main>

      <Popover side="right" open={!!panel} anchorTop={anchorTop} title={panel ? t.panels[panel] : ''} icon={activeItem?.icon} onClose={() => setPanel(null)}>
        {panel && <PopoverBody panel={panel} vm={vm} tally={tally} voters={voters} live={live} />}
      </Popover>

      <ErrorToast error={vm.error} />
    </div>
  );
}
