'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { MAINNET_PROOF, RELAY_PHASES, parse7702Code } from '../lib/oneshot-finale';
import { shortHex } from '../lib/config';
import type { Dict } from '../lib/i18n';

type Phase = 'idle' | 'running' | 'done';

/**
 * The 1Shot mainnet finale (Best 1Shot + 7702 + 7710 mainnet relay). Honestly labelled a replay
 * of the real relay: the stepper + tx + USDC fee are pinned real artifacts, but the 7702-upgrade
 * proof is a GENUINELY LIVE, free, read-only eth_getCode on Base mainnet — no wallet, no gas.
 */
export function OneShotFinale({ t }: { t: Dict }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setPhase('running');
    setErr(null);
    setStep(0);
    setCode(null);
    try {
      for (let i = 1; i <= RELAY_PHASES.length; i++) {
        await new Promise((r) => setTimeout(r, reduce ? 0 : 520));
        setStep(i);
      }
      const client = createPublicClient({ chain: base, transport: http(MAINNET_PROOF.rpc) });
      const c = await client.getCode({ address: MAINNET_PROOF.burner });
      setCode(c ?? '0x');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase('done');
    }
  }

  if (phase === 'idle') {
    return (
      <div className="card oneshot-cta row spread">
        <div className="label">{t.oneShotCtaHint}</div>
        <button onClick={run}>{t.oneShotCtaBtn}</button>
      </div>
    );
  }

  const parsed = parse7702Code(code);

  return (
    <div className="card oneshot-finale">
      <div className="row spread mb-0">
        <div className="card-title">{t.oneShotTitle}</div>
        <span className="chain-badge oneshot-mainnet">{t.oneShotMainnet}</span>
      </div>

      <div className="relay-steps mt-md">
        {RELAY_PHASES.map((p, i) => (
          <div key={p.key} className={`relay-step ${step > i ? 'done' : step === i ? 'current' : ''}`}>
            <span className="relay-dot" />
            <span className="label">
              {t.relayPhases[p.key]} <span className="mono">· {p.code}</span>
            </span>
          </div>
        ))}
      </div>

      <div className={`burner-upgrade mt-md ${parsed.upgraded ? 'upgraded' : ''}`}>
        <div className="label">
          {t.oneShotBurner}{' '}
          <a className="mono" href={`${MAINNET_PROOF.basescan}/address/${MAINNET_PROOF.burner}`} target="_blank" rel="noreferrer">
            {shortHex(MAINNET_PROOF.burner, 4)} ↗
          </a>
        </div>
        {phase === 'running' && !code && <div className="mono label mt-sm">{t.oneShotChecking}</div>}
        {parsed.upgraded && (
          <motion.div className="mt-sm" initial={reduce ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="pill brand">{t.oneShot7702}</span>
            <div className="mono oneshot-code mt-sm">
              0xef0100<span className="oneshot-impl">{parsed.implementation?.slice(2)}</span>
            </div>
            <div className="label mt-sm">
              {t.oneShotImpl} <span className="mono">{shortHex(parsed.implementation, 5)}</span>
            </div>
          </motion.div>
        )}
        {code && !parsed.upgraded && <div className="err mt-sm">{t.oneShotNotUpgraded}</div>}
        {err && <div className="err mt-sm">⚠ {err}</div>}
      </div>

      <div className="proof-wall mt-md">
        <div className="row gap-sm">
          <span className="pill green">{t.oneShotGasUsdc}</span>
          <span className="pill">{t.oneShotBurnerNoEth}</span>
        </div>
        <a className="mono mt-sm" style={{ display: 'inline-block' }} href={`${MAINNET_PROOF.basescan}/tx/${MAINNET_PROOF.castVoteTx}`} target="_blank" rel="noreferrer">
          {t.oneShotCastVoteTx} {shortHex(MAINNET_PROOF.castVoteTx, 6)} ↗
        </a>
        <div className="label mt-sm">{t.oneShotBundle}</div>
      </div>
    </div>
  );
}
