/**
 * In-memory store of orchestration runs. Every stored value is validated against the shared
 * RunStatus contract, so the HTTP API can only ever serve well-formed, contract-valid status.
 */
import crypto from 'node:crypto';
import type { Address, Hex } from 'viem';
import {
  RunStatusSchema,
  type DelegationChain,
  type RunError,
  type RunState,
  type RunStatus,
  type VeniceTrace,
  type VoteReceipt,
} from '@mandate/shared';

export interface CreateRunInput {
  chainId: number;
  governor: Address;
  proposalId: string;
  delegations: DelegationChain;
}

export interface RunPatch {
  status?: RunState;
  redelegationHash?: Hex;
  venice?: VeniceTrace;
  vote?: VoteReceipt;
  revokeTxHash?: Hex;
  error?: RunError;
}

const nowIso = (): string => new Date().toISOString();

export class RunStore {
  private readonly runs = new Map<string, RunStatus>();

  create(input: CreateRunInput, runId = `run_${crypto.randomUUID()}`, updatedAt = nowIso()): RunStatus {
    const status: RunStatus = {
      runId,
      chainId: input.chainId,
      governor: input.governor,
      proposalId: input.proposalId,
      status: 'granted',
      delegations: input.delegations,
      updatedAt,
    };
    const validated = RunStatusSchema.parse(status);
    this.runs.set(runId, validated);
    return validated;
  }

  get(runId: string): RunStatus | undefined {
    return this.runs.get(runId);
  }

  list(): RunStatus[] {
    return [...this.runs.values()];
  }

  patch(runId: string, patch: RunPatch, updatedAt = nowIso()): RunStatus {
    const current = this.runs.get(runId);
    if (!current) throw new Error(`unknown run: ${runId}`);
    const next: RunStatus = {
      ...current,
      ...(patch.status ? { status: patch.status } : {}),
      delegations: patch.redelegationHash
        ? { ...current.delegations, redelegationHash: patch.redelegationHash }
        : current.delegations,
      ...(patch.venice ? { venice: patch.venice } : {}),
      ...(patch.vote ? { vote: patch.vote } : {}),
      ...(patch.revokeTxHash ? { revokeTxHash: patch.revokeTxHash } : {}),
      ...(patch.error ? { error: patch.error } : {}),
      updatedAt,
    };
    const validated = RunStatusSchema.parse(next);
    this.runs.set(runId, validated);
    return validated;
  }
}
