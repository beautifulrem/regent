/**
 * ERC-7710 governance delegation helpers: the heart of Mandate.
 *
 * A root FunctionCall delegation grants the right to call `Governor.castVote(proposalId, support)`
 * with proposalId LOCKED (via allowedCalldata) and `support` LEFT FREE (so Venice decides
 * For/Against at redeem time). The orchestrator attenuates and redelegates to the analyst; the
 * analyst (leaf) redeems the chain LEAF→ROOT to cast the vote. Disabling the root cascade-revokes
 * the whole chain.
 *
 * Every SDK call below is verified against @metamask/smart-accounts-kit@1.6.0.
 */
import {
  contracts,
  createDelegation,
  createExecution,
  ExecutionMode,
  getSmartAccountsEnvironment,
  ScopeType,
} from '@metamask/smart-accounts-kit';
import { createCaveatBuilder } from '@metamask/smart-accounts-kit/utils';
import {
  encodeAbiParameters,
  encodeFunctionData,
  hashTypedData,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';

export type SmartAccountsEnvironment = ReturnType<typeof getSmartAccountsEnvironment>;

export interface Caveat {
  enforcer: Address;
  terms: Hex;
  args: Hex;
}

/** On-chain delegation shape (matches createDelegation's output; salt/signature are hex). */
export interface Delegation {
  delegate: Address;
  delegator: Address;
  authority: Hex;
  caveats: Caveat[];
  salt: Hex;
  signature: Hex;
}

export const CASTVOTE_SIGNATURE = 'castVote(uint256,uint8)' as const;
const CASTVOTE_ABI = parseAbi([`function ${CASTVOTE_SIGNATURE}`]);

/** A random 32-byte salt so re-runs produce fresh, non-colliding delegation hashes. */
export function freshSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = '0x';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex as Hex;
}

type CreateDelegationParams = Parameters<typeof createDelegation>[0];

/** FunctionCall scope: lock `proposalId` (bytes 4..35), leave `support` (byte 36) free. */
function castVoteScope(governor: Address, proposalId: bigint) {
  return {
    type: ScopeType.FunctionCall,
    targets: [governor],
    selectors: [CASTVOTE_SIGNATURE],
    allowedCalldata: [
      {
        value: encodeAbiParameters([{ name: 'proposalId', type: 'uint256' }], [proposalId]),
        startIndex: 4,
      },
    ],
  };
}

/** ROOT: the user smart account grants `delegate` the scoped right to cast this proposal's vote. */
export function buildVoteDelegation(args: {
  governor: Address;
  proposalId: bigint;
  delegate: Address;
  delegator: Address;
  environment: SmartAccountsEnvironment;
  salt?: Hex;
}): Delegation {
  return createDelegation({
    scope: castVoteScope(args.governor, args.proposalId),
    to: args.delegate,
    from: args.delegator,
    environment: args.environment,
    salt: args.salt ?? freshSalt(),
  } as CreateDelegationParams) as Delegation;
}

/** REDELEGATION (attenuated): same/narrower scope, linked to its parent (narrow-only is enforced). */
export function redelegateVote(args: {
  governor: Address;
  proposalId: bigint;
  delegate: Address;
  delegator: Address;
  environment: SmartAccountsEnvironment;
  parentDelegation: Delegation;
  salt?: Hex;
}): Delegation {
  return createDelegation({
    scope: castVoteScope(args.governor, args.proposalId),
    to: args.delegate,
    from: args.delegator,
    environment: args.environment,
    parentDelegation: args.parentDelegation,
    salt: args.salt ?? freshSalt(),
  } as CreateDelegationParams) as Delegation;
}

// ---------------------------------------------------------------------------
// STANDING delegation: any proposal on `governor`, vote-only, bounded by votes + expiry.
// Used by the VoteBoard judge flow (the single-proposal builders above stay for the CLI
// scripts that vote on the real Governor). proposalId is NO LONGER locked (the agent may
// vote on any current/future proposal), so revoking the grant has real teeth, while the
// scope is still "castVote only, this board only, ≤maxVotes, until expiry, revocable".
// ---------------------------------------------------------------------------

/** FunctionCall scope: `castVote` on `governor`, ANY proposalId (no calldata lock), vote-only,
 *  this board only. AllowedTargets + AllowedMethods caveats, but NOT AllowedCalldata. */
function voteOnlyScope(governor: Address) {
  return { type: ScopeType.FunctionCall, targets: [governor], selectors: [CASTVOTE_SIGNATURE] };
}

/** Optional standing-authority guardrails: timestamp (valid until `expiry`) and/or limitedCalls
 *  (≤ `maxVotes`). Each is added only when provided, so the caller can bound by votes, by time,
 *  or both. (Scope still restricts to castVote-on-this-board with value 0, regardless.) */
function standingBounds(
  environment: SmartAccountsEnvironment,
  opts: { maxVotes?: number; expiry?: number },
) {
  let b = createCaveatBuilder(environment);
  if (opts.expiry != null) b = b.addCaveat('timestamp', { afterThreshold: 0, beforeThreshold: opts.expiry });
  if (opts.maxVotes != null) b = b.addCaveat('limitedCalls', { limit: opts.maxVotes });
  return b;
}

/** ROOT (standing): grant `delegate` the right to cast ANY proposal's vote on `governor`, vote-only,
 *  revocable anytime. Optionally cap by `maxVotes` redemptions and/or expire at `expiry` (unix secs);
 *  omit one to bound only by the other. */
export function buildStandingVoteDelegation(args: {
  governor: Address;
  delegate: Address;
  delegator: Address;
  environment: SmartAccountsEnvironment;
  maxVotes?: number;
  expiry?: number;
  salt?: Hex;
}): Delegation {
  return createDelegation({
    scope: voteOnlyScope(args.governor),
    caveats: standingBounds(args.environment, { maxVotes: args.maxVotes, expiry: args.expiry }),
    to: args.delegate,
    from: args.delegator,
    environment: args.environment,
    salt: args.salt ?? freshSalt(),
  } as CreateDelegationParams) as Delegation;
}

/** Encode the redemption of a delegation chain (LEAF→ROOT) that casts `support`. */
export function redeemVoteCalldata(args: {
  chain: Delegation[]; // leaf-first, root-last
  governor: Address;
  proposalId: bigint;
  support: number; // 0=Against 1=For 2=Abstain
}): Hex {
  const execution = createExecution({
    target: args.governor,
    callData: encodeFunctionData({
      abi: CASTVOTE_ABI,
      functionName: 'castVote',
      args: [args.proposalId, args.support],
    }),
  });
  return contracts.DelegationManager.encode.redeemDelegations({
    delegations: [args.chain],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  }) as Hex;
}

/** Encode a redemption attempting an ARBITRARY (tampered) execution, used by the Tamper Probe to
 *  prove the standing scope rejects anything but castVote on the board (e.g. moving funds). */
export function redeemTamperCalldata(args: { chain: Delegation[]; target: Address; callData: Hex }): Hex {
  const execution = createExecution({ target: args.target, callData: args.callData });
  return contracts.DelegationManager.encode.redeemDelegations({
    delegations: [args.chain],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  }) as Hex;
}

/** Encode disabling the root delegation: cascade-revokes the whole chain. */
export function revokeRootCalldata(rootDelegation: Delegation): Hex {
  return contracts.DelegationManager.encode.disableDelegation({
    delegation: rootDelegation,
  }) as Hex;
}

/** The DelegationManager address for a chain. */
export function delegationManagerAddress(chainId: number): Address {
  return getSmartAccountsEnvironment(chainId).DelegationManager;
}

const DELEGATION_EIP712_TYPES = {
  Caveat: [
    { name: 'enforcer', type: 'address' },
    { name: 'terms', type: 'bytes' },
  ],
  Delegation: [
    { name: 'delegate', type: 'address' },
    { name: 'delegator', type: 'address' },
    { name: 'authority', type: 'bytes32' },
    { name: 'caveats', type: 'Caveat[]' },
    { name: 'salt', type: 'uint256' },
  ],
} as const;

/** The EIP-712 hash that identifies a delegation on the DelegationManager (for display/tracking). */
export function delegationHash(delegation: Delegation, chainId: number, delegationManager: Address): Hex {
  return hashTypedData({
    domain: { name: 'DelegationManager', version: '1', chainId, verifyingContract: delegationManager },
    types: DELEGATION_EIP712_TYPES,
    primaryType: 'Delegation',
    message: {
      delegate: delegation.delegate,
      delegator: delegation.delegator,
      authority: delegation.authority,
      caveats: delegation.caveats.map((c) => ({ enforcer: c.enforcer, terms: c.terms })),
      salt: BigInt(delegation.salt),
    },
  });
}

/**
 * The "kill the chain" check: simulate a redemption. Returns true if it would succeed,
 * false if it reverts (e.g. because the root was disabled). No state change.
 */
export async function canRedeem(
  client: PublicClient,
  delegationManager: Address,
  redeemCalldata: Hex,
  from: Address,
): Promise<boolean> {
  try {
    await client.call({ to: delegationManager, data: redeemCalldata, account: from });
    return true;
  } catch {
    return false;
  }
}
