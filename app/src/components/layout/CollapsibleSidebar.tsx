'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '../../lib/cn';

export const SIDEBAR_RAIL = 56;

/**
 * A Gemini/ChatGPT-style collapsible sidebar: a button animates it between a full panel and a narrow
 * icon rail. The aside animates its WIDTH (motion) with overflow-hidden, and the expanded content is
 * laid out at its full width and anchored to the OUTER edge, so it's revealed/clipped instead of
 * reflowing as the width changes; the icon rail cross-fades in. The center pane (a flex sibling) and
 * its React Flow graph re-fit live via the graph's ResizeObserver as this width animates.
 */
export function CollapsibleSidebar({
  side,
  collapsed,
  onToggle,
  width,
  label,
  expanded,
  rail,
}: {
  side: 'left' | 'right';
  collapsed: boolean;
  onToggle: () => void;
  width: number;
  label: string;
  expanded: ReactNode;
  rail: ReactNode;
}) {
  const CloseIcon = side === 'left' ? PanelLeftClose : PanelRightClose;
  const OpenIcon = side === 'left' ? PanelLeftOpen : PanelRightOpen;
  const outer = side === 'left' ? 'left-0' : 'right-0';

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_RAIL : width }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className={cn(
        'relative z-[2] hidden shrink-0 overflow-hidden bg-base/30 sm:block',
        side === 'left' ? 'border-r border-hairline' : 'border-l border-hairline',
      )}
    >
      {/* collapse / expand toggle — pinned to the inner edge */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? `expand ${label}` : `collapse ${label}`}
        className={cn(
          'absolute top-3 z-[4] grid! size-8! place-items-center! rounded-lg! border! border-hairline! bg-surface/70! p-0! text-ink-mute! shadow-none! backdrop-blur transition-colors hover:border-brand/45! hover:text-brand!',
          side === 'left' ? 'right-2.5' : 'left-2.5',
        )}
      >
        {collapsed ? <OpenIcon className="size-4" strokeWidth={2} /> : <CloseIcon className="size-4" strokeWidth={2} />}
      </button>

      {/* expanded content — full width, anchored to the outer edge, clipped as the aside collapses */}
      <div
        className={cn('absolute inset-y-0 transition-opacity duration-200', outer, collapsed && 'pointer-events-none')}
        style={{ width, opacity: collapsed ? 0 : 1 }}
        aria-hidden={collapsed}
      >
        {expanded}
      </div>

      {/* collapsed icon rail */}
      <div
        className={cn('absolute inset-y-0 transition-opacity duration-200', outer, !collapsed && 'pointer-events-none')}
        style={{ width: SIDEBAR_RAIL, opacity: collapsed ? 1 : 0 }}
        aria-hidden={!collapsed}
      >
        {rail}
      </div>
    </motion.aside>
  );
}
