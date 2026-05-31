import type { RunStatus } from '@mandate/shared';
import { ORCHESTRATOR_URL } from './config';

export interface DemoConfig {
  chainId: number;
  governor: `0x${string}`;
  token: `0x${string}`;
  proposalId: string;
  orchestratorSA: `0x${string}`;
  analyst: `0x${string}`;
}

export async function getConfig(): Promise<DemoConfig> {
  const res = await fetch(`${ORCHESTRATOR_URL}/config`);
  if (!res.ok) throw new Error('orchestrator /config unavailable — is the service running?');
  return res.json();
}

export async function postGrant(grant: unknown): Promise<{ runId: string }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/grant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(grant),
  });
  if (!res.ok) throw new Error(`grant rejected: ${await res.text()}`);
  return res.json();
}

/** Cast on another proposal reusing an existing run's STANDING grant — no new user signature. */
export async function voteAgain(
  runId: string,
  proposalId: string,
  proposalText: string,
): Promise<{ runId: string }> {
  const res = await fetch(`${ORCHESTRATOR_URL}/vote-again`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId, proposalId, proposalText }),
  });
  if (!res.ok) throw new Error(`vote-again rejected: ${await res.text()}`);
  return res.json();
}

export async function getRun(runId: string): Promise<RunStatus> {
  const res = await fetch(`${ORCHESTRATOR_URL}/run/${runId}`);
  if (!res.ok) throw new Error('run not found');
  return res.json();
}

export interface ProvisionResult {
  sa: `0x${string}`;
  deployed: boolean;
  alreadyDeployed: boolean;
  txHash?: `0x${string}`;
}

/** Deploy the connecting wallet's smart account so the agent can vote AS it on the VoteBoard. */
export async function provision(eoa: string): Promise<ProvisionResult> {
  const res = await fetch(`${ORCHESTRATOR_URL}/provision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eoa }),
  });
  if (!res.ok) throw new Error(`provision failed: ${await res.text()}`);
  return res.json();
}
