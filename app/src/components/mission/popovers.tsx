'use client';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { VOTE_BOARD_ADDRESS } from '@mandate/shared';
import { Award, Globe, Lock, Wallet } from 'lucide-react';
import { CHAIN_ID } from '../../lib/config';
import type { TallyBreakdown } from '../../lib/voteboard-view';
import type { VoterRow } from '../../lib/useLiveTally';
import { VoteTally } from '../VoteTally';
import { X402TollGate } from '../X402TollGate';
import { OneShotFinale } from '../OneShotFinale';
import { TeeReasoningStream } from '../TeeReasoningStream';
import { PermissionInspector } from '../PermissionInspector';
import { TamperProbe } from '../TamperProbe';
import { SmartAccountCard } from '../panels/SmartAccountCard';
import { ProofTimeline } from '../panels/ProofTimeline';
import { VoteLog } from '../panels/VoteLog';
import { VoteResultBanner } from '../panels/VoteResultBanner';
import { TrackTag } from '../ui/Badge';
import type { MissionVM } from '../MissionControl';
import type { PanelKey } from './IconRail';

/** Routes a rail key to its popover body, reusing the app's real (live) modules. */
export function PopoverBody({
  panel,
  vm,
  tally,
  voters,
  live,
}: {
  panel: PanelKey;
  vm: MissionVM;
  tally: TallyBreakdown;
  voters: VoterRow[];
  live: boolean;
}) {
  switch (panel) {
    case 'wallet':
      return <WalletBody vm={vm} />;
    case 'tally':
      return <VoteTally tally={tally} voters={voters} live={live} you={vm.userSA?.address} t={vm.t} bare />;
    case 'x402':
      return vm.cfg ? <X402TollGate cfg={vm.cfg} t={vm.t} bare /> : null;
    case 'oneshot':
      return <OneShotFinale t={vm.t} bare />;
    case 'run':
      return <RunBody vm={vm} />;
    default:
      return null;
  }
}

/** Smart-Account identity + the permission dossier (Permission X-Ray + on-chain Tamper Probe). */
function WalletBody({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const { openConnectModal } = useConnectModal();

  if (!vm.userSA) {
    return (
      <div className="flex flex-col gap-3.5">
        <TrackTag tone="brand" icon={Award}>
          Smart Accounts · ERC-4337
        </TrackTag>
        <p className="m-0 text-[13px] leading-relaxed text-ink-soft">{t.connectHint}</p>
        <button type="button" className="mc-btn" onClick={() => openConnectModal?.()}>
          <Wallet className="size-[15px]" /> {t.connect}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TrackTag tone="brand" icon={Award}>
        Smart Accounts · ERC-4337
      </TrackTag>
      <SmartAccountCard userSA={vm.userSA} eoaAddress={vm.address} t={t} />
      {vm.rootDel && (
        <>
          <div className="border-t border-hairline" />
          <PermissionInspector rootDel={vm.rootDel} chainId={CHAIN_ID} bare />
          {vm.grantedProposalId != null && (
            <>
              <div className="border-t border-hairline" />
              <TamperProbe rootDel={vm.rootDel} governor={VOTE_BOARD_ADDRESS} proposalId={vm.grantedProposalId} chainId={CHAIN_ID} bare />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Under-the-hood run dossier: the TEE reasoning, the on-chain result, the proof timeline, the log. */
function RunBody({ vm }: { vm: MissionVM }) {
  const { t } = vm;
  const runActive = !!vm.venice || !!vm.run;
  if (!runActive) return <p className="m-0 text-[13px] leading-relaxed text-ink-mute/80">{t.tabs.noRun}</p>;
  return (
    <div className="flex flex-col gap-5">
      {vm.venice && !vm.killed && (
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-info/80">
            <Lock className="size-3" /> {t.split.private}
          </div>
          <TeeReasoningStream venice={vm.venice} t={t} />
        </div>
      )}
      {(vm.run?.vote || vm.killed) && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ok/80">
            <Globe className="size-3" /> {t.split.public}
          </div>
          <VoteResultBanner run={vm.run} killed={vm.killed} recallTx={vm.recallTx} userSAAddress={vm.userSA?.address} t={t} />
        </div>
      )}
      {vm.run && <ProofTimeline run={vm.run} killed={vm.killed} t={t} />}
      {vm.voteLog.length > 0 && <VoteLog records={vm.voteLog} lang={vm.lang} t={t} />}
    </div>
  );
}
