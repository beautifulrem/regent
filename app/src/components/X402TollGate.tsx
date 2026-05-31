'use client';

import { useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { createPublicClient, erc20Abi, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { AlertTriangle, Coins, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { BASESCAN, RPC_URL, shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import { TOLL_DECIMALS, TOLL_SYMBOL, X402_PHASES, formatTokenAmount, tollChallenge } from '../lib/x402-toll';
import type { DemoConfig } from '../lib/orchestrator';
import type { Dict } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge, TrackTag } from './ui/Badge';

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-ink-mute">{k}</span>
      <span className="min-w-0 break-all text-ink-soft">{v}</span>
    </div>
  );
}

/**
 * x402 pay-per-query toll gate. Renders the real 402 challenge (scheme erc7710) and the SCOPED
 * Erc20TransferAmount delegation that settles it, then traces the 402 -> sign -> redeem -> 200
 * lifecycle and reads the seller's live MVOTE balance on-chain (read-only — no spend).
 */
export function X402TollGate({ cfg, t }: { cfg: DemoConfig; t: Dict }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [tracing, setTracing] = useState(false);
  const [bal, setBal] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const req = tollChallenge({ asset: cfg.token, payTo: cfg.analyst, chainId: cfg.chainId }).accepts[0];
  const price = formatTokenAmount(BigInt(req.maxAmountRequired), TOLL_DECIMALS);

  async function trace() {
    setTracing(true);
    setErr(null);
    setStep(0);
    setBal(null);
    try {
      for (let i = 1; i <= X402_PHASES.length; i++) {
        await new Promise((r) => setTimeout(r, reduce ? 0 : 520));
        setStep(i);
      }
      const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
      const raw = (await client.readContract({
        address: cfg.token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [cfg.analyst],
      })) as bigint;
      setBal(formatTokenAmount(raw, TOLL_DECIMALS));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTracing(false);
    }
  }

  return (
    <Panel tone="ok" pad="lg" className="mb-3.5">
      <PanelHeader
        icon={Coins}
        title={t.x402.title}
        track={<TrackTag tone="ok" icon={Receipt}>x402 · ERC-7710</TrackTag>}
        right={<Badge tone="neutral">{TOLL_SYMBOL}/{t.x402.perQuery}</Badge>}
      />
      <p className="text-[13px] leading-relaxed text-ink-soft">{t.x402.hint}</p>

      {/* the real 402 challenge */}
      <div className="mt-4 overflow-hidden rounded-xl border border-warn/25 bg-[#0e0b06]/70">
        <div className="border-b border-warn/15 bg-warn/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">
          {t.x402.require}
        </div>
        <div className="grid gap-1.5 px-4 py-3 font-mono text-[12px]">
          <Row k="scheme" v={req.scheme} />
          <Row
            k="asset"
            v={
              <a className="text-info hover:underline" href={`${BASESCAN}/address/${req.asset}`} target="_blank" rel="noreferrer">
                {TOLL_SYMBOL} {shortHex(req.asset, 4)} ↗
              </a>
            }
          />
          <Row
            k="payTo"
            v={
              <a className="text-info hover:underline" href={`${BASESCAN}/address/${req.payTo}`} target="_blank" rel="noreferrer">
                {shortHex(req.payTo, 4)} ↗
              </a>
            }
          />
          <Row k="price" v={<span className="text-ink">{price} {TOLL_SYMBOL} <span className="text-ink-mute">/ {t.x402.perQuery}</span></span>} />
          <Row k="resource" v={req.resource} />
        </div>
      </div>

      {/* scoped ERC-7710 payment delegation */}
      <div className="mt-4 rounded-xl border border-ok/25 bg-surface-2/60 px-4 py-3.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
          <ShieldCheck className="size-3.5 text-ok" /> {t.x402.scopeTitle}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="ok">Erc20TransferAmount</Badge>
          <Badge tone="neutral">cap = {price} {TOLL_SYMBOL}</Badge>
          <Badge tone="neutral">to = {shortHex(cfg.analyst, 4)}</Badge>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">{t.x402.scopeNote}</p>
      </div>

      {/* lifecycle stepper + live read */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        {X402_PHASES.map((p, i) => {
          const state = step === 0 ? 'idle' : step > i ? 'done' : step === i ? 'current' : 'idle';
          return (
            <div key={p.key} className={cn('inline-flex items-center gap-2 transition-opacity', state === 'idle' ? 'opacity-45' : 'opacity-100')}>
              <span className={cn('size-2.5 rounded-full', state === 'done' ? 'bg-ok' : state === 'current' ? 'bg-brand motion-safe:animate-glow' : 'bg-line')} />
              <span className="text-[13px] text-ink-soft">
                {t.x402.phases[p.key]}
                {p.code != null && <span className="font-mono text-[11px] text-ink-mute"> · {p.code}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={trace} disabled={tracing} className="inline-flex items-center gap-2">
          <Wallet className="size-4" /> {tracing ? t.x402.tracing : t.x402.trace}
        </button>
        {tracing && step >= X402_PHASES.length && bal === null && (
          <span className="font-mono text-[11px] text-ink-mute motion-safe:animate-pulse">{t.x402.reading}</span>
        )}
        {bal !== null && (
          <Badge tone="ok">
            <Wallet className="size-3" /> {t.x402.sellerBalance}: {bal} {TOLL_SYMBOL}
          </Badge>
        )}
        {err && (
          <span className="flex items-center gap-1.5 text-[12px] text-bad">
            <AlertTriangle className="size-3.5" /> {err}
          </span>
        )}
      </div>
    </Panel>
  );
}
