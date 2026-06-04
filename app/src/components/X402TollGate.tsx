'use client';

import { useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { createPublicClient, erc20Abi, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { AlertTriangle, Coins, Receipt, ShieldCheck, Wallet } from 'lucide-react';
import { BASESCAN, RPC_URL, shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import type { RunStatus } from '@mandate/shared';
import { TOLL_DECIMALS, TOLL_SYMBOL, X402_PHASES, formatTokenAmount, tollChallenge, tollResource } from '../lib/x402-toll';
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
export function X402TollGate({
  cfg,
  t,
  bare = false,
  toll,
  queryCount = 0,
  proposalId,
}: {
  cfg: DemoConfig;
  t: Dict;
  bare?: boolean;
  /** a REAL per-vote toll the analyst pulled on-chain (present once a vote has settled one). */
  toll?: RunStatus['toll'];
  /** how many queries have been billed under the current mandate (drives the running count). */
  queryCount?: number;
  /** the proposal being priced — its #id is shown in the resource path. */
  proposalId?: bigint | string | null;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [tracing, setTracing] = useState(false);
  const [bal, setBal] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // when a real toll has settled, the rail shows live on-chain proof; otherwise it traces the lifecycle.
  const resource = toll?.resource ?? tollResource(proposalId);
  const req = tollChallenge({ asset: cfg.token, payTo: cfg.analyst, chainId: cfg.chainId, resource }).accepts[0];
  const price = formatTokenAmount(BigInt(req.maxAmountRequired), TOLL_DECIMALS);
  const phaseStep = toll ? X402_PHASES.length : step; // a real settlement marks the whole lifecycle done
  const sellerBalanceFmt = toll ? formatTokenAmount(BigInt(toll.sellerBalance), TOLL_DECIMALS) : bal;

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
    <Panel tone="ok" pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
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

      {/* lifecycle — a vertical step log; each phase explains what actually happens */}
      <div className="mt-4 flex flex-col gap-2.5">
        {X402_PHASES.map((p, i) => {
          const state = phaseStep === 0 ? 'idle' : phaseStep > i ? 'done' : phaseStep === i ? 'current' : 'idle';
          return (
            <div key={p.key} className={cn('flex gap-2.5 transition-opacity', state === 'idle' ? 'opacity-45' : 'opacity-100')}>
              <span className={cn('mt-1 size-2.5 shrink-0 rounded-full', state === 'done' ? 'bg-ok' : state === 'current' ? 'bg-brand motion-safe:animate-glow' : 'bg-line')} />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink-soft">
                  {t.x402.phases[p.key]}
                  {p.code != null && <span className="font-mono text-[11px] font-normal text-ink-mute"> · {p.code}</span>}
                </div>
                <div className="text-[11.5px] leading-snug text-ink-mute">{t.x402.phaseDesc[p.key]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {toll ? (
        /* a REAL per-vote settlement — the on-chain redeem tx + the seller's real balance + running count */
        <div className="mt-4 rounded-xl border border-ok/25 bg-ok/[0.06] px-4 py-3.5">
          <p className="text-[12.5px] leading-relaxed text-ink-soft">{t.x402.result}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge tone="ok">
              <Receipt className="size-3" /> {t.x402.settled}
              {queryCount > 0 ? ` · ${queryCount}` : ''}
            </Badge>
            <a className="font-mono text-[12px] text-info hover:underline" href={`${BASESCAN}/tx/${toll.txHash}`} target="_blank" rel="noreferrer">
              {shortHex(toll.txHash, 5)} ↗
            </a>
            <Badge tone="ok">
              <Wallet className="size-3" /> {t.x402.sellerBalance}: {sellerBalanceFmt} {TOLL_SYMBOL}
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
              <span className="size-1.5 rounded-full bg-info motion-safe:animate-pulse" /> {t.x402.liveRead}
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button onClick={trace} disabled={tracing} className="inline-flex items-center gap-2">
              <Wallet className="size-4" /> {tracing ? t.x402.tracing : t.x402.trace}
            </button>
            {tracing && step >= X402_PHASES.length && bal === null && (
              <span className="font-mono text-[11px] text-ink-mute motion-safe:animate-pulse">{t.x402.reading}</span>
            )}
            {err && (
              <span className="flex items-center gap-1.5 text-[12px] text-bad">
                <AlertTriangle className="size-3.5" /> {err}
              </span>
            )}
          </div>

          {/* result — plain-language outcome + the seller's real on-chain balance (the actual proof) */}
          {bal !== null && (
            <div className="mt-3 rounded-xl border border-ok/25 bg-ok/[0.06] px-4 py-3.5">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">{t.x402.result}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Badge tone="ok">
                  <Wallet className="size-3" /> {t.x402.sellerBalance}: {bal} {TOLL_SYMBOL}
                </Badge>
                <span className="inline-flex items-center gap-1.5 rounded-chip border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-info">
                  <span className="size-1.5 rounded-full bg-info motion-safe:animate-pulse" /> {t.x402.liveRead}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
