'use client';

import type { ComponentType } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { CheckCircle2, Minus, Plus, Scissors, ShieldCheck, Vote, Zap } from 'lucide-react';
import { grantDisabled, voteActiveDisabled } from '../../lib/flow';
import { MandateStats } from '../panels/MandateStats';
import { Badge } from '../ui/Badge';
import type { MissionVM } from '../MissionControl';

const VOTES_MIN = 1;
const VOTES_MAX = 50;
const DAYS_MIN = 1;
const DAYS_MAX = 365;

const MODES = [
  { key: 'votes' as const, labelKey: 'boundModeVotes' as const },
  { key: 'days' as const, labelKey: 'boundModeDays' as const },
  { key: 'both' as const, labelKey: 'boundModeBoth' as const },
];

/**
 * The control cluster below the graph — the only thing the user drives. Pre-grant it surfaces the
 * voting-mandate stance presets, the trimmed scope sentence + on-chain-enforced chips, the bound
 * mode + vote/day steppers, and the primary CTA (Connect → Grant). Once granted it swaps to the live
 * mandate readout (MandateStats) + "let the agent vote" + Recall. Post-sever it keeps the vote
 * action live (so a fresh attempt visibly reverts on-chain) under the severed notice.
 */
export function ScopeBlock({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const { openConnectModal } = useConnectModal();
  const granted = !!vm.grantRunId;
  const killed = vm.killed;
  const voted = vm.statusKey === 'voted';

  const grantOff = grantDisabled({ busy: vm.busy, hasConfig: !!vm.cfg, connected: vm.isConnected, status: vm.s, killed });
  const voteOff = voteActiveDisabled({ hasGrant: granted, busy: vm.busy, running: vm.running, killed });

  // Only the pre-grant scope sentence. Once granted, the MandateStats readout + the on-chain chips
  // already say everything; the old "n/10 votes used · revocable" line just repeated them.
  const sentence = !granted && !killed ? t.scopeSentence : null;

  return (
    <div className="flex w-full max-w-[720px] flex-col items-center gap-3.5">
      {/* live mandate readout / severed notice */}
      {granted && (
        <div className="flex flex-col items-center gap-2">
          <MandateStats
            boundMode={vm.boundMode}
            maxVotes={vm.maxVotes}
            ttlDays={vm.ttlDays}
            votesUsed={vm.votesUsed}
            grantedAt={vm.grantedAt}
            killed={killed}
            t={t}
          />
          {voted && !killed && (
            <Badge tone="ok">
              <CheckCircle2 className="size-3" /> {t.voteCast}
            </Badge>
          )}
          {killed && (
            <p className="max-w-[460px] text-center text-[13px] leading-relaxed text-ink-soft">
              <Scissors className="mr-1.5 inline size-4 -translate-y-px text-bad" />
              <strong className="text-bad">{t.severedBold}</strong> {t.severedRest}
            </p>
          )}
        </div>
      )}

      {/* scope sentence */}
      {sentence && <p className="m-0 max-w-[560px] text-center text-[15px] text-ink-soft">{sentence}</p>}

      {/* on-chain-enforced chip row */}
      {!killed && (
        <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[12.5px] font-semibold text-brand">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> {t.scopeEnforced}
          </span>
          <span className="text-ink-mute">·</span>
          <span>{t.scopeVoteOnly}</span>
          <span className="text-ink-mute">·</span>
          <span>{t.scopeRevocable}</span>
        </div>
      )}

      {/* pre-grant configurator */}
      {!granted && !killed && (
        <>
          <div className="mc-seg" role="tablist">
            {MODES.map((m) => (
              <button key={m.key} type="button" className={vm.boundMode === m.key ? 'on' : ''} onClick={() => vm.setBoundMode(m.key)}>
                {t[m.labelKey] as string}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-7">
            {vm.boundMode !== 'days' && (
              <Stepper
                value={vm.maxVotes}
                unit={t.grantVotesUnit}
                onDec={() => vm.setMaxVotes(Math.max(VOTES_MIN, vm.maxVotes - 1))}
                onInc={() => vm.setMaxVotes(Math.min(VOTES_MAX, vm.maxVotes + 1))}
                atMin={vm.maxVotes <= VOTES_MIN}
                atMax={vm.maxVotes >= VOTES_MAX}
              />
            )}
            {vm.boundMode !== 'votes' && (
              <Stepper
                value={vm.ttlDays}
                unit={t.grantDaysUnit}
                onDec={() => vm.setTtlDays(Math.max(DAYS_MIN, vm.ttlDays - 1))}
                onInc={() => vm.setTtlDays(Math.min(DAYS_MAX, vm.ttlDays + 1))}
                atMin={vm.ttlDays <= DAYS_MIN}
                atMax={vm.ttlDays >= DAYS_MAX}
              />
            )}
          </div>
        </>
      )}

      {/* buttons */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
        {!vm.isConnected ? (
          <button type="button" className="mc-btn big" onClick={() => openConnectModal?.()}>
            <Zap className="size-[18px]" strokeWidth={2.5} /> {t.connect}
          </button>
        ) : !granted ? (
          <button type="button" className="mc-btn big" onClick={vm.onGrant} disabled={grantOff}>
            <Zap className="size-[18px]" strokeWidth={2.5} /> {vm.busy ? t.signing : t.grant}
          </button>
        ) : (
          <>
            <button type="button" className="mc-btn" onClick={vm.onVoteActive} disabled={voteOff}>
              <Vote className="size-[17px]" strokeWidth={2.5} /> {vm.busy && vm.running ? t.signing : t.voteActive}
            </button>
            {!killed && (
              <button type="button" className="mc-btn danger" onClick={vm.onRecall} disabled={vm.recalling} title={t.recallTitle}>
                <Scissors className="size-[17px]" strokeWidth={2.5} /> {vm.recalling ? t.severing : t.recall}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stepper({
  value,
  unit,
  onDec,
  onInc,
  atMin,
  atMax,
}: {
  value: number;
  unit: string;
  onDec: () => void;
  onInc: () => void;
  atMin: boolean;
  atMax: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-3">
      <StepBtn icon={Minus} onClick={onDec} disabled={atMin} label={`− ${unit}`} />
      <span className="mc-stepval">
        {value}
        <span className="mc-stepunit">{unit}</span>
      </span>
      <StepBtn icon={Plus} onClick={onInc} disabled={atMax} label={`+ ${unit}`} />
    </div>
  );
}

function StepBtn({
  icon: Icon,
  onClick,
  disabled,
  label,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button type="button" className="mc-step" onClick={onClick} disabled={disabled} aria-label={label}>
      <Icon className="size-4" strokeWidth={2.5} />
    </button>
  );
}
