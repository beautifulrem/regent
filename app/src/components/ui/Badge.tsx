import type { ComponentType, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

/** Small status pill — replaces the legacy `.pill` classes. */
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-hairline bg-surface-2 text-ink-soft',
        brand: 'border-brand/40 bg-brand/10 text-brand',
        ok: 'border-ok/35 bg-ok/12 text-ok',
        warn: 'border-warn/35 bg-warn/12 text-warn',
        bad: 'border-bad/35 bg-bad/12 text-bad',
        info: 'border-info/35 bg-info/12 text-info',
        eth: 'border-eth/40 bg-eth/12 text-eth',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends VariantProps<typeof badge> {
  className?: string;
  children: ReactNode;
}

export function Badge({ tone, className, children }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>;
}

const DOT_BG = {
  ok: 'bg-ok',
  brand: 'bg-brand',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  idle: 'bg-ink-mute',
} as const;

/** Pulsing presence indicator (ping halo respects reduced-motion). */
export function StatusDot({
  tone = 'ok',
  pulse = true,
  className,
}: {
  tone?: keyof typeof DOT_BG;
  pulse?: boolean;
  className?: string;
}) {
  const c = DOT_BG[tone];
  return (
    <span className={cn('relative inline-flex size-2.5', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping',
            c,
          )}
        />
      )}
      <span className={cn('relative inline-flex size-2.5 rounded-full', c)} />
    </span>
  );
}

/** The on-screen "which track this proves" label — judges read it at a glance. */
const trackTag = cva(
  'inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]',
  {
    variants: {
      tone: {
        brand: 'border-brand/40 bg-brand/10 text-brand',
        info: 'border-info/40 bg-info/10 text-info',
        eth: 'border-eth/40 bg-eth/10 text-eth',
        ok: 'border-ok/40 bg-ok/10 text-ok',
      },
    },
    defaultVariants: { tone: 'brand' },
  },
);

export function TrackTag({
  tone,
  icon: Icon,
  children,
}: VariantProps<typeof trackTag> & {
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span className={trackTag({ tone })}>
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}
