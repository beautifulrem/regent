'use client';

import { useEffect, useRef } from 'react';

interface FieldNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  cyan: boolean;
  r: number;
}

/**
 * Ambient network field — a slow-drifting constellation of nodes + proximity links over the aurora,
 * with orange (authority) + electric-blue (data) glints. Transform/opacity-only at 60fps; renders a
 * single static frame under prefers-reduced-motion. This is the quiet "web3 energy" behind the HUD.
 */
export function NetworkField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const COUNT = 56;
    const LINK = 180;
    let w = 0;
    let h = 0;
    let nodes: FieldNode[] = [];
    let raf = 0;

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const seed = () => {
      nodes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.085,
        vy: (Math.random() - 0.5) * 0.085,
        cyan: Math.random() < 0.32,
        r: Math.random() * 1.4 + 0.6,
      }));
    };
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            const o = (1 - d / LINK) * 0.15;
            ctx.strokeStyle = a.cyan || b.cyan ? `rgba(56,224,255,${o})` : `rgba(246,133,27,${o})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = n.cyan ? 'rgba(56,224,255,0.5)' : 'rgba(246,133,27,0.45)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = n.cyan ? 'rgba(56,224,255,0.08)' : 'rgba(246,133,27,0.06)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(() => {
      resize();
      seed();
      if (reduce) frame();
    });
    ro.observe(canvas);
    resize();
    seed();
    frame();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="mc-netbg" aria-hidden="true" />;
}
