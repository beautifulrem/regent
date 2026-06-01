'use client';

import { KeyRound, ScanSearch, Wallet } from 'lucide-react';
import { LeftRail } from './LeftRail';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import type { MissionVM } from '../MissionControl';

/**
 * The grant-side sidebar — collapsible (Gemini-style). Expanded it shows the Smart-Account identity,
 * Permission X-Ray and Tamper Probe (or a standing-mandate intro before connecting); collapsed it's
 * an icon rail (wallet, plus X-Ray + Tamper once a grant exists). Clicking any rail icon expands it.
 */
export function LeftSidebar({ vm, collapsed, onToggle }: { vm: MissionVM; collapsed: boolean; onToggle: () => void }) {
  const granted = !!vm.rootDel && !!vm.userSA && !vm.killed && vm.grantedProposalId != null;
  const icons = granted ? [Wallet, ScanSearch, KeyRound] : [Wallet];

  return (
    <CollapsibleSidebar
      side="left"
      collapsed={collapsed}
      onToggle={onToggle}
      width={320}
      label={vm.lang === 'zh' ? '钱包' : 'wallet'}
      rail={
        <div className="flex h-full flex-col items-center gap-1.5 pt-14">
          {icons.map((Icon, i) => (
            <button
              key={i}
              type="button"
              onClick={onToggle}
              aria-label={vm.lang === 'zh' ? '展开' : 'expand'}
              className="grid! size-9! place-items-center! rounded-lg! border! border-transparent! bg-none! p-0! text-ink-mute! shadow-none! transition-colors hover:border-hairline! hover:text-ink!"
            >
              <Icon className="size-[18px]" strokeWidth={2} />
            </button>
          ))}
        </div>
      }
      expanded={<LeftRail vm={vm} />}
    />
  );
}
