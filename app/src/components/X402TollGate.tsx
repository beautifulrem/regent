'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { Bot, Coins, Lock, Receipt, Scale, ShieldCheck, Sparkles, User, Wallet } from 'lucide-react';
import { BASESCAN, shortHex } from '../lib/config';
import { cn } from '../lib/cn';
import type { RunStatus } from '@mandate/shared';
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

type Pt = { x: number; y: number };

/**
 * A mini replica of the cockpit's authority graph for the popover: circular 你→编排器→终裁→Venice nodes.
 * The PAYMENT leg (你→编排器→终裁) is a flowing gold DASH — same vocabulary as the main graph beams (no
 * coin; the coin lives only in the main graph). The DATA leg (终裁↔Venice) is a clearly distinct cyan
 * particle stream: the funded seller's request to Venice then Venice's response, edge-trimmed, played
 * once (request → response → gone) — not an infinite loop.
 */
function MiniPaymentDiagram({ cap, spent, t }: { cap?: number; spent: number; t: Dict }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const n0 = useRef<HTMLDivElement>(null); // 你
  const n1 = useRef<HTMLDivElement>(null); // 编排器
  const n2 = useRef<HTMLDivElement>(null); // 终裁 (seller)
  const n3 = useRef<HTMLDivElement>(null); // Venice
  const [g, setG] = useState<{ pay: string; dataFrom: Pt; dataTo: Pt; w: number; h: number } | null>(null);
  const [data, setData] = useState<'req' | 'resp' | 'done'>('req');

  useEffect(() => {
    const compute = () => {
      if (!wrap.current || !n0.current || !n1.current || !n2.current || !n3.current) return;
      const cr = wrap.current.getBoundingClientRect();
      const c = (n: HTMLDivElement): Pt => {
        const r = n.getBoundingClientRect();
        return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 };
      };
      const along = (a: Pt, b: Pt, d: number): Pt => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: a.x + (dx / len) * d, y: a.y + (dy / len) * d };
      };
      const R = 17; // node radius (size-8 = 32) + a hair, so beams/particles stop at the rim
      const p0 = c(n0.current);
      const p1 = c(n1.current);
      const p2 = c(n2.current);
      const p3 = c(n3.current);
      const payStart = along(p0, p1, R);
      const payEnd = along(p2, p1, R);
      setG({
        pay: `M ${payStart.x} ${payStart.y} L ${p1.x} ${p1.y} L ${payEnd.x} ${payEnd.y}`,
        dataFrom: along(p2, p3, R),
        dataTo: along(p3, p2, R),
        w: cr.width,
        h: cr.height,
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  // transient seller↔Venice exchange: request → response → gone (no infinite loop)
  useEffect(() => {
    if (reduce) {
      setData('done');
      return;
    }
    setData('req');
    const t1 = setTimeout(() => setData('resp'), 850);
    const t2 = setTimeout(() => setData('done'), 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduce]);

  const nodes = [
    { ref: n0, icon: User, label: t.x402.buyerYou, tone: '#ffd470' },
    { ref: n1, icon: Bot, label: t.nodes.orch.who, tone: 'var(--color-brand)' },
    { ref: n2, icon: Scale, label: t.nodes.synthesis.who, tone: '#ffd470' },
    { ref: n3, icon: Sparkles, label: t.nodes.venice.who, tone: 'var(--color-info)' },
  ];
  const dataParticles = (from: Pt, to: Pt, key: string) =>
    [0, 1, 2].map((i) => (
      <span
        key={`${key}-${i}`}
        className="data-packet"
        style={{ left: from.x, top: from.y, '--dx': `${to.x - from.x}px`, '--dy': `${to.y - from.y}px`, animationDelay: `${i * 0.14}s` } as CSSProperties}
      />
    ));
  return (
    <div ref={wrap} className="relative mt-4 rounded-xl border border-ok/20 bg-surface-2/40 px-2 pb-5 pt-3" style={{ height: 112 }}>
      {g && (
        <svg className="pointer-events-none absolute inset-0" width={g.w} height={g.h} style={{ overflow: 'visible' }} aria-hidden>
          {/* payment leg — flowing gold dash (the same dashed-beam vocabulary as the main graph) */}
          <path className="beam-base" d={g.pay} />
          <path className="beam-pulse" d={g.pay} stroke="#ffd470" style={{ color: '#ffd470' }} />
          {/* data channel — faint static guide; cyan particles animate over it */}
          <line x1={g.dataFrom.x} y1={g.dataFrom.y} x2={g.dataTo.x} y2={g.dataTo.y} stroke="var(--color-info)" strokeWidth={1.5} strokeDasharray="3 5" opacity={0.4} />
        </svg>
      )}
      <div className="relative flex items-start justify-between px-1">
        {nodes.map((n, i) => (
          <div key={i} className="flex w-[68px] flex-col items-center gap-1 text-center">
            <div
              ref={n.ref}
              className="grid size-8 place-items-center rounded-full border"
              style={{ borderColor: n.tone, color: n.tone, background: 'rgba(20,25,37,.6)', boxShadow: `0 0 0 4px color-mix(in srgb, ${n.tone} 12%, transparent)` }}
            >
              <n.icon className="size-4" />
            </div>
            <span className="text-[10px] font-semibold text-ink-soft">{n.label}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-1.5 text-center font-mono text-[9.5px] text-ink-mute">
        Erc20TransferAmount · {spent}/{cap ?? '∞'} {t.x402.spent} (≤ {cap ?? '∞'} {TOLL_SYMBOL})
      </div>
      {g && !reduce && data === 'req' && dataParticles(g.dataFrom, g.dataTo, 'req')}
      {g && !reduce && data === 'resp' && dataParticles(g.dataTo, g.dataFrom, 'resp')}
    </div>
  );
}

/** The locked placeholder shown before x402 has a real per-vote settlement (grant + a completed vote). */
function X402Locked({ t, bare }: { t: Dict; bare: boolean }) {
  return (
    <Panel tone="ok" pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
      <PanelHeader
        icon={Coins}
        title={t.x402.title}
        track={
          <TrackTag tone="ok" icon={Receipt}>
            x402 · ERC-7710
          </TrackTag>
        }
        right={
          <Badge tone="neutral">
            <Lock className="size-3" /> {t.x402.lockedShort}
          </Badge>
        }
      />
      <p className="text-[13px] leading-relaxed text-ink-soft">{t.x402.hint}</p>
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-hairline bg-surface-2/40 px-4 py-3.5 text-[12.5px] leading-relaxed text-ink-mute">
        <Lock className="mt-0.5 size-4 shrink-0 text-ink-mute" />
        <span>{t.x402.locked}</span>
      </div>
    </Panel>
  );
}

/**
 * x402 pay-per-query toll gate — shown ONLY after a real per-vote settlement (the rail/dock gate it on
 * vm.run?.toll). Renders the mini payment graph (你→编排器→终裁→Venice), the real 402 challenge, the
 * scoped Erc20TransferAmount delegation, the 402→sign→settle→200 lifecycle, and the on-chain receipt
 * (tx + the seller's real mUSDC balance captured at settlement).
 */
export function X402TollGate({
  cfg,
  t,
  bare = false,
  toll,
  queryCount = 0,
  cap,
}: {
  cfg: DemoConfig;
  t: Dict;
  bare?: boolean;
  /** a REAL per-vote toll the analyst pulled on-chain. When absent, the gate is locked. */
  toll?: RunStatus['toll'];
  /** how many queries have been billed under the current mandate (the running count). */
  queryCount?: number;
  /** the cumulative budget cap in queries (= mUSDC), from the grant. */
  cap?: number;
}) {
  if (!toll) return <X402Locked t={t} bare={bare} />;

  const req = tollChallenge({ asset: cfg.paymentToken, payTo: cfg.analyst, chainId: cfg.chainId, resource: toll.resource }).accepts[0];
  const price = formatTokenAmount(BigInt(req.maxAmountRequired), TOLL_DECIMALS);
  const sellerBalanceFmt = formatTokenAmount(BigInt(toll.sellerBalance), TOLL_DECIMALS);

  return (
    <Panel tone="ok" pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
      <PanelHeader
        icon={Coins}
        title={t.x402.title}
        track={
          <TrackTag tone="ok" icon={Receipt}>
            x402 · ERC-7710
          </TrackTag>
        }
        right={
          <Badge tone="neutral">
            {TOLL_SYMBOL}/{t.x402.perQuery}
          </Badge>
        }
      />
      <p className="text-[13px] leading-relaxed text-ink-soft">{t.x402.hint}</p>

      {/* payment FLOW — a mini replica of the cockpit authority graph (你→编排器→终裁→Venice) */}
      <MiniPaymentDiagram cap={cap} spent={queryCount} t={t} />

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
          <Badge tone="neutral">≤ {cap ?? '∞'} {TOLL_SYMBOL}</Badge>
          <Badge tone="neutral">to = {shortHex(cfg.analyst, 4)}</Badge>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">{t.x402.scopeNote}</p>
      </div>

      {/* lifecycle — every phase is complete once a real toll has settled */}
      <div className="mt-4 flex flex-col gap-2.5">
        {X402_PHASES.map((p) => (
          <div key={p.key} className={cn('flex gap-2.5')}>
            <span className="mt-1 size-2.5 shrink-0 rounded-full bg-ok" />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink-soft">
                {t.x402.phases[p.key]}
                {p.code != null && <span className="font-mono text-[11px] font-normal text-ink-mute"> · {p.code}</span>}
              </div>
              <div className="text-[11.5px] leading-snug text-ink-mute">{t.x402.phaseDesc[p.key]}</div>
            </div>
          </div>
        ))}
      </div>

      {/* the on-chain receipt — redeem tx + the seller's real mUSDC balance at settlement + running count */}
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
    </Panel>
  );
}
