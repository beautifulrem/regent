'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { AlertTriangle, CheckCircle2, Cpu, ExternalLink, Play, Radio, Rocket } from 'lucide-react';
import { MAINNET_PROOF, RELAY_PHASES, parse7702Code } from '../lib/oneshot-finale';
import { shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import type { Dict } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge, TrackTag } from './ui/Badge';

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
      <Panel tone="eth" pad="lg" className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-ink-soft">
          <Radio className="size-4 text-[#8aa0f0]" /> {t.oneShotCtaHint}
        </div>
        <button onClick={run} className="inline-flex items-center gap-2">
          <Play className="size-4" /> {t.oneShotCtaBtn}
        </button>
      </Panel>
    );
  }

  const parsed = parse7702Code(code);

  return (
    <Panel tone="eth" pad="lg" className="mb-3.5">
      <PanelHeader
        icon={Rocket}
        title={t.oneShotTitle}
        track={<TrackTag tone="eth" icon={Cpu}>1Shot · mainnet 7710 + 7702</TrackTag>}
        right={<Badge tone="eth">{t.oneShotMainnet}</Badge>}
      />

      {/* relay stepper */}
      <div className="flex flex-wrap gap-4">
        {RELAY_PHASES.map((p, i) => {
          const state = step > i ? 'done' : step === i ? 'current' : 'idle';
          return (
            <div key={p.key} className={cn('inline-flex items-center gap-2 transition-opacity', state === 'idle' ? 'opacity-45' : 'opacity-100')}>
              <span className={cn('size-2.5 rounded-full', state === 'done' ? 'bg-ok' : state === 'current' ? 'bg-brand motion-safe:animate-glow' : 'bg-line')} />
              <span className="text-[13px] text-ink-soft">
                {t.relayPhases[p.key]} <span className="font-mono text-[11px] text-ink-mute">· {p.code}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* burner 7702 upgrade — genuinely live read-only eth_getCode on Base mainnet */}
      <div className={cn('mt-4 rounded-xl border bg-surface-2/60 px-4 py-3.5 transition-colors', parsed.upgraded ? 'border-brand/40' : 'border-hairline')}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
          {t.oneShotBurner}
          <a className="font-mono text-info hover:underline" href={`${MAINNET_PROOF.basescan}/address/${MAINNET_PROOF.burner}`} target="_blank" rel="noreferrer">
            {shortHex(MAINNET_PROOF.burner, 4)} ↗
          </a>
        </div>
        {phase === 'running' && !code && (
          <div className="mt-2 font-mono text-[11px] text-ink-mute motion-safe:animate-pulse">{t.oneShotChecking}</div>
        )}
        {parsed.upgraded && (
          <motion.div
            className="mt-2"
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
          >
            <Badge tone="brand">
              <CheckCircle2 className="size-3" /> {t.oneShot7702}
            </Badge>
            <div className="mt-2 break-all font-mono text-[11.5px] text-ink-mute">
              0xef0100<span className="text-brand">{parsed.implementation?.slice(2)}</span>
            </div>
            <div className="mt-1.5 text-[11px] text-ink-mute">
              {t.oneShotImpl} <span className="font-mono text-ink-soft">{shortHex(parsed.implementation, 5)}</span>
            </div>
          </motion.div>
        )}
        {code && !parsed.upgraded && <div className="mt-2 text-[12px] text-bad">{t.oneShotNotUpgraded}</div>}
        {err && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-bad">
            <AlertTriangle className="size-3.5" /> {err}
          </div>
        )}
      </div>

      {/* proof wall — pinned real on-chain artifacts */}
      <div className="mt-4 rounded-xl border border-hairline bg-surface-2/60 px-4 py-3.5">
        <div className="flex flex-wrap gap-2">
          <Badge tone="ok">{t.oneShotGasUsdc}</Badge>
          <Badge tone="neutral">{t.oneShotBurnerNoEth}</Badge>
        </div>
        <a
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[12px] text-info hover:underline"
          href={`${MAINNET_PROOF.basescan}/tx/${MAINNET_PROOF.castVoteTx}`}
          target="_blank"
          rel="noreferrer"
        >
          {t.oneShotCastVoteTx} {shortHex(MAINNET_PROOF.castVoteTx, 6)} <ExternalLink className="size-3" />
        </a>
        <div className="mt-2 text-[11px] leading-relaxed text-ink-mute">{t.oneShotBundle}</div>
      </div>
    </Panel>
  );
}
