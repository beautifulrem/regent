'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Bot, Boxes, Coins, ExternalLink, Lock, Scale, Scissors, ShieldCheck, TrendingUp, User, Users, type LucideIcon } from 'lucide-react';
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
type ToneKey = 'brand' | 'info' | 'ok' | 'bad' | 'warn';
const TONES: Record<ToneKey, { accent: string; ring: string; bg: string; glow: string; beamDeep: string; beamLight: string; packet: string }> = {
  brand: { accent: 'var(--color-brand)', ring: 'rgba(246,133,27,.5)', bg: 'rgba(246,133,27,.15)', glow: 'rgba(246,133,27,.06)', beamDeep: 'var(--color-brand-deep)', beamLight: '#ffc879', packet: 'var(--color-brand-soft)' },
  info: { accent: 'var(--color-info)', ring: 'rgba(110,168,254,.5)', bg: 'rgba(110,168,254,.13)', glow: 'rgba(110,168,254,.07)', beamDeep: '#3b6fd0', beamLight: '#8fb6ef', packet: '#8fb6ef' },
  ok: { accent: 'var(--color-ok)', ring: 'rgba(74,222,128,.55)', bg: 'rgba(74,222,128,.12)', glow: 'rgba(74,222,128,.06)', beamDeep: '#2f9e5a', beamLight: '#6ee79a', packet: '#6ee79a' },
  bad: { accent: 'var(--color-bad)', ring: 'rgba(248,113,113,.55)', bg: 'rgba(248,113,113,.12)', glow: 'rgba(248,113,113,.06)', beamDeep: '#a23b3b', beamLight: '#f87171', packet: '#f87171' },
  warn: { accent: 'var(--color-warn)', ring: 'rgba(251,191,36,.55)', bg: 'rgba(251,191,36,.13)', glow: 'rgba(251,191,36,.07)', beamDeep: '#a87514', beamLight: '#fbbf24', packet: '#fbbf24' },
};

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
  tee?: boolean;
  thinking?: string;
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
}

function ChainNode({ nodeRef, icon: Icon, who, role, addr, active, working, tee, thinking, killed, board, small, floatBelow, result, tone, pips }: ChainNodeProps) {
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
        zIndex: 1,
        flex: small ? '0 0 auto' : 1,
        minWidth: 0,
        textAlign: 'center',
        opacity: killed && !board ? 0.4 : 1,
        filter: killed && !board ? 'grayscale(1)' : 'none',
        transition: 'opacity .3s, filter .3s',
      }}
    >
      <span
        style={{
          margin: '0 auto',
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 999,
          border: ringActive ? `1.5px solid ${ringColor}` : '1.5px solid var(--color-hairline)',
          background: ringActive ? ringBg : 'rgba(20,25,37,.6)',
          backdropFilter: 'blur(6px)',
          color: ringActive ? accent : 'var(--color-ink-mute)',
          boxShadow: ringActive ? `0 0 0 ${small ? 5 : 6}px ${glowRing}, 0 0 34px -10px ${accent}` : 'none',
          transition: 'all .3s',
          animation: working && !killed ? 'glow 2.8s ease-in-out infinite' : 'none',
        }}
        title={result ? `${who}: ${result}` : who}
        aria-label={result ? `${who} ${result}` : who}
      >
        <Icon size={small ? 16 : 24} strokeWidth={1.5} />
      </span>
      <div style={floatBelow ? { position: 'absolute', top: '100%', left: 0, right: 0 } : undefined}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: small ? 10.5 : 15.5, color: ringActive ? accent : 'var(--color-ink)', marginTop: small ? 3 : 9 }}>
        {who}
      </div>
      {role && <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-ink-mute)' }}>{role}</div>}

      {/* verdict pills intentionally removed from graph nodes; circles are colored by `tone` (see above).
          The TeeConsole committee cards + synth verdict row continue to show explicit "For"/"Against" text. */}
      {tee && !killed && (
        <div
          className="mc-thinking"
          style={{
            margin: small ? '6px auto 0' : '8px auto 0',
            maxWidth: 130,
            display: 'flex',
            height: small ? 18 : 22,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 6,
            border: '1px dashed rgba(110,168,254,.45)',
            background: 'rgba(110,168,254,.1)',
            color: 'var(--color-info)',
            fontSize: 10.5,
            padding: '0 7px',
          }}
        >
          <Lock size={11} /> {thinking}
        </div>
      )}
      {addr && (
        <a
          href={`${BASESCAN}/address/${addr}`}
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
}: {
  from: DivRef;
  to: DivRef;
  container: DivRef;
  live?: boolean;
  killed?: boolean;
  cutting?: boolean;
  root?: boolean;
  tone?: ToneKey;
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
            {live && <path className="beam-pulse" d={geom.d} stroke={`url(#beamgrad-${gid})`} />}
          </>
        )}
      </svg>
      {live && !killed && !cutting && (
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

function ScopeChip({
  container,
  youRef,
  orchRef,
  synthRef,
  pos,
  attenuated,
  label,
}: {
  container: DivRef;
  youRef: DivRef;
  orchRef: DivRef;
  synthRef: DivRef;
  pos: 'you' | 'orch' | 'synth';
  attenuated: boolean;
  label: string;
}) {
  const [xs, setXs] = useState<{ you: number; orch: number; synth: number; topY: number } | null>(null);
  useEffect(() => {
    const compute = () => {
      if (!container.current || !youRef.current || !orchRef.current || !synthRef.current) return;
      const cr = container.current.getBoundingClientRect();
      const cx = (n: HTMLDivElement) => {
        const r = n.getBoundingClientRect();
        return r.left - cr.left + r.width / 2;
      };
      // float the token just above the You / Orch / Synth circle row (they share one vertical centre).
      const orchTop = orchRef.current.getBoundingClientRect().top - cr.top;
      setXs({ you: cx(youRef.current), orch: cx(orchRef.current), synth: cx(synthRef.current), topY: orchTop - 30 });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [container, youRef, orchRef, synthRef]);
  if (!xs) return null;
  // The scope token (the delegation) rides You → Orchestrator → Arbiter/终裁 (the cast point); the four
  // lenses are decision agents, not delegation hops, so the token floats over them.
  const x = xs[pos];
  return (
    <div style={{ position: 'absolute', left: x, top: xs.topY, transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none', transition: 'left .85s var(--ease-fluid)' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
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
        <Lock size={12} /> {label}
      </span>
    </div>
  );
}

export interface ChainParties {
  you?: string;
  orch?: string;
  analyst?: string;
  board?: string;
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
  status,
  killed,
  cutting,
  connected,
  pips,
  lenses,
  synthDecision,
}: {
  t: Dict;
  parties: ChainParties;
  shownIdx: number; // staged reveal index, driven by the cockpit (shared with the TEE console)
  status?: string;
  killed: boolean;
  cutting: boolean;
  connected: boolean;
  pips: Pips;
  lenses: LensVerdict[] | undefined;
  synthDecision?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const orchRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lensRefs = useMemo<DivRef[]>(() => LENSES.map(() => ({ current: null })), []);
  const s = status;
  const live = !!s && !['', 'idle'].includes(s);

  const litIdx = useRatchet(shownIdx, PACKET_MS, killed);
  const idxOf = (target: string) => (ORDER as readonly string[]).indexOf(target);
  const beamLive = (target: string) => shownIdx >= idxOf(target);
  const nodeLit = (target: string) => litIdx >= idxOf(target);

  // The four lenses light one-by-one once 'analyzing' is revealed (the committee reports in).
  const lensTarget = beamLive('analyzing') ? LENSES.length - 1 : -1;
  const lensLit = useRatchet(lensTarget, LENS_STAGGER_MS, killed);

  const orchWorking = nodeLit('redelegated') && !beamLive('analyzing'); // lit, holding the scope
  const synthWorking = nodeLit('decided') && shownIdx < idxOf('voting'); // lit, finalizing the vote
  const verdictFor = (key: LensKey) => lenses?.find((l) => l.lens === key);

  // The scope token rides You → Orchestrator → Arbiter/终裁 (the per-proposal narrowed cast point).
  const chipPos: 'you' | 'orch' | 'synth' = beamLive('decided') ? 'synth' : beamLive('redelegated') ? 'orch' : 'you';
  const chipLabel = chipPos === 'synth' ? t.scopeChipAttenuated : chipPos === 'orch' ? t.scopeChip : t.scopeChipOrigin;

  // VoteBoard color = the live tally result (passing=green / failing=red), flipping to brand-orange the
  // moment our vote lands. The fan-in beams (lens→Arbiter) and the cast beam (Arbiter→board) now carry
  // the verdict color instead of the old fixed orange / green.
  const boardTone: ToneKey = nodeLit('voted') ? 'brand' : pips.for_ > pips.against ? 'ok' : 'bad';

  return (
    <div className={`chain${killed ? ' killed' : ''}`} ref={containerRef} style={{ width: '100%', maxWidth: 1120, alignItems: 'center' }}>
      <ChainNode nodeRef={youRef} icon={User} who={t.nodes.you.who} role={t.nodes.you.role} addr={parties.you} active={connected} floatBelow killed={killed} />
      <ChainNode nodeRef={orchRef} icon={Bot} who={t.nodes.orch.who} role={t.nodes.orch.role} addr={parties.orch} active={nodeLit('redelegated')} working={orchWorking} floatBelow killed={killed} />

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
              tee={lit && !v}
              thinking={t.thinking}
              result={v ? v.decision : undefined}
              tone={v ? decisionToneKey(v.decision) : 'info'}
              killed={killed}
              small
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
        active={nodeLit('decided')}
        working={synthWorking}
        result={nodeLit('decided') && synthDecision ? (synthDecision as Decision) : undefined}
        tone={nodeLit('decided') && synthDecision ? decisionToneKey(synthDecision) : 'brand'}
        floatBelow
        killed={killed}
      />
      <ChainNode nodeRef={boardRef} icon={Boxes} who={t.nodes.board.who} role={t.nodes.board.role} addr={parties.board} active={connected} board tone={boardTone} floatBelow pips={pips} />

      {/* You → Orchestrator (root), then fan-out to the lenses, fan-in to Arbiter (终裁), then to the board */}
      <Beam container={containerRef} from={youRef} to={orchRef} live={beamLive('redelegated')} killed={killed} cutting={cutting} root />
      {LENSES.map((lens, i) => (
        <Beam key={`out-${lens.key}`} container={containerRef} from={orchRef} to={lensRefs[i]} live={beamLive('analyzing')} killed={killed} cutting={cutting} />
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
      <Beam container={containerRef} from={synthRef} to={boardRef} live={beamLive('voted')} killed={killed} cutting={cutting} tone={decisionToneKey(synthDecision)} />

      {live && !killed && !cutting && (
        <ScopeChip container={containerRef} youRef={youRef} orchRef={orchRef} synthRef={synthRef} pos={chipPos} attenuated={chipPos === 'synth'} label={chipLabel} />
      )}
    </div>
  );
}
