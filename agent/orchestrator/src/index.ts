/**
 * @mandate/orchestrator — holds the root delegation context, attenuated-redelegates to the
 * analyst, drives the run state machine, and serves the shared run-status contract over HTTP
 * (see server.ts). Public API below.
 */
import { GrantRequestSchema, RunStatusEnum, type GrantRequest, type RunState } from '@mandate/shared';

export { RunStore, type CreateRunInput, type RunPatch } from './runStore.js';
export { runVote, type OrchestratorConfig } from './runVote.js';

/** Parse + validate an incoming grant from the app. */
export function parseGrant(payload: unknown): GrantRequest {
  return GrantRequestSchema.parse(payload);
}

/** The ordered run lifecycle this service drives. */
export const RUN_STATES: readonly RunState[] = RunStatusEnum.options;
