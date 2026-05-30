import { describe, expect, it } from 'vitest';
import {
  GrantRequestSchema,
  RunStatusSchema,
  SUPPORT,
  supportToDecision,
  type GrantRequest,
  type RunStatus,
} from './api.js';

const USER = '0x1111111111111111111111111111111111111111';
const ORCH = '0x2222222222222222222222222222222222222222';
const ANALYST = '0x3333333333333333333333333333333333333333';
const GOVERNOR = '0x4444444444444444444444444444444444444444';
const HASH = '0x' + 'ab'.repeat(32);
const ROOT_AUTHORITY = '0x' + '00'.repeat(32);

const grantFixture: GrantRequest = {
  chainId: 84532,
  governor: GOVERNOR,
  proposalId: '12345678901234567890',
  proposalText: 'Fund an audited public-goods grant with milestones and clawback.',
  rootDelegation: {
    delegate: ORCH,
    delegator: USER,
    authority: ROOT_AUTHORITY,
    caveats: [{ enforcer: '0x5555555555555555555555555555555555555555', terms: '0xdeadbeef', args: '0x' }],
    salt: '0x3ade68b1',
    signature: '0x' + 'cd'.repeat(65),
  },
};

const statusFixture: RunStatus = {
  runId: 'run_abc123',
  chainId: 84532,
  governor: GOVERNOR,
  proposalId: '12345678901234567890',
  status: 'voted',
  delegations: {
    rootHash: HASH,
    redelegationHash: '0x' + 'cd'.repeat(32),
    participants: { user: USER, orchestrator: ORCH, analyst: ANALYST },
  },
  venice: {
    model: 'tee-qwen3-5-122b-a10b',
    support: 1,
    decision: 'For',
    rationale: 'Proposal funds an audited public good with bounded spend.',
    attestation: { verified: true, nonce: 'n-1' },
    signature: { recovered: true, signingAddress: '0x6666666666666666666666666666666666666666' },
  },
  vote: { txHash: HASH, support: 1, blockNumber: '1024', relay: 'direct' },
  updatedAt: '2026-05-30T00:00:00.000Z',
};

describe('GrantRequestSchema', () => {
  it('parses a valid grant', () => {
    expect(GrantRequestSchema.parse(grantFixture)).toEqual(grantFixture);
  });

  it('rejects a malformed governor address', () => {
    expect(GrantRequestSchema.safeParse({ ...grantFixture, governor: '0xnotanaddress' }).success).toBe(false);
  });

  it('rejects a non-numeric proposalId (must be a decimal bigint string)', () => {
    expect(GrantRequestSchema.safeParse({ ...grantFixture, proposalId: '0xff' }).success).toBe(false);
  });

  it('rejects a root delegation missing its signature', () => {
    const { signature: _omit, ...unsigned } = grantFixture.rootDelegation;
    expect(GrantRequestSchema.safeParse({ ...grantFixture, rootDelegation: unsigned }).success).toBe(false);
  });
});

describe('RunStatusSchema', () => {
  it('parses a fully-populated voted run (2 delegation hashes, 3 participants)', () => {
    const parsed = RunStatusSchema.parse(statusFixture);
    expect(parsed.delegations.rootHash).toBe(HASH);
    expect(parsed.delegations.redelegationHash).toBeDefined();
    expect(Object.keys(parsed.delegations.participants)).toEqual(['user', 'orchestrator', 'analyst']);
  });

  it('parses an early run before redelegation/venice/vote exist', () => {
    const early: RunStatus = {
      ...statusFixture,
      status: 'granted',
      delegations: { rootHash: HASH, participants: statusFixture.delegations.participants },
      venice: undefined,
      vote: undefined,
    };
    expect(RunStatusSchema.safeParse(early).success).toBe(true);
  });

  it('rejects a Venice trace whose decision contradicts its support code', () => {
    const bad: RunStatus = {
      ...statusFixture,
      venice: { ...statusFixture.venice!, support: 0, decision: 'For' }, // 0 is Against
    };
    expect(RunStatusSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an out-of-range support value', () => {
    const bad = { ...statusFixture, vote: { ...statusFixture.vote!, support: 3 } };
    expect(RunStatusSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(RunStatusSchema.safeParse({ ...statusFixture, status: 'teleported' }).success).toBe(false);
  });

  it('carries a typed error in the failed state', () => {
    const failed: RunStatus = {
      ...statusFixture,
      status: 'failed',
      vote: undefined,
      error: { code: 'VOTE_REVERTED', message: 'redeem reverted: root delegation disabled' },
    };
    const parsed = RunStatusSchema.parse(failed);
    expect(parsed.error?.code).toBe('VOTE_REVERTED');
  });
});

describe('support/decision mapping', () => {
  it('maps OZ GovernorCountingSimple codes (0=Against,1=For,2=Abstain)', () => {
    expect(SUPPORT).toEqual({ Against: 0, For: 1, Abstain: 2 });
    expect(supportToDecision(0)).toBe('Against');
    expect(supportToDecision(1)).toBe('For');
    expect(supportToDecision(2)).toBe('Abstain');
  });
});
