'use client';

import type { ComponentType } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Cpu, ExternalLink, Minus, Play, Plus, Scissors, ShieldCheck, Sparkles, Vote, Zap } from 'lucide-react';
import { grantDisabled, voteActiveDisabled } from '../../lib/flow';
import { MandateStats } from '../panels/MandateStats';
import { MAINNET_SNAPSHOT } from '../../lib/mainnet-snapshot';
import { shortHex } from '../../lib/config';
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

const EASE_FLUID: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_SNAPPY: [number, number, number, number] = [0.2, 0, 0, 1];

/**
 * The control cluster below the graph — the only thing the user drives. Pre-grant it surfaces the
 * trimmed scope sentence + on-chain-enforced chips, the bound mode + vote/day steppers, and the
 * primary CTA (Connect → Grant). Once granted it swaps to the live mandate readout (MandateStats) +
 * "let the agent vote" + Recall. Once SEVERED everything goes dead: the vote button is disabled,
 * Recall is hidden, the enforced-scope chips drop away, and only the 0%-authority stats + the
 * severed notice remain.
 *
 * The pre-grant ↔ post-grant swap is wrapped in AnimatePresence so the content crossfades with a
 * blur+slide instead of snapping.
 */
export function ScopeBlock({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const { openConnectModal } = useConnectModal();
  const granted = !!vm.grantRunId;
  const killed = vm.killed;
  const voted = vm.runOnActive && vm.statusKey === 'voted';

  const grantOff = grantDisabled({ busy: vm.busy, hasConfig: !!vm.cfg, connected: vm.isConnected, status: vm.s, killed });
  const voteOff = voteActiveDisabled({ hasGrant: granted, busy: vm.busy, running: vm.running, killed });

  const sentence = !granted && !killed ? t.scopeSentence : null;
  const noMotion = !!useReducedMotion();

  const revealIn = noMotion ? false : { opacity: 0, y: 24, filter: 'blur(8px)' };
  const revealAnimate = {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: noMotion ? 0 : 0.5, ease: EASE_FLUID },
  };
  const revealOut = noMotion
    ? { opacity: 0, transition: { duration: 0 } }
    : { opacity: 0, y: -16, filter: 'blur(6px)', transition: { duration: 0.28, ease: EASE_SNAPPY } };

  return (
    <div className="flex w-full max-w-[720px] flex-col items-center gap-3.5">
      <AnimatePresence mode="wait" initial={false}>
        {granted ? (
          <motion.div
            key="granted"
            initial={revealIn}
            animate={revealAnimate}
            exit={revealOut}
            className="flex w-full flex-col items-center gap-3.5"
          >
            {/* live mandate readout / severed notice — the vote-budget/TTL/authority stats are a TESTNET
                standing-grant concept; the mainnet replay is a one-shot recorded run, so they're hidden. */}
            <div className="flex flex-col items-center gap-2">
              {!vm.replayMode && (
                <MandateStats
                  boundMode={vm.boundMode}
                  maxVotes={vm.maxVotes}
                  ttlDays={vm.ttlDays}
                  votesUsed={vm.votesUsed}
                  grantedAt={vm.grantedAt}
                  killed={killed}
                  t={t}
                />
              )}
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

            {/* buttons — replay controls in mainnet replay, else live vote/recall */}
            {vm.replayMode ? (
              <ReplayControls vm={vm} />
            ) : (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
                <button type="button" className="mc-btn" onClick={vm.onVoteActive} disabled={voteOff}>
                  <Vote className="size-[17px]" strokeWidth={2.5} /> {vm.busy && vm.running ? t.signing : t.voteActive}
                </button>
                {!killed && (
                  <button type="button" className="mc-btn danger" onClick={vm.onRecall} disabled={vm.recalling} title={t.recallTitle}>
                    <Scissors className="size-[17px]" strokeWidth={2.5} /> {vm.recalling ? t.severing : t.recall}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        ) : !killed ? (
          <motion.div
            key="pre-grant"
            initial={revealIn}
            animate={revealAnimate}
            exit={revealOut}
            className="flex w-full flex-col items-center gap-3.5"
          >
            {/* scope sentence */}
            {sentence && <p className="m-0 max-w-[560px] text-center text-[15px] text-ink-soft">{sentence}</p>}

            {/* on-chain-enforced chip row */}
            <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[12.5px] font-semibold text-brand">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" /> {t.scopeEnforced}
              </span>
              <span className="text-ink-mute">·</span>
              <span>{t.scopeVoteOnly}</span>
              <span className="text-ink-mute">·</span>
              <span>{t.scopeRevocable}</span>
            </div>

            {/* pre-grant configurator */}
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

            {/* buttons */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
              {!vm.isConnected ? (
                <button type="button" className="mc-btn big" onClick={() => openConnectModal?.()}>
                  <Zap className="size-[18px]" strokeWidth={2.5} /> {t.connect}
                </button>
              ) : (
                <button type="button" className="mc-btn big" onClick={vm.onGrant} disabled={grantOff}>
                  <Zap className="size-[18px]" strokeWidth={2.5} /> {vm.busy ? t.signing : t.grant}
                </button>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Mainnet-replay controls: a Replay button + BaseScan proof links for the recorded 1Shot run. */
function ReplayControls({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const snap = MAINNET_SNAPSHOT;
  const bs = snap?.chain.basescan ?? 'https://basescan.org';
  return (
    <div className="mt-1 flex flex-col items-center gap-3">
      <button type="button" className="mc-btn big" onClick={vm.onReplay} disabled={vm.replaying}>
        <Play className="size-[18px]" strokeWidth={2.5} /> {vm.replaying ? t.replaying : t.replayRun}
      </button>
      {snap && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px]">
          <a className="inline-flex items-center gap-1.5 text-info hover:underline" href={`${bs}/tx/${snap.vote.txHash}`} target="_blank" rel="noreferrer">
            <Sparkles className="size-3.5" /> {t.proofVote} {shortHex(snap.vote.txHash, 5)} <ExternalLink className="size-3" />
          </a>
          <a className="inline-flex items-center gap-1.5 text-info hover:underline" href={`${bs}/address/${snap.oneshot.burner}`} target="_blank" rel="noreferrer">
            <Cpu className="size-3.5" /> {t.proofBurner} {shortHex(snap.oneshot.burner, 4)} <ExternalLink className="size-3" />
          </a>
        </div>
      )}
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
