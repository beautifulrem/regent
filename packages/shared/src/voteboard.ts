import type { Abi, Address } from 'viem';

/**
 * Shared VoteBoard demo config: the proposal everyone votes on, the seeded personas, and the
 * minimal ABI to read the live tally. The board lets ANY wallet (incl. a judge's) join the SAME
 * proposal — see contracts/src/VoteBoard.sol.
 */

/** The shared demo proposal id (kept equal to the Governor proposal for continuity). */
export const DEMO_PROPOSAL_ID =
  99019252316370500923492472570053420635813165261460609212982482510530266843538n;

/**
 * Deployed VoteBoard on Base Sepolia (script/DeployVoteBoard.s.sol broadcast 2026-05-31).
 * Seeded with 5 persona votes — 3 For, 1 Against, 1 Abstain.
 */
export const VOTE_BOARD_ADDRESS: Address = '0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B';

const ZERO = '0x0000000000000000000000000000000000000000';
export function isVoteBoardLive(addr: Address = VOTE_BOARD_ADDRESS): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr) && addr.toLowerCase() !== ZERO;
}

export type Support = 0 | 1 | 2; // 0 = Against, 1 = For, 2 = Abstain (GovernorCountingSimple order)

export interface Persona {
  name: string;
  address: Address;
  support: Support;
}

/** Personas seeded by script/DeployVoteBoard.s.sol — keep addresses + supports in sync with it. */
export const DEMO_PERSONAS: readonly Persona[] = [
  { name: 'Alice', address: '0x1e7868c6c3d0E441ACC28ee04a021a17438f364e', support: 1 },
  { name: 'Bob', address: '0xcefdaEeDe499AB111643E644283b949D0bec19eF', support: 1 },
  { name: 'Carol', address: '0x6f4DAa10107D0F88C8FA206E28BF671950F60c5F', support: 0 },
  { name: 'Dao', address: '0x7Dd2820b2F3155Bd96a90bAb2A434CE930377d32', support: 1 },
  { name: 'Eve', address: '0x1D4d5B8164A7cE3447B122787E8076092276762a', support: 2 },
];

const PERSONA_BY_ADDR: Record<string, Persona> = Object.fromEntries(
  DEMO_PERSONAS.map((p) => [p.address.toLowerCase(), p]),
);

/** Map an on-chain voter address to its seeded persona (case-insensitive), if any. */
export function personaFor(address: string): Persona | undefined {
  return PERSONA_BY_ADDR[address.toLowerCase()];
}

export const SUPPORT_LABEL: Record<Support, 'Against' | 'For' | 'Abstain'> = {
  0: 'Against',
  1: 'For',
  2: 'Abstain',
};

/** getVote returns support+1 (0 = not voted); decode to a Support or null. */
export function decodeBallot(raw: number | bigint): Support | null {
  const v = Number(raw);
  return v >= 1 && v <= 3 ? ((v - 1) as Support) : null;
}

/** Minimal VoteBoard ABI: the castVote write + the tally/voters/vote reads. */
export const VOTE_BOARD_ABI = [
  {
    type: 'function',
    name: 'castVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getTally',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getVoters',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getVote',
    stateMutability: 'view',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'voter', type: 'address' },
    ],
    outputs: [{ type: 'uint8' }],
  },
] as const satisfies Abi;
