'use client';

import { useEffect, useId, type ComponentType, type ReactNode } from 'react';
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
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={`mc-pop ${side}`}
      role="dialog"
      aria-labelledby={titleId}
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
          <span id={titleId} className="mc-side-title truncate">
            {title}
          </span>
        </div>
        <button type="button" className="mc-x" onClick={onClose} aria-label="close">
          <X className="size-[15px]" strokeWidth={2} />
        </button>
      </div>
      <div className="mc-pop-body hud-scroll">{children}</div>
    </div>
  );
}
