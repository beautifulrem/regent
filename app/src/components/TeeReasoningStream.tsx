'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { VeniceTrace } from '@mandate/shared';
import type { Dict } from '../lib/i18n';

const decisionClass = (d?: string) => (d === 'For' ? 'green' : d === 'Against' ? 'red' : 'amber');

/**
 * Replays the Venice TEE model's private reasoning progressively (it arrives all at once on the
 * 'decided' poll; we reveal it client-side so a judge SEES the AI think), then crystallizes the
 * For/Against verdict out of the final JSON line. The console is honestly labelled as a replay;
 * the decision shown is the real venice.decision the analyst cast on-chain.
 */
export function TeeReasoningStream({ venice, t }: { venice: VeniceTrace; t: Dict }) {
  const reduce = useReducedMotion();
  const full = (venice.reasoning && venice.reasoning.trim()) || t.teeFallbackReasoning;
  const [shown, setShown] = useState(reduce ? full.length : 0);
  const done = shown >= full.length;

  useEffect(() => {
    if (reduce) {
      setShown(full.length);
      return;
    }
    setShown(0);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(full.length, i + 3);
      setShown(i);
      if (i >= full.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [full, reduce]);

  const jsonLine = `{"decision":"${venice.decision}","rationale":"${venice.rationale}"}`;

  return (
    <div className="tee-console mt-lg">
      <div className="tee-console-head">
        <span className="tee-lock" aria-hidden>🔒</span>
        <span className="label">{t.teeConsoleTitle}</span>
        <span className="mono label tee-model">{venice.model}</span>
        {venice.attestation.verified && <span className="pill green">{t.teeAttested}</span>}
      </div>
      <div className="tee-console-body mono">
        {full.slice(0, shown)}
        {!done && <span className="tee-caret" aria-hidden />}
      </div>
      {done && (
        <motion.div
          className="tee-verdict mt-sm"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mono tee-json">{jsonLine}</div>
          <div className="decision mt-sm row gap-sm">
            <span className="label">{t.aiDecided}</span>
            <motion.span
              className={`pill ${decisionClass(venice.decision)}`}
              initial={reduce ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 18 }}
            >
              {venice.decision}
            </motion.span>
            <span className="rationale" style={{ flexBasis: '100%' }}>“{venice.rationale}”</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
