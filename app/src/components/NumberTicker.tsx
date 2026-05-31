'use client';

import { animate } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Animated count that springs from its previous value to the new one — used for the live vote
 * tally, the agent-authority meter (100% → 0% on sever), and KPIs. Drives a plain React state
 * via animate()'s onUpdate so it re-renders reliably on React 19 (a MotionValue rendered directly
 * as a <motion.span> child does not). Respects prefers-reduced-motion by snapping instantly.
 */
export function NumberTicker({
  value,
  suffix = '',
  duration = 0.9,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const latest = useRef(value);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const start = latest.current;
    if (reduce || start === value) {
      latest.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(start, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        latest.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span>
      {Math.round(display)}
      {suffix}
    </span>
  );
}
