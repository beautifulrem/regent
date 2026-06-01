'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TRACK_DEFS, type TrackTone } from '../../lib/tracks';
import { StatusDot } from '../ui/Badge';
import type { MissionVM } from '../MissionControl';

const TONE_TEXT: Record<TrackTone, string> = {
  brand: 'text-brand!',
  info: 'text-info!',
  ok: 'text-ok!',
  eth: 'text-[#8aa0f0]!',
};
const DOT_TONE: Record<TrackTone, 'brand' | 'info' | 'ok'> = { brand: 'brand', info: 'info', ok: 'ok', eth: 'info' };

/**
 * The judges' checklist — always-visible, the six hackathon tracks as frameless chips. Each lights
 * by run state (dormant → live pulse → proven ✓; x402/1Shot stay "ready" as on-demand demos) and
 * is click-to-peek: a popover surfaces the track's name + on-screen proof, so every capability is
 * discoverable at any time, even before a run.
 */
export function TrackRail({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const [open, setOpen] = useState<number | null>(null);
  const snap = {
    isConnected: vm.isConnected,
    hasSA: !!vm.userSA,
    hasRootDel: !!vm.rootDel,
    s: vm.s,
    hasVenice: !!vm.venice,
    hasConfig: !!vm.cfg,
  };

  return (
    <>
      {open !== null && <div className="fixed inset-0 z-[3]" aria-hidden onClick={() => setOpen(null)} />}
      <div className="absolute inset-x-0 bottom-4 z-[4] flex flex-wrap items-end justify-center gap-2 px-2">
        {TRACK_DEFS.map((def, idx) => {
          const state = def.state(snap);
          const item = t.scorecard.items[def.itemIndex];
          const isOpen = open === idx;
          const dim = state === 'dormant';
          return (
            <div key={def.short} className="relative">
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                    className="absolute bottom-[36px] left-1/2 w-[236px] -translate-x-1/2 rounded-xl border border-hairline bg-surface/95 px-3.5 py-3 text-left shadow-panel backdrop-blur-xl"
                  >
                    <div className={cn('text-[12px] font-bold', TONE_TEXT[def.tone])}>{item.name}</div>
                    <div className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">{item.proof}</div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={() => setOpen(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-chip! border! bg-none! px-2.5! py-1! text-[10px]! font-bold! uppercase tracking-[0.12em] shadow-none! transition-all duration-200',
                  dim ? 'border-transparent! text-ink-mute/45! hover:text-ink-mute!' : cn('bg-surface-2/50!', TONE_TEXT[def.tone]),
                  state === 'live' && 'border-current! shadow-[0_0_18px_-6px_currentColor]!',
                  state === 'proven' && 'border-current/35!',
                  state === 'ready' && 'border-hairline!',
                  isOpen && 'ring-1 ring-current',
                )}
              >
                {state === 'live' && <StatusDot tone={DOT_TONE[def.tone]} />}
                {state === 'proven' && <Check className="size-3" strokeWidth={3} />}
                {def.short}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
