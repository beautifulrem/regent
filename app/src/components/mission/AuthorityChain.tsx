'use client';

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Bot, Boxes, ExternalLink, Lock, ScanSearch, Scissors, User, type LucideIcon } from 'lucide-react';
import { BASESCAN, shortHex } from '../../lib/config';
import { ORDER } from '../../lib/runState';
import { useRatchet } from '../../lib/useRatchet';
import type { Dict } from '../../lib/i18n';

type Pips = { for_: number; against: number; abstain: number };
type DivRef = RefObject<HTMLDivElement | null>;

// Packet-travel time: a node turns ON this long after its incoming beam goes live, so the light
// visibly crosses the wire first and *then* the Orchestrator / Analyst lights up. Matches beamTravel.
// (The per-stage hold lives in the cockpit now — it drives the chain AND the TEE console together.)
const PACKET_MS = 850;

interface ChainNodeProps {
  nodeRef: DivRef;
  icon: LucideIcon;
  who: string;
  role: string;
  addr?: string;
  active?: boolean;
  working?: boolean;
  tee?: boolean;
  thinking?: string;
  killed?: boolean;
  board?: boolean;
  pips?: Pips;
}

function ChainNode({ nodeRef, icon: Icon, who, role, addr, active, working, tee, thinking, killed, board, pips }: ChainNodeProps) {
  const accent = board ? 'var(--color-ok)' : 'var(--color-brand)';
  const ringActive = !!active && !killed;
  const ringColor = board ? 'rgba(74,222,128,.55)' : 'rgba(246,133,27,.5)';
  const ringBg = board ? 'rgba(74,222,128,.12)' : 'rgba(246,133,27,.15)';
  return (
    <div
      ref={nodeRef}
      className="mc-node-hit"
      style={{
        position: 'relative',
        zIndex: 1,
        flex: 1,
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
          width: 60,
          height: 60,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 999,
          border: ringActive ? `1.5px solid ${ringColor}` : '1.5px solid var(--color-hairline)',
          background: ringActive ? ringBg : 'rgba(20,25,37,.6)',
          backdropFilter: 'blur(6px)',
          color: ringActive ? accent : 'var(--color-ink-mute)',
          boxShadow: ringActive
            ? `0 0 0 6px ${board ? 'rgba(74,222,128,.06)' : 'rgba(246,133,27,.06)'}, 0 0 34px -10px ${accent}`
            : 'none',
          transition: 'all .3s',
          animation: working && !killed ? 'glow 2.8s ease-in-out infinite' : 'none',
        }}
      >
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15.5, color: ringActive ? accent : 'var(--color-ink)', marginTop: 9 }}>
        {who}
      </div>
      <div style={{ marginTop: 2, fontSize: 12, color: 'var(--color-ink-mute)' }}>{role}</div>
      {tee && !killed && (
        <div
          className="mc-thinking"
          style={{
            margin: '8px auto 0',
            maxWidth: 130,
            display: 'flex',
            height: 22,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            borderRadius: 6,
            border: '1px dashed rgba(110,168,254,.45)',
            background: 'rgba(110,168,254,.1)',
            color: 'var(--color-info)',
            fontSize: 10.5,
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
  tone?: 'ok' | 'brand';
}) {
  const [geom, setGeom] = useState<Geom | null>(null);
  useEffect(() => {
    const compute = () => {
      if (!from.current || !to.current || !container.current) return;
      const cr = container.current.getBoundingClientRect();
      const a = from.current.getBoundingClientRect();
      const b = to.current.getBoundingClientRect();
      const iconY = 30; // icon-circle centre row, not the node centre
      const start = { x: a.right - cr.left - a.width / 2 + 46, y: a.top - cr.top + iconY };
      const end = { x: b.left - cr.left + b.width / 2 - 46, y: b.top - cr.top + iconY };
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      setGeom({ w: cr.width, h: cr.height, d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, start, end, mid: { x: mx, y: my } });
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
  const grad = tone === 'ok' ? 'beamgradok' : 'beamgrad';
  const packetColor = tone === 'ok' ? '#6ee79a' : 'var(--color-brand-soft)';
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
          <linearGradient id="beamgrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-brand-deep)" />
            <stop offset="100%" stopColor="#ffc879" />
          </linearGradient>
          <linearGradient id="beamgradok" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2f9e5a" />
            <stop offset="100%" stopColor="#6ee79a" />
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
            {live && <path className="beam-pulse" d={geom.d} stroke={`url(#${grad})`} />}
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
  analystRef,
  pos,
  attenuated,
  label,
}: {
  container: DivRef;
  youRef: DivRef;
  orchRef: DivRef;
  analystRef: DivRef;
  pos: 'you' | 'orch' | 'analyst';
  attenuated: boolean;
  label: string;
}) {
  const [xs, setXs] = useState<{ you: number; orch: number; analyst: number } | null>(null);
  useEffect(() => {
    const compute = () => {
      if (!container.current || !youRef.current || !orchRef.current || !analystRef.current) return;
      const cr = container.current.getBoundingClientRect();
      const cx = (n: HTMLDivElement) => {
        const r = n.getBoundingClientRect();
        return r.left - cr.left + r.width / 2;
      };
      setXs({ you: cx(youRef.current), orch: cx(orchRef.current), analyst: cx(analystRef.current) });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [container, youRef, orchRef, analystRef]);
  if (!xs) return null;
  // Rides with the light packet — You → Orchestrator → Analyst, one beam per stage. The `left`
  // transition matches the packet's 0.85s travel so the token and the light move as one.
  const x = xs[pos];
  return (
    <div style={{ position: 'absolute', left: x, top: -14, transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none', transition: 'left .85s var(--ease-fluid)' }}>
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
 * The live authority graph: You → Orchestrator → Analyst → VoteBoard. Beams light + a permission
 * packet travels left→right as the run advances; the floating scope token slides from the
 * orchestrator to the analyst as the permission is attenuated; Recall plays the scissors snip +
 * spark and the cables recoil apart (the kill-the-chain fracture).
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
}: {
  t: Dict;
  parties: ChainParties;
  shownIdx: number; // staged reveal index, driven by the cockpit (shared with the TEE console)
  status?: string;
  killed: boolean;
  cutting: boolean;
  connected: boolean;
  pips: Pips;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const orchRef = useRef<HTMLDivElement>(null);
  const analystRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const s = status;
  const live = !!s && !['', 'idle'].includes(s);

  // `shownIdx` (the staged reveal index) arrives from the cockpit, so the chain and the TEE console
  // advance off the SAME beat. Beams + the scope token use it directly; nodes light one packet-travel
  // later — `litIdx` ratchets toward shownIdx so a node only turns on once its packet has arrived.
  const litIdx = useRatchet(shownIdx, PACKET_MS, killed);

  const idxOf = (target: string) => (ORDER as readonly string[]).indexOf(target);
  const beamLive = (target: string) => shownIdx >= idxOf(target); // packet travels the wire
  const nodeLit = (target: string) => litIdx >= idxOf(target); //    node turns on once it arrives
  const orchWorking = nodeLit('redelegated') && !beamLive('analyzing'); // lit, holding the scope
  const analystWorking = nodeLit('analyzing') && shownIdx < idxOf('decided'); // lit, deciding
  const analystTee = analystWorking; // "thinking…" pill while deciding
  // The scope token rides with the packets: held by You, → Orchestrator on the You→Orch beam, then →
  // Analyst on the Orch→Analyst beam (attenuated). Same thresholds as the beams ⇒ moves in lockstep
  // with the light, instead of teleporting to the analyst the moment the first beam fires.
  const chipPos: 'you' | 'orch' | 'analyst' = beamLive('analyzing') ? 'analyst' : beamLive('redelegated') ? 'orch' : 'you';
  const chipAttenuated = beamLive('analyzing');
  // Held by You it's the full grant; the orchestrator's root delegation reads as its caveats; once
  // attenuated it's the narrowed scope.
  const chipLabel = chipPos === 'analyst' ? t.scopeChipAttenuated : chipPos === 'orch' ? t.scopeChip : t.scopeChipOrigin;

  return (
    <div className={`chain${killed ? ' killed' : ''}`} ref={containerRef} style={{ width: '100%', maxWidth: 1080 }}>
      <ChainNode nodeRef={youRef} icon={User} who={t.nodes.you.who} role={t.nodes.you.role} addr={parties.you} active={connected} killed={killed} />
      <ChainNode nodeRef={orchRef} icon={Bot} who={t.nodes.orch.who} role={t.nodes.orch.role} addr={parties.orch} active={nodeLit('redelegated')} working={orchWorking} killed={killed} />
      <ChainNode
        nodeRef={analystRef}
        icon={ScanSearch}
        who={t.nodes.analyst.who}
        role={t.nodes.analyst.role}
        addr={parties.analyst}
        active={nodeLit('analyzing')}
        working={analystWorking}
        tee={analystTee}
        thinking={t.thinking}
        killed={killed}
      />
      <ChainNode nodeRef={boardRef} icon={Boxes} who={t.nodes.board.who} role={t.nodes.board.role} addr={parties.board} active={connected} board pips={pips} />

      <Beam container={containerRef} from={youRef} to={orchRef} live={beamLive('redelegated')} killed={killed} cutting={cutting} root />
      <Beam container={containerRef} from={orchRef} to={analystRef} live={beamLive('analyzing')} killed={killed} cutting={cutting} />
      <Beam container={containerRef} from={analystRef} to={boardRef} live={beamLive('voted')} killed={killed} cutting={cutting} tone="ok" />

      {live && !killed && !cutting && (
        <ScopeChip container={containerRef} youRef={youRef} orchRef={orchRef} analystRef={analystRef} pos={chipPos} attenuated={chipAttenuated} label={chipLabel} />
      )}
    </div>
  );
}
