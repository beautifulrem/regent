'use client';

import { Check, Coins, Rocket, Zap } from 'lucide-react';
import type { Dict } from '../../lib/i18n';
import type { PanelKey } from './IconRail';

/**
 * x402 + 1Shot surfaced as native high-value capability cards (not buried in a sidebar), with the
 * met-track micro badges (4337 · 7710 · A2A · TEE) below — the judge-readable "what this proves"
 * row. Clicking a card opens its popover.
 */
export function CapabilityDock({
  t,
  onOpen,
  connected,
  revealIdx,
  killed,
  x402Settled,
  mainnet,
}: {
  t: Dict;
  onOpen: (key: PanelKey) => void;
  connected: boolean;
  revealIdx: number;
  killed?: boolean;
  x402Settled?: boolean;
  mainnet?: boolean;
}) {
  // Light up in sequence, in lockstep with the authority chain (revealIdx = the same staged index):
  // 4337 on connect, then 7710 (granted = stage 0) → A2A (redelegated = 1) → TEE (analyzing = 2) →
  // 7702 at the cast beat (voting = 4). The 7702 chip exists ONLY on mainnet — the testnet flow is
  // pure Hybrid-4337 + 7710 with no set-code anywhere, and a chip that can never light is noise.
  // Each chip pops + glows as it lights (see .mc-chip.met), so the proofs cascade instead of
  // flipping at once. Once the chain is severed they all go dark — the mandate is dead.
  const met = [
    { label: '4337', on: connected && !killed, tip: t.trackTips['4337'] },
    { label: '7710', on: revealIdx >= 0 && !killed, tip: t.trackTips['7710'] },
    ...(mainnet
      ? [{ label: '7702', on: revealIdx >= 4 && !killed, tip: t.trackTips['7702'] }]
      : []),
    { label: 'A2A', on: revealIdx >= 1 && !killed, tip: t.trackTips.A2A },
    { label: 'TEE', on: revealIdx >= 2 && !killed, tip: t.trackTips.TEE },
  ];
  return (
    <div className="flex flex-col items-center gap-3.5">
      <div className="mc-dock">
        <button
          type="button"
          className="mc-cap orange"
          onClick={() => onOpen('x402')}
          aria-label={t.panels.x402}
        >
          <span className="mc-cap-ic">
            <Coins className="size-[19px]" />
          </span>
          <span>
            <span className="mc-cap-k">x402 {x402Settled && <span className="live-dot" />}</span>
            <span className="mc-cap-v">
              {mainnet ? '0.001 USDC' : '1 mUSDC'} / {t.x402.perQuery}
            </span>
          </span>
        </button>

        {/* 1Shot is a MAINNET-only relay — on testnet it can't run, so the card is shown inert/grey. The
            detail itself lives inline in the mainnet replay, so this card is informational (not clickable). */}
        <div
          className={`mc-cap cyan${mainnet ? '' : ' inert'}`}
          role="group"
          aria-label={t.panels.oneshot}
          aria-disabled={!mainnet}
        >
          <span className="mc-cap-ic">
            <Rocket className="size-[19px]" />
          </span>
          <span>
            <span className="mc-cap-k">
              1Shot <Zap className="size-3.5 text-cyan" />
            </span>
            <span className="mc-cap-v">{mainnet ? t.capOneShot : t.capOneShotTestnet}</span>
          </span>
        </div>
      </div>

      <div className="mc-tracks">
        {met.map((m) => (
          // each chip carries a hover/focus bubble (reusing .mc-stance/.mc-stance-tip) that explains
          // what the proof means — judges can read it without leaving the cockpit.
          <span key={m.label} className="mc-stance">
            <span
              className={`mc-chip${m.on ? ' met' : ''}`}
              tabIndex={0}
              role="img"
              aria-label={`${m.label}: ${m.tip}`}
              aria-describedby={`track-tip-${m.label}`}
            >
              {m.on && <Check className="size-3" />}
              {m.label}
            </span>
            <span id={`track-tip-${m.label}`} className="mc-stance-tip" role="tooltip">
              {m.tip}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
