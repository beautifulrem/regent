'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { Address } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ShieldCheck } from 'lucide-react';
import type { DaoProposal, Delegation, RunStatus } from '@mandate/shared';
import type { DemoConfig } from '../lib/orchestrator';
import type { SmartAccount } from '../lib/wallet';
import type { Dict, Lang } from '../lib/i18n';
import { LangToggle } from './LangToggle';
import { StatusDot } from './ui/Badge';
import { GraphStage } from './graph/GraphStage';
import { ProposalDock } from './proposal/ProposalDock';
import { ActionBar } from './panels/ActionBar';
import { ErrorToast } from './panels/ErrorToast';
import { type VoteRecord } from './panels/VoteLog';
import { TrackRail } from './layout/TrackRail';
import { LeftSidebar } from './layout/LeftSidebar';
import { RightSidebar } from './layout/RightSidebar';

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

/**
 * The cockpit: a persistent TopBar over a 3-pane layout — a collapsible grant-side sidebar, the
 * living React Flow permission graph in the center (with the proposal / actions / track HUD floating
 * over it), and a collapsible execution-side sidebar whose dossier is organized into tabs. Each
 * sidebar animates (Gemini-style) between a full panel and a narrow icon rail; collapse both and the
 * graph goes full-bleed immersive. The graph re-fits via its ResizeObserver as the sidebars animate.
 */
export function MissionControl({ vm }: { vm: MissionVM }) {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Phones / tablets: start collapsed so the graph isn't crushed (the user can open the sidebars).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      {/* TopBar — persistent, full width */}
      <header className="relative z-[5] flex shrink-0 items-center justify-between gap-3 px-6 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-brand shadow-[0_0_24px_-8px_var(--color-brand)]">
            <ShieldCheck className="size-5" strokeWidth={2} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">Mandate</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle lang={vm.lang} onToggle={vm.toggleLang} />
          <span className="inline-flex items-center gap-2 rounded-chip border border-hairline bg-surface/40 px-3 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur">
            <StatusDot tone="ok" /> Base Sepolia
          </span>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <LeftSidebar vm={vm} collapsed={leftCollapsed} onToggle={() => setLeftCollapsed((c) => !c)} />

        {/* center — the living permission graph + the proposal / actions / track HUD over it */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div ref={vm.graphStageRef} className="absolute inset-0">
            <GraphStage vm={vm} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-base/85 to-transparent" aria-hidden />
          <ProposalDock
            proposal={vm.activeProposal}
            activeIdx={vm.activeIdx}
            count={vm.proposalCount}
            onSelect={vm.setActiveIdx}
            lang={vm.lang}
            t={vm.t}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-base/90 to-transparent" aria-hidden />
          <ActionBar vm={vm} />
          <TrackRail vm={vm} />
          <ErrorToast error={vm.error} />
        </div>

        <RightSidebar vm={vm} collapsed={rightCollapsed} onToggle={() => setRightCollapsed((c) => !c)} />
      </div>
    </div>
  );
}
