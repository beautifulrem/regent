'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { Bot, Boxes, CheckCircle2, Coins, Cpu, ExternalLink, Filter, Fuel, Gavel, Lock, Package, Radio, Receipt, Rocket, Scale, Scissors, ShieldCheck, Sparkles, TrendingUp, User, Users, Wallet, type LucideIcon } from 'lucide-react';
import { LENSES, type Decision, type LensKey, type LensVerdict } from '@mandate/shared';
import { BASESCAN, shortHex } from '../../lib/config';
import { ORDER } from '../../lib/runState';
import { useRatchet } from '../../lib/useRatchet';
import type { Dict } from '../../lib/i18n';

type Pips = { for_: number; against: number; abstain: number };
type DivRef = RefObject<HTMLDivElement | null>;

// A node turns ON this long after its incoming beam goes live (the light crosses the wire first).
const PACKET_MS = 850;
// The four lenses light one-by-one this far apart, so the committee "reports in" in sequence.
const LENS_STAGGER_MS = 480;
// The mainnet cast hops (终裁 → Burner → 1Shot → VoteBoard) light one-by-one this far apart, so the
// relayed vote visibly travels hop-by-hop instead of the whole leg flashing on at once. Kept slow
// enough that each hop reads calmly, and that the burner's 700ms 7702 upgrade ring finishes in one step.
const RELAY_STAGGER_MS = 1150;

const LENS_ICON: Record<LensKey, LucideIcon> = {
  fiscal: Coins,
  growth: TrendingUp,
  security: ShieldCheck,
  participation: Users,
};

// Every circle + beam is colored by ONE tone. `accent` drives the icon/label; ring/bg/glow are the
// circle's halo (rgba so inline styles can alpha them); beamDeep→beamLight is the beam gradient and
// `packet` the travelling light. For=ok(green) · Against=bad(red) · Abstain=warn(amber) · brand=orange
// (the spine / our cast landed) · info=cold blue (a lens still thinking).
type ToneKey = 'brand' | 'info' | 'ok' | 'bad' | 'warn' | 'pay';
const TONES: Record<ToneKey, { accent: string; ring: string; bg: string; glow: string; beamDeep: string; beamLight: string; packet: string }> = {
  brand: { accent: 'var(--color-brand)', ring: 'rgba(246,133,27,.5)', bg: 'rgba(246,133,27,.15)', glow: 'rgba(246,133,27,.06)', beamDeep: 'var(--color-brand-deep)', beamLight: '#ffc879', packet: 'var(--color-brand-soft)' },
  info: { accent: 'var(--color-info)', ring: 'rgba(110,168,254,.5)', bg: 'rgba(110,168,254,.13)', glow: 'rgba(110,168,254,.07)', beamDeep: '#3b6fd0', beamLight: '#8fb6ef', packet: '#8fb6ef' },
  ok: { accent: 'var(--color-ok)', ring: 'rgba(74,222,128,.55)', bg: 'rgba(74,222,128,.12)', glow: 'rgba(74,222,128,.06)', beamDeep: '#2f9e5a', beamLight: '#6ee79a', packet: '#6ee79a' },
  bad: { accent: 'var(--color-bad)', ring: 'rgba(248,113,113,.55)', bg: 'rgba(248,113,113,.12)', glow: 'rgba(248,113,113,.06)', beamDeep: '#a23b3b', beamLight: '#f87171', packet: '#f87171' },
  warn: { accent: 'var(--color-warn)', ring: 'rgba(251,191,36,.55)', bg: 'rgba(251,191,36,.13)', glow: 'rgba(251,191,36,.07)', beamDeep: '#a87514', beamLight: '#fbbf24', packet: '#fbbf24' },
  // gold — the x402 mUSDC payment sub-flow (budget chip / coin packet / receipt tick); distinct from
  // the orange voting spine so "money" reads as its own thing.
  pay: { accent: '#f5b942', ring: 'rgba(245,185,66,.5)', bg: 'rgba(245,185,66,.13)', glow: 'rgba(245,185,66,.18)', beamDeep: '#a8791f', beamLight: '#ffd470', packet: '#ffd470' },
};

/** True only `ms` after `v` turns true (false the instant `v` drops) — used to pop a receipt
 *  when the coin that pays it LANDS, not when it launches (the relay coins fly ~1.1s). */
function useLanded(v: boolean, ms: number): boolean {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!v) {
      setLanded(false);
      return;
    }
    const id = setTimeout(() => setLanded(true), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return landed;
}

/** A vote decision → its tone key (For=green, Against=red, Abstain=amber); anything else → brand. */
const decisionToneKey = (d?: string): ToneKey => (d === 'For' ? 'ok' : d === 'Against' ? 'bad' : d === 'Abstain' ? 'warn' : 'brand');

interface ChainNodeProps {
  nodeRef: DivRef;
  icon: LucideIcon;
  who: string;
  role?: string;
  addr?: string;
  active?: boolean;
  working?: boolean;
  killed?: boolean;
  board?: boolean;
  small?: boolean;
  /** float the label/verdict/addr absolutely below the circle, so the node's height == the circle
   *  and align-items:center lines ALL the main-node circles up (regardless of how much hangs below). */
  floatBelow?: boolean;
  /** the verdict word, kept only for the title/aria-label (colorblind-safe); the color comes from `tone`. */
  result?: Decision;
  /** the circle's color tone (icon + ring + glow). Defaults: board=ok, lens=info, else brand. */
  tone?: ToneKey;
  pips?: Pips;
  /** a small highlighted chip under the role (e.g. the burner's "7702 ✓ · 0 ETH" gas-abstraction badge). */
  badge?: string;
  /** play a one-shot EIP-7702 "set-code → smart account" upgrade ring on the circle (burner, leg start). */
  upgrade?: boolean;
  /** the throwaway burner's single-use idle state: dashed, breathing, desaturated — NOT the killed grey. */
  idle?: boolean;
  /** the explorer base for the address link — defaults to the live (Sepolia) one; mainnet replay overrides it. */
  basescan?: string;
  /** hover bubble: one-line "who am I / what do I do" (same springy pop as the 4337/7710/A2A/TEE chips). */
  tip?: string;
}

function ChainNode({ nodeRef, icon: Icon, who, role, addr, active, working, killed, board, small, floatBelow, result, tone, pips, badge, upgrade, idle, basescan = BASESCAN, tip }: ChainNodeProps) {
  // One tone drives the whole circle (icon + ring + glow). Callers pass it explicitly: the lenses and
  // the Arbiter (终裁) by their verdict, the VoteBoard by the live tally (or brand once our vote lands).
  // You/Orchestrator default brand; a lens with no verdict yet stays cold info-blue.
  const T = TONES[tone ?? (board ? 'ok' : small ? 'info' : 'brand')];
  const accent = T.accent;
  const ringActive = !!active && !killed;
  const ringColor = T.ring;
  const ringBg = T.bg;
  const glowRing = T.glow;
  const size = small ? 38 : 60;
  return (
    <div
      ref={nodeRef}
      className="mc-node-hit"
      style={{
        position: 'relative',
        flex: small ? '0 0 auto' : 1,
        minWidth: 0,
        textAlign: 'center',
        opacity: killed && !board ? 0.4 : 1,
        filter: killed && !board ? 'grayscale(1)' : 'none',
        transition: 'opacity .3s, filter .3s',
      }}
    >
      {upgrade && !killed && (
        // EIP-7702 set-code pulse: a cyan ring blooms out of the burner circle once, as the EOA is
        // upgraded into a smart account at the start of the relay leg (one-shot, not a loop).
        <span aria-hidden className="node-upgrade-ring" style={{ position: 'absolute', top: size / 2, left: '50%', width: size, height: size, transform: 'translate(-50%, -50%)', borderRadius: 999, pointerEvents: 'none' }} />
      )}
      <span
        className={idle && !killed ? 'mc-node-idle' : undefined}
        style={{
          margin: '0 auto',
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 999,
          border: ringActive ? `1.5px solid ${ringColor}` : '1.5px solid var(--color-hairline)',
          background: ringActive ? ringBg : 'rgba(20,25,37,.88)',
          color: ringActive ? accent : 'var(--color-ink-mute)',
          boxShadow: ringActive ? `0 0 0 ${small ? 5 : 6}px ${glowRing}, 0 0 34px -10px ${accent}` : 'none',
          transition: 'all .3s',
          animation: working && !killed ? 'glow 2.8s ease-in-out infinite' : 'none',
        }}
        title={tip ? undefined : result ? `${who}: ${result}` : who}
        aria-label={result ? `${who} ${result}` : who}
      >
        <Icon size={small ? 16 : 24} strokeWidth={1.5} />
      </span>
      {tip && (
        <span className="mc-node-tip" role="tooltip">
          <span className="mc-node-tip-k">{who}</span>
          {tip}
        </span>
      )}
      <div style={floatBelow ? { position: 'absolute', top: '100%', left: 0, right: 0 } : undefined}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: small ? 10.5 : 15.5, color: ringActive ? accent : 'var(--color-ink)', marginTop: small ? 3 : 9 }}>
        {who}
      </div>
      {role && <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-ink-mute)' }}>{role}</div>}
      {badge && (
        <div style={{ marginTop: 5 }}>
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--color-cyan)', background: 'rgba(56,224,255,.1)', border: '1px solid rgba(56,224,255,.35)', whiteSpace: 'nowrap' }}>
            {badge}
          </span>
        </div>
      )}

      {/* No verdict pills and no "thinking…" box on graph nodes: a working node simply glows brand-orange
          (the `working` pulse + brand tone), then its circle switches to the verdict color once the
          decision lands — so nothing changes the node's height. The TeeConsole still shows the text. */}
      {addr && (
        <a
          href={`${basescan}/address/${addr}`}
          target="_blank"
          rel="noreferrer"
          style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-info)' }}
        >
          {shortHex(addr, 4)} <ExternalLink size={11} style={{ color: 'var(--color-ink-mute)' }} />
        </a>
      )}
      {pips && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-ink-mute)' }}>
          <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--color-ok)', marginRight: 4 }} />{pips.for_}</span>
          <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--color-bad)', marginRight: 4 }} />{pips.against}</span>
          <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--color-ink-mute)', marginRight: 4 }} />{pips.abstain}</span>
        </div>
      )}
      </div>
    </div>
  );
}

interface Geom {
  w: number;
  h: number;
  d: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  mid: { x: number; y: number };
}

function Beam({
  from,
  to,
  container,
  live,
  killed,
  cutting,
  root,
  tone,
  packet = true,
  flowing = true,
}: {
  from: DivRef;
  to: DivRef;
  container: DivRef;
  live?: boolean;
  killed?: boolean;
  cutting?: boolean;
  root?: boolean;
  tone?: ToneKey;
  /** render the travelling light when the beam goes live. The mainnet cast-leg beams turn this OFF —
   *  there the MainnetRelayFlow coins ARE the travelling light, and doubling them reads as clutter. */
  packet?: boolean;
  /** animate the dash flow. False at rest: a lit-but-static beam costs zero repaints, while the
   *  infinite dashoffset animation repaints the full-width SVG every frame — the page's main idle
   *  cost (11 beams once a run completes). The flow plays only while the run is actually moving. */
  flowing?: boolean;
}) {
  const [geom, setGeom] = useState<Geom | null>(null);
  const gid = useId().replace(/:/g, ''); // unique per beam — gradient ids must not collide across beams
  useEffect(() => {
    const compute = () => {
      if (!from.current || !to.current || !container.current) return;
      const cr = container.current.getBoundingClientRect();
      const a = from.current.getBoundingClientRect();
      const b = to.current.getBoundingClientRect();
      // connect the icon-circle centres (top of each node), then trim along the beam so it starts/
      // ends just outside each circle — works for the angled fan-out/fan-in beams too.
      const rad = (r: DOMRect) => (r.width >= 56 ? 30 : 19); // main circle radius 30, small lens radius 19
      const iconY = (r: DOMRect) => r.top - cr.top + rad(r); // circle-centre row
      const aC = { x: a.left - cr.left + a.width / 2, y: iconY(a) };
      const bC = { x: b.left - cr.left + b.width / 2, y: iconY(b) };
      const dx = bC.x - aC.x;
      const dy = bC.y - aC.y;
      const len = Math.hypot(dx, dy) || 1;
      const ax = rad(a) + 4; // trim to just outside each circle, along the beam
      const bx = rad(b) + 4;
      const start = { x: aC.x + (dx / len) * ax, y: aC.y + (dy / len) * ax };
      const end = { x: bC.x - (dx / len) * bx, y: bC.y - (dy / len) * bx };
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      setGeom({ w: cr.width, h: cr.height, d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, start, end, mid });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [from, to, container, live, killed]);
  if (!geom) return null;
  const T = TONES[tone ?? 'brand'];
  const packetColor = T.packet;
  const GAP = 11;
  const DROOP = 9;
  const midL = { x: geom.mid.x - GAP, y: geom.mid.y + DROOP };
  const midR = { x: geom.mid.x + GAP, y: geom.mid.y + DROOP };
  const dCutL = `M ${geom.start.x} ${geom.start.y} L ${midL.x} ${midL.y}`;
  const dCutR = `M ${midR.x} ${midR.y} L ${geom.end.x} ${geom.end.y}`;
  return (
    <>
      <svg className="beam-svg" width={geom.w} height={geom.h} viewBox={`0 0 ${geom.w} ${geom.h}`} fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={`beamgrad-${gid}`} gradientUnits="userSpaceOnUse" x1={geom.start.x} y1={geom.start.y} x2={geom.end.x} y2={geom.end.y}>
            <stop offset="0%" stopColor={T.beamDeep} />
            <stop offset="100%" stopColor={T.beamLight} />
          </linearGradient>
        </defs>
        {killed ? (
          <g style={{ '--droop': `${DROOP}px` } as CSSProperties}>
            <path className="beam-base killed beam-cut" d={dCutL} style={{ transformOrigin: `${geom.start.x}px ${geom.start.y}px` }} />
            <path className="beam-base killed beam-cut" d={dCutR} style={{ transformOrigin: `${geom.end.x}px ${geom.end.y}px` }} />
          </g>
        ) : (
          <>
            <path className="beam-base" d={geom.d} />
            {live && <path className={flowing ? 'beam-pulse' : 'beam-pulse calm'} d={geom.d} stroke={`url(#beamgrad-${gid})`} />}
          </>
        )}
      </svg>
      {live && !killed && !cutting && packet && (
        <span
          className="beam-packet"
          style={
            {
              left: geom.start.x,
              top: geom.start.y,
              color: packetColor,
              '--dx': `${geom.end.x - geom.start.x}px`,
              '--dy': `${geom.end.y - geom.start.y}px`,
            } as CSSProperties
          }
        />
      )}
      {root && cutting && (
        <>
          <span className="beam-spark" style={{ left: geom.mid.x, top: geom.mid.y }} />
          <span className="beam-scissor snip" style={{ left: geom.mid.x, top: geom.mid.y }}>
            <Scissors size={20} strokeWidth={2} />
          </span>
        </>
      )}
      {root && killed && (
        <span className="beam-scissor" style={{ left: geom.mid.x, top: geom.mid.y + DROOP }}>
          <Scissors size={18} strokeWidth={2} />
        </span>
      )}
    </>
  );
}

type ChipPos = 'you' | 'orch' | 'synth' | 'burner' | 'oneShot' | 'board';

function ScopeChip({
  container,
  youRef,
  orchRef,
  synthRef,
  burnerRef,
  oneShotRef,
  boardRef,
  pos,
  attenuated,
  label,
  icon: Icon,
}: {
  container: DivRef;
  youRef: DivRef;
  /** absent on the mainnet leg — there is no orchestrator hop in the recorded 1Shot run. */
  orchRef?: DivRef;
  synthRef: DivRef;
  burnerRef?: DivRef;
  oneShotRef?: DivRef;
  boardRef: DivRef;
  pos: ChipPos;
  attenuated: boolean;
  label: string;
  icon: LucideIcon;
}) {
  const [xs, setXs] = useState<{ you: number; orch: number; synth: number; burner?: number; oneShot?: number; board: number; topY: number } | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const compute = () => {
      if (!container.current || !youRef.current || !synthRef.current || !boardRef.current) return;
      const cr = container.current.getBoundingClientRect();
      const cx = (n: HTMLDivElement) => {
        const r = n.getBoundingClientRect();
        return r.left - cr.left + r.width / 2;
      };
      // float the token just above the You / Orch / Arbiter / Board circle row (they share one centre).
      const orchTop = (orchRef?.current ?? youRef.current).getBoundingClientRect().top - cr.top;
      setXs({
        you: cx(youRef.current),
        orch: orchRef?.current ? cx(orchRef.current) : cx(youRef.current),
        synth: cx(synthRef.current),
        burner: burnerRef?.current ? cx(burnerRef.current) : undefined,
        oneShot: oneShotRef?.current ? cx(oneShotRef.current) : undefined,
        board: cx(boardRef.current),
        topY: orchTop - 30,
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [container, youRef, orchRef, synthRef, burnerRef, oneShotRef, boardRef]);
  if (!xs) return null;
  // The scope token (the delegation) rides You → Orchestrator → Arbiter (the cast point) → VoteBoard
  // (the on-chain vote); on the mainnet leg it also rides Burner → 1Shot. The four lenses are decision
  // agents, not delegation hops, so it floats over them. It glides between circle x-positions while its
  // icon+label morph in (keyed).
  const x = xs[pos] ?? xs.synth;
  return (
    <div className="scope-chip-entry" style={{ position: 'absolute', left: 0, top: xs.topY, transform: `translate(calc(${x}px - 50%), 0)`, zIndex: 3, pointerEvents: 'none', transition: reduce ? 'none' : 'transform .85s var(--ease-fluid)', willChange: 'transform' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 9px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          color: '#1a0f02',
          background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-deep))',
          boxShadow: '0 4px 14px -4px var(--color-brand-glow)',
          transform: attenuated ? 'scale(.92)' : 'scale(1)',
          transition: 'transform .5s var(--ease-fluid)',
        }}
      >
        <span key={pos} className="mc-scopechip-morph" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon size={12} /> {label}
        </span>
      </span>
    </div>
  );
}

type PayPoint = { x: number; y: number };
type DataPhase = 'idle' | 'req' | 'resp' | 'done';
interface PaySeg {
  from: PayPoint;
  to: PayPoint;
}
interface PayGeom {
  w: number;
  h: number;
  youWallet: PayPoint;
  synthWallet: PayPoint;
  enclave: { x: number; y: number; w: number; h: number }; // the Venice-TEE box the lens committee runs inside
  venice: PayPoint; // the Venice AI node, docked at the enclave's bottom-right corner
  synthSeg: PaySeg; // 终裁↔Venice synthesis tap (from = synth rim, to = the Venice node)
}

/**
 * The x402 payment sub-flow welded onto the spine. Persistent once granted: a flat wallet at You and
 * at the seller (终裁), plus a faint "Venice AI · TEE" enclave drawn AROUND the 4-lens committee — the
 * lenses visibly run INSIDE the inference platform (containment, so no crossing query lines clutter the
 * fan-in diamond). When the AI pays (终裁 lights) it fires ONCE: a flat coin is withdrawn from You's
 * wallet, arcs to the seller's wallet (its own lane, not on the beam), is deposited (ring), then the
 * seller's synthesis query exchanges 终裁↔Venice (request → response) along the single tap. One-shot.
 */
function PaymentFlow({
  container,
  youRef,
  synthRef,
  lensRefs,
  active,
  decidedLit,
  live,
  killed,
  veniceTip,
  showCoin = true,
}: {
  container: DivRef;
  youRef: DivRef;
  synthRef: DivRef;
  lensRefs: DivRef[];
  /** the committee is analyzing — brightens the Venice enclave while the lenses work inside it. */
  active: boolean;
  /** the 终裁/Arbiter node is lit — drives the coin payment + the 终裁↔Venice query. */
  decidedLit: boolean;
  /** a vote is actually in flight on this proposal — the coin fires ONLY then, so flipping back to an
   *  already-paid proposal shows the finished state (coin gone) instead of replaying the payment. */
  live: boolean;
  killed: boolean;
  /** hover bubble for the Venice AI satellite node. */
  veniceTip?: string;
  /** draw the user->seller wallets + 3D coin. OFF on mainnet, where the off-axis Burner wallet pays,
   *  so PaymentFlow contributes only the Venice enclave + node + synthesis query. */
  showCoin?: boolean;
}) {
  const reduce = useReducedMotion();
  const coinRef = useRef<HTMLDivElement>(null);
  const youWalletRef = useRef<HTMLSpanElement>(null);
  const synthWalletRef = useRef<HTMLSpanElement>(null);
  const [geom, setGeom] = useState<PayGeom | null>(null);
  const [synthPhase, setSynthPhase] = useState<DataPhase>('idle');
  const synthFired = useRef(false);

  // Entry reveal: fade elements in on first mount. Instant when revisiting (live=false) or reduce-motion.
  const [revealed, setRevealed] = useState(!live || !!reduce);
  const revealFired = useRef(false);
  useEffect(() => {
    if (revealed || revealFired.current || !geom) return;
    revealFired.current = true;
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [revealed, geom]);

  useEffect(() => {
    const compute = () => {
      if (!container.current || !youRef.current || !synthRef.current || lensRefs.some((r) => !r.current)) return;
      const cr = container.current.getBoundingClientRect();
      const rad = (r: DOMRect) => (r.width >= 56 ? 30 : 19);
      const center = (r: DOMRect): PayPoint => ({ x: r.left - cr.left + r.width / 2, y: r.top - cr.top + rad(r) });
      const along = (p: PayPoint, q: PayPoint, dist: number): PayPoint => {
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist };
      };
      const youC = center(youRef.current.getBoundingClientRect());
      const synthC = center(synthRef.current.getBoundingClientRect());
      // The Venice-TEE enclave = the tight bounding box of the 4 lens nodes (circles + labels) + a pad.
      // The committee literally sits INSIDE Venice — containment expresses the per-lens queries, so no
      // crossing lines are drawn into the fan-in. Only the seller's synthesis tap connects to it.
      const lensRects = lensRefs.map((r) => r.current!.getBoundingClientRect());
      const PAD = 9;
      const ex0 = Math.min(...lensRects.map((r) => r.left)) - cr.left - PAD;
      const ey0 = Math.min(...lensRects.map((r) => r.top)) - cr.top - PAD;
      const ex1 = Math.max(...lensRects.map((r) => r.right)) - cr.left + PAD;
      const ey1 = Math.max(...lensRects.map((r) => r.bottom)) - cr.top + PAD;
      const enclave = { x: ex0, y: ey0, w: ex1 - ex0, h: ey1 - ey0 };
      // the Venice AI node sits at 终裁's upper-right — in the open 终裁→VoteBoard span, above the spine
      // beam and clear of the fan-in (which all arrives on 终裁's left) and the TeeConsole below. The box
      // stays its TEE (committee runs inside); 终裁 taps up-right to it.
      const venice: PayPoint = { x: synthC.x + 78, y: synthC.y - 72 };
      const synthSeg: PaySeg = {
        from: along(synthC, venice, rad(synthRef.current!.getBoundingClientRect()) + 4),
        to: along(venice, synthC, 19),
      };
      setGeom({
        w: cr.width,
        h: cr.height,
        youWallet: { x: youC.x + 21, y: youC.y + 21 },
        synthWallet: { x: synthC.x - 21, y: synthC.y + 21 },
        enclave,
        venice,
        synthSeg,
      });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [container, youRef, synthRef, lensRefs]);

  // reset the one-shot ratchet when the run rewinds (a fresh vote) or the chain is severed
  useEffect(() => {
    if (killed || (!active && !decidedLit)) {
      synthFired.current = false;
      setSynthPhase('idle');
      if (coinRef.current) coinRef.current.style.opacity = '0';
    }
  }, [killed, active, decidedLit]);

  // coin payment 你→终裁 + 终裁↔Venice synthesis query — fire once when 终裁 lights
  useEffect(() => {
    const coin = coinRef.current;
    if (!geom || killed || !decidedLit || synthFired.current || !live) return;
    synthFired.current = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const repulse = (ref: typeof youWalletRef) => {
      ref.current?.classList.remove('pulse');
      void ref.current?.offsetWidth;
      ref.current?.classList.add('pulse');
    };
    const startSynthQuery = () => {
      setSynthPhase('req');
      timers.push(setTimeout(() => setSynthPhase('resp'), 560));
      timers.push(setTimeout(() => setSynthPhase('done'), 1120));
    };
    if (reduce || !coin || !showCoin) {
      startSynthQuery();
      return () => timers.forEach(clearTimeout);
    }
    repulse(youWalletRef); // withdraw from You's wallet
    const arcH = 52;
    const fly = animate(0, 1, {
      duration: 1,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (t) => {
        const x = geom.youWallet.x + (geom.synthWallet.x - geom.youWallet.x) * t;
        const y = geom.youWallet.y + (geom.synthWallet.y - geom.youWallet.y) * t - arcH * Math.sin(Math.PI * t);
        const pop = t < 0.16 ? t / 0.16 : t > 0.84 ? (1 - t) / 0.16 : 1; // pop out of / absorb into the wallet
        coin.style.transform = `translate3d(${x - 9}px, ${y - 9}px, 0) scale(${0.45 + 0.55 * pop})`;
        coin.style.opacity = `${pop}`;
      },
      onComplete: () => {
        coin.style.opacity = '0';
        repulse(synthWalletRef); // deposit into the seller's wallet
        startSynthQuery();
      },
    });
    return () => {
      fly.stop();
      timers.forEach(clearTimeout);
    };
  }, [geom, decidedLit, live, killed, reduce, showCoin]);

  if (!geom) return null;
  const ro = revealed ? 1 : 0; // reveal opacity multiplier — 0 on first frame, CSS transitions fade in
  const dim: CSSProperties | undefined = killed ? { opacity: 0.4 * ro, filter: 'grayscale(1)' } : undefined;
  const particles = (seg: PaySeg, dir: 'req' | 'resp', key: string) => {
    const from = dir === 'req' ? seg.from : seg.to;
    const to = dir === 'req' ? seg.to : seg.from;
    return [0, 1, 2].map((i) => (
      <span
        key={`${key}-${i}`}
        className="data-packet"
        style={{ left: from.x, top: from.y, '--dx': `${to.x - from.x}px`, '--dy': `${to.y - from.y}px`, animationDelay: `${i * 0.12}s` } as CSSProperties}
      />
    ));
  };
  return (
    <>
      {/* the Venice-TEE enclave: the 4-lens committee runs INSIDE the inference platform (containment, so
          the per-lens queries need no crossing lines). Brightens while the committee is analyzing. */}
      <div
        className="pay-enclave"
        style={{ left: geom.enclave.x, top: geom.enclave.y, width: geom.enclave.w, height: geom.enclave.h, opacity: (killed ? 0.3 : active ? 1 : 0.6) * ro, filter: killed ? 'grayscale(1)' : undefined }}
      />
      {/* the Venice AI node — the inference platform; the box around the committee is its TEE, 终裁 taps it */}
      <div className="pay-venice" style={{ left: geom.venice.x, top: geom.venice.y, opacity: (killed ? 0.35 : 1) * ro, filter: killed ? 'grayscale(1)' : undefined }}>
        <span className={`pay-venice-disc${active ? ' on' : ''}`}>
          <Sparkles size={15} />
        </span>
        <span className="pay-venice-label">Venice AI</span>
        {veniceTip && (
          <span className="mc-node-tip" role="tooltip">
            <span className="mc-node-tip-k">Venice AI</span>
            {veniceTip}
          </span>
        )}
      </div>
      {/* the seller's single synthesis tap: 终裁 ↔ Venice (faint persistent line + a data pulse on query) */}
      <svg className="beam-svg" width={geom.w} height={geom.h} viewBox={`0 0 ${geom.w} ${geom.h}`} fill="none" aria-hidden="true">
        <line x1={geom.synthSeg.from.x} y1={geom.synthSeg.from.y} x2={geom.synthSeg.to.x} y2={geom.synthSeg.to.y} stroke="var(--color-info)" strokeWidth={1.5} strokeDasharray="3 5" style={{ opacity: (killed ? 0.12 : 0.32) * ro, transition: 'opacity 0.5s var(--ease-fluid)' }} />
      </svg>
      {/* user + seller wallets and the flying coin — testnet only (mainnet pays from the off-axis
          Burner agent wallet, so showCoin is off and these are skipped) */}
      {showCoin && (
        <>
          <span ref={youWalletRef} className="pay-wallet" style={{ left: geom.youWallet.x, top: geom.youWallet.y, opacity: dim ? dim.opacity : ro, filter: dim?.filter }}>
            <Wallet size={12} />
          </span>
          <span ref={synthWalletRef} className="pay-wallet" style={{ left: geom.synthWallet.x, top: geom.synthWallet.y, opacity: dim ? dim.opacity : ro, filter: dim?.filter }}>
            <Wallet size={12} />
          </span>
          <div ref={coinRef} className="pay-coin" style={{ opacity: 0 }}>
            <div className="pay-coin-face" />
          </div>
          {!killed && synthPhase === 'req' && <span key="pay-ring" className="pay-ring" style={{ left: geom.synthWallet.x, top: geom.synthWallet.y }} />}
        </>
      )}
      {/* transient 终裁<->Venice synthesis data (request -> response) — both networks */}
      {!killed && synthPhase === 'req' && particles(geom.synthSeg, 'req', 'sreq')}
      {!killed && synthPhase === 'resp' && particles(geom.synthSeg, 'resp', 'sresp')}
    </>
  );
}

/** A small gold receipt tick pinned to the seller (Arbiter) node once a real toll has settled for the
 *  shown proposal — links to the on-chain settlement tx. The main graph's "payment happened" proof. */
function ReceiptTick({ container, nodeRef, txHash, basescan = BASESCAN, title = 'x402 toll settled ↗' }: { container: DivRef; nodeRef: DivRef; txHash?: string; basescan?: string; title?: string }) {
  const [p, setP] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const compute = () => {
      if (!container.current || !nodeRef.current) return;
      const cr = container.current.getBoundingClientRect();
      const r = nodeRef.current.getBoundingClientRect();
      setP({ x: r.left - cr.left + r.width / 2 + 24, y: r.top - cr.top + 8 });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [container, nodeRef]);
  if (!p) return null;
  const T = TONES.pay;
  const tick = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 5px',
        borderRadius: 999,
        color: '#1a0f02',
        background: `linear-gradient(135deg, ${T.beamLight}, ${T.beamDeep})`,
        boxShadow: `0 3px 10px -3px ${T.glow}`,
      }}
    >
      <Receipt size={11} strokeWidth={2.25} />
    </span>
  );
  return (
    <div className="receipt-stamp" style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)', zIndex: 4, pointerEvents: txHash ? 'auto' : 'none' }}>
      {/* gold "clink" ring that blooms once as the receipt stamps in — same vocabulary as the
          pay-ring at the seller wallet, so "paid" and "receipt" read as one event. */}
      <span className="receipt-ring" aria-hidden />
      {txHash ? (
        <a href={`${basescan}/tx/${txHash}`} target="_blank" rel="noreferrer" title={title}>
          {tick}
        </a>
      ) : (
        tick
      )}
    </div>
  );
}

export interface ChainParties {
  you?: string;
  orch?: string;
  analyst?: string;
  board?: string;
  /** the 7702-upgraded burner that casts via 1Shot (mainnet relay leg only). */
  burner?: string;
}

/**
 * The mainnet payment sub-flow, with the BURNER drawn as a floating "agent wallet" docked BELOW the
 * axis, centred between 终裁 and 1Shot. It is the agent's deployed USDC account (EIP-7702-upgraded,
 * 0 ETH); it pays two real fees, each a coin RISING to its payee so money reads as supply from the
 * wallet, never an axis backflow:
 *   - x402 toll: Burner → 终裁 (the seller), a 3D coin on the arbiter's decision beat
 *   - 1Shot relay fee: Burner → 1Shot, when the relay hop lights
 *   - the ETH gas 1Shot fronts: 1Shot → VoteBoard (violet), when the cast lands
 * Mainnet-only; the testnet x402 lives in PaymentFlow.
 */
function MainnetRelayFlow({
  container,
  synthRef,
  oneShotRef,
  boardRef,
  relayLit,
  decidedLit,
  paced,
  relay,
  burnerAddr,
  basescan,
  killed,
  t,
}: {
  container: DivRef;
  synthRef: DivRef;
  oneShotRef: DivRef;
  boardRef: DivRef;
  /** the cast-leg ratchet: -1 idle, 0 = 1Shot lit, 1 = VoteBoard reached. */
  relayLit: number;
  /** the arbiter has decided — fire the x402 toll coin (Burner → 终裁). */
  decidedLit: boolean;
  /** true while the ratchet is climbing (a paced replay); a snapped ratchet fires no travel particles. */
  paced: boolean;
  relay: { basescan: string; tollTx?: string; castTx?: string; tollUsdc: string; feeUsdc: string };
  burnerAddr?: string;
  basescan: string;
  killed: boolean;
  t: Dict;
}) {
  const reduce = useReducedMotion();
  const [g, setG] = useState<{
    synth: { x: number; y: number };
    oneShot: { x: number; y: number };
    board: { x: number; y: number };
    burner: { x: number; y: number };
    gasMid: { x: number; y: number };
  } | null>(null);
  const coinRef = useRef<HTMLDivElement>(null);
  const tollFired = useRef(false);
  const [ring, setRing] = useState(false);

  useEffect(() => {
    const compute = () => {
      if (!container.current || !synthRef.current || !oneShotRef.current || !boardRef.current) return;
      const cr = container.current.getBoundingClientRect();
      const c = (n: HTMLDivElement, dy = 30) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + dy };
      };
      const synth = c(synthRef.current);
      const oneShot = c(oneShotRef.current);
      const board = c(boardRef.current);
      // wallet BELOW the axis, between 终裁 and 1Shot — both fees rise to their payee (x402 up-left to
      // 终裁, relay fee up-right to 1Shot): supply, never an axis backflow.
      const burner = { x: (synth.x + oneShot.x) / 2, y: synth.y + 86 };
      setG({ synth, oneShot, board, burner, gasMid: { x: (oneShot.x + board.x) / 2, y: (oneShot.y + board.y) / 2 } });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [container, synthRef, oneShotRef, boardRef]);

  // reset the one-shot toll coin when the run rewinds / is severed
  useEffect(() => {
    if (!decidedLit || killed) {
      tollFired.current = false;
      setRing(false);
      if (coinRef.current) coinRef.current.style.opacity = '0';
    }
  }, [decidedLit, killed]);
  // x402 toll: a 3D coin arcs UP from the agent wallet to 终裁 (the seller) on the decision beat
  useEffect(() => {
    const coin = coinRef.current;
    if (!g || !decidedLit || killed || tollFired.current || !paced) return;
    tollFired.current = true;
    let ringTimer: ReturnType<typeof setTimeout> | undefined;
    const payY = g.synth.y + 20; // land just below the 终裁 circle, not on its centre
    if (reduce || !coin) {
      setRing(true);
      ringTimer = setTimeout(() => setRing(false), 700);
      return () => clearTimeout(ringTimer);
    }
    const arcH = 44;
    const fly = animate(0, 1, {
      duration: 0.95,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (pr) => {
        const x = g.burner.x + (g.synth.x - g.burner.x) * pr;
        const y = g.burner.y + (payY - g.burner.y) * pr - arcH * Math.sin(Math.PI * pr);
        const pop = pr < 0.16 ? pr / 0.16 : pr > 0.84 ? (1 - pr) / 0.16 : 1;
        coin.style.transform = `translate3d(${x - 9}px, ${y - 9}px, 0) scale(${0.45 + 0.55 * pop})`;
        coin.style.opacity = `${pop}`;
      },
      onComplete: () => {
        coin.style.opacity = '0';
        setRing(true);
        ringTimer = setTimeout(() => setRing(false), 700);
      },
    });
    return () => {
      fly.stop();
      if (ringTimer) clearTimeout(ringTimer);
    };
  }, [g, decidedLit, killed, paced, reduce]);

  // cyan relay-fee + violet gas coins re-mount per fresh relay (epoch bumps when relayLit goes live)
  const [epoch, setEpoch] = useState(0);
  const prevLive = useRef(false);
  useEffect(() => {
    const live = relayLit >= 0;
    if (live && !prevLive.current) setEpoch((e) => e + 1);
    prevLive.current = live;
  }, [relayLit]);
  if (!g) return null;

  const R = 37;
  const travel = (from: { x: number; y: number }, to: { x: number; y: number }, cls: string, key: string) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const sx = from.x + (dx / len) * R;
    const sy = from.y + (dy / len) * R;
    const ex = to.x - (dx / len) * R;
    const ey = to.y - (dy / len) * R;
    return <span key={key} className={cls} style={{ left: sx, top: sy, '--dx': `${ex - sx}px`, '--dy': `${ey - sy}px` } as CSSProperties} />;
  };

  const upgraded = relayLit >= 0; // 7702-upgraded by the time it sponsors the relay
  const retired = relayLit >= 1 && !killed; // vote landed → the one-shot key is retired (abandoned, not destroyed)
  return (
    <>
      {/* x402 toll: Burner → 终裁 (3D gold coin, rising), deposit ring at the seller */}
      <div ref={coinRef} className="pay-coin" style={{ opacity: 0 }}>
        <div className="pay-coin-face" />
      </div>
      {ring && !killed && <span key="mn-x402-ring" className="pay-ring" style={{ left: g.synth.x, top: g.synth.y + 20 }} />}
      {/* 1Shot relay fee: Burner → 1Shot (cyan, rising right); ETH gas: 1Shot → VoteBoard (violet) */}
      {paced && relayLit >= 0 && travel(g.burner, g.oneShot, 'relay-coin cyan', `fee-${epoch}`)}
      {paced && relayLit >= 1 && travel(g.oneShot, g.board, 'relay-fuel', `eth-${epoch}`)}
      <div className={`relay-gas-label${relayLit >= 1 ? ' firing' : ''}`} style={{ left: g.gasMid.x, top: g.gasMid.y + 24 }}>
        <Fuel size={9} /> {t.relayGasLabel}
      </div>

      {/* the agent wallet — a floating Burner node below the axis, the source of both fees */}
      <div className={`burner-wallet${killed ? ' killed' : ''}${retired ? ' retired' : ''}`} style={{ left: g.burner.x, top: g.burner.y }}>
        {upgraded && !retired && !killed && <span aria-hidden className="burner-wallet-ring" />}
        <span className={`burner-wallet-disc${upgraded && !killed ? ' on' : ''}${retired ? ' retired' : ''}`}>
          <Cpu size={15} />
        </span>
        <span className="burner-wallet-meta">
          <span className="burner-wallet-name">{t.burnerNode.who}</span>
          {burnerAddr ? (
            <a className="burner-wallet-addr" href={`${basescan}/address/${burnerAddr}`} target="_blank" rel="noreferrer">
              {shortHex(burnerAddr, 4)} ↗
            </a>
          ) : null}
          {retired ? <span className="burner-wallet-retired">{t.burnerRetired}</span> : <span className="burner-wallet-chip">0 ETH</span>}
        </span>
        <span className="mc-node-tip" role="tooltip">
          <span className="mc-node-tip-k">{t.burnerNode.who}</span>
          {t.nodeTips.burner}
        </span>
      </div>
    </>
  );
}

/**
 * The live authority graph: You → Orchestrator → (four governance lenses) → Arbiter (终裁) → VoteBoard.
 * The orchestrator fans the proposal out to four specialist lenses (each a private TEE analysis),
 * which report a verdict in sequence; the Arbiter (终裁) node weighs them and its decision is what
 * gets cast on-chain. Beams light + a permission packet travels as the run advances; the scope token
 * rides You→Orch→Arbiter (the lenses are decision agents, not delegation hops); Recall snips the root.
 */
export function AuthorityChain({
  t,
  parties,
  shownIdx,
  instant,
  status,
  killed,
  cutting,
  connected,
  pips,
  lenses,
  synthDecision,
  votedHere,
  paymentCap,
  tollSettled,
  tollTxHash,
  oneShot,
  relay,
}: {
  t: Dict;
  parties: ChainParties;
  shownIdx: number; // staged reveal index, driven by the cockpit (shared with the TEE console)
  /** snap node/lens lighting straight to the target instead of animating — true except during a live cast. */
  instant?: boolean;
  status?: string;
  killed: boolean;
  cutting: boolean;
  connected: boolean;
  pips: Pips;
  lenses: LensVerdict[] | undefined;
  synthDecision?: string;
  /** true when OUR vote has landed on the currently-shown proposal — flips the VoteBoard to orange. */
  votedHere?: boolean;
  /** the AI's cumulative x402 budget in queries (= mUSDC); 0/undefined hides the payment sub-flow. */
  paymentCap?: number;
  /** a real toll settled for the shown proposal — lights the receipt tick at the seller node. */
  tollSettled?: boolean;
  /** the settlement tx for the tick's link. */
  tollTxHash?: string;
  /** insert a 1Shot relay node on the cast leg (Arbiter → 1Shot → VoteBoard) — the mainnet path. */
  oneShot?: boolean;
  /** mainnet relay payment facts: the x402 toll + 1Shot fee, for the coin sub-flow + receipt ticks. */
  relay?: { basescan: string; tollTx?: string; castTx?: string; tollUsdc: string; feeUsdc: string };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const orchRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<HTMLDivElement>(null);
  const oneShotRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lensRefs = useMemo<DivRef[]>(() => LENSES.map(() => ({ current: null })), []);
  const s = status;
  const live = !!s && !['', 'idle'].includes(s);

  const idxOf = (target: string) => (ORDER as readonly string[]).indexOf(target);

  // The four lenses light one-by-one once 'analyzing' is revealed (the committee reports in).
  const lensTarget = shownIdx >= idxOf('analyzing') ? LENSES.length - 1 : -1;
  const lensLit = useRatchet(lensTarget, LENS_STAGGER_MS, killed || !!instant);
  // The arbiter rules on FOUR verdicts, so the reveal holds at 'analyzing' until the whole
  // committee has reported. A live run can't outrun this (Venice takes seconds), but the replay's
  // fixed stage pacing can — without the clamp 终裁 lights while lenses are still reporting.
  // Instant (rest / snap) is unaffected: lensLit snaps complete first.
  const committeeDone = lensLit >= LENSES.length - 1;
  const effIdx = committeeDone ? shownIdx : Math.min(shownIdx, idxOf('decided') - 1);
  const litIdx = useRatchet(effIdx, PACKET_MS, killed || !!instant);
  const beamLive = (target: string) => effIdx >= idxOf(target);
  const nodeLit = (target: string) => litIdx >= idxOf(target);

  // Mainnet cast leg: the relayed hops light one-by-one (终裁 → 1Shot → VoteBoard); the Burner is now
  // a floating agent wallet off the axis (it sponsors the fee, it is not a cast-leg hop). relayLit
  // 0 = 1Shot lit, 1 = VoteBoard reached.
  const relayTarget = oneShot && beamLive('voted') ? 1 : -1;
  const relayLit = useRatchet(relayTarget, RELAY_STAGGER_MS, killed || !!instant);
  // receipts pop when their paying coin LANDS (~1.1s flight), not when it launches
  const tollLanded = useLanded(nodeLit('decided'), 1100);
  const castLanded = useLanded(relayLit >= 1, 1100);
  // On the testnet leg (no relay nodes), the single cast beam still lights at 'voted' as before.
  const castBeamLive = (hop: number) => (oneShot ? relayLit >= hop : beamLive('voted'));

  const orchWorking = nodeLit('redelegated') && !beamLive('analyzing'); // lit, holding the scope
  // the Arbiter glows brand-orange while the committee's inputs converge on it (the fan-in is live but
  // the verdict hasn't crystallized yet), then its circle switches to the decision color.
  const synthThinking = beamLive('decided') && !nodeLit('decided');
  const verdictFor = (key: LensKey) => lenses?.find((l) => l.lens === key);

  // The scope token rides You → Orchestrator → Arbiter, then on the mainnet leg through Burner → 1Shot →
  // VoteBoard (testnet jumps Arbiter → VoteBoard), its icon + label morphing at each hop: full grant →
  // narrowed → adjudicated → signed (7710 bundle) → relaying → voted.
  const chipPos: ChipPos =
    oneShot && beamLive('voted')
      ? relayLit >= 1
        ? 'board'
        : relayLit >= 0
          ? 'oneShot'
          : 'synth'
      : beamLive('voted')
        ? 'board'
        : beamLive('decided')
          ? 'synth'
          : beamLive('redelegated')
            ? 'orch'
            : 'you';
  const SCOPE_STAGES: Record<ChipPos, { label: string; icon: LucideIcon }> = {
    you: { label: t.scopeChipOrigin, icon: Lock },
    orch: { label: t.scopeChip, icon: Filter },
    synth: { label: t.scopeChipDecided, icon: Gavel },
    burner: { label: t.scopeChipBundled, icon: Package },
    oneShot: { label: t.scopeChipRelaying, icon: Radio },
    board: { label: t.scopeChipVoted, icon: CheckCircle2 },
  };
  const scope = SCOPE_STAGES[chipPos];

  // VoteBoard color = the live tally result (passing=green / failing=red), flipping to brand-orange once
  // OUR vote has landed on the CURRENTLY-shown proposal (votedHere). Once the chain is SEVERED the orange
  // "voted" state drops away — the board returns to the plain tally color. The fan-in beams (lens→Arbiter)
  // and the cast beam (Arbiter→board) carry the verdict color instead of the old fixed orange / green.
  const boardTone: ToneKey = !killed && votedHere ? 'brand' : pips.for_ > pips.against ? 'ok' : 'bad';
  // mainnet replay overrides every node's explorer link to Base mainnet (else the address ↗ opens Sepolia).
  const bs = relay?.basescan;

  return (
    <div className={`chain${killed ? ' killed' : ''}`} ref={containerRef} style={{ width: '100%', maxWidth: 1120, alignItems: 'center' }}>
      <ChainNode nodeRef={youRef} icon={User} who={t.nodes.you.who} role={t.nodes.you.role} addr={parties.you} basescan={bs} active={connected} floatBelow killed={killed} tip={t.nodeTips.you} />
      <ChainNode nodeRef={orchRef} icon={Bot} who={t.nodes.orch.who} role={t.nodes.orch.role} addr={parties.orch} basescan={bs} active={nodeLit('redelegated')} working={orchWorking} floatBelow killed={killed} tip={t.nodeTips.orch} />

      {/* the four governance lenses (decision agents), stacked between the orchestrator and arbiter/终裁 */}
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', alignSelf: 'center' }}>
        {LENSES.map((lens, i) => {
          const lit = lensLit >= i;
          const v = verdictFor(lens.key);
          return (
            <ChainNode
              key={lens.key}
              nodeRef={lensRefs[i]}
              icon={LENS_ICON[lens.key]}
              who={t.presets[lens.key]}
              active={lit}
              working={lit && !v}
              result={v ? v.decision : undefined}
              tone={v ? decisionToneKey(v.decision) : 'brand'}
              killed={killed}
              small
              tip={t.nodeTips[lens.key]}
            />
          );
        })}
      </div>

      <ChainNode
        nodeRef={synthRef}
        icon={Scale}
        who={t.nodes.synthesis.who}
        role={t.nodes.synthesis.role}
        addr={parties.analyst}
        basescan={bs}
        active={beamLive('decided')}
        working={synthThinking}
        result={nodeLit('decided') && synthDecision ? (synthDecision as Decision) : undefined}
        tone={nodeLit('decided') && synthDecision ? decisionToneKey(synthDecision) : 'brand'}
        floatBelow
        killed={killed}
        tip={t.nodeTips.synthesis}
      />
      {/* the 1Shot relay node (mainnet only): the analyst's 7710 bundle is relayed through 1Shot —
          gas fronted by the relayer, fees paid in USDC by the off-axis Burner agent wallet. */}
      {oneShot && (
        <ChainNode
          nodeRef={oneShotRef}
          icon={Rocket}
          who="1Shot"
          role={t.oneShotNodeRole}
          active={relayLit >= 0}
          working={relayLit === 0}
          tone="info"
          floatBelow
          killed={killed}
          tip={t.nodeTips.oneShot}
        />
      )}
      <ChainNode nodeRef={boardRef} icon={Boxes} who={t.nodes.board.who} role={t.nodes.board.role} addr={parties.board} basescan={bs} active={connected} board tone={boardTone} floatBelow pips={pips} tip={t.nodeTips.board} />

      {/* You → Orchestrator (root, testnet), then fan-out to the lenses, fan-in to Arbiter (终裁),
          then to the board. The 2-hop A2A chain is real on BOTH networks now (the recorded mainnet
          run signs distinct user/orchestrator/analyst hops). */}
      <Beam container={containerRef} from={youRef} to={orchRef} live={beamLive('redelegated')} killed={killed} cutting={cutting} root flowing={!instant} />
      {LENSES.map((lens, i) => (
        <Beam key={`out-${lens.key}`} container={containerRef} from={orchRef} to={lensRefs[i]} live={beamLive('analyzing')} killed={killed} cutting={cutting} flowing={!instant} />
      ))}
      {LENSES.map((lens, i) => (
        <Beam
          key={`in-${lens.key}`}
          container={containerRef}
          from={lensRefs[i]}
          to={synthRef}
          live={beamLive('decided')}
          killed={killed}
          cutting={cutting}
          tone={decisionToneKey(verdictFor(lens.key)?.decision)}
        />
      ))}
      {/* the cast leg: Arbiter → VoteBoard, routed through the Burner + 1Shot relay on the mainnet path */}
      {oneShot ? (
        <>
          {/* packet OFF: the cast leg is 终裁 → 1Shot → VoteBoard; the off-axis Burner wallet supplies
              the fee coins. Each beam lights on its hop (relayLit 0 → 1). */}
          <Beam container={containerRef} from={synthRef} to={oneShotRef} live={castBeamLive(0)} killed={killed} cutting={cutting} tone={decisionToneKey(synthDecision)} packet={false} flowing={!instant} />
          <Beam container={containerRef} from={oneShotRef} to={boardRef} live={castBeamLive(1)} killed={killed} cutting={cutting} tone={decisionToneKey(synthDecision)} packet={false} flowing={!instant} />
        </>
      ) : (
        <Beam container={containerRef} from={synthRef} to={boardRef} live={beamLive('voted')} killed={killed} cutting={cutting} tone={decisionToneKey(synthDecision)}  flowing={!instant} />
      )}

      {live && !killed && !cutting && (
        <ScopeChip
          container={containerRef}
          youRef={youRef}
          orchRef={orchRef}
          synthRef={synthRef}
          burnerRef={undefined}
          oneShotRef={oneShot ? oneShotRef : undefined}
          boardRef={boardRef}
          pos={chipPos}
          attenuated={chipPos !== 'you' && chipPos !== 'orch'}
          label={scope.label}
          icon={scope.icon}
        />
      )}

      {/* TESTNET x402 sub-flow: a faint Venice-TEE enclave around the lens committee, a coin flying
          You->seller as the AI pays, and a receipt tick at the seller once the toll settles. */}
      {connected && !!paymentCap && !oneShot && (
        <PaymentFlow
          container={containerRef}
          youRef={youRef}
          synthRef={synthRef}
          lensRefs={lensRefs}
          active={lensLit >= 0}
          decidedLit={nodeLit('decided')}
          live={!instant}
          killed={killed}
          veniceTip={t.nodeTips.venice}
        />
      )}
      {tollSettled && !killed && !oneShot && <ReceiptTick container={containerRef} nodeRef={synthRef} txHash={tollTxHash} />}

      {/* MAINNET relay sub-flow: the burner pays two USDC fees (x402 → 终裁, relay fee → 1Shot), the
          relayer covers ETH gas, and two real receipt ticks link the x402 toll + the 1Shot castVote. */}
      {oneShot && relay && (
        <>
          {/* PaymentFlow draws ONLY the Venice enclave + node + synthesis query on mainnet (showCoin
              off): the x402 coin is supplied by the off-axis Burner agent wallet in MainnetRelayFlow,
              where buyer = the real on-chain burner SA, fees rising to their payees (no backflow). */}
          <PaymentFlow container={containerRef} youRef={youRef} synthRef={synthRef} lensRefs={lensRefs} active={lensLit >= 0} decidedLit={nodeLit('decided')} live={!instant} killed={killed} veniceTip={t.nodeTips.venice} showCoin={false} />
          <MainnetRelayFlow container={containerRef} synthRef={synthRef} oneShotRef={oneShotRef} boardRef={boardRef} relayLit={relayLit} decidedLit={nodeLit('decided')} paced={!instant && !killed} relay={relay} burnerAddr={parties.burner} basescan={bs ?? BASESCAN} killed={killed} t={t} />
          {/* receipts pop at their causal beats during a paced replay (toll paid → 终裁 tick;
              cast confirmed → 1Shot tick); at rest / on snap they show immediately */}
          {relay.tollTx && (instant || tollLanded) && <ReceiptTick container={containerRef} nodeRef={synthRef} txHash={relay.tollTx} basescan={relay.basescan} title="x402 toll ↗" />}
          {relay.castTx && (instant || castLanded) && <ReceiptTick container={containerRef} nodeRef={oneShotRef} txHash={relay.castTx} basescan={relay.basescan} title="1Shot castVote ↗" />}
        </>
      )}
    </div>
  );
}
