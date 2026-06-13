'use client';

import type { DaoProposal } from '@mandate/shared';
import type { Dict, Lang } from '../../lib/i18n';
import type { TallyBreakdown } from '../../lib/voteboard-view';
import { StatusDot } from '../ui/Badge';

/**
 * Top-center proposal HUD — the live status line (voting now · n/total · #id), the proposal title +
 * body, a segmented For/Against/Abstain micro-tally (from the live on-chain tally, so the user's own
 * cast vote shows up here), and the progress dots that rotate / select proposals.
 */
export function ProposalHUD({
  proposal,
  tally,
  activeIdx,
  count,
  onSelect,
  lang,
  t,
}: {
  proposal: DaoProposal;
  tally: TallyBreakdown;
  activeIdx: number;
  count: number;
  onSelect: (i: number) => void;
  lang: Lang;
  t: Dict;
}) {
  const forV = tally.for_;
  const against = tally.against;
  const abstain = tally.abstain;

  return (
    <div className="flex w-full max-w-[760px] flex-col items-center">
      <div className="mc-statusline">
        <StatusDot tone="ok" /> {t.feed.voting}
        <span className="text-ink-mute">
          · {activeIdx + 1}/{count}
        </span>
        <span className="font-mono font-medium normal-case tracking-normal text-ink-mute">
          · #{proposal.id.toString().slice(-6)}
        </span>
      </div>

      <h2 className="mc-title">{proposal.title[lang]}</h2>
      <p className="mc-body">{proposal.body[lang]}</p>

      <div
        className="mc-tallybar mt-3.5"
        role="img"
        aria-label={`${forV} ${t.tally.for} · ${against} ${t.tally.against} · ${abstain} ${t.tally.abstain}`}
      >
        <span aria-hidden="true" style={{ flexGrow: forV, background: 'var(--color-ok)' }} />
        <span aria-hidden="true" style={{ flexGrow: against, background: 'var(--color-bad)' }} />
        <span
          aria-hidden="true"
          style={{ flexGrow: abstain, background: 'var(--color-ink-mute)' }}
        />
      </div>
      <div className="mt-2 flex gap-4 text-[12.5px] font-semibold">
        <span className="text-ok">
          {forV} {t.tally.for}
        </span>
        <span className="text-bad">
          {against} {t.tally.against}
        </span>
        <span className="text-ink-mute">
          {abstain} {t.tally.abstain}
        </span>
      </div>

      <div className="mc-dots mt-2.5">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`mc-dot ${i === activeIdx ? 'on' : 'off'}`}
            aria-label={`proposal ${i + 1}`}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
    </div>
  );
}
