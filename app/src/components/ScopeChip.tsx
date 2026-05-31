'use client';

import { useEffect, useState, type RefObject } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Lock } from 'lucide-react';
import type { Dict } from '../lib/i18n';

const BAND_Y = 4; // sits in the chain's top padding band, clear of the node content below

/** X of a node's centre, relative to the chain container. */
function centerX(container: HTMLElement, node: HTMLElement): number {
  const cr = container.getBoundingClientRect();
  const nr = node.getBoundingClientRect();
  return nr.left - cr.left + nr.width / 2;
}

/**
 * The A2A attenuation made visible: a small token floats in the band ABOVE the chain, over whichever
 * node currently holds the permission — the orchestrator before the redelegation, the analyst after.
 * Floating above the node row (not in the cramped inter-node gap) keeps it clear of node content at
 * any viewport width; it shrinks + slides to the analyst to show the scope being narrowed and passed.
 */
export function ScopeChip({
  containerRef,
  orchRef,
  analystRef,
  redelegated,
  t,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  orchRef: RefObject<HTMLDivElement | null>;
  analystRef: RefObject<HTMLDivElement | null>;
  redelegated: boolean;
  t: Dict;
}) {
  const reduce = useReducedMotion();
  const [xs, setXs] = useState<{ orch: number; analyst: number } | null>(null);

  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      const o = orchRef.current;
      const an = analystRef.current;
      if (!c || !o || !an) return;
      setXs({ orch: centerX(c, o), analyst: centerX(c, an) });
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [containerRef, orchRef, analystRef]);

  if (!xs) return null;
  const x = redelegated ? xs.analyst : xs.orch;
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 210, damping: 26 };

  return (
    <motion.div className="scope-chip-anchor" initial={false} animate={{ left: x, top: BAND_Y }} transition={spring}>
      <motion.div className="scope-chip" initial={false} animate={{ scale: redelegated ? 0.92 : 1 }} transition={spring}>
        <Lock className="size-3" /> {redelegated ? t.scopeChipAttenuated : t.scopeChip}
      </motion.div>
    </motion.div>
  );
}
