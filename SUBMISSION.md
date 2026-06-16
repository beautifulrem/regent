# SUBMISSION.md: HackQuest submission copy (draft)

> Paste-ready copy for the HackQuest form fields. Nothing here is published until pasted.
> Appendix A is filed; the X thread in Appendix B is still a draft.

---

## One-liner (project tagline)

> Grant an AI a vote-only, revocable governance regency. A Venice TEE decides every vote, x402
> pays the data toll, 1Shot relays on Base mainnet, and one click revokes the entire delegation
> chain on-chain.

## 描述 / Description

### The problem

DAOs already let you delegate voting power, but only to an address you must trust to vote
however it likes, indefinitely, until you move your tokens. Meanwhile, the AI products that
could do the voting for you want either your private key, which one prompt injection can leak,
or a co-signature on every action, which rules out autonomy.

### The answer

Regent is a standing, vote-only, revocable AI governance mandate. Your MetaMask smart account
signs one ERC-7710 delegation: an AI may `castVote` on this DAO board, nothing else, bounded by
a vote cap and a validity window you choose. The agent then votes proposal after proposal on
its own, and the moment you stop trusting it, one on-chain call kills the whole delegation
chain.

### How it works

1. Grant. One MetaMask signature creates the root delegation (`AllowedTargets` and
   `AllowedMethods` pin it to castVote; `LimitedCalls` and `Timestamp` bound it).
2. Re-delegate. An orchestrator smart account re-delegates to an analyst with a narrower scope
   (`parentDelegation`). This hop makes the mandate attenuable and cascade-revocable.
3. Decide. The analyst reads each proposal inside a Venice TEE (Intel TDX, an `e2ee-*` model,
   attestation verified). The cast `support` comes from the model; the on-chain tally bucket
   matches the TEE decision. Four Venice endpoints run in the main flow (`/models`,
   `/chat/completions`, `/tee/attestation`, `/audio/speech`); the arbiter reads its verdict
   aloud through Venice TTS.
4. Pay. The agent buys proposal data through x402 by signing a scoped `Erc20TransferAmount`
   delegation; the seller redeems it on-chain to settle.
5. Vote. The analyst redeems the chain leaf to root, and the DelegationManager executes
   `castVote` as your smart account. On Base mainnet the full chain went through the 1Shot
   permissionless relayer in one call: a 3-hop delegation redeemed, the vote landing as the
   user's own smart account, the user's EIP-7702 upgrade riding the same relay call, and a
   burner account sponsoring the 0.01 USDC fee. The relay also feeds a signed-webhook status
   stream (`destinationUrl` to `POST /webhooks/1shot`, Ed25519-verified against the relayer
   JWKS; register with `pnpm 1shot:vote --webhook <url>`).
6. Recall. One `disableDelegation(root)` revokes everything downstream; the next redemption
   reverts on-chain, and the app shows it.

### Why this needs ERC-7710 re-delegation

A voting agent needs four properties at once: vote-only, bounded, revocable on-chain, and
custody kept. A bare key, a session key, token-weight `delegate()` and custodial services each
give up at least one (the comparison table is in the README). It also has to be a chain rather
than flat grants:

- One signature, rotating workforce. The orchestrator can replace analysts by re-delegating
  without sending the user back to MetaMask.
- Attenuation is enforced at redemption: a child can only narrow its parent, checked on-chain.
- The kill switch depends on the chain: one `disableDelegation(root)` revokes every downstream
  agent at once.

The in-app Tamper Probe runs the negative case live: two `eth_call`s against the
DelegationManager, where the honest castVote passes and the tampered fund transfer reverts at
`AllowedMethodsEnforcer`.

### Tracks claimed

| Track | Evidence |
|---|---|
| General qualification (SAK + ERC-7710 in the main flow) | grant flow in `app/src/lib/wallet.ts`; redeem tx [`0xc9f4…4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841) |
| Best A2A coordination | 3 participants, 2 signed delegations, leaf-to-root redemption; see `EVIDENCE.md` |
| Best use of Venice AI | four endpoints in the main flow (models, chat, attestation, speech); TEE decisions discriminate; attestation verified |
| Best x402 + ERC-7710 | `pnpm x402:demo`: 402, scoped `Erc20TransferAmount` delegation, on-chain settle, data |
| Best 1Shot Permissionless Relayer | the full chain in one Base mainnet relay: castVote tx [`0xc486…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092) executed as the user SA with the 7702 upgrade in-call and a sponsored 0.01 USDC fee; x402 toll tx [`0xb244…6174`](https://basescan.org/tx/0xb244c3e4b9c701bea6eb8812caf0b71f6d23ab29c6c3084d69bc421deefd6174); every authority key holds 0 ETH |
| Best Smart Accounts Agent | `pnpm orchestrate`: one grant, a TEE decision, a real castVote; the tally bucket equals the decision |
| Kill-the-chain (the core) | disable UserOp [`0x1475…c74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b); `canRedeem` flips from true to false |

### Limitations

- The app's standing mandate runs on a self-built `VoteBoard`; the OZ `Governor` path is the
  CLI reproduction with the scope tightened to one locked `proposalId`. `votingPeriod` is 300
  seconds so judges can reproduce grant, vote and recall in minutes.
- The x402 toll settles in a self-deployed `MockUSDC` on Base Sepolia; the only real-USDC legs
  are the 1Shot mainnet fee and toll. The seller is self-built, with no Coinbase facilitator.
- Venice inference is prepaid by API key; x402 pays the proposal-data toll.
- The app's mainnet panel replays pinned artifacts from the recorded run (linked transactions
  plus a live `eth_getCode` 7702 check); live mainnet execution stays opt-in via the CLI.

### Judge quick links

- Repo: https://github.com/beautifulrem/regent (MIT)
- Per-track on-chain receipts: `EVIDENCE.md`
- Demo video: https://www.youtube.com/watch?v=55HJ_LHQdqY
- Live app: https://mandate-app-murex.vercel.app (wired to a hosted orchestrator, so the live
  Sepolia flow runs for anyone who opens the link; toggle the network pill to Base mainnet for
  the recorded real-funds replay)
- Reproduce: `pnpm vote:2hop`, `pnpm revoke:2hop`, `pnpm orchestrate`, `pnpm x402:demo`,
  `pnpm 1shot:full --mainnet --estimate`

## 本次黑客松进展 / Progress during the hackathon

Validation first. Before building features we ran go/no-go spikes against the real stacks:
`createDelegation(ScopeType.FunctionCall)` with `parentDelegation` re-delegation, leaf-to-root
`redeemDelegations` and `disableDelegation` on Base Sepolia; 1Shot capability probing; Venice
TEE model resolution. The spikes surfaced the constraints that shaped the design. The 1Shot
permissionless relayer is mainnet-only (`relayer_getCapabilities` on Base Sepolia returns an
empty object), Venice TEE models are named `e2ee-*` rather than `tee-*`, and fresh Venice keys
ship with a zero spend limit that blocks every call. We designed around all three: testnet for
the mechanism, an opt-in mainnet leg for the 1Shot track.

The delegation core. Root grant (castVote-only scope with `LimitedCalls` and `Timestamp`
bounds), attenuated re-delegation, leaf-to-root redemption, and a cause-proven cascade revoke,
all against the real DelegationManager and reproducible from the CLI (`pnpm vote:2hop`,
`pnpm revoke:2hop`).

The autonomous loop. `pnpm orchestrate`: one signed grant, then the orchestrator re-delegates,
the analyst decides inside the Venice TEE, redeems the chain and casts. No hardcoded support;
the on-chain tally bucket is whatever the model decided.

The x402 leg. A self-built seller answers `402 Payment Required` with an `erc7710` scheme; the
buyer signs a scoped `Erc20TransferAmount` delegation; the seller redeems it on-chain and
returns the data.

The 1Shot mainnet leg. We deployed the Governor to Base mainnet (`HACKATHON DEMO - NO REAL
VALUE`), then ran the full chain in one relay call: a 3-hop delegation (user, orchestrator,
analyst, leaf locked to the decided vote) redeemed by the relayer, `castVote` executing as the
user's smart account, the user's EIP-7702 upgrade in the same call, and a burner sponsoring the
0.01 USDC fee. Every authority key holds 0 ETH.

The app. A Next.js 15 mission-control UI: connect, grant with browser signing, a live authority
graph (SSE-streamed run state with a polling fallback), the Venice TEE panel with a spoken
verdict, the x402 toll card, the 1Shot mainnet replay, recall, and the Tamper Probe (a live
pass-and-revert pair with the enforcer named on screen). An MCP server (`agent/mandate-mcp`)
lets any agent request a mandate; the request returns unsigned, and only the human's MetaMask
account can grant.

Engineering. 206 tests passing (108 shared, 58 app, 25 Foundry, 15 agents), including a committed
Base Sepolia fork test that redeems the real 2-hop delegation chain and asserts the scope holds at
the live stock enforcers (cause-specific revert reasons); strict TypeScript;
eslint; a browser-safe shared package (Web Crypto, no runtime `node:*`); throwaway keys and
gitignored secrets; every mainnet action opt-in and quoted before signing.

## 融资状态 / Funding status

Not fundraising. Regent is an open-source (MIT) hackathon build focused on one primitive: a
scoped, revocable, chain-killable AI governance mandate. Open to ecosystem grants and follow-on
collaboration with the MetaMask, Base, Venice and 1Shot ecosystems.

---

# Appendix A: feedback-track GitHub issues (filed 2026-06-11)

Real friction from the build, filed as actionable issues from the team account (@beautifulrem).
The full writeup (what happened, why it matters, the fix, and our workaround for each) is in
[FEEDBACK.md](./FEEDBACK.md). Paste these links into the form's feedback field:

| # | Issue | Link |
|---|---|---|
| A1 | Venice api-docs: "TEE models" are actually `e2ee-*`; document the prefix and capability-based discovery | https://github.com/veniceai/api-docs/issues/283 |
| A2 | Venice api-docs: fresh API keys silently fail until the per-key USD spend limit is raised; name the cause in the error | https://github.com/veniceai/api-docs/issues/284 |
| A3 | 1Shot docs: `relayer_getCapabilities` returns `{}` on unsupported chains; return an explicit unsupported signal | https://github.com/1Shot-API/1shot-documentation/issues/2 |
| A4 | MetaMask SAK: docs gap on when ERC-7715 suffices versus when you need 7710 `createDelegation` (function-call scopes) | https://github.com/MetaMask/smart-accounts-kit/issues/263 |

# Appendix B: X (Twitter) thread (draft, not posted)

> Post from the team account; tag @MetaMaskDev; attach the demo video or the Tamper Probe clip.

1/ Your DAO vote, on autopilot, without giving an AI your keys.
Regent: sign ONE MetaMask delegation and an AI votes for you, vote-only, bounded, revocable
on-chain in one click. Built for the @MetaMaskDev Dev Cook-Off

2/ The grant is an ERC-7710 delegation with real constraints: AllowedTargets and AllowedMethods
pin it to `castVote` on one board, LimitedCalls caps the votes, Timestamp expires it. The EVM
enforces the scope, not our backend.

3/ The brain runs inside a Venice TEE (Intel TDX, attestation verified). Each proposal is
analysed privately; the cast `support` is whatever the model decided, and you can read it off
the on-chain tally bucket.

4/ The agent pays its own way: a 402 response, a scoped Erc20TransferAmount delegation, an
on-chain settle, then the data. x402 with ERC-7710, no blanket approvals.

5/ On Base mainnet the whole chain went through 1Shot's permissionless relayer in one call:
a 3-hop delegation redeemed, the vote landing as the user's own smart account, the 7702
upgrade riding the same call, a sponsor paying the $0.01 fee in USDC. Nobody held ETH.

6/ The kill switch: one `disableDelegation(root)` and the entire delegation chain dies; the
next redemption reverts at the enforcer. Ask the agent to move funds and watch the chain
refuse. Repo and receipts: [link]

---

# Appendix C: remaining checklist

- [ ] Record the sub-3-minute demo video (each track capability on screen, per the judge
      requirement; the video must show the SAK integration in the main flow). Uploaded at
      https://www.youtube.com/watch?v=55HJ_LHQdqY but currently 5:18; trim to under 3:00.
- [ ] Optional: record the separate pitch video (HackQuest has a second video slot)
- [x] Deploy the app and fill the live-app link (done: mandate-app-murex.vercel.app)
- [x] File the Appendix-A issues and list them in the form (filed 2026-06-11)
- [ ] Post the Appendix-B thread and link it in the form (social-media track)
- [ ] Fill the HackQuest fields from this file (one-liner, 描述, 进展, 融资状态), project name
      "Regent"
- [ ] Final pass: every tx link resolves, every README command reproduces
