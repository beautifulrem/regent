'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Globe, Lock } from 'lucide-react';
import { TeeReasoningStream } from '../TeeReasoningStream';
import { VoteTally } from '../VoteTally';
import { X402TollGate } from '../X402TollGate';
import { OneShotFinale } from '../OneShotFinale';
import { VoteResultBanner } from '../panels/VoteResultBanner';
import { ProofTimeline } from '../panels/ProofTimeline';
import { VoteLog } from '../panels/VoteLog';
import type { MissionVM } from '../MissionControl';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * The execution-side HUD column (frameless), floating over the right margin of the living graph.
 * Reveals the run's evidence contextually: the Venice TEE reasoning, the vote/severed outcome, the
 * under-the-hood proof timeline, the full DAO tally, the x402 toll, and the 1Shot mainnet finale —
 * the always-available capabilities (tally/x402/1Shot) double as the idle showcase before any run.
 */
export function RightDossier({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const showTee = !!vm.venice && !vm.killed;
  const showResult = !!vm.run?.vote || vm.killed;
  const showProof = !!vm.run;
  const showTally = !!vm.cfg;

  return (
    <div className="pointer-events-auto absolute right-5 top-[132px] z-[3] hidden max-h-[calc(100dvh-208px)] w-[340px] flex-col gap-6 overflow-y-auto overflow-x-hidden pl-1 pb-4 hud-scroll lg:flex">
      <AnimatePresence initial={false}>
        {showTee && (
          <Reveal key="tee">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-info/80">
              <Lock className="size-3" /> {t.split.private}
              <span className="text-info/45">· {t.teeConsoleTitle}</span>
            </div>
            <TeeReasoningStream venice={vm.venice!} t={t} />
          </Reveal>
        )}
        {showResult && (
          <Reveal key="result">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ok/80">
              <Globe className="size-3" /> {t.split.public}
            </div>
            <VoteResultBanner run={vm.run} killed={vm.killed} recallTx={vm.recallTx} userSAAddress={vm.userSA?.address} t={t} />
          </Reveal>
        )}
        {showProof && (
          <Reveal key="proof">
            <ProofTimeline run={vm.run!} killed={vm.killed} t={t} />
          </Reveal>
        )}
        {vm.voteLog.length > 0 && (
          <Reveal key="votelog">
            <VoteLog records={vm.voteLog} lang={vm.lang} t={t} />
          </Reveal>
        )}
        {showTally && (
          <Reveal key="tally">
            <VoteTally proposalId={vm.activeProposal.id} seed={vm.activeProposal.seed} you={vm.userSA?.address} t={t} bare />
          </Reveal>
        )}
        {showTally && (
          <Reveal key="x402">
            <X402TollGate cfg={vm.cfg!} t={t} bare />
          </Reveal>
        )}
        <Reveal key="oneshot">
          <OneShotFinale t={t} bare />
        </Reveal>
      </AnimatePresence>
    </div>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 18 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
