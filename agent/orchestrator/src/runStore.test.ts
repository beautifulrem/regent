import { describe, expect, it } from 'vitest';
import { RunStore, type CreateRunInput } from './runStore.js';

const HASH = `0x${'ab'.repeat(32)}` as const;
const REDEL_HASH = `0x${'cd'.repeat(32)}` as const;
const input: CreateRunInput = {
  chainId: 84532,
  governor: '0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5',
  proposalId: '12345',
  delegations: {
    rootHash: HASH,
    participants: {
      user: '0x1111111111111111111111111111111111111111',
      orchestrator: '0x2222222222222222222222222222222222222222',
      analyst: '0x3333333333333333333333333333333333333333',
    },
  },
};

const veniceTrace = {
  model: 'e2ee-qwen3-5-122b-a10b',
  support: 1 as const,
  decision: 'For' as const,
  rationale: 'sound',
  attestation: { verified: true, nonce: 'n1' },
  signature: { recovered: true, signingAddress: '0x6525e128afcffebf7eed05d485d7be983cdae934' as const },
};

describe('RunStore', () => {
  it('creates a contract-valid granted run', () => {
    const store = new RunStore();
    const run = store.create(input, 'run_1', '2026-05-30T00:00:00.000Z');
    expect(run.runId).toBe('run_1');
    expect(run.status).toBe('granted');
    expect(run.delegations.rootHash).toBe(HASH);
    expect(store.get('run_1')).toEqual(run);
  });

  it('records the redelegation hash + advances the state', () => {
    const store = new RunStore();
    store.create(input, 'run_1');
    const run = store.patch('run_1', { status: 'redelegated', redelegationHash: REDEL_HASH });
    expect(run.status).toBe('redelegated');
    expect(run.delegations.redelegationHash).toBe(REDEL_HASH);
    expect(run.delegations.rootHash).toBe(HASH); // unchanged
  });

  it('attaches the Venice decision and the vote receipt', () => {
    const store = new RunStore();
    store.create(input, 'run_1');
    store.patch('run_1', { status: 'decided', venice: veniceTrace });
    const voted = store.patch('run_1', {
      status: 'voted',
      vote: { txHash: HASH, support: 1, relay: 'direct' },
    });
    expect(voted.venice?.decision).toBe('For');
    expect(voted.vote?.support).toBe(1);
    expect(voted.status).toBe('voted');
  });

  it('rejects a contract-invalid patch (venice decision/support mismatch)', () => {
    const store = new RunStore();
    store.create(input, 'run_1');
    expect(() =>
      store.patch('run_1', { status: 'decided', venice: { ...veniceTrace, support: 0 } }),
    ).toThrow();
  });

  it('records a typed failure', () => {
    const store = new RunStore();
    store.create(input, 'run_1');
    const failed = store.patch('run_1', {
      status: 'failed',
      error: { code: 'VENICE_FAILED', message: 'tee unreachable' },
    });
    expect(failed.status).toBe('failed');
    expect(failed.error?.code).toBe('VENICE_FAILED');
  });

  it('throws when patching an unknown run', () => {
    expect(() => new RunStore().patch('nope', { status: 'voted' })).toThrow(/unknown run/);
  });

  it('notifies subscribers on every patch (the SSE feed)', () => {
    const store = new RunStore();
    store.create(input, 'run_1');
    const seen: string[] = [];
    const unsubscribe = store.subscribe('run_1', (run) => seen.push(run.status));
    store.patch('run_1', { status: 'redelegated', redelegationHash: REDEL_HASH });
    store.patch('run_1', { status: 'analyzing' });
    expect(seen).toEqual(['redelegated', 'analyzing']);
    unsubscribe();
    store.patch('run_1', { status: 'decided', venice: veniceTrace });
    expect(seen).toEqual(['redelegated', 'analyzing']); // unsubscribed — no more pushes
  });

  it('scopes subscriptions to their run', () => {
    const store = new RunStore();
    store.create(input, 'run_1');
    store.create(input, 'run_2');
    const seen: string[] = [];
    store.subscribe('run_2', (run) => seen.push(run.runId));
    store.patch('run_1', { status: 'analyzing' });
    expect(seen).toEqual([]);
    store.patch('run_2', { status: 'analyzing' });
    expect(seen).toEqual(['run_2']);
  });
});
