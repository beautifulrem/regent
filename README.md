# Mandate — revocable AI governance delegation

> Delegate your DAO voting power to an AI agent hierarchy — and yank it back in one click, on-chain.
>
> Hackathon entry: **MetaMask Smart Accounts Kit × 1Shot API × Venice AI "Dev Cook-Off"** (submission 2026-06-15).

## What it is

Mandate lets a user grant a **scoped, revocable ERC-7710 delegation** to govern on their behalf:

1. The user delegates a tightly-scoped right (`castVote` on a specific Governor, one proposal) to an **Orchestrator** agent.
2. The Orchestrator **attenuated-redelegates** an even narrower scope to **Analyst** agents.
3. Analysts privately analyze the proposal inside a **Venice TEE** (confidential inference) and pay per-query for proposal data via **x402 + ERC-7710**.
4. The vote is cast on **Base mainnet** through the **1Shot permissionless relayer** (gas paid in stablecoin, account upgraded via EIP-7702).
5. At any moment the user hits **Recall** → one `disableDelegation` on the root makes the **entire delegation chain die on-chain**: the agent's next `castVote` redemption reverts. *Self-custody you can watch.*

## Targeted tracks

- **Best A2A coordination / redelegation** — primary (real 2-hop attenuated redelegation + cascade-revoke)
- **Best 1Shot Permissionless Relayer** — mainnet 7710 relay + EIP-7702 upgrade through 1Shot
- **Best x402 + ERC-7710** — agents pay per-query for proposal data via scoped delegation
- **Best use of Venice AI** — private TEE proposal analysis decides the vote
- **Best Agent** — autonomous analyze → decide → vote → revocable loop

## Architecture (high level)

```
User (MetaMask Smart Account)
   │  createDelegation(FunctionCall: Governor.castVote, proposalId locked, support open)
   ▼
Orchestrator agent ──redelegate (narrower)──▶ Analyst agent
   │                                              │  Venice TEE analysis decides support
   │                                              │  x402+7710 pays for proposal data
   ▼                                              ▼
redeemDelegations([analyst, orchestrator, root]) ─▶ Governor.castVote   (relayed via 1Shot on Base mainnet, EIP-7702 + USDC gas)
   ▲
User hits Recall ─▶ disableDelegation(root) ─▶ next redemption reverts ("kill the chain")
```

## Repo structure

```
spike/        # D1-D3 go/no-go harness (delegation chain + cascade-revoke + 1Shot relay) — see spike/README.md
contracts/    # (planned) Governor wiring + deploy scripts
app/          # (planned) Next.js frontend (grant / authority graph / Recall / kill-the-chain demo)
agent/        # (planned) Orchestrator + Analyst services (Venice TEE, x402, 1Shot relay)
```

## Getting started

The spike verifies the core mechanics on Base Sepolia. See **[`spike/README.md`](./spike/README.md)** for run steps and the go/no-go checklist.

## Stack

`@metamask/smart-accounts-kit` (ERC-7710 delegation + redelegation, EIP-7702) · `viem` · 1Shot permissionless relayer (JSON-RPC) · Venice AI (TEE/E2EE inference, x402) · Next.js · Base (8453 / Sepolia 84532).

## License

MIT.
