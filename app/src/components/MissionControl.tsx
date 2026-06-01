'use client';

import type { RefObject } from 'react';
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
import { LeftRail } from './layout/LeftRail';
import { RightDossier } from './layout/RightDossier';
import { TrackRail } from './layout/TrackRail';

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
 * IMMERSIVE, FRAMELESS cockpit — NO cards. The React Flow permission graph fills the entire
 * viewport as a living canvas (MC-S2/S3); everything else floats over it as borderless HUD
 * (typography + glow + soft scrims for legibility), and key data fuses into the graph nodes.
 */
export function MissionControl({ vm }: { vm: MissionVM }) {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* living graph (React Flow) — the immersive centerpiece. Full-bleed below lg; on lg+ the
          canvas insets to the clear zone between the side rails so nodes never sit under a rail. */}
      <div ref={vm.graphStageRef} className="absolute inset-0 lg:left-[336px] lg:right-[356px]">
        <GraphStage vm={vm} />
      </div>

      {/* soft top scrim for legibility — a fade, not a card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-base/85 to-transparent" aria-hidden />

      {/* TopBar — frameless, floating over the graph */}
      <header className="absolute inset-x-0 top-0 z-[3] flex items-center justify-between gap-3 px-6 py-4">
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

      {/* Proposal — frameless top-center HUD (the subject the graph operates on) */}
      <ProposalDock
        proposal={vm.activeProposal}
        activeIdx={vm.activeIdx}
        count={vm.proposalCount}
        onSelect={vm.setActiveIdx}
        lang={vm.lang}
        t={vm.t}
      />

      {/* grant-side HUD — Smart Account, Permission X-Ray, Tamper Probe (frameless, contextual) */}
      <LeftRail vm={vm} />

      {/* execution-side HUD — TEE, vote result, proof timeline, tally, x402, 1Shot (frameless) */}
      <RightDossier vm={vm} />

      {/* floating error toast */}
      <ErrorToast error={vm.error} />

      {/* soft bottom scrim */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-base/90 to-transparent" aria-hidden />

      {/* Action zone — frameless bottom-center controls */}
      <ActionBar vm={vm} />

      {/* Track rail — the always-visible judges' checklist (6 tracks, click-to-peek) */}
      <TrackRail vm={vm} />
    </div>
  );
}
