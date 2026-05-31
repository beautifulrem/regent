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
import { RPC_URL } from '../lib/config';
import { formatMessage, getDict, resolveLang } from '../lib/i18n';
import type { SmartAccount } from '../lib/wallet';

interface TamperProbeProps {
  rootDel: Delegation;
  userSA: SmartAccount;
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

function pillClass(status: ProbeStatus): string {
  if (status === 'pass') return 'green';
  if (status === 'revert') return 'red';
  return 'amber';
}

function rowClass(status: ProbeStatus): string {
  if (status === 'pass') return 'pass';
  if (status === 'revert') return 'revert';
  return status;
}

export function TamperProbe({ rootDel, userSA, governor, proposalId, chainId }: TamperProbeProps) {
  const t = currentDict();
  const [honest, setHonest] = useState<ProbeStatus>('idle');
  const [tampered, setTampered] = useState<ProbeStatus>('idle');
  const timedOut = honest === 'timeout' || tampered === 'timeout';
  const checking = honest === 'checking' || tampered === 'checking';

  const resultLabel = (status: ProbeStatus) => {
    if (status === 'checking') return t.tamperProbeChecking;
    if (status === 'pass') return t.tamperProbePass;
    if (status === 'revert') {
      return formatMessage(t.tamperProbeRevert, { enforcer: 'AllowedCalldataEnforcer' });
    }
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
      const [honestCanRedeem, tamperedCanRedeem] = await Promise.all([
        withTimeout(canRedeem(redeemClient, manager, honestCalldata, userSA.address), 2500),
        withTimeout(canRedeem(redeemClient, manager, tamperedCalldata, userSA.address), 2500),
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
    <div className="card tamper-probe">
      <div className="tamper-results">
        <div className={`tamper-row ${rowClass(honest)}`}>
          <span className="label">{t.tamperProbeHonest}</span>
          <span className={`pill tamper-result ${pillClass(honest)}`}>{resultLabel(honest)}</span>
        </div>
        <div className={`tamper-row ${rowClass(tampered)}`}>
          <span className="label">{t.tamperProbeTampered}</span>
          <span className={`pill tamper-result ${pillClass(tampered)}`}>{resultLabel(tampered)}</span>
        </div>
      </div>
      {timedOut && <div className="label tamper-timeout mt-sm">{t.tamperProbeTimeout}</div>}
      <button className="mt-md" onClick={runProbe} disabled={checking}>
        {checking ? t.tamperProbeChecking : t.tamperProbeButton}
      </button>
    </div>
  );
}
