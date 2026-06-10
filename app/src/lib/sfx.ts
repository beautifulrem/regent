import { useSyncExternalStore } from 'react';

/**
 * HUD sound effects, synthesized with the Web Audio API — no audio assets, no licensing,
 * and the bleep/chime/whoosh palette matches the mission-control visual language.
 *
 * Every cue is a short envelope on oscillators/noise routed through one master gain:
 *   press   barely-audible UI click (primary action buttons)
 *   tick    one stage of the authority chain lighting up
 *   grant   the standing mandate is signed (two-note rise)
 *   vote    the vote lands on-chain (rising triad)
 *   coin    the x402 toll settles (two-note metallic ping)
 *   denied  the tamper probe reverts on-chain (double low buzz)
 *   sever   kill-the-chain — recall disables the root (falling sweep + noise crack)
 *   relay   the mainnet replay launches (rising whoosh)
 *
 * All entry points are no-ops without a window/AudioContext (SSR, tests) and while muted.
 * The mute choice persists in localStorage; useSfxMuted() subscribes React to it.
 */

const KEY = 'mandate.sfx.muted';
const MASTER_GAIN = 0.25;

let muted: boolean | null = null; // lazy — read localStorage on first use
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false; // private mode
  }
}

export function sfxMuted(): boolean {
  if (muted === null) muted = readStored();
  return muted;
}

export function toggleSfxMuted(): boolean {
  muted = !sfxMuted();
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
  return muted;
}

export function subscribeSfx(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React subscription to the mute state (SSR snapshot = unmuted; corrected on hydration). */
export function useSfxMuted(): boolean {
  return useSyncExternalStore(subscribeSfx, sfxMuted, () => false);
}

// ---------- engine ----------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ensure(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
      return null;
    }
  }
  // Autoplay policy: contexts start suspended until a user gesture — every cue retries a resume.
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return master ? { ctx, master } : null;
}

interface ToneOpts {
  freq: number;
  /** glide target frequency (Hz) reached at the end of the envelope. */
  to?: number;
  type?: OscillatorType;
  /** seconds after now to start. */
  at?: number;
  dur: number;
  peak: number;
}

function tone(a: { ctx: AudioContext; master: GainNode }, o: ToneOpts): void {
  const t0 = a.ctx.currentTime + (o.at ?? 0);
  const osc = a.ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(o.peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(a.master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

interface NoiseOpts {
  dur: number;
  peak: number;
  at?: number;
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
}

function noise(a: { ctx: AudioContext; master: GainNode }, o: NoiseOpts): void {
  const t0 = a.ctx.currentTime + (o.at ?? 0);
  const len = Math.max(1, Math.floor(a.ctx.sampleRate * o.dur));
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  // xorshift PRNG — deterministic noise, no Math.random needed
  let seed = 0x9e3779b9;
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
  }
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(o.peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let head: AudioNode = src;
  if (o.filter) {
    const f = a.ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.from, t0);
    if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, t0 + o.dur);
    if (o.filter.q) f.Q.value = o.filter.q;
    head.connect(f);
    head = f;
  }
  head.connect(g).connect(a.master);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

function play(fn: (a: { ctx: AudioContext; master: GainNode }) => void): void {
  if (sfxMuted()) return;
  const a = ensure();
  if (!a) return;
  try {
    fn(a);
  } catch {
    /* a failed cue must never break the UI */
  }
}

// ---------- cues ----------

/** Barely-audible click for the primary action buttons. */
export const sfxPress = (): void =>
  play((a) => noise(a, { dur: 0.016, peak: 0.05, filter: { type: 'highpass', from: 2400 } }));

/** One stage of the chain lighting up on the reveal beat. */
export const sfxTick = (): void => play((a) => tone(a, { freq: 1175, to: 880, dur: 0.07, peak: 0.07 }));

/** The standing mandate is signed — a warm two-note rise. */
export const sfxGrant = (): void =>
  play((a) => {
    tone(a, { freq: 587, dur: 0.12, peak: 0.11, type: 'triangle' });
    tone(a, { freq: 880, at: 0.09, dur: 0.2, peak: 0.13, type: 'triangle' });
  });

/** The vote lands on-chain — a rising A-major triad with a sparkle. */
export const sfxVote = (): void =>
  play((a) => {
    tone(a, { freq: 880, dur: 0.22, peak: 0.1 });
    tone(a, { freq: 1109, at: 0.09, dur: 0.22, peak: 0.1 });
    tone(a, { freq: 1319, at: 0.18, dur: 0.3, peak: 0.11 });
    tone(a, { freq: 2637, at: 0.18, dur: 0.25, peak: 0.04 });
  });

/** The x402 toll settles — a two-note metallic ping. */
export const sfxCoin = (): void =>
  play((a) => {
    tone(a, { freq: 1976, dur: 0.1, peak: 0.08 });
    tone(a, { freq: 2637, at: 0.07, dur: 0.18, peak: 0.09 });
  });

/** The tamper probe reverts on-chain — a double low buzz. */
export const sfxDenied = (): void =>
  play((a) => {
    tone(a, { freq: 150, dur: 0.09, peak: 0.12, type: 'square' });
    tone(a, { freq: 130, at: 0.14, dur: 0.12, peak: 0.12, type: 'square' });
  });

/** Kill-the-chain — a falling power-down sweep under a noise crack. */
export const sfxSever = (): void =>
  play((a) => {
    noise(a, { dur: 0.3, peak: 0.14, filter: { type: 'lowpass', from: 2600, to: 220, q: 0.8 } });
    tone(a, { freq: 320, to: 55, dur: 0.55, peak: 0.16, type: 'sawtooth' });
    tone(a, { freq: 90, to: 42, at: 0.05, dur: 0.35, peak: 0.18 });
  });

/** The mainnet replay launches — a rising whoosh. */
export const sfxRelay = (): void =>
  play((a) => {
    noise(a, { dur: 0.35, peak: 0.07, filter: { type: 'bandpass', from: 250, to: 2200, q: 1.2 } });
    tone(a, { freq: 440, to: 1320, dur: 0.3, peak: 0.05, type: 'triangle' });
  });
