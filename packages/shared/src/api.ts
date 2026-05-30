/**
 * The integration contract between the app (frontend) and the orchestrator/analyst
 * services. Wire format is JSON-serializable (hex/bigint as strings) and validated
 * at the boundary with zod, so both sides fail loudly on a shape mismatch.
 */
import { z } from 'zod';

// --- primitives -------------------------------------------------------------

/** 20-byte address. */
export const AddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'expected a 20-byte hex address');
/** 32-byte hash (delegation hash, tx hash, root authority). */
export const Bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'expected a 32-byte hex value');
/** Arbitrary-length hex (calldata, terms, signature). */
export const HexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, 'expected a 0x-hex string');
/** A non-negative integer encoded as a decimal string (bigint over JSON), e.g. proposalId. */
export const UintStringSchema = z.string().regex(/^\d+$/, 'expected a decimal uint string');

/** OZ GovernorCountingSimple vote codes. */
export const SUPPORT = { Against: 0, For: 1, Abstain: 2 } as const;
export type Decision = keyof typeof SUPPORT;
export type Support = (typeof SUPPORT)[Decision];

const DECISION_BY_SUPPORT: Record<Support, Decision> = { 0: 'Against', 1: 'For', 2: 'Abstain' };

/** Map a support code to its decision label. */
export function supportToDecision(support: Support): Decision {
  return DECISION_BY_SUPPORT[support];
}

export const SupportSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export const DecisionSchema = z.enum(['Against', 'For', 'Abstain']);

// --- delegations (wire format mirrors the on-chain SAK Delegation) -----------

export const CaveatSchema = z.object({
  enforcer: AddressSchema,
  terms: HexSchema,
  args: HexSchema,
});

export const DelegationSchema = z.object({
  delegate: AddressSchema,
  delegator: AddressSchema,
  /** root authority is bytes32(0); a redelegation's authority is its parent's hash. */
  authority: Bytes32Schema,
  caveats: z.array(CaveatSchema),
  /** 32-byte salt as a hex string (matches the on-chain Delegation). */
  salt: HexSchema,
  signature: HexSchema,
});

// --- grant: app -> orchestrator ---------------------------------------------

/**
 * The signed ROOT delegation (user SA -> orchestrator SA, FunctionCall castVote scope:
 * proposalId locked, support free) plus the proposal it authorizes. The orchestrator
 * creates and signs the attenuated redelegation to the analyst itself.
 */
export const GrantRequestSchema = z.object({
  chainId: z.number().int().positive(),
  governor: AddressSchema,
  proposalId: UintStringSchema,
  /** the proposal text the analyst should privately evaluate. */
  proposalText: z.string().min(1),
  rootDelegation: DelegationSchema,
});
export type GrantRequest = z.infer<typeof GrantRequestSchema>;

export const GrantResponseSchema = z.object({ runId: z.string().min(1) });
export type GrantResponse = z.infer<typeof GrantResponseSchema>;

// --- run status: orchestrator -> app ----------------------------------------

/** Lifecycle: one grant drives the run through these states. */
export const RunStatusEnum = z.enum([
  'granted', // root received, validated
  'redelegated', // orchestrator -> analyst redelegation signed (2 hashes now known)
  'analyzing', // Venice TEE running
  'decided', // Venice returned support + rationale
  'voting', // redeemDelegations submitted
  'voted', // castVote confirmed on-chain
  'revoked', // user disabled the root; further redeems revert
  'failed',
]);
export type RunState = z.infer<typeof RunStatusEnum>;

export const DelegationChainSchema = z.object({
  rootHash: Bytes32Schema,
  /** present once the orchestrator has signed the redelegation. */
  redelegationHash: Bytes32Schema.optional(),
  participants: z.object({
    user: AddressSchema,
    orchestrator: AddressSchema,
    analyst: AddressSchema,
  }),
});

export const VeniceTraceSchema = z
  .object({
    model: z.string().min(1),
    support: SupportSchema,
    decision: DecisionSchema,
    rationale: z.string(),
    attestation: z.object({ verified: z.boolean(), nonce: z.string().optional() }),
    signature: z.object({ recovered: z.boolean(), signingAddress: AddressSchema.optional() }),
  })
  // the decision label must agree with the numeric support the model emitted
  .refine((v) => supportToDecision(v.support) === v.decision, {
    message: 'venice.decision does not match venice.support',
    path: ['decision'],
  });
export type VeniceTrace = z.infer<typeof VeniceTraceSchema>;

export const VoteReceiptSchema = z.object({
  txHash: Bytes32Schema,
  support: SupportSchema,
  blockNumber: UintStringSchema.optional(),
  /** how the vote reached the chain: a direct UserOp, or relayed via 1Shot (mainnet leg). */
  relay: z.enum(['direct', '1shot']).optional(),
});
export type VoteReceipt = z.infer<typeof VoteReceiptSchema>;

export const RunErrorSchema = z.object({
  code: z.enum(['INVALID_GRANT', 'SIMULATION_FAILED', 'VENICE_FAILED', 'VOTE_REVERTED', 'INTERNAL']),
  message: z.string(),
});
export type RunError = z.infer<typeof RunErrorSchema>;

export const RunStatusSchema = z.object({
  runId: z.string().min(1),
  chainId: z.number().int().positive(),
  governor: AddressSchema,
  proposalId: UintStringSchema,
  status: RunStatusEnum,
  delegations: DelegationChainSchema,
  /** present from 'decided' onward. */
  venice: VeniceTraceSchema.optional(),
  /** present from 'voted'. */
  vote: VoteReceiptSchema.optional(),
  /** present when 'revoked'. */
  revokeTxHash: Bytes32Schema.optional(),
  /** present when 'failed'. */
  error: RunErrorSchema.optional(),
  /** ISO-8601 timestamp set by the server on each transition. */
  updatedAt: z.string(),
});
export type RunStatus = z.infer<typeof RunStatusSchema>;

/** The JSON wire shape of a delegation (hex fields); the on-chain `Delegation` lives in delegation.ts. */
export type WireDelegation = z.infer<typeof DelegationSchema>;
export type DelegationChain = z.infer<typeof DelegationChainSchema>;
