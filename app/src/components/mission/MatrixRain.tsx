'use client';

import { useEffect, useRef } from 'react';

// Katakana + hex + block glyphs — the "code rain" alphabet.
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF▓▒░█▌▐';

/**
 * Confined "digital rain" for the TEE console — a subtle, premium nod to the Matrix without going
 * full neon-green. Cyan heads, info-blue trails, rare orange/green glints (all brand colors). Pure
 * canvas (no DOM glyph nodes), throttled to ~25fps; renders a single faint static frame under
 * prefers-reduced-motion. Sits behind the console content at low opacity (see .tee-rain in CSS).
 */
export function MatrixRain({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const FONT = 13;
    let w = 0;
    let h = 0;
    let drops: { y: number; speed: number }[] = [];
    let raf = 0;
    let last = 0;

    const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(1, Math.floor(w / FONT));
      drops = Array.from({ length: n }, () => ({ y: Math.random() * -20, speed: 0.35 + Math.random() * 0.45 }));
    };

    const draw = (head: boolean) => {
      ctx.font = `${FONT}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        const x = i * FONT;
        const r = Math.random();
        ctx.fillStyle = r < 0.03 ? 'rgba(246,133,27,0.5)' : r < 0.12 ? 'rgba(74,222,128,0.42)' : 'rgba(56,224,255,0.6)';
        ctx.fillText(glyph(), x, d.y * FONT);
        if (head) {
          if (d.y * FONT > h && Math.random() > 0.975) d.y = Math.random() * -10;
          d.y += d.speed;
        }
      }
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 40) return;
      last = t;
      ctx.fillStyle = 'rgba(7,11,20,0.1)'; // fade → trailing tails
      ctx.fillRect(0, 0, w, h);
      draw(true);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) {
        ctx.clearRect(0, 0, w, h);
        draw(false);
      }
    });
    ro.observe(canvas);
    resize();
    if (reduce) draw(false);
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
