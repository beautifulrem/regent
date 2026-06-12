# Regent:架构

[English](./ARCHITECTURE.md) · [**简体中文**](./ARCHITECTURE.zh-CN.md)

用户把一份范围很窄、随时可撤销的投票权授予一个代理层级;代理自主且私密地做决策;用户任何
时刻都能在链上切断整条链。UI 之下的一切都在 Base Sepolia 上实际运行,1Shot 环节运行在
Base 主网。

代码标识符保留项目原工作名:`@mandate/*` 包名与已部署的 `MandateGovernor` 合约早于改名
Regent。

## 组件

一个 pnpm monorepo:

| 包 | 职责 |
|---|---|
| `packages/shared` | 可复用内核:ERC-7710 委托的构建、兑付与撤销;Governor 与提案辅助;Venice TEE 客户端;1Shot 中继客户端;应用与服务共用的 zod 运行契约。浏览器安全:只用 Web Crypto,运行时不含 `node:*`。 |
| `packages/contracts` | Foundry。`VotesToken`(ERC20Votes,时间戳时钟;owner 铸币时自动为接收者自委托)与 `MandateGovernor`(Settings、CountingSimple、Votes、QuorumFraction),另有 `Deploy.s.sol` 与 `Propose.s.sol`。 |
| `agent/orchestrator` | 持有根委托,以更窄范围再委托给分析师,驱动运行状态机,并通过 HTTP 提供运行契约(`POST /grant`、`GET /run/:id`、`GET /config`)。 |
| `agent/analyst` | 在 Venice TEE 内决定 `support`,然后兑付委托链完成投票。投出的 support 从不硬编码。 |
| `agent/mandate-mcp` | MCP 服务器:任何代理都可以描述或请求一份委托,但请求返回时未签名,只有人的 MetaMask 账户能授予。 |
| `app` | Next.js 15 / React 19。连接 MetaMask,派生用户智能账户,在浏览器内签根委托,提交给编排器,然后观看实时权限图与撤销。 |

## 委托本体

授权是一份带 FunctionCall scope 的 ERC-7710 `createDelegation`。应用使用常设变体,CLI 保留
同一 scope 的更紧的单提案变体。

常设委托(应用):板上仅投票、有界、可撤销。

- `targets = [VoteBoard]`、`selectors = ['castVote(uint256,uint8)']`,由 `AllowedTargets`
  与 `AllowedMethods` 强制。代理只能在这个板上调 `castVote`,动不了资金。
- 常设边界由 caveat 提供:`Timestamp`(有效期)与 `LimitedCalls`(票数上限)。
- `proposalId` 不锁定,一次授权覆盖现在和将来的任意提案。授权范围越广,撤销能力越是前提。

单提案变体(CLI `vote:2hop`,对 OpenZeppelin `Governor`):同一 scope 之上,用
`allowedCalldata` 锁住 `proposalId`(第 4 至 35 字节),`support`(第 36 字节)留空。代理
只能投那一个提案,方向仍由 Venice 决定。

```
用户 SA ── 根委托:castVote scope,有界;proposalId 开放(CLI:锁定)──▶ 编排器 SA
编排器 SA ── 衰减再委托(parentDelegation = 根)──▶ 分析师
分析师提交 redeemDelegations([叶, 根], [castVote(proposalId, support)])
   → DelegationManager 校验整条链,并以用户 SA 的身份执行 castVote
```

兑付从叶到根,执行以根委托人(用户智能账户)的身份发生。因此用户 SA 必须在提案快照时持有
票权;代币的 owner 铸币会自动自委托,预置投票人不需要额外 UserOp。

### 切断链条

撤销是 `DelegationManager.disableDelegation(root)`,由用户智能账户经免私钥公共 bundler 以
UserOp 发出。为了证明 revert 的原因是根被禁用而不是"已投过票",撤销流程使用一个全新的、
未投过票的提案:同一条已签名链在禁用前 `canRedeem = true`,禁用后为 `false`。复现:
`pnpm revoke:2hop`。

## 运行状态机

`POST /grant` 提交签名根委托后创建一次运行,编排器驱动它走完:

```
granted → redelegated → analyzing → decided → voting → voted   (或 → failed)
```

每次状态迁移都先经过共享的 zod `RunStatus` 契约校验,再存储或对外提供,因此应用只可能渲染
契约合法的状态。状态携带委托哈希、参与方地址、Venice 痕迹(决策、support、理由、attestation)
以及投票回执(交易哈希、support)。

## Venice TEE 分析师

- 模型:运行时从 `GET /models` 按 `supportsTeeAttestation` 能力解析,即 `e2ee-*` 系列。
  旧的 `tee-*` 命名已不存在,这是开发期间发现并向上游反馈的。
- 决策:治理系统提示词产出严格 JSON `{decision, rationale}`,映射到 OZ 的 support 码
  (反对 0、赞成 1、弃权 2)。解析器兼容推理型模型,读取其最终答案。
- 证明:每次补全返回 `x-venice-tee: true`(Phala / NEAR-AI,Intel TDX);
  `GET /tee/attestation` 返回 `verified: true`、飞地签名地址、新鲜 nonce 与 TDX quote。
  应用以「TEE 已证明」徽章呈现。
- 计费:预付费 Venice API key。x402 过路费支付的是提案数据,不是推理。

## 1Shot 主网环节

1Shot 公共中继是无许可的,但只支持主网;在 Base Sepolia 上 `relayer_getCapabilities` 返回
空对象。`packages/shared` 中的客户端(`getCapabilities`、`getFeeData`、`estimate7710`、
`send7710`、`getStatus`、Ed25519 webhook 验签,以及 `0xef0100` 升级后代码检查)在测试中
以只读方式对真实主网中继验证。

录制的完整链运行(2026-06-12)更进一步:三跳链(用户、编排器、分析师,叶委托授予 1Shot
target 并锁死为已决定的 `castVote(proposalId, support)`)在一笔中继调用中完成兑付。用户的
EIP-7702 升级搭载同一笔调用,另有一个 burner 账户按中继器的 sponsored-fee 模式赞助 USDC
费用。收据见 `EVIDENCE.zh-CN.md`;先用 `--estimate` 免费报价,再以
`pnpm 1shot:full --mainnet` 复现。

## 实现备注

- 代币与 governor 使用时间戳时钟,`votingDelay = 60s`、`votingPeriod = 300s`,演示窗口
  紧凑;`pnpm proposal --reseed` 维持一个新鲜的活跃提案。
- owner 铸币自动自委托,智能账户投票人无需自己发 delegate UserOp 即可激活。
- OpenZeppelin 与 forge-std 以 git 子模块放在 `packages/contracts/lib/` 下。pnpm 的根外
  符号链接会落在 solc allow-paths 之外,子模块绕开了这个问题。
- 共享包保持浏览器安全:webhook 验签用 Web Crypto,`node:crypto` 仅作类型导入,因此整个
  barrel 能打进 Next.js 客户端。
- 撤销 UserOp 走免私钥的 Pimlico 公共 bundler(`public.pimlico.io/v2/84532/rpc`),智能
  账户自付 gas,不用 paymaster。

## 复现

`pnpm vote:2hop`、`pnpm revoke:2hop`、`pnpm orchestrate`、`pnpm proposal --reseed`,每条
命令都会打印自己的链上收据。UI 把它们串起来:`orchestrator serve` 加 `app dev`。
