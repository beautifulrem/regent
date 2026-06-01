'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '../../lib/cn';

export const SIDEBAR_RAIL = 56;

/**
 * Decisive, premium open/close curve (the Vaul / Linear drawer feel). Springs read as "floaty" when
 * resizing a panel, so the AI-chat apps (ChatGPT / Claude / Gemini) use a crisp tween instead.
 */
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

/**
 * A Gemini/ChatGPT-style collapsible sidebar: a button animates it between a full panel and a narrow
 * icon rail. The aside animates its WIDTH (crisp tween) with overflow-hidden; the expanded content is
 * laid out at its full width and anchored to the OUTER edge, so it's revealed/clipped instead of
 * reflowing as the width changes. Expanded content and the icon rail cross-fade with a small stagger
 * (content fades in just after the panel starts widening; the rail fades in just after it narrows),
 * and the collapse animation runs slightly faster than the expand (exit < enter). The center pane (a
 * flex sibling) and its React Flow graph re-fit live via the graph's ResizeObserver as this animates.
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
  const reduce = useReducedMotion();
  const CloseIcon = side === 'left' ? PanelLeftClose : PanelRightClose;
  const OpenIcon = side === 'left' ? PanelLeftOpen : PanelRightOpen;
  const outer = side === 'left' ? 'left-0' : 'right-0';

  // exit (collapse) is snappier than enter (expand); both instant under reduced-motion.
  const widthDur = reduce ? 0 : collapsed ? 0.26 : 0.34;
  const fadeDur = reduce ? 0 : 0.22;
  const toggleLabel = collapsed ? `expand ${label}` : `collapse ${label}`;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_RAIL : width }}
      transition={{ duration: widthDur, ease: EASE }}
      className={cn(
        'relative z-[2] hidden shrink-0 overflow-hidden bg-base/30 sm:block',
        side === 'left' ? 'border-r border-hairline' : 'border-l border-hairline',
      )}
    >
      {/* expanded content — full width, anchored to the outer edge, clipped as the aside collapses */}
      <motion.div
        className={cn('absolute inset-y-0', outer, collapsed && 'pointer-events-none')}
        style={{ width }}
        initial={false}
        animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? (side === 'left' ? -10 : 10) : 0 }}
        transition={{ duration: fadeDur, ease: EASE, delay: !reduce && !collapsed ? 0.07 : 0 }}
        aria-hidden={collapsed}
      >
        {expanded}
      </motion.div>

      {/* collapsed icon rail — cross-fades in just after the panel narrows */}
      <motion.div
        className={cn('absolute inset-y-0', outer, !collapsed && 'pointer-events-none')}
        style={{ width: SIDEBAR_RAIL }}
        initial={false}
        animate={{ opacity: collapsed ? 1 : 0 }}
        transition={{ duration: fadeDur, ease: EASE, delay: !reduce && collapsed ? 0.07 : 0 }}
        aria-hidden={!collapsed}
      >
        {rail}
      </motion.div>

      {/* collapse / expand toggle — pinned to the inner edge, above both layers */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        className={cn(
          'absolute top-3 z-[4] grid! size-8! place-items-center! rounded-lg! border! border-hairline! bg-none! bg-surface! p-0! text-ink-mute! shadow-[0_2px_12px_-4px_rgba(0,0,0,0.55)] transition-colors hover:border-brand/45! hover:bg-none! hover:bg-surface-2! hover:text-brand!',
          side === 'left' ? 'right-2.5' : 'left-2.5',
        )}
      >
        {collapsed ? <OpenIcon className="size-4" strokeWidth={2} /> : <CloseIcon className="size-4" strokeWidth={2} />}
      </button>
    </motion.aside>
  );
}
