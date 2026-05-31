import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../lib/cn';

const VALUE_TONE = {
  ink: 'text-ink',
  brand: 'text-brand',
  ok: 'text-ok',
  info: 'text-info',
  eth: 'text-[#8aa0f0]',
} as const;

/** A KPI block: uppercase label (+ optional lucide icon) over a big tabular value. */
export function Stat({
  label,
  value,
  unit,
  tone = 'ink',
  icon: Icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  tone?: keyof typeof VALUE_TONE;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('font-display text-2xl font-bold tabular-nums', VALUE_TONE[tone])}>{value}</span>
        {unit && <span className="text-xs font-medium text-ink-soft">{unit}</span>}
      </div>
    </div>
  );
}
