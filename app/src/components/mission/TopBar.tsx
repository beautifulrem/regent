'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { ChevronDown, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import type { Dict, Lang } from '../../lib/i18n';
import { sfxTick, toggleSfxMuted, useSfxMuted } from '../../lib/sfx';
import { LangToggle } from '../LangToggle';
import { StatusDot } from '../ui/Badge';

/**
 * Persistent HUD chrome over the canvas: the Mandate logo lockup (left) and the language toggle +
 * live-network pill + wallet identity pill (right). The wallet pill is driven by RainbowKit's custom
 * render-prop so real connect / account / chain modals stay wired — connecting itself lives in the
 * Smart-Account popover; here we only surface the connected identity.
 */
/** GitHub mark (lucide dropped brand icons) — stroke-free glyph, currentColor. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function TopBar({
  lang,
  toggleLang,
  t,
  network = 'sepolia',
  toggleNetwork,
  mainnetAvailable = false,
}: {
  lang: Lang;
  toggleLang: () => void;
  t: Dict;
  network?: 'sepolia' | 'mainnet';
  toggleNetwork?: () => void;
  mainnetAvailable?: boolean;
}) {
  const isMainnet = network === 'mainnet';
  const sfxOff = useSfxMuted();
  return (
    <header className="mc-topbar">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-[11px] border border-brand/30 bg-brand/10 text-brand shadow-[0_0_24px_-8px_var(--color-brand)]">
          <ShieldCheck className="size-5" strokeWidth={2} />
        </span>
        <span className="font-display text-[19px] font-bold tracking-tight text-ink">Mandate</span>
      </div>

      <div className="flex items-center gap-2.5">
        <a
          href="https://github.com/beautifulrem/mandate"
          target="_blank"
          rel="noreferrer"
          title={t.repoTitle}
          className="grid size-8 place-items-center rounded-chip border border-hairline bg-surface/60 !text-ink-soft no-underline backdrop-blur transition-colors hover:border-brand/40 hover:!text-ink"
        >
          <GitHubMark className="size-4" />
        </a>
        <button
          type="button"
          onClick={() => {
            const nowMuted = toggleSfxMuted();
            if (!nowMuted) sfxTick(); // audible confirmation only when turning sound ON
          }}
          title={sfxOff ? t.soundOff : t.soundOn}
          className="grid size-8 place-items-center rounded-chip border border-hairline bg-none bg-surface/60 p-0 text-ink-soft shadow-none backdrop-blur transition-colors hover:border-brand/40 hover:text-ink"
        >
          {sfxOff ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        <LangToggle lang={lang} onToggle={toggleLang} />
        {mainnetAvailable && toggleNetwork ? (
          <button
            type="button"
            onClick={toggleNetwork}
            title="Switch network"
            className={`inline-flex items-center gap-2 rounded-chip border bg-none px-3.5 py-1.5 text-xs font-semibold shadow-none backdrop-blur transition-colors ${
              isMainnet
                ? 'border-info/45 bg-info/10 text-info hover:border-info/70'
                : 'border-hairline bg-surface/60 text-ink-soft hover:border-brand/40 hover:text-ink'
            }`}
          >
            <StatusDot tone={isMainnet ? 'info' : 'ok'} /> {isMainnet ? t.netMainnet : t.netSepolia}
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-chip border border-hairline bg-surface/60 px-3.5 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur">
            <StatusDot tone="ok" /> Base Sepolia
          </span>
        )}

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
