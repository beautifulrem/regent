# Regent: Per-Track Evidence Map

[English](./EVIDENCE.md) · [简体中文](./EVIDENCE.zh-CN.md)

On-chain receipts for each hackathon track. Testnet artifacts live on Base Sepolia
(chainId 84532, `https://sepolia.basescan.org`); the 1Shot leg on Base mainnet (8453,
`https://basescan.org`).

> Two flows, one set of primitives. The interactive app casts a standing, vote-only, revocable
> mandate on the VoteBoard (any proposal, bounded by votes and time). The receipts below come
> from the CLI/Governor reproduction (`pnpm vote:2hop` and friends), which runs the same
> MetaMask Smart Accounts primitives against a real OpenZeppelin `Governor` with the scope
> tightened to one locked `proposalId`.

## Deployed (Base Sepolia)

| What | Address |
|---|---|
| VotesToken (ERC20Votes, timestamp clock) | [`0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55`](https://sepolia.basescan.org/address/0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55) |
| MandateGovernor (delay 60s, period 300s) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://sepolia.basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) |
| User smart account (root delegator, voter) | [`0xEb35F7b58EB654383092569Adc527220A7E89383`](https://sepolia.basescan.org/address/0xEb35F7b58EB654383092569Adc527220A7E89383) |
| Orchestrator smart account | [`0x2caa4D4583015F418F2d962e2E38F7D5E724d16e`](https://sepolia.basescan.org/address/0x2caa4D4583015F418F2d962e2E38F7D5E724d16e) |
| Analyst EOA (leaf delegate) | [`0x31f898937F29c089b748750b00668Cf8ED5a5F28`](https://sepolia.basescan.org/address/0x31f898937F29c089b748750b00668Cf8ED5a5F28) |
| DelegationManager (MetaMask SAK) | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |

## Track summary

| # | Track | Status | Proof |
|---|---|---|---|
| 1 | General qualification: SAK smart account + ERC-7710 in the main flow | done | the redeem tx below casts an on-chain vote via `@metamask/smart-accounts-kit` |
| 2 | Best A2A coordination: 2-hop attenuated re-delegation, redeemed on-chain | done | vote and revoke txs below; 3 participants, 2 signed delegations, leaf-to-root redemption |
| 3 | Best 1Shot relayer: the full chain in one mainnet relay (3-hop redemption, 7702 in-call upgrade, sponsored USDC fee) | done, mainnet | castVote and toll txs in the mainnet section below |
| 4 | Best Venice AI: the TEE model decides `support`; attestation verified | done | decisions discriminate (risky proposals go Against, sound ones For); `x-venice-tee: true`; attestation verified |
| 5 | x402 + ERC-7710: a self-built seller charges per query; the buyer pays through a scoped delegation | done | 402, signed `Erc20TransferAmount` delegation, on-chain settle, data (`pnpm x402:demo`) |
| 6 | Best Agent: autonomous analyze, decide, vote after one grant | done | `pnpm orchestrate`; the on-chain tally bucket equals the decision |
| 7 | Kill-the-chain: recall disables the root, the next redeem reverts | done | disable UserOp plus the cause-proven revert below |
| 8 | Compliance: open-source repo, addresses, video | video pending | this repo and this file |

## A2A re-delegation (live, Base Sepolia)

- 2-hop attenuated vote ending in `castVote` (the analyst redeems the chain; the
  DelegationManager executes as the user SA):
  [`0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841),
  after which `hasVoted(userSA) = true` and `proposalVotes.For = 1000e18`. Reproduce with
  `pnpm vote:2hop`.
- Cause-proven cascade revoke (the user SA disables the root via a UserOp; the same fresh,
  unvoted chain then reverts in simulation): disable UserOp
  [`0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b),
  with `canRedeem` flipping from true to false. Reproduce with `pnpm revoke:2hop`.

> Each demo run reseeds a fresh proposal (votingPeriod 300s), so proposal ids and exact tx
> hashes differ between runs; the transactions above are receipts from one live run.

## Venice AI (live)

- The TEE model decides `support`, with nothing hardcoded. On `e2ee-qwen3-5-122b-a10b`
  (Phala / NEAR-AI, Intel TDX), a risky anonymous no-audit proposal went Against (support 0)
  and an audited milestone-plus-clawback grant went For (support 1). Each completion returns
  `x-venice-tee: true`.
- Attestation: `GET /tee/attestation?model=…` returns `verified: true` with
  `server_verification.tdx` all valid, enclave signing address
  `0x6525e128afcffebf7eed05d485d7be983cdae934`, a fresh nonce, the Intel TDX quote and NVIDIA
  Hopper evidence. Reproduce via `analyzeProposal` / `fetchAttestation`.

## 1Shot relay on Base mainnet (live)

The same Governor and token are deployed on Base mainnet; the token name carries
`HACKATHON DEMO - NO REAL VALUE / 0 TREASURY`.

| What | Value |
|---|---|
| MandateGovernor (mainnet) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) |
| User smart account (root delegator, 7702-upgraded in this run) | [`0x578215EB18099f48978dFF14a5d03a74242a0dA3`](https://basescan.org/address/0x578215EB18099f48978dFF14a5d03a74242a0dA3) |
| Orchestrator (attenuating re-delegator) | [`0x82FBd69A5b1643196374F13Fc015935B9e3F9B0B`](https://basescan.org/address/0x82FBd69A5b1643196374F13Fc015935B9e3F9B0B) |
| Analyst (leaf delegate, x402 seller) | [`0x31f898937F29c089b748750b00668Cf8ED5a5F28`](https://basescan.org/address/0x31f898937F29c089b748750b00668Cf8ED5a5F28) |
| Burner (7702 relay sponsor) | [`0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991`](https://basescan.org/address/0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991) |

The full chain in one mainnet run (2026-06-12). Reproduce with
`pnpm 1shot:full --mainnet --estimate` for a free quote, then `pnpm 1shot:full --mainnet`:

- A2A: a 3-hop attenuated chain. User SA to orchestrator (root: this board, at most 3
  votes, 7-day expiry), orchestrator to analyst (adds `limitedCalls 1`), analyst to the 1Shot
  target with the leaf locked to exactly `castVote(proposalId, decidedSupport)`. Hashes: root
  `0x206a9adc…`, mid `0x669df36a…`, leaf `0x42233d2f…`.
- TEE: the Venice committee (four lenses and an arbiter) decided For before the leaf was
  signed. Attestation verified, enclave nonce `83fbc5a9…`.
- x402: the agent's USDC budget paid the analyst's 0.001 USDC data toll on-chain, toll tx
  [`0xb244c3e4…6174`](https://basescan.org/tx/0xb244c3e4b9c701bea6eb8812caf0b71f6d23ab29c6c3084d69bc421deefd6174).
- 1Shot: the relayer redeemed the 3-hop chain. `castVote` executed as the user SA, the user's
  EIP-7702 upgrade rode the same relay call, and the burner sponsored the USDC fee. castVote tx
  [`0xc48632ca…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092)
  (block 47228284). On-chain afterwards: `getVote(proposalId, userSA) = 2` (voted, support 1),
  the user's code is `0xef0100` plus the implementation, and the 0.01 USDC fee came from the
  sponsor. This is the run the app replays.

An earlier minimal proof (2026-06-09), a burner-only castVote
[`0x3b5448aa…6a07`](https://basescan.org/tx/0x3b5448aaac605e1416be48e238c12a755532b762d392dd70f4025e5a152a6a07),
is superseded by the full-chain run. Single-leg reproduce: `pnpm 1shot:vote`.

## x402 + ERC-7710 pay-per-query (live, Base Sepolia)

A self-built HTTP data seller answers `402 Payment Required` with an `erc7710` scheme. The
buyer, a smart account holding MVOTE credits, signs a scoped `Erc20TransferAmount` delegation
and retries with an `X-PAYMENT` header. The seller redeems the delegation on-chain to settle
(1 MVOTE moves from buyer to seller) and returns the data. This is separate from Venice
inference, which is prepaid by API key. Reproduce: `pnpm x402:demo`.

## Autonomous agent loop (live)

`pnpm orchestrate`: one signed grant, then the orchestrator re-delegates, the analyst decides
inside the Venice TEE, redeems the chain and casts. The cast `support` is whatever Venice
decided; the proof is which tally bucket receives the votes. Example: Venice said For, and
`proposalVotes.For` became `1000e18` in redeem tx
[`0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356`](https://sepolia.basescan.org/tx/0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356).
