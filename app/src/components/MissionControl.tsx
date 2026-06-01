'use client';

import type { RefObject } from 'react';
import type { Address } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ShieldCheck } from 'lucide-react';
import type { DaoProposal, Delegation, RunStatus } from '@mandate/shared';
import type { DemoConfig } from '../lib/orchestrator';
import type { SmartAccount } from '../lib/wallet';
import type { Dict, Lang } from '../lib/i18n';
import { cn } from '../lib/cn';
import { LangToggle } from './LangToggle';
import { StatusDot } from './ui/Badge';
import { GraphStage } from './graph/GraphStage';
import { ProposalDock } from './proposal/ProposalDock';
import { ActionBar } from './panels/ActionBar';

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
      {/* full-bleed living graph (React Flow) — the immersive centerpiece */}
      <div ref={vm.graphStageRef} className="absolute inset-0">
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

      {/* contextual HUD — frameless floating zones (filled in MC-S6/S7) */}
      <HudZone className="left-6 top-36 w-[300px]" label="grant side · MC-S6" hint="SmartAccount · X-Ray · Tamper" />
      <HudZone className="right-6 top-36 w-[320px] items-end text-right" label="execution · MC-S7" hint="TEE · tally · proof · x402 · 1Shot" />

      {/* soft bottom scrim */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-base/90 to-transparent" aria-hidden />

      {/* Action zone — frameless bottom-center controls */}
      <ActionBar vm={vm} />

      {/* Track rail — frameless glowing chips, the always-visible judges' checklist (MC-S8) */}
      <div className="absolute inset-x-0 bottom-4 z-[3] flex items-center justify-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-mute/70">
        {['4337', '7710', 'A2A', 'TEE', 'x402', '1Shot'].map((k) => (
          <span key={k} className="transition-colors hover:text-brand">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A borderless floating HUD label zone — no box, just typography over the graph. */
function HudZone({ className, label, hint }: { className?: string; label: string; hint: string }) {
  return (
    <div className={cn('absolute z-[3] flex flex-col gap-1', className)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-mute/60">{label}</div>
      <div className="text-[13px] text-ink-soft/75">{hint}</div>
    </div>
  );
}
