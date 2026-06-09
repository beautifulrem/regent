'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { AlertTriangle, CheckCircle2, Coins, Cpu, ExternalLink, Lock, Play, Radio, Rocket, Scale, Sparkles, type LucideIcon } from 'lucide-react';
import { MAINNET_PROOF, RELAY_PHASES, parse7702Code } from '../lib/oneshot-finale';
import { MAINNET_SNAPSHOT } from '../lib/mainnet-snapshot';
import { shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import type { Dict } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge, TrackTag } from './ui/Badge';

type Phase = 'idle' | 'running' | 'done';

const FLOW_NODES: { icon: LucideIcon; label: string; at: number }[] = [
  { icon: Lock, label: '7710', at: 1 },
  { icon: Rocket, label: '1Shot', at: 1 },
  { icon: Cpu, label: 'Burner', at: 2 },
  { icon: CheckCircle2, label: 'castVote', at: 3 },
];

function OneShotFlow({ step, upgraded }: { step: number; upgraded: boolean }) {
  return (
    <div className="mb-4 flex items-start">
      {FLOW_NODES.map((n, i) => (
        <Fragment key={n.label}>
          {i > 0 && (
            <div className="min-w-[16px] flex-1" style={{ paddingTop: 15 }}>
              <div className={cn('h-[1.5px] w-full rounded-full transition-all duration-700', step >= n.at ? 'oneshot-beam-lit' : 'bg-line')} />
            </div>
          )}
          <div className="flex flex-col items-center" style={{ flex: '0 0 auto', minWidth: 48 }}>
            <span className={cn('oneshot-disc', step >= n.at && 'on')}>
              <n.icon size={14} strokeWidth={1.8} />
            </span>
            <span className={cn('mt-1.5 whitespace-nowrap text-[9.5px] font-bold tracking-wide transition-colors duration-500', step >= n.at ? 'text-cyan' : 'text-ink-mute')}>
              {n.label}
            </span>
            {n.label === 'Burner' && step >= 2 && (
              <span className="text-[8px] font-semibold text-cyan/70">
                {upgraded ? '7702 ✓ · 0 ETH' : '7702 · 0 ETH'}
              </span>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
      <Icon className="size-3.5" /> {label}
    </div>
  );
}

function SnapshotSections({ t, lang }: { t: Dict; lang: 'en' | 'zh' }) {
  if (!MAINNET_SNAPSHOT) return null;
  const s = MAINNET_SNAPSHOT;
  const bs = s.chain.basescan;

  return (
    <>
      {/* proposal context */}
      <div className="rounded-xl border border-hairline bg-surface-2/60 px-4 py-3">
        <SectionHeader icon={Scale} label={t.oneShotProposalLabel} />
        <div className="text-[13px] font-semibold text-ink">{s.proposal.title[lang]}</div>
        <div className="mt-1 text-[11.5px] leading-snug text-ink-mute">{s.proposal.body[lang]}</div>
      </div>

      {/* Venice TEE decision */}
      <div className="rounded-xl border border-info/25 bg-info/[0.04] px-4 py-3">
        <SectionHeader icon={Sparkles} label={t.oneShotVeniceLabel} />
        <div className="flex items-center gap-2">
          <Badge tone={s.venice.decision === 'For' ? 'ok' : s.venice.decision === 'Against' ? 'bad' : 'warn'}>
            {s.venice.decision}
          </Badge>
          <span className="font-mono text-[11px] text-ink-mute">{s.venice.model}</span>
          {s.venice.attestation.verified && <Badge tone="info">TEE ✓</Badge>}
        </div>
        <div className="mt-2 text-[11.5px] leading-snug text-ink-soft">{s.venice.rationale}</div>

        {/* 4 lens verdicts */}
        {s.lenses.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-ink-mute">{t.oneShotLensesLabel}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {s.lenses.map((l) => (
                <div key={l.lens} className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface/60 px-2 py-1.5">
                  <span className={cn('size-1.5 rounded-full', l.decision === 'For' ? 'bg-ok' : l.decision === 'Against' ? 'bg-bad' : 'bg-warn')} />
                  <span className="text-[10.5px] font-semibold text-ink-soft">{t.presets[l.lens]}</span>
                  <span className={cn('ml-auto text-[10px] font-bold', l.decision === 'For' ? 'text-ok' : l.decision === 'Against' ? 'text-bad' : 'text-warn')}>
                    {l.decision}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* x402 toll — only when a toll was settled alongside this run */}
      {s.toll && (
        <div className="rounded-xl border border-brand/25 bg-brand/[0.04] px-4 py-3">
          <SectionHeader icon={Coins} label={t.oneShotTollLabel} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">1 mUSDC</Badge>
            <a
              className="inline-flex items-center gap-1 font-mono text-[11px] text-info hover:underline"
              href={`${bs}/tx/${s.toll.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {shortHex(s.toll.txHash, 6)} <ExternalLink className="size-2.5" />
            </a>
          </div>
          <div className="mt-1.5 font-mono text-[10.5px] text-ink-mute">
            {shortHex(s.toll.buyer, 4)} → {shortHex(s.toll.seller, 4)}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The 1Shot mainnet finale. When a MAINNET_SNAPSHOT is populated, shows the complete story:
 * proposal context, Venice TEE decision, x402 toll, and the 1Shot relay proof.
 * The 7702-upgrade check is GENUINELY LIVE (free, read-only eth_getCode on Base mainnet).
 */
export function OneShotFinale({
  t,
  bare = false,
  autoRun = false,
  focusRelay = false,
}: {
  t: Dict;
  bare?: boolean;
  /** start the relay playback on mount (inline mainnet detail, no click needed). */
  autoRun?: boolean;
  /** hide the proposal/Venice/x402 sections (already shown by the main graph + TEE console). */
  focusRelay?: boolean;
}) {
  const reduce = useReducedMotion();
  const lang = (t.tally.for === '赞成' ? 'zh' : 'en') as 'en' | 'zh';
  // Prefer the recorded snapshot's run (proposal + Venice + this exact tx) so the proof wall, the 7702
  // check, and the receipt all describe the SAME run shown above; fall back to the pinned MAINNET_PROOF.
  const proof = MAINNET_SNAPSHOT
    ? {
        rpc: MAINNET_SNAPSHOT.chain.rpc,
        basescan: MAINNET_SNAPSHOT.chain.basescan,
        burner: MAINNET_SNAPSHOT.oneshot.burner,
        castVoteTx: MAINNET_SNAPSHOT.vote.txHash,
        block: Number(MAINNET_SNAPSHOT.vote.blockNumber),
        gasUsed: MAINNET_SNAPSHOT.oneshot.gasUsed,
      }
    : MAINNET_PROOF;
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ status: 'success' | 'reverted'; block: string; gasUsed: string; live: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setPhase('running');
    setErr(null);
    setStep(0);
    setCode(null);
    setReceipt(null);
    try {
      for (let i = 1; i <= RELAY_PHASES.length; i++) {
        await new Promise((r) => setTimeout(r, reduce ? 0 : 520));
        setStep(i);
      }
      const client = createPublicClient({ chain: base, transport: http(proof.rpc) });
      const c = await client.getCode({ address: proof.burner });
      setCode(c ?? '0x');
      let rc: { status: 'success' | 'reverted'; block: string; gasUsed: string; live: boolean } = {
        status: 'success',
        block: String(proof.block),
        gasUsed: String(proof.gasUsed),
        live: false,
      };
      try {
        const r = await client.getTransactionReceipt({ hash: proof.castVoteTx });
        rc = { status: r.status, block: r.blockNumber.toString(), gasUsed: r.gasUsed.toString(), live: true };
      } catch {
        /* keep the recorded fallback */
      }
      setReceipt(rc);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase('done');
    }
  }

  // autoRun: kick the relay playback once on mount (inline mainnet detail — no click needed).
  const ranOnce = useRef(false);
  useEffect(() => {
    if (autoRun && !ranOnce.current) {
      ranOnce.current = true;
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  const parsed = parse7702Code(code);

  if (phase === 'idle') {
    return (
      <Panel tone="eth" pad="lg" bare={bare} className={`${bare ? '' : 'mb-3.5 '}flex flex-col items-center gap-3 text-center`}>
        <OneShotFlow step={0} upgraded={false} />
        {MAINNET_SNAPSHOT && (
          <div className="text-[11px] text-ink-mute">{t.oneShotReplayNote}</div>
        )}
        <div className="flex items-center justify-center gap-2 text-[13px] text-ink-soft">
          <Radio className="size-4 shrink-0 text-[#8aa0f0]" /> {t.oneShotCtaHint}
        </div>
        <button onClick={run} className="inline-flex items-center gap-2">
          <Play className="size-4" /> {t.oneShotCtaBtn}
        </button>
      </Panel>
    );
  }

  return (
    <Panel tone="eth" pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
      <PanelHeader
        icon={Rocket}
        title={t.oneShotTitle}
        track={<TrackTag tone="eth" icon={Cpu}>1Shot · mainnet 7710 + 7702</TrackTag>}
        right={<Badge tone="eth">{t.oneShotMainnet}</Badge>}
      />

      {/* visual flow: 7710 → 1Shot → Burner(7702) → castVote */}
      <OneShotFlow step={step} upgraded={parsed.upgraded} />

      {/* snapshot sections: proposal + Venice + x402 — hidden when the main graph already shows them */}
      {phase === 'done' && !focusRelay && <SnapshotSections t={t} lang={lang} />}

      {/* relay lifecycle stepper */}
      <div className={cn('flex flex-col gap-2.5', phase === 'done' && MAINNET_SNAPSHOT && 'mt-4')}>
        {RELAY_PHASES.map((p, i) => {
          const state = step > i ? 'done' : step === i ? 'current' : 'idle';
          return (
            <div key={p.key} className={cn('flex gap-2.5 transition-opacity', state === 'idle' ? 'opacity-45' : 'opacity-100')}>
              <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', state === 'done' ? 'bg-ok' : state === 'current' ? 'bg-brand motion-safe:animate-glow' : 'bg-line')} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink-soft">
                  {t.relayPhases[p.key]} <span className="font-mono text-[11px] font-normal text-ink-mute">· {p.code}</span>
                </div>
                <div className="text-[11.5px] leading-snug text-ink-mute">{t.oneShotRelayDesc[p.key]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* burner 7702 upgrade — genuinely live read-only eth_getCode on Base mainnet */}
      <div className={cn('mt-4 rounded-xl border bg-surface-2/60 px-4 py-3.5 transition-colors', parsed.upgraded ? 'border-brand/40' : 'border-hairline')}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
          {t.oneShotBurner}
          <a className="font-mono text-info hover:underline" href={`${proof.basescan}/address/${proof.burner}`} target="_blank" rel="noreferrer">
            {shortHex(proof.burner, 4)} ↗
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                <CheckCircle2 className="size-3" /> {t.oneShot7702}
              </Badge>
              <LiveTag label={t.oneShotLive} />
            </div>
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
          href={`${proof.basescan}/tx/${proof.castVoteTx}`}
          target="_blank"
          rel="noreferrer"
        >
          {t.oneShotCastVoteTx} {shortHex(proof.castVoteTx, 6)} <ExternalLink className="size-3" />
        </a>
        {phase === 'running' && !receipt && (
          <div className="mt-2 font-mono text-[11px] text-ink-mute motion-safe:animate-pulse">{t.oneShotReceiptReading}</div>
        )}
        {receipt && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone={receipt.status === 'success' ? 'ok' : 'bad'}>
              <CheckCircle2 className="size-3" /> {receipt.status === 'success' ? t.oneShotTxConfirmed : 'reverted'}
            </Badge>
            <span className="font-mono text-[11px] text-ink-soft">
              {t.oneShotBlock} #{receipt.block}
            </span>
            <span className="font-mono text-[11px] text-ink-soft">
              {t.oneShotGasUsed} {Number(receipt.gasUsed).toLocaleString()}
            </span>
            {receipt.live && <LiveTag label={t.oneShotLive} />}
          </div>
        )}
        <div className="mt-2.5 text-[11px] leading-relaxed text-ink-mute">{t.oneShotBundle}</div>
      </div>
    </Panel>
  );
}

function LiveTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
      <span className="size-1.5 rounded-full bg-info motion-safe:animate-pulse" /> {label}
    </span>
  );
}
