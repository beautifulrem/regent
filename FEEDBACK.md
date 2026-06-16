# Developer Feedback

Real friction we hit while building **Regent** against all three sponsor stacks in the main flow:
the **MetaMask Smart Accounts Kit** (ERC-7710), the **1Shot Permissionless Relayer**, and the
**Venice AI** API. Every item below is a blocker we actually ran into, filed as a reproducible,
actionable GitHub issue from our team account ([@beautifulrem](https://github.com/beautifulrem)) on
2026-06-11, with a concrete fix proposed and, where it fit, an offer to PR it.

We integrated all three stacks deeply rather than as a checkbox, which is why we met these at all: a
7710 delegation chain enforced on-chain, a 1Shot mainnet relay, and a Venice TEE committee that
decides every vote. This is the kind of friction you only find when you wire the real thing end to
end.

## At a glance

| # | Stack | One-line problem | Suggested fix | Issue |
|---|-------|------------------|---------------|-------|
| 1 | MetaMask Smart Accounts Kit | The docs do not signpost where ERC-7715 stops and ERC-7710 begins | A "7715 vs 7710" decision table atop Advanced Permissions | [SAK#263](https://github.com/MetaMask/smart-accounts-kit/issues/263) |
| 2 | 1Shot Permissionless Relayer | `relayer_getCapabilities` returns `{}` on an unsupported chain, with no error | Return an explicit unsupported signal | [docs#2](https://github.com/1Shot-API/1shot-documentation/issues/2) |
| 3 | Venice AI | A new API key silently fails every call until its USD spend limit is raised | Name the cause in the error response | [api-docs#284](https://github.com/veniceai/api-docs/issues/284) |
| 4 | Venice AI | The docs say "TEE models" but the model ids are `e2ee-*` | Document the prefix and capability-based discovery | [api-docs#283](https://github.com/veniceai/api-docs/issues/283) |

---

## 1. MetaMask Smart Accounts Kit: signpost where ERC-7715 stops and ERC-7710 begins

**Issue:** [MetaMask/smart-accounts-kit#263](https://github.com/MetaMask/smart-accounts-kit/issues/263)

**What happened.** We designed Regent's grant flow around ERC-7715
(`wallet_requestExecutionPermissions`) and found out late that 7715 permission requests cover the
token-transfer, stream, and periodic permission types only. Authority over an arbitrary contract
function, in our case `Governor.castVote(uint256,uint8)`, has to be granted through the Kit's
ERC-7710 path instead (`createDelegation` with a `FunctionCall` scope). Nothing where we entered the
Advanced Permissions docs said this out loud, so we built against 7715 first and pivoted mid-build.

**Why it matters.** The two permission systems solve different problems, but a developer landing on
Advanced Permissions gets no signpost for which one fits. Anyone whose goal is "let an agent call one
specific contract function" (governance, app-specific actions) will reach for 7715 by name and lose
time, exactly as we did.

**Suggested fix.** A short "Choosing ERC-7715 vs ERC-7710" section or decision table near the top of
the Advanced Permissions docs. One paragraph would have saved us roughly a day. We offered to PR a
draft.

**Our workaround.** Regent's grant is a 7710 `createDelegation` with a `FunctionCall` scope locked to
`castVote`, bounded by `LimitedCalls` and `Timestamp` caveats, then redelegated from user to
orchestrator to analyst. That 7710 flow became the core of the project.

## 2. 1Shot: make "unsupported chain" an explicit signal, not an empty object

**Issue:** [1Shot-API/1shot-documentation#2](https://github.com/1Shot-API/1shot-documentation/issues/2)

**What happened.** Integrating the Permissionless Relayer, we called `relayer_getCapabilities` with
`["84532"]` (Base Sepolia) and got back an empty object `{}`: no error, no message. We spent a
debugging session checking our request shape, the chain-id encoding, and whether the relayer was
down, before concluding by elimination that the permissionless relayer simply does not serve Base
Sepolia.

**Why it matters.** An empty object is indistinguishable from "I did not understand your request."
Hackathon teams reach for testnets first by reflex, so a silently empty response is the path of least
resistance straight into a dead end.

**Suggested fix.** Make "unsupported chain" explicit: either
`{"84532": {"supported": false, "reason": "mainnet chains only"}}` or a top-level `supportedChains`
array in the capabilities response. Either is a small change that turns a half-day of guessing into a
one-glance answer.

**Our workaround.** We redesigned the live cast around an opt-in Base mainnet leg through 1Shot,
keeping the rest of the demo on Base Sepolia. The mainnet relay (a 3-hop delegation redeemed in one
call, an EIP-7702 burner upgrade riding along, a USDC-sponsored fee) is our 1Shot track evidence.

## 3. Venice: name the per-key spend-limit block in the error

**Issue:** [veniceai/api-docs#284](https://github.com/veniceai/api-docs/issues/284)

**What happened.** We funded a Venice account, created a fresh API key, and every `/chat/completions`
call was rejected even though the account had credit. Nothing in the error named the cause. We
rotated keys and suspected model gating and regional issues before finding the per-key USD spend
limit, which for a newly created key was effectively zero until we raised it in the key settings.

**Why it matters.** The failure mode is brutal for onboarding: funded account, valid key, every call
fails, and no pointer to the one setting that fixes it. For us, wiring Venice TEE inference into an
autonomous agent, the silent rejection looked exactly like a TEE or model problem rather than a
billing toggle.

**Suggested fix.** (1) When a request is blocked by the per-key spend limit, say so explicitly, for
example `error.code = "key_spend_limit_exceeded"` with the key's current limit. (2) Default a new
key's limit to the account balance or a sane non-zero cap rather than a value that blocks every call.
(3) Add a one-line callout to the quickstart's "create an API key" step.

**Our workaround.** We raised the per-key limit and wrote the gotcha into our own setup notes, so the
agent's first live call would stop looking like a TEE failure.

## 4. Venice: document the `e2ee-*` prefix and capability-based TEE discovery

**Issue:** [veniceai/api-docs#283](https://github.com/veniceai/api-docs/issues/283)

**What happened.** Looking for the "TEE models" the docs and product pages describe, we expected ids
like `tee-*`. The actual TEE-attestation models carry an `e2ee-` prefix (for example
`e2ee-gpt-oss-120b-p`), and the only reliable way we found to discover them is to filter `/models` by
the capability flag `model_spec.capabilities.supportsTeeAttestation === true`. That mapping, "TEE" in
the prose to `e2ee-*` ids plus the capability flag, is not documented anywhere we could find, so we
lost time hardcoding guessed ids before reading the raw `/models` output.

**Why it matters.** The prose-to-id mismatch, compounded by "E2EE" versus "TEE" naming, makes the
headline TEE feature hard to actually call. Pinned, guessed ids also break the moment a model
rotates.

**Suggested fix.** (1) Document the `e2ee-` prefix wherever TEE inference is described, and briefly
why. (2) Document capability-based discovery as the recommended pattern: a five-line `/models` filter
on `supportsTeeAttestation`. (3) Cross-link the `/tee/attestation` endpoint docs to that snippet.

**Our workaround.** `resolveTeeModel` in `packages/shared/src/venice.ts` auto-resolves a TEE model by
the `supportsTeeAttestation` capability and falls back from a configured id, so we never pin a guessed
name.

---

## Why we think this is useful feedback

- **Real, not retrospective.** Each item is a blocker we hit during the build and filed the same week
  (2026-06-11), timestamped in the issue threads, not a wishlist written after the fact.
- **Actionable.** Every fix is concrete and minimal: an error string, a docs table, one response
  field. We offered to PR where it made sense.
- **It saves the next team time.** Each one turns a multi-hour debugging session into a one-glance
  answer for whoever integrates next.
- **It spans the whole stack.** All three sponsor stacks are represented because Regent integrates all
  three in the main flow, not as a checkbox: the ERC-7710 delegation chain, the 1Shot mainnet relay,
  and the Venice TEE committee.

Filed from [@beautifulrem](https://github.com/beautifulrem) on 2026-06-11. Full project:
[README](./README.md), [on-chain evidence](./EVIDENCE.md), [submission](./SUBMISSION.md).
