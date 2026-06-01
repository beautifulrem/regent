'use client';

import { ShieldCheck } from 'lucide-react';
import { formatMessage, type Dict } from '../../lib/i18n';
import type { BoundMode } from '../../lib/mandate';

/**
 * Intento-style lead-in: the mandate you're about to sign, in one plain-English sentence that
 * updates live with the bound config, followed by the SAME limits flagged as "enforced on-chain"
 * (vote-only · the specific cap/window · revocable). Makes "revocable AI governance delegation"
 * legible before the user touches a single control.
 */
export function MandateSentence({
  boundMode,
  maxVotes,
  ttlDays,
  t,
}: {
  boundMode: BoundMode;
  maxVotes: number;
  ttlDays: number;
  t: Dict;
}) {
  const sentence = formatMessage(t.grantSentence[boundMode], { votes: String(maxVotes), days: String(ttlDays) });
  const chips = [
    t.scopeVote,
    boundMode !== 'days' ? `≤${maxVotes} ${t.grantVotesUnit}` : null,
    boundMode !== 'votes' ? `${ttlDays} ${t.grantDaysUnit}` : null,
    t.scopeRevocable,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-[540px] text-center">
      <p className="text-[13.5px] leading-relaxed text-ink-soft/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">{sentence}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.14em] text-ink-mute/70">
          <ShieldCheck className="size-3 text-brand" /> {t.grantSentence.enforced}
        </span>
        {chips.map((c, i) => (
          <span key={i} className="text-brand/85">
            · {c}
          </span>
        ))}
      </div>
    </div>
  );
}
