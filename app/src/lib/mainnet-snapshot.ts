import type { Address, Hex } from 'viem';
import type { LensVerdict } from '@mandate/shared';

/**
 * A recorded UNIFIED 1Shot run, produced by `packages/shared/scripts/1shot-record.ts`:
 * the Venice TEE committee decides the support, then that decided castVote is relayed through the
 * 1Shot permissionless relayer (EIP-7702 burner upgrade + ERC-7710 bundle). Every field is a REAL
 * on-chain / TEE artifact. The OneShotFinale replays it.
 */
export interface MainnetSnapshot {
  recordedAt: string;

  chain: { id: number; name: string; rpc: string; basescan: string };
  /** which 1Shot relayer leg this run was relayed through. */
  relayer: 'mainnet' | 'testnet';

  proposal: {
    id: string;
    title: { en: string; zh: string };
    body: { en: string; zh: string };
  };

  /** The mainnet VoteBoard the personas + the AI's 1Shot vote landed on (live tally source). */
  voteBoard?: Address;

  /** Venice TEE final decision (the synthesis of the 4 lenses) — drives the relayed castVote's support. */
  venice: {
    model: string;
    decision: 'For' | 'Against' | 'Abstain';
    support: 0 | 1 | 2;
    rationale: string;
    reasoning?: string;
    attestation: { verified: boolean; nonce?: string };
    signature: { recovered: boolean; signingAddress?: Address };
  };

  /** The four lens verdicts the committee reported. */
  lenses: LensVerdict[];

  /** The 1Shot-relayed castVote (the support == venice.support). */
  vote: { txHash: Hex; support: 0 | 1 | 2; blockNumber: string; relay: '1shot' };

  /** 1Shot-specific evidence: the 7702-upgraded burner, the USDC fee, gas (paid by the relayer). */
  oneshot: {
    burner: Address;
    feeUsdc: string;
    gasUsed: number;
    /** the 1Shot feeCollector the relay fee went to. */
    feeCollector: Address;
    /** the relayer EOA that broadcast the bundle and paid the ETH gas. */
    relayer: Address;
  };

  /** Optional x402 toll, if a toll was settled alongside the run (the main flow always demonstrates it). */
  toll?: {
    txHash: Hex;
    asset: Address;
    buyer: Address;
    seller: Address;
    amount: string;
    sellerBalance: string;
    resource: string;
  };
}

/**
 * Recorded Base mainnet 1Shot execution (2026-06-09). The Venice TEE committee decided For; that
 * decision was relayed through the 1Shot permissionless relayer (7702 burner + ERC-7710 bundle) and
 * cast on the mainnet VoteBoard (0x0B87…ebeF) as the 6th voter alongside 5 seeded personas — tx
 * 0xbf344a…ed4d4, verifiable on basescan.org. Produced by `packages/shared/scripts/1shot-record.ts`.
 */
export const MAINNET_SNAPSHOT: MainnetSnapshot | null = {
  recordedAt: '2026-06-09T10:18:00.000Z',
  chain: { id: 8453, name: 'base', rpc: 'https://base-rpc.publicnode.com', basescan: 'https://basescan.org' },
  relayer: 'mainnet',
  proposal: {
    id: '99019252316370500923492472570053420635813165261460609212982482510530266843538',
    title: { en: 'Renew core-dev team budget', zh: '续期核心开发团队预算' },
    body: {
      en: 'Renew the core-dev team budget at 12,000 USDC/quarter, released against public monthly milestone reports via a 2-of-3 multisig, with an unspent-funds clawback. Should the DAO approve?',
      zh: '将核心开发团队预算按每季度 12,000 USDC 续期，凭每月公开的里程碑报告、经 2/3 多签放款，并对未用资金设追回条款。DAO 是否批准？',
    },
  },
  voteBoard: '0x0B878c4A25002c14602ea8b25fD0099Ad6CEebeF',
  venice: {
    model: 'e2ee-gpt-oss-120b-p',
    decision: 'For',
    support: 1,
    rationale: 'Fiscal oversight and security accountability drive approval; budget modest, milestone-gated, multisig with clawback ensures low risk.',
    attestation: { verified: true, nonce: '995e188d7c25097f373a439137b823491aaee817d2e81a21477e8d8753f9ee8c' },
    signature: { recovered: true, signingAddress: '0x56d070df1c6be444b007839ef9cf67cec7c12b8b' },
  },
  lenses: [
    { lens: 'fiscal', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Milestone-gated, modest budget with multisig oversight and clawback aligns with lean, accountable spending mandate', teeVerified: true },
    { lens: 'growth', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Low cost, high accountability, supports core development and ecosystem growth', teeVerified: true },
    { lens: 'security', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Low risk, modest cost, strong accountability; aligns with development needs and security mandate', teeVerified: true },
    { lens: 'participation', model: 'e2ee-gpt-oss-120b-p', support: 1, decision: 'For', rationale: 'Low cost, strong accountability, minimal risk; supports core development.', teeVerified: true },
  ],
  vote: { txHash: '0xbf344ae9ec65e67e02108d4bd0983b0c0b9d9b830769b7cf67c85d5940ded4d4', support: 1, blockNumber: '47105516', relay: '1shot' },
  oneshot: {
    burner: '0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991',
    feeUsdc: '0.01',
    gasUsed: 357994,
    feeCollector: '0xE936e8FAf4A5655469182A49a505055B71C17604',
    relayer: '0x7338fFC0aE8FB5C601955a65D4F5896F866cc9b8',
  },
  // Real Base-mainnet x402 micro-toll: the burner (buyer) signed an Erc20TransferAmount delegation;
  // the analyst (seller) redeemed exactly 0.001 USDC. tx 0x321c54…c601, verifiable on basescan.org.
  toll: {
    txHash: '0x321c5456aea94a6479e4fdd7e34d0d4cc160151dbdf5411927111479c836c601',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    buyer: '0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991',
    seller: '0x31f898937F29c089b748750b00668Cf8ED5a5F28',
    amount: '1000',
    sellerBalance: '1000',
    resource: '/context/proposal-843538',
  },
};
