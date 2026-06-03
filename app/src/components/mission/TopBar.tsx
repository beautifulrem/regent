'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import type { Dict, Lang } from '../../lib/i18n';
import { LangToggle } from '../LangToggle';
import { StatusDot } from '../ui/Badge';

/**
 * Persistent HUD chrome over the canvas: the Mandate logo lockup (left) and the language toggle +
 * live-network pill + wallet identity pill (right). The wallet pill is driven by RainbowKit's custom
 * render-prop so real connect / account / chain modals stay wired — connecting itself lives in the
 * Smart-Account popover; here we only surface the connected identity.
 */
export function TopBar({ lang, toggleLang, t }: { lang: Lang; toggleLang: () => void; t: Dict }) {
  return (
    <header className="mc-topbar">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-[11px] border border-brand/30 bg-brand/10 text-brand shadow-[0_0_24px_-8px_var(--color-brand)]">
          <ShieldCheck className="size-5" strokeWidth={2} />
        </span>
        <span className="font-display text-[19px] font-bold tracking-tight text-ink">Mandate</span>
      </div>

      <div className="flex items-center gap-2.5">
        <LangToggle lang={lang} onToggle={toggleLang} />
        <span className="inline-flex items-center gap-2 rounded-chip border border-hairline bg-surface/60 px-3.5 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur">
          <StatusDot tone="ok" /> Base Sepolia
        </span>

        <ConnectButton.Custom>
          {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
            const ready = mounted;
            const connected = ready && !!account && !!chain;
            if (!ready) return <span aria-hidden className="h-8 w-px" />;
            if (!connected) {
              return (
                <button
                  type="button"
                  onClick={openConnectModal}
                  className="mc-btn !px-3.5 !py-1.5 !text-[13px]"
                >
                  {t.connect}
                </button>
              );
            }
            if (chain.unsupported) {
              return (
                <button type="button" onClick={openChainModal} className="mc-btn danger !px-3.5 !py-1.5 !text-[13px]">
                  Wrong network
                </button>
              );
            }
            return (
              <button
                type="button"
                onClick={openAccountModal}
                className="inline-flex items-center gap-2 rounded-chip border border-hairline bg-none bg-surface/60 px-3 py-1.5 font-mono text-xs font-semibold text-ink-soft shadow-none backdrop-blur transition-colors hover:border-brand/40 hover:text-ink"
              >
                <Jazzicon diameter={16} seed={jsNumberForAddress(account.address)} />
                {account.displayName}
                <ChevronDown className="size-3.5 text-ink-mute" />
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
}
