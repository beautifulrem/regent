'use client';

import { useState } from 'react';
import {
  canRedeem,
  delegationManagerAddress,
  redeemTamperCalldata,
  redeemVoteCalldata,
  type Delegation,
} from '@mandate/shared';
import { createPublicClient, encodeFunctionData, http, parseAbi, type Address } from 'viem';

const TRANSFER_ABI = parseAbi(['function transfer(address to, uint256 amount)']);
import { baseSepolia } from 'viem/chains';
import { Ban, CheckCircle2, Radar } from 'lucide-react';
import { RPC_URL } from '../lib/config';
import { cn } from '../lib/cn';
import { getDict, resolveLang } from '../lib/i18n';
import { Panel, PanelHeader } from './ui/Panel';
import { Badge } from './ui/Badge';

interface TamperProbeProps {
  rootDel: Delegation;
  governor: Address;
  proposalId: bigint;
  chainId: number;
  /** Render frameless (no card chrome) for the Mission-Control HUD. */
  bare?: boolean;
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
 * DelegationManager: the honest castVote passes, a tampered execution that
 * tries to MOVE FUNDS (an ERC-20 transfer) reverts at AllowedMethodsEnforcer
 * (the scope allows castVote only). Proves the scope is enforced on-chain.
 */
export function TamperProbe({ rootDel, governor, proposalId, chainId, bare = false }: TamperProbeProps) {
  const t = currentDict();
  const [honest, setHonest] = useState<ProbeStatus>('idle');
  const [tampered, setTampered] = useState<ProbeStatus>('idle');
  const timedOut = honest === 'timeout' || tampered === 'timeout';
  const checking = honest === 'checking' || tampered === 'checking';

  const resultLabel = (status: ProbeStatus, kind: 'honest' | 'tampered') => {
    if (status === 'checking') return t.tamperProbeChecking;
    if (status === 'pass') return t.tamperProbePass;
    // plain-language reason instead of the raw enforcer name: the tampered call is blocked because the
    // scope only allows castVote (it can never move funds); the honest call only reverts when the mandate
    // itself is no longer redeemable (revoked / expired / exhausted).
    if (status === 'revert') return kind === 'tampered' ? t.tamperProbeRevertFunds : t.tamperProbeRevertDead;
    if (status === 'timeout') return t.tamperProbeFallback;
    return t.tamperProbeIdle;
  };

  async function runProbe() {
    setHonest('checking');
    setTampered('checking');
    try {
      const honestCalldata = redeemVoteCalldata({ chain: [rootDel], governor, proposalId, support: 1 });
      // tamper: try to MOVE FUNDS (a transfer) instead of voting — blocked by AllowedMethods (castVote only)
      const tamperedCalldata = redeemTamperCalldata({
        chain: [rootDel],
        target: governor,
        callData: encodeFunctionData({
          abi: TRANSFER_ABI,
          functionName: 'transfer',
          args: ['0x000000000000000000000000000000000000dEaD', 1n],
        }),
      });
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
    <Panel pad="lg" bare={bare} className={bare ? '' : 'mb-3.5'}>
      <PanelHeader icon={Radar} title={t.tamperProbeTitle} right={<Badge tone="info">live eth_call</Badge>} />
      <div className="grid gap-2.5">
        <div className={cn('flex items-center justify-between gap-3 rounded-xl border bg-surface-2/60 px-3.5 py-3', rowBorder(honest))}>
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <CheckCircle2 className={cn('size-4', honest === 'idle' ? 'text-ink-mute' : 'text-ok')} /> {t.tamperProbeHonest}
          </span>
          <Badge tone={badgeTone(honest)}>{resultLabel(honest, 'honest')}</Badge>
        </div>
        <div className={cn('flex items-center justify-between gap-3 rounded-xl border bg-surface-2/60 px-3.5 py-3', rowBorder(tampered))}>
          <span className="flex items-center gap-2 text-[13px] text-ink-soft">
            <Ban className={cn('size-4', tampered === 'idle' ? 'text-ink-mute' : 'text-bad')} /> {t.tamperProbeTampered}
          </span>
          <span className="flex flex-col items-end gap-1">
            <Badge tone={badgeTone(tampered)}>{resultLabel(tampered, 'tampered')}</Badge>
            {tampered === 'revert' && (
              <code className="font-mono text-[10px] text-ink-mute">↳ AllowedMethodsEnforcer</code>
            )}
          </span>
        </div>
      </div>
      {timedOut && <div className="mt-3 text-[12px] text-warn">{t.tamperProbeTimeout}</div>}
      <div className="mt-4 flex justify-center">
        <button type="button" onClick={runProbe} disabled={checking}>
          {checking ? t.tamperProbeChecking : t.tamperProbeButton}
        </button>
      </div>
    </Panel>
  );
}
