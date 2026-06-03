'use client';

import { useEffect, useRef, useState } from 'react';

export type Play = 'off' | 'type' | 'full';

/**
 * Token-streaming hook — reveals text token-by-token with an irregular, LLM-like cadence (jittered
 * pauses, longer after punctuation). Timestamp-driven so a throttled / background tab still advances
 * and always snaps complete; honours prefers-reduced-motion by snapping instantly. Shared by the
 * center TEE console and the run-popover stream.
 */
export function useTeeStream(full: string, play: Play): { text: string; typing: boolean } {
  const schedule = useRef<{ key: string | null; tokens: string[]; cum: number[] }>({ key: null, tokens: [], cum: [] });
  if (schedule.current.key !== full) {
    const tokens = full ? full.match(/\s*\S+/g) ?? [] : [];
    let acc = 0;
    const cum = tokens.map((tok, i) => {
      const last = tok[tok.length - 1];
      const jit = ((i * 2654435761) % 100) / 100; // deterministic 0..1 from index
      let dur = 26 + jit * 40; // 26–66ms base per token
      if (/[.…!?。]/.test(last)) dur += 220; // sentence pause
      else if (/[,;:，；:]/.test(last)) dur += 110; // clause pause
      acc += dur;
      return acc;
    });
    schedule.current = { key: full, tokens, cum };
  }
  const { tokens, cum } = schedule.current;
  const [n, setN] = useState(0);
  const reduce = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (play === 'off') {
      setN(0);
      return;
    }
    if (play === 'full' || reduce.current) {
      setN(tokens.length);
      return;
    }
    const start = Date.now();
    setN(0);
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      let k = 0;
      while (k < cum.length && cum[k] <= elapsed) k++;
      setN(k);
      if (k >= tokens.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [play, full, tokens, cum]);

  return { text: tokens.slice(0, n).join(''), typing: n < tokens.length };
}

/** The blinking block caret — Matrix-cyan, styled by .tee-cursor in globals.css. */
export function TeeCursor() {
  return <span aria-hidden className="tee-cursor" />;
}

/** Venice decision → CSS color (matches the app convention: For green · Against red · Abstain amber). */
export const decisionColor = (d?: string) =>
  d === 'For' ? 'var(--color-ok)' : d === 'Against' ? 'var(--color-bad)' : 'var(--color-warn)';
