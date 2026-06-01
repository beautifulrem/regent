'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Activity, Coins, Globe, Lock, Rocket, Vote } from 'lucide-react';
import { cn } from '../../lib/cn';
import { VoteTally } from '../VoteTally';
import { X402TollGate } from '../X402TollGate';
import { OneShotFinale } from '../OneShotFinale';
import { TeeReasoningStream } from '../TeeReasoningStream';
import { VoteResultBanner } from '../panels/VoteResultBanner';
import { ProofTimeline } from '../panels/ProofTimeline';
import { VoteLog } from '../panels/VoteLog';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import type { MissionVM } from '../MissionControl';

type TabKey = 'tally' | 'x402' | 'oneShot' | 'run';
const TABS: { key: TabKey; icon: ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { key: 'tally', icon: Vote },
  { key: 'x402', icon: Coins },
  { key: 'oneShot', icon: Rocket },
  { key: 'run', icon: Activity },
];

/**
 * The execution-side sidebar — collapsible (Gemini-style) with the dossier organized into TABS so
 * each section gets the full panel width instead of being stacked/cramped: DAO Tally · x402 · 1Shot
 * · Run (the live TEE reasoning + vote result + proof + per-mandate vote log). Auto-switches to Run
 * when a run starts. Collapsed, it's an icon rail; clicking an icon expands to that tab.
 */
export function RightSidebar({ vm, collapsed, onToggle }: { vm: MissionVM; collapsed: boolean; onToggle: () => void }) {
  const { t } = vm;
  const [tab, setTab] = useState<TabKey>('tally');
  const runActive = !!vm.venice || !!vm.run;

  useEffect(() => {
    if (runActive) setTab('run');
  }, [runActive]);

  const pick = (k: TabKey) => {
    setTab(k);
    if (collapsed) onToggle();
  };

  return (
    <CollapsibleSidebar
      side="right"
      collapsed={collapsed}
      onToggle={onToggle}
      width={384}
      label={vm.lang === 'zh' ? '档案' : 'dossier'}
      rail={
        <div className="flex h-full flex-col items-center gap-1.5 pt-14">
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => pick(key)}
              aria-label={t.tabs[key]}
              title={t.tabs[key]}
              className={cn(
                'relative grid! size-9! place-items-center! rounded-lg! border! border-transparent! bg-none! p-0! text-ink-mute! shadow-none! transition-colors hover:border-hairline! hover:text-ink!',
                tab === key && 'border-hairline! bg-surface-2/70! text-brand!',
              )}
            >
              <Icon className="size-[18px]" strokeWidth={2} />
              {key === 'run' && runActive && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
      }
      expanded={
        <div className="flex h-full flex-col">
          <div role="tablist" className="flex flex-wrap items-center gap-1 border-b border-hairline px-3 pb-2 pl-12 pt-3">
            {TABS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-chip! border! bg-none! px-2.5! py-1! text-[11px]! font-semibold! shadow-none! transition-colors',
                  tab === key ? 'border-brand/30! bg-brand/12! text-brand!' : 'border-transparent! text-ink-mute! hover:text-ink!',
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} /> {t.tabs[key]}
                {key === 'run' && runActive && <span className="size-1.5 rounded-full bg-brand" />}
              </button>
            ))}
          </div>

          <div className="hud-scroll flex-1 overflow-y-auto overflow-x-hidden p-4">
            {tab === 'tally' &&
              (vm.cfg ? (
                <VoteTally proposalId={vm.activeProposal.id} seed={vm.activeProposal.seed} you={vm.userSA?.address} t={t} bare />
              ) : null)}
            {tab === 'x402' && (vm.cfg ? <X402TollGate cfg={vm.cfg} t={t} bare /> : null)}
            {tab === 'oneShot' && <OneShotFinale t={t} bare />}
            {tab === 'run' &&
              (runActive ? (
                <div className="flex flex-col gap-5">
                  {vm.venice && !vm.killed && (
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-info/80">
                        <Lock className="size-3" /> {t.split.private}
                      </div>
                      <TeeReasoningStream venice={vm.venice} t={t} />
                    </div>
                  )}
                  {(vm.run?.vote || vm.killed) && (
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ok/80">
                        <Globe className="size-3" /> {t.split.public}
                      </div>
                      <VoteResultBanner run={vm.run} killed={vm.killed} recallTx={vm.recallTx} userSAAddress={vm.userSA?.address} t={t} />
                    </div>
                  )}
                  {vm.run && <ProofTimeline run={vm.run} killed={vm.killed} t={t} />}
                  {vm.voteLog.length > 0 && <VoteLog records={vm.voteLog} lang={vm.lang} t={t} />}
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-ink-mute/80">{t.tabs.noRun}</p>
              ))}
          </div>
        </div>
      }
    />
  );
}
