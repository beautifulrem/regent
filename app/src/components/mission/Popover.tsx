'use client';

import type { ComponentType, ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Anchored popover "bubble" — height adapts to its content and it floats over the canvas (the focal
 * column is never squeezed). A little tail points back at the rail button it sprang from; the X (or
 * re-clicking the rail icon) closes it.
 */
export function Popover({
  side,
  open,
  anchorTop,
  title,
  icon: Icon,
  onClose,
  children,
}: {
  side: 'left' | 'right';
  open: boolean;
  anchorTop: number;
  title: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className={`mc-pop ${side}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ top: anchorTop, maxHeight: `calc(100vh - ${anchorTop}px - 22px)` }}
    >
      <span className="mc-pop-tail" aria-hidden="true" />
      <div className="mc-pop-head">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="mc-pop-ic">
              <Icon className="size-[15px]" strokeWidth={2} />
            </span>
          )}
          <span className="mc-side-title truncate">{title}</span>
        </div>
        <button type="button" className="mc-x" onClick={onClose} aria-label="close">
          <X className="size-[15px]" strokeWidth={2} />
        </button>
      </div>
      <div className="mc-pop-body hud-scroll">{children}</div>
    </div>
  );
}
