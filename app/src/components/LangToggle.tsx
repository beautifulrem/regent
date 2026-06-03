'use client';

import { Languages } from 'lucide-react';
import type { Lang } from '../lib/i18n';

/** EN ⇄ 中文 switch. Shows the language you'll switch *to*. */
export function LangToggle({ lang, onToggle }: { lang: Lang; onToggle: () => void }) {
  const target = lang === 'en' ? '中文' : 'EN';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
      className="inline-flex items-center gap-1.5 rounded-chip border border-hairline bg-none bg-surface/70 px-3 py-1.5 text-xs font-bold text-ink-soft shadow-none backdrop-blur transition-colors duration-150 hover:border-brand/50 hover:bg-surface-2 hover:text-brand hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <Languages className="size-3.5" />
      {target}
    </button>
  );
}
