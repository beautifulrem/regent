'use client';

import type { ComponentType } from 'react';

export type PanelKey = 'wallet' | 'tally' | 'x402' | 'oneshot' | 'run';

export interface RailItem {
  key: PanelKey;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  /** Small brand dot in the corner (e.g. a live run on the Run button). */
  dot?: boolean;
  /** Inert + non-clickable (e.g. x402 before its first real per-vote settlement). */
  disabled?: boolean;
}

/**
 * The single right-hand icon rail (wallet · tally · x402 · 1Shot · run). Each button toggles its
 * anchored popover bubble; the active one warms to brand. The rail sits above the popovers so it
 * stays clickable while a bubble is open.
 */
export function IconRail({
  items,
  active,
  onSelect,
  side = 'right',
}: {
  items: RailItem[];
  active: PanelKey | null;
  onSelect: (key: PanelKey) => void;
  side?: 'left' | 'right';
}) {
  return (
    <div className={`mc-rail ${side}`}>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            type="button"
            className={`mc-rail-btn${active === it.key ? ' active' : ''}${it.disabled ? ' disabled' : ''}`}
            title={it.title}
            aria-label={it.title}
            aria-pressed={active === it.key}
            aria-disabled={it.disabled}
            onClick={() => !it.disabled && onSelect(it.key)}
          >
            <Icon className="size-[19px]" strokeWidth={1.9} />
            {it.dot && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" />}
          </button>
        );
      })}
    </div>
  );
}
