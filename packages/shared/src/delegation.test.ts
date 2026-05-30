import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import { describe, expect, it } from 'vitest';
import {
  buildVoteDelegation,
  delegationHash,
  delegationManagerAddress,
  freshSalt,
  redeemVoteCalldata,
  redelegateVote,
  revokeRootCalldata,
} from './delegation.js';

const ENV = getSmartAccountsEnvironment(84532);
const ROOT_AUTHORITY = `0x${'ff'.repeat(32)}`;
const GOVERNOR = '0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5';
const USER = '0x1111111111111111111111111111111111111111';
const ORCH = '0x2222222222222222222222222222222222222222';
const ANALYST = '0x3333333333333333333333333333333333333333';
const PROPOSAL = 12345n;

describe('freshSalt', () => {
  it('returns a 32-byte hex salt', () => {
    expect(freshSalt()).toMatch(/^0x[0-9a-f]{64}$/);
  });
  it('is different each call', () => {
    expect(freshSalt()).not.toBe(freshSalt());
  });
});

describe('buildVoteDelegation (root)', () => {
  const d = buildVoteDelegation({
    governor: GOVERNOR,
    proposalId: PROPOSAL,
    delegate: ORCH,
    delegator: USER,
    environment: ENV,
    salt: '0x01',
  });

  it('delegates from the user to the orchestrator, unsigned, as a root authority', () => {
    expect(d.delegator).toBe(USER);
    expect(d.delegate).toBe(ORCH);
    expect(d.authority.toLowerCase()).toBe(ROOT_AUTHORITY);
    expect(d.signature).toBe('0x');
    expect(d.salt).toBe('0x01');
  });

  it('carries the FunctionCall scope as caveats (targets + selector + locked proposalId)', () => {
    expect(d.caveats.length).toBe(4);
    // the locked proposalId is encoded into a caveat's terms, so a different proposal
    // produces different caveat terms
    const other = buildVoteDelegation({
      governor: GOVERNOR,
      proposalId: PROPOSAL + 1n,
      delegate: ORCH,
      delegator: USER,
      environment: ENV,
      salt: '0x01',
    });
    expect(d.caveats.map((c) => c.terms)).not.toEqual(other.caveats.map((c) => c.terms));
  });
});

describe('redelegateVote (attenuated 2nd hop)', () => {
  it('links to its parent (authority is not ROOT) and delegates orch→analyst', () => {
    const root = buildVoteDelegation({
      governor: GOVERNOR,
      proposalId: PROPOSAL,
      delegate: ORCH,
      delegator: USER,
      environment: ENV,
      salt: '0x01',
    });
    const re = redelegateVote({
      governor: GOVERNOR,
      proposalId: PROPOSAL,
      delegate: ANALYST,
      delegator: ORCH,
      environment: ENV,
      parentDelegation: root,
      salt: '0x02',
    });
    expect(re.delegator).toBe(ORCH);
    expect(re.delegate).toBe(ANALYST);
    expect(re.authority.toLowerCase()).not.toBe(ROOT_AUTHORITY); // points at the parent's hash
  });
});

describe('redeem / revoke encodings', () => {
  const root = buildVoteDelegation({
    governor: GOVERNOR, proposalId: PROPOSAL, delegate: ORCH, delegator: USER, environment: ENV, salt: '0x01',
  });
  const re = redelegateVote({
    governor: GOVERNOR, proposalId: PROPOSAL, delegate: ANALYST, delegator: ORCH, environment: ENV, parentDelegation: root, salt: '0x02',
  });

  it('encodes a redeemDelegations calldata for the leaf→root chain', () => {
    const data = redeemVoteCalldata({ chain: [re, root], governor: GOVERNOR, proposalId: PROPOSAL, support: 1 });
    expect(data).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(data.length).toBeGreaterThan(200);
  });

  it('encodes disableDelegation with the expected selector', () => {
    // disableDelegation selector verified against the SDK: 0x49934047
    expect(revokeRootCalldata(root).startsWith('0x49934047')).toBe(true);
  });
});

describe('delegationManagerAddress', () => {
  it('resolves the Base Sepolia DelegationManager', () => {
    expect(delegationManagerAddress(84532)).toBe('0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3');
  });
});

describe('delegationHash', () => {
  const dm = delegationManagerAddress(84532);
  const root = buildVoteDelegation({
    governor: GOVERNOR, proposalId: PROPOSAL, delegate: ORCH, delegator: USER, environment: ENV, salt: '0x01',
  });

  it('is a deterministic 32-byte EIP-712 hash', () => {
    const h = delegationHash(root, 84532, dm);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    expect(delegationHash(root, 84532, dm)).toBe(h); // deterministic
  });

  it('differs when the delegation differs', () => {
    const other = buildVoteDelegation({
      governor: GOVERNOR, proposalId: PROPOSAL, delegate: ANALYST, delegator: USER, environment: ENV, salt: '0x01',
    });
    expect(delegationHash(other, 84532, dm)).not.toBe(delegationHash(root, 84532, dm));
  });
});
