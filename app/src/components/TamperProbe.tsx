'use client';

import { useState } from 'react';
import {
  canRedeem,
  delegationManagerAddress,
  redeemVoteCalldata,
  type Delegation,
} from '@mandate/shared';
import { createPublicClient, http, type Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { Ban, CheckCircle2, Radar } from 'lucide-react';
import { RPC_URL } from '../lib/config';
import { cn } from '../lib/cn';
import { formatMessage, getDict, resolveLang } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge } from './ui/Badge';

interface TamperProbeProps {
  rootDel: Delegation;
  governor: Address;
  proposalId: bigint;
  chainId: number;
}

type ProbeStatus = 'idle' | 'checking' | 'pass' | 'revert' | 'timeout';

class ProbeTimeoutError extends Error {
  constructor() {
    super('probe timed out');
    this.name = 'ProbeTimeoutError';
  }
}

function currentDict() {
  if (typeof document === 'undefined') return getDict('en');
  return getDict(resolveLang(document.documentElement.lang));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new ProbeTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timeout);
        reject(reason);
      },
    );
  });
}

const badgeTone = (s: ProbeStatus): 'ok' | 'bad' | 'warn' | 'neutral' =>
  s === 'pass' ? 'ok' : s === 'revert' ? 'bad' : s === 'timeout' ? 'warn' : 'neutral';

const rowBorder = (s: ProbeStatus): string =>
  s === 'pass' ? 'border-ok/35' : s === 'revert' ? 'border-bad/35' : s === 'timeout' ? 'border-warn/35' : 'border-hairline';

/**
 * Tamper Probe — fires two REAL eth_calls (canRedeem) against the live
 * DelegationManager: the honest proposalId passes, a tampered proposalId=999
 * reverts at AllowedCalldataEnforcer. Proves the scope is enforced on-chain.
 */
export function TamperProbe({ rootDel, governor, proposalId, chainId }: TamperProbeProps) {
  const t = currentDict();
  const [honest, setHonest] = useState<ProbeStatus>('idle');
  const [tampered, setTampered] = useState<ProbeStatus>('idle');
  const timedOut = honest === 'timeout' || tampered === 'timeout';
  const checking = honest === 'checking' || tampered === 'checking';

  const resultLabel = (status: ProbeStatus) => {
    if (status === 'checking') return t.tamperProbeChecking;
    if (status === 'pass') return t.tamperProbePass;
    if (status === 'revert') return formatMessage(t.tamperProbeRevert, { enforcer: 'AllowedCalldataEnforcer' });
    if (status === 'timeout') return t.tamperProbeFallback;
    return t.tamperProbeIdle;
  };

  async function runProbe() {
    setHonest('checking');
    setTampered('checking');
    try {
      const honestCalldata = redeemVoteCalldata({ chain: [rootDel], governor, proposalId, support: 1 });
      const tamperedCalldata = redeemVoteCalldata({ chain: [rootDel], governor, proposalId: 999n, support: 1 });
      const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
      const redeemClient = client as unknown as Parameters<typeof canRedeem>[0];
      const manager = delegationManagerAddress(chainId);
      // Redeem [rootDel] AS its delegate (the orchestrator) — the honest call only passes when
      // simulated from the authorized redeemer; the tampered proposalId then reverts at the caveat.
      const redeemer = rootDel.delegate;
      const [honestCanRedeem, tamperedCanRedeem] = await Promise.all([
        withTimeout(canRedeem(redeemClient, manager, honestCalldata, redeemer), 2500),
        withTimeout(canRedeem(redeemClient, manager, tamperedCalldata, redeemer), 2500),
      ]);
      setHonest(honestCanRedeem ? 'pass' : 'revert');
      setTampered(tamperedCanRedeem ? 'pass' : 'revert');
    } catch (error) {
      if (error instanceof ProbeTimeoutError) {
        setHonest('timeout');
        setTampered('timeout');
        return;
      }
      setHonest('revert');
      setTampered('revert');
    }
  }

  return (
    <Panel pad="lg" className="mb-3.5">
      <PanelHeader icon={Radar} title={t.tamperProbeTitle} right={<Badge tone="info">live eth_call</Badge>} />
      <div className="grid gap-2.5">
        <div className={cn('flex items-center justify-between gap-3 rounded-xl border bg-surface-2/60 px-3.5 py-3', rowBorder(honest))}>
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <CheckCircle2 className="size-4 text-ok" /> {t.tamperProbeHonest}
          </span>
          <Badge tone={badgeTone(honest)}>{resultLabel(honest)}</Badge>
        </div>
        <div className={cn('flex items-center justify-between gap-3 rounded-xl border bg-surface-2/60 px-3.5 py-3', rowBorder(tampered))}>
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Ban className="size-4 text-bad" /> {t.tamperProbeTampered}
          </span>
          <Badge tone={badgeTone(tampered)}>{resultLabel(tampered)}</Badge>
        </div>
      </div>
      {timedOut && <div className="mt-3 text-[12px] text-warn">{t.tamperProbeTimeout}</div>}
      <button className="mt-4" onClick={runProbe} disabled={checking}>
        {checking ? t.tamperProbeChecking : t.tamperProbeButton}
      </button>
    </Panel>
  );
}
