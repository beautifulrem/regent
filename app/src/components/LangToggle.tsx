'use client';

import type { Lang } from '../lib/i18n';

/** EN ⇄ 中文 switch. Shows the language you'll switch *to*. */
export function LangToggle({ lang, onToggle }: { lang: Lang; onToggle: () => void }) {
  const target = lang === 'en' ? '中文' : 'EN';
  return (
    <button
      type="button"
      className="lang-btn"
      onClick={onToggle}
      aria-label={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
    >
      🌐 {target}
    </button>
  );
}
