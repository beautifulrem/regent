'use client';

import type { ComponentType } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Minus, Plus, Scissors, Vote, Zap } from 'lucide-react';
import { grantDisabled, voteActiveDisabled } from '../../lib/flow';
import { type Dict } from '../../lib/i18n';
import { cn } from '../../lib/cn';
import { MandateStats } from './MandateStats';
import { MandateSentence } from './MandateSentence';
import type { MissionVM } from '../MissionControl';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const MODES: { key: 'votes' | 'days' | 'both'; labelKey: keyof Dict }[] = [
  { key: 'votes', labelKey: 'boundModeVotes' },
  { key: 'days', labelKey: 'boundModeDays' },
  { key: 'both', labelKey: 'boundModeBoth' },
];

const VOTES_MIN = 1;
const VOTES_MAX = 50;
const DAYS_MIN = 1;
const DAYS_MAX = 365;

/**
 * Frameless bottom-center control cluster — the only thing the user drives. Pre-grant it shows the
 * standing-scope configurator (bound-mode toggle + vote/day steppers) and the primary Grant CTA;
 * once granted it swaps to the standing status + "let the agent vote this proposal" (reuses the
 * grant, no re-sign) + the danger Recall. Post-kill the Recall is gone, the vote action stays live
 * (so a fresh attempt visibly reverts), and the hint flips to the severed copy. No card chrome.
 */
export function ActionBar({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const reduce = useReducedMotion();
  const granted = !!vm.grantRunId;
  const grantOff = grantDisabled({
    busy: vm.busy,
    hasConfig: !!vm.cfg,
    connected: vm.isConnected,
    status: vm.s,
    killed: vm.killed,
  });
  const voteOff = voteActiveDisabled({
    hasGrant: granted,
    busy: vm.busy,
    running: vm.running,
    killed: vm.killed,
  });
  const showVotes = vm.boundMode !== 'days';
  const showDays = vm.boundMode !== 'votes';

  const enter = reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

  return (
    <div className="absolute inset-x-0 bottom-12 z-[3] flex flex-col items-center px-4">
      <AnimatePresence mode="wait" initial={false}>
        {!granted ? (
          <motion.div key="config" {...enter} transition={{ duration: 0.3, ease: EASE }} className="flex flex-col items-center gap-3">
            {/* the mandate you're about to sign, in plain English (lead-in) */}
            {vm.isConnected && (
              <MandateSentence boundMode={vm.boundMode} maxVotes={vm.maxVotes} ttlDays={vm.ttlDays} t={t} />
            )}

            {/* bound-mode segmented toggle */}
            <div className="flex items-center gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => vm.setBoundMode(m.key)}
                  aria-pressed={vm.boundMode === m.key}
                  className={cn(
                    'rounded-chip! border! bg-none! px-3.5! py-1.5! text-[11px]! font-bold! shadow-none! transition-colors duration-200',
                    vm.boundMode === m.key
                      ? 'border-brand/50! bg-brand/15! text-brand!'
                      : 'border-transparent! bg-transparent! text-ink-mute! hover:text-ink!',
                  )}
                >
                  {t[m.labelKey] as string}
                </button>
              ))}
            </div>

            {/* vote / day steppers */}
            <div className="flex items-center gap-6">
              {showVotes && (
                <Stepper
                  value={vm.maxVotes}
                  unit={t.grantVotesUnit}
                  onDec={() => vm.setMaxVotes(Math.max(VOTES_MIN, vm.maxVotes - 1))}
                  onInc={() => vm.setMaxVotes(Math.min(VOTES_MAX, vm.maxVotes + 1))}
                  atMin={vm.maxVotes <= VOTES_MIN}
                  atMax={vm.maxVotes >= VOTES_MAX}
                />
              )}
              {showDays && (
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

            {/* primary CTA — the base :where(button) brand pill is exactly the primary look */}
            <button onClick={vm.onGrant} disabled={grantOff} className="big inline-flex items-center gap-2">
              <Zap className="size-4" strokeWidth={2.5} />
              {vm.busy ? t.signing : t.grant}
            </button>

            {!vm.isConnected && (
              <div className="max-w-[480px] text-center">
                <p className="font-display text-[15px] font-semibold leading-snug text-ink/90">
                  {t.heroLine1} {t.heroLine2}
                </p>
                <p className="mt-1 text-[12px] text-ink-mute/80">{t.connect}</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="live" {...enter} transition={{ duration: 0.3, ease: EASE }} className="flex flex-col items-center gap-3">
            <MandateStats
              boundMode={vm.boundMode}
              maxVotes={vm.maxVotes}
              ttlDays={vm.ttlDays}
              votesUsed={vm.votesUsed}
              grantedAt={vm.grantedAt}
              killed={vm.killed}
              t={t}
            />

            <div className="flex items-center gap-3">
              <button
                onClick={vm.onVoteActive}
                disabled={voteOff}
                className="inline-flex items-center gap-2 bg-none! bg-surface-2/80! text-ink! shadow-none! ring-1 ring-line transition-colors hover:text-brand! hover:ring-brand/50! disabled:opacity-40!"
              >
                <Vote className="size-4" strokeWidth={2.5} />
                {t.voteActive}
              </button>

              {!vm.killed && (
                <button
                  onClick={vm.onRecall}
                  disabled={vm.recalling}
                  title={t.recallTitle}
                  className="danger inline-flex items-center gap-2"
                >
                  <Scissors className="size-4" strokeWidth={2.5} />
                  {vm.recalling ? t.severing : t.recall}
                </button>
              )}
            </div>

            <p className="max-w-[460px] text-center text-[12px] leading-relaxed text-ink-mute/85">
              {vm.killed ? t.actionDeadHint : t.actionLiveHint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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
    <div className="flex items-center gap-2.5">
      <StepBtn icon={Minus} onClick={onDec} disabled={atMin} label={`− ${unit}`} />
      <div className="min-w-[58px] text-center">
        <span className="font-mono text-xl font-bold tabular-nums text-ink">{value}</span>
        <span className="ml-1 text-[11px] font-medium text-ink-mute">{unit}</span>
      </div>
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
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid! size-7! place-items-center! rounded-full! border! border-hairline! bg-surface-2/70! p-0! text-ink-soft! shadow-none! transition-colors hover:border-brand/45! hover:text-brand! disabled:opacity-35!"
    >
      <Icon className="size-3.5" strokeWidth={2.5} />
    </button>
  );
}
