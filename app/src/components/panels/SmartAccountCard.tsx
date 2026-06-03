'use client';

import type { Address } from 'viem';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { KeyRound, Wallet } from 'lucide-react';
import { BASESCAN, shortHex } from '../../lib/config';
import { formatMessage, type Dict } from '../../lib/i18n';
import type { SmartAccount } from '../../lib/wallet';
import { Badge } from '../ui/Badge';

/**
 * Frameless identity HUD for the connected MetaMask Smart Account (the ERC-4337 root delegator).
 * No card — a Jazzicon + the real on-chain SA address (BaseScan link) + the 4337·Hybrid marker +
 * the signer EOA + how it signs. This is the "You" node's dossier; it opens in the Smart Account
 * popover the moment a wallet connects, so judges SEE a real smart account before anything is granted.
 */
export function SmartAccountCard({
  userSA,
  eoaAddress,
  t,
}: {
  userSA: SmartAccount;
  eoaAddress?: Address;
  t: Dict;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-mute/80">
        <Wallet className="size-3" /> {t.walletLabel}
      </div>

      <div className="flex items-start gap-2.5">
        <Jazzicon diameter={26} seed={jsNumberForAddress(userSA.address)} />
        <a
          href={`${BASESCAN}/address/${userSA.address}`}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 break-all font-mono text-[12.5px] font-medium leading-snug text-ink transition-colors hover:text-brand"
        >
          {userSA.address}
        </a>
      </div>

      <div>
        <Badge tone="brand">{t.saHeadline}</Badge>
      </div>

      <div className="font-mono text-[11px] text-ink-mute">
        {formatMessage(t.eoaSubline, { address: eoaAddress ? shortHex(eoaAddress, 5) : t.notConnected })}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-ink-mute/85">
        <KeyRound className="size-3" /> {t.sigCaption}
      </div>
    </div>
  );
}
