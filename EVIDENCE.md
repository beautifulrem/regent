# Mandate — Per-Track Evidence Map

On-chain receipts proving each hackathon track. All testnet artifacts are on **Base Sepolia
(chainId 84532)**; Basescan: `https://sepolia.basescan.org`. Started at Checkpoint A.

## Deployed (Base Sepolia)

| What | Address |
|---|---|
| VotesToken (ERC20Votes, timestamp clock) | [`0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55`](https://sepolia.basescan.org/address/0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55) |
| MandateGovernor (delay=60s, period=300s) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://sepolia.basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) |
| User smart account (root delegator / voter) | [`0xEb35F7b58EB654383092569Adc527220A7E89383`](https://sepolia.basescan.org/address/0xEb35F7b58EB654383092569Adc527220A7E89383) |
| Orchestrator smart account | [`0x2caa4D4583015F418F2d962e2E38F7D5E724d16e`](https://sepolia.basescan.org/address/0x2caa4D4583015F418F2d962e2E38F7D5E724d16e) |
| Analyst EOA (leaf delegate) | [`0x31f898937F29c089b748750b00668Cf8ED5a5F28`](https://sepolia.basescan.org/address/0x31f898937F29c089b748750b00668Cf8ED5a5F28) |
| DelegationManager (MetaMask SAK) | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |

## Tracks

| # | Track | Status | Proof |
|---|---|---|---|
| 1 | **General qualification** — SAK smart account + ERC-7710 in the main flow | ✅ | the redeem tx below casts a real vote via `@metamask/smart-accounts-kit` |
| 2 | **Best A2A coordination** (anchor) — 2-hop attenuated redelegation, redeemed on-chain | ✅ | vote + revoke txs below; 3 participants, 2 signed delegations, leaf→root redemption |
| 3 | **Best 1Shot relayer** — mainnet castVote via 7702 upgrade + 7710 (USDC gas) | ◑ client live | read-only verified vs the live relayer (caps/feeData, minFee $0.01); actual mainnet send = T16 |
| 4 | **Best Venice AI** — TEE model decides `support`; attestation verified | ✅ | live decisions discriminate (risky→Against, sound→For); `x-venice-tee:true`; attestation `verified:true` (see below) |
| 5 | **x402 + ERC-7710** (secondary) — analyst pays per-query via scoped delegation | ⏳ T17 | — |
| 6 | **Best Agent** — autonomous analyze→decide→vote after one grant | ✅ | `pnpm orchestrate`: one grant → Venice TEE decision → real castVote; on-chain tally bucket == the decision (see below) |
| 7 | **Kill-the-chain** (wow) — recall disables root; next redeem reverts | ✅ | disable UserOp + cause-proven revert below |
| 8 | **Compliance** — open-source repo, addresses, video | ⏳ T20 | repo + this file |

## Checkpoint A — Best A2A (live, Base Sepolia)

- **2-hop attenuated vote → real `castVote`** (analyst redeems the chain; DelegationManager
  executes as the user SA): [`0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841)
  → `hasVoted(userSA)=true`, `proposalVotes.For = 1000e18`. Reproduce: `pnpm vote:2hop`.
- **Cause-proven cascade-revoke** (user SA disables the root via a UserOp; the same fresh,
  unvoted chain then reverts in simulation): disable UserOp
  [`0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b)
  → `canRedeem` flips `true → false`. Reproduce: `pnpm revoke:2hop`.

> Each demo run reseeds a fresh proposal (votingPeriod=300s), so proposal ids and exact
> tx hashes differ per run; the txs above are representative proof from a live run.

## Best Venice AI (live)

- **TEE model decides `support`** (not hardcoded): on `e2ee-qwen3-5-122b-a10b` (Phala/NEAR-AI
  TEE, Intel TDX) — a risky anonymous-no-audit proposal → **Against (support 0)**, an audited
  milestone+clawback grant → **For (support 1)**. Each completion returns `x-venice-tee: true`.
- **Attestation** `GET /tee/attestation?model=…` → `verified: true`, `server_verification.tdx`
  all-valid, enclave `signing_address 0x6525e128afcffebf7eed05d485d7be983cdae934`, fresh nonce,
  Intel TDX quote + NVIDIA Hopper evidence. Reproduce via `analyzeProposal` / `fetchAttestation`.

## Best Agent — autonomous loop (live)

- **`pnpm orchestrate`**: one signed grant → orchestrator attenuated-redelegates → analyst decides
  in the Venice TEE → analyst redeems the chain → real `castVote`. The cast `support` is whatever
  Venice decided, with **NO hardcoding** — proven on-chain by which tally bucket receives the votes
  (e.g. Venice "For" → `proposalVotes.For = 1000e18`, redeem tx
  [`0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356`](https://sepolia.basescan.org/tx/0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356)).
