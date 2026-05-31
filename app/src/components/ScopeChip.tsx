'use client';

import { useEffect, useState, type RefObject } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Lock } from 'lucide-react';
import { anchorPoint, type Point } from '../lib/beam';
import type { Dict } from '../lib/i18n';

const CURV = 22; // matches AnimatedBeam's default curvature

function beamMid(container: HTMLElement, a: HTMLElement, b: HTMLElement): Point {
  const cr = container.getBoundingClientRect();
  const start = anchorPoint(cr, a.getBoundingClientRect(), 'right');
  const end = anchorPoint(cr, b.getBoundingClientRect(), 'left');
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - CURV / 2 };
}

/**
 * The A2A attenuation made visible: a "4 caveats" chip rides the authority spine. On
 * granted→redelegated it travels from the You→Orchestrator beam midpoint to the
 * Orchestrator→Analyst midpoint, shrinks, and re-stamps "· attenuated" with the real
 * redelegationHash — so a judge SEES the orchestrator narrow + pass on the permission.
 */
export function ScopeChip({
  containerRef,
  youRef,
  orchRef,
  analystRef,
  redelegated,
  t,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  youRef: RefObject<HTMLDivElement | null>;
  orchRef: RefObject<HTMLDivElement | null>;
  analystRef: RefObject<HTMLDivElement | null>;
  redelegated: boolean;
  t: Dict;
}) {
  const reduce = useReducedMotion();
  const [mids, setMids] = useState<{ a: Point; b: Point } | null>(null);

  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      const y = youRef.current;
      const o = orchRef.current;
      const an = analystRef.current;
      if (!c || !y || !o || !an) return;
      setMids({ a: beamMid(c, y, o), b: beamMid(c, o, an) });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [containerRef, youRef, orchRef, analystRef]);

  if (!mids) return null;
  const pos = redelegated ? mids.b : mids.a;

  return (
    <motion.div
      className="scope-chip"
      initial={false}
      animate={{ left: pos.x, top: pos.y, scale: redelegated ? 0.84 : 1 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 210, damping: 26 }}
    >
      <Lock className="size-3" /> {redelegated ? t.scopeChipAttenuated : t.scopeChip}
    </motion.div>
  );
}
