import type { ComponentType, HTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

/**
 * Glassmorphic surface — the container for every module in the redesign.
 * Frosted dark glass + hairline border + soft elevation; brand/eth/state tones
 * shift the border to signal status. `glow` swaps the panel shadow for the
 * MetaMask brand halo (used on the active/centerpiece module).
 */
const panel = cva(
  'relative rounded-panel border bg-surface/70 backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-300 ease-fluid',
  {
    variants: {
      tone: {
        default: 'border-hairline',
        brand: 'border-brand/30',
        eth: 'border-[#627eea]/40',
        ok: 'border-ok/30',
        bad: 'border-bad/30',
      },
      glow: { true: 'shadow-glow', false: 'shadow-panel' },
      pad: { none: '', md: 'p-5', lg: 'p-6 sm:p-7' },
    },
    defaultVariants: { tone: 'default', glow: false, pad: 'md' },
  },
);

export interface PanelProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof panel> {}

export function Panel({ tone, glow, pad, className, children, ...rest }: PanelProps) {
  return (
    <div className={cn(panel({ tone, glow, pad }), className)} {...rest}>
      {children}
    </div>
  );
}

/** Module header: lucide icon chip + kicker/title on the left, track tag + slot on the right. */
export function PanelHeader({
  icon: Icon,
  title,
  kicker,
  track,
  right,
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: ReactNode;
  kicker?: ReactNode;
  track?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-hairline bg-surface-2 text-brand">
            <Icon className="size-[18px]" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          {kicker && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">{kicker}</div>
          )}
          <h3 className="font-display text-[15px] font-semibold leading-tight text-ink">{title}</h3>
        </div>
      </div>
      {(track || right) && (
        <div className="flex shrink-0 items-center gap-2">
          {track}
          {right}
        </div>
      )}
    </div>
  );
}
