# Regent: Architecture

[English](./ARCHITECTURE.md) · [简体中文](./ARCHITECTURE.zh-CN.md)

A user grants an agent hierarchy a narrow, revocable right to cast governance votes. The agents
decide autonomously and privately, and the user can sever the whole chain on-chain at any moment.
Everything below the UI runs live on Base Sepolia; the 1Shot leg runs on Base mainnet.

Code identifiers keep the project's original working name: the `@mandate/*` packages and the
deployed `MandateGovernor` contract predate the rename to Regent.

## Components

A pnpm monorepo:

| Package | Role |
|---|---|
| `packages/shared` | The reusable core: ERC-7710 delegation building, redemption and revocation; Governor and proposal helpers; the Venice TEE client; the 1Shot relayer client; and the zod run contract shared by the app and the services. Browser-safe: Web Crypto only, no `node:*` at runtime. |
| `packages/contracts` | Foundry. `VotesToken` (ERC20Votes on a timestamp clock; the owner mint auto-self-delegates the recipient) and `MandateGovernor` (Settings, CountingSimple, Votes, QuorumFraction), plus `Deploy.s.sol` and `Propose.s.sol`. |
| `agent/orchestrator` | Holds the root delegation, re-delegates to the analyst with a narrower scope, drives the run state machine, and serves the run contract over HTTP (`POST /grant`, `GET /run/:id`, `GET /config`). |
| `agent/analyst` | Decides `support` inside the Venice TEE, then casts by redeeming the delegation chain. The cast support is never hardcoded. |
| `agent/mandate-mcp` | An MCP server through which any agent can describe or request a mandate. Requests come back unsigned; only the human's MetaMask account can grant. |
| `app` | Next.js 15 / React 19. Connect MetaMask, derive the user smart account, sign the root delegation in the browser, post it to the orchestrator, then watch the live authority graph and recall. |

## The delegation

The grant is an ERC-7710 `createDelegation` with a FunctionCall scope. The app uses the standing
variant; the CLI keeps a tighter single-proposal variant of the same scope.

Standing mandate (the app): vote-only on the board, bounded, revocable.

- `targets = [VoteBoard]`, `selectors = ['castVote(uint256,uint8)']`, enforced by
  `AllowedTargets` and `AllowedMethods`. The agent can call `castVote` on this board and
  nothing else; it cannot move funds.
- Standing bounds as caveats: `Timestamp` (expiry) and `LimitedCalls` (vote cap).
- `proposalId` is left open, so one grant covers any current or future proposal. The breadth of the grant is
  what makes revocation necessary.

Single-proposal variant (CLI `vote:2hop`, against the OpenZeppelin `Governor`): the same scope
plus `allowedCalldata` locking the `proposalId` (bytes 4 to 35) while leaving `support`
(byte 36) free. The agent can vote only on that one proposal; Venice still decides the
direction.

```
User SA ── root: castVote scope, bounded; proposalId open (CLI: locked) ──▶ Orchestrator SA
Orchestrator SA ── attenuated re-delegation (parentDelegation = root) ──▶ Analyst
Analyst submits redeemDelegations([leaf, root], [castVote(proposalId, support)])
   → the DelegationManager validates the chain and executes castVote AS the user SA
```

Redemption runs leaf to root, and the execution happens as the root delegator, the user's smart
account. The user SA therefore needs voting power at the proposal snapshot; the token's owner
mint auto-self-delegates, so seeding a voter takes no extra UserOp.

### Killing the chain

Recall is `DelegationManager.disableDelegation(root)`, sent by the user smart account as a
UserOp through a keyless public bundler. To show the revert is caused by the disabled root
rather than by an already-cast vote, the revoke flow uses a fresh, unvoted proposal: the same
signed chain returns `canRedeem = true` before the disable and `false` after. Reproduce with
`pnpm revoke:2hop`.

## The run state machine

`POST /grant` with the signed root creates a run, which the orchestrator drives through:

```
granted → redelegated → analyzing → decided → voting → voted   (or → failed)
```

Every transition is validated against the shared zod `RunStatus` contract before it is stored
or served, so the app can only ever render a contract-valid status. The status carries the
delegation hashes, the participant addresses, the Venice trace (decision, support, rationale,
attestation) and the vote receipt (tx hash, support).

## The Venice TEE analyst

- Model: resolved at runtime from `GET /models` by the `supportsTeeAttestation` capability.
  These are the `e2ee-*` models; the older `tee-*` naming no longer exists, which we found out
  during the build and reported upstream.
- Decision: a governance system prompt produces strict JSON `{decision, rationale}`, mapped to
  the OZ support code (Against 0, For 1, Abstain 2). The parser tolerates reasoning models by
  reading the final answer.
- Proof: each completion returns `x-venice-tee: true` (Phala / NEAR-AI, Intel TDX), and
  `GET /tee/attestation` returns `verified: true` with the enclave signing address, a fresh
  nonce and the TDX quote. The app surfaces this as a TEE-attested badge.
- Payment: a prepaid Venice API key. The x402 toll pays for proposal data, not for inference.

## The 1Shot mainnet leg

The 1Shot public relayer is permissionless but mainnet-only; on Base Sepolia,
`relayer_getCapabilities` returns an empty object. The client in `packages/shared`
(`getCapabilities`, `getFeeData`, `estimate7710`, `send7710`, `getStatus`, Ed25519 webhook
verification, and the `0xef0100` post-upgrade code check) is exercised read-only against the
live mainnet relayer in tests.

The recorded full-chain run (2026-06-12) goes further: a 3-hop chain (user, orchestrator,
analyst, with the leaf delegated to the 1Shot target and locked to the decided
`castVote(proposalId, support)`) is redeemed in a single relay call. The user's EIP-7702
upgrade rides that same call, and a separate burner account sponsors the USDC fee under the
relayer's sponsored-fee pattern. Receipts are in `EVIDENCE.md`; reproduce with
`pnpm 1shot:full --mainnet` after a free `--estimate` quote.

## Implementation notes

- Timestamp clock on the token and governor, with `votingDelay = 60s` and
  `votingPeriod = 300s`, keeps the demo window tight; `pnpm proposal --reseed` keeps a fresh
  active proposal available.
- The owner mint auto-self-delegates, so a smart-account voter is active without sending its
  own delegate UserOp.
- OpenZeppelin and forge-std live as git submodules under `packages/contracts/lib/`. pnpm's
  out-of-root symlinks fall outside solc's allow-paths, and submodules avoid the problem.
- The shared package stays browser-safe: the webhook verifier uses Web Crypto with a type-only
  `node:crypto` import, so the barrel bundles into the Next.js client.
- The recall UserOp goes through the keyless Pimlico public bundler
  (`public.pimlico.io/v2/84532/rpc`); the smart account pays its own gas, no paymaster.

## Reproduce

`pnpm vote:2hop`, `pnpm revoke:2hop`, `pnpm orchestrate`, `pnpm proposal --reseed`. Each prints
its on-chain receipts. The UI ties them together: `orchestrator serve` plus `app dev`.
