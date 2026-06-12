<div align="center">

<img src="docs/assets/logo.png" width="96" alt="Regent 标志:切面对勾,起笔是一节链环,长臂上嵌着可拔出的锁定销">

# Regent

一份可撤销的 AI 投票摄政权。主权始终在你:授权范围受限、票数有界,整条委托链随时
可以一键在链上收回。

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

[![Live demo](https://img.shields.io/badge/在线演示-vercel-f6851b?logo=vercel&logoColor=white)](https://mandate-app-murex.vercel.app)
[![Base mainnet](https://img.shields.io/badge/Base-主网_8453-0052ff?logo=coinbase&logoColor=white)](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092)
[![ERC-7710](https://img.shields.io/badge/ERC--7710-委托-e2761b)](https://eips.ethereum.org/EIPS/eip-7710)
[![EIP-7702](https://img.shields.io/badge/EIP--7702-原地升级-e2761b)](https://eips.ethereum.org/EIPS/eip-7702)
[![Tests](https://img.shields.io/badge/测试-201_全绿-2ea043)](#-快速开始)
[![License](https://img.shields.io/badge/license-MIT-8b95a7)](./LICENSE)

[在线演示](https://mandate-app-murex.vercel.app) · [链上证据](./EVIDENCE.zh-CN.md) · [架构](./ARCHITECTURE.zh-CN.md) · [提交文案](./SUBMISSION.md)

<img src="docs/assets/hero.gif" width="880" alt="应用回放真实的 Base 主网运行:授权、再委托、Venice TEE 委员会、x402 过路费、1Shot 中继、投票上链">

<sub>应用内回放的真实 Base 主网运行:三跳委托链、Venice TEE 委员会、x402 过路费、1Shot 中继。
投票以用户自己的智能账户落账,每个环节都能在 Basescan 上查证。</sub>

</div>

---

Regent 让你把 DAO 投票权交给一个 AI,而不交出其他任何东西。一次 MetaMask 签名生成一份
ERC-7710 委托:它只能在指定的投票板上调用 `castVote`,票数上限和有效期由你设定,除此之外
什么也做不了。此后代理自主地一个提案接一个提案投票。哪天你不再信任它,在链上发一笔
`disableDelegation` 即可收回整条委托链,它的下一次投票尝试会直接 revert。

本项目为 MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook-Off 参赛作品
(截止 2026-06-15)。

## ✨ 它包含什么

- 一份常设、仅投票的委托:一次授权覆盖板上任意提案,由 `LimitedCalls` 和 `Timestamp`
  两个 caveat 约束。代理动不了资金;应用内的 Tamper Probe 会现场演示越权调用在 enforcer
  处被拒。
- 一键终止开关:`disableDelegation(root)` 级联撤销所有下游代理,下一次兑付在链上 revert。
- 代理间衰减:用户、编排器、分析师三级,每一跳权限严格更窄,在兑付时由链上校验。
- Venice TEE 委员会:四个分析视角加一位终裁,在密封的 Intel TDX 飞地内决定每一票,带远程
  证明,还能通过 `/audio/speech` 朗读裁决。
- x402 按次付费:代理用一份受限的 `Erc20TransferAmount` 预算购买提案数据,每次 0.001
  USDC,链上结算。
- 经 1Shot 无许可中继的主网零 ETH 投票:三跳链在一笔中继调用里兑付,`castVote` 以用户
  智能账户身份执行,用户的 EIP-7702 升级搭同一笔调用,赞助账户付 USDC 费用,中继器垫付
  gas。
- 以上每一条都有收据,逐项链接在 [EVIDENCE.zh-CN.md](./EVIDENCE.zh-CN.md)。

## 🧭 工作原理

1. 授权。你的 MetaMask 智能账户签一份 ERC-7710 委托:AI 可以对板上任意提案 `castVote`,
   票数和有效期按你设定。范围由 `AllowedTargets` 与 `AllowedMethods` 强制,边界由
   `LimitedCalls` 与 `Timestamp` 强制。
2. 再委托。编排器智能账户以更窄的范围把权利再委托给分析师(`parentDelegation`)。有了这
   一跳,委托才可衰减、可级联撤销。
3. 决策。分析师在 Venice TEE(Intel TDX)内阅读每个提案,给出赞成、反对或弃权。投出的
   `support` 来自模型,链上计票桶和 TEE 的结论一致。
4. 投票。分析师从叶到根兑付整条链,DelegationManager 以你的智能账户身份执行 `castVote`。
   一份授权之下,代理可以持续投票,直到触及你设的上限。
5. 撤销。对根委托发一次 `disableDelegation`,整条链作废,下一次兑付在链上 revert,应用里
   能看到全过程。

仓库另有一条 CLI 路径(`pnpm vote:2hop`),用同一套机制对真实的 OpenZeppelin `Governor`
投票,范围进一步收紧到锁死的单个 `proposalId`,用于产出 `EVIDENCE` 里的 Governor 链上
收据。

### 🪙 零 gas 成员资格

录制的主网投票
([`0xc486…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092))
把一票拆成一笔原子中继交易里的两份委托。这个拆分正对应 DAO 在生产环境的用法:

- 成员只签授权。投票钥匙不持有 ETH 也不持有 USDC,连 EIP-7702 升级都搭在中继调用里;
  链上记录的投票人就是成员自己的智能账户。
- DAO 自营付费账户:一个国库注资的账户,其委托只能向中继器的收费地址转 USDC,可设单笔、
  累计、有效期三重上限,且不获得任何投票权。
- 1Shot 将两者原子地合并执行,并垫付 ETH gas。要么投票落地且费用付清,要么都不发生。

DAO 配置一次投票 gas 账户,此后成员无需持有任何 gas。赞助方补贴的是参与而不是立场:它在
任何决策产生之前就已签字,无法按投票结果选择性付费。本仓库中这个角色由一次性 burner 扮演,
生产环境对应 DAO 的运营国库。

## 🧱 为什么是 ERC-7710

让 AI 投你的治理票,四个性质缺一不可,而更弱的方案各有短板:

| 方案 | 仅投票 | 有界 | 链上可撤销 | 保持自托管 |
|---|:--:|:--:|:--:|:--:|
| 把私钥交给代理 | 否 | 否 | 只能换钥匙 | 否 |
| 宽泛 session key | 否,能动资金 | 部分 | 部分 | 是 |
| `delegate()` 票权(ERC20Votes) | 委托的是票重,不是有界任务 | 否 | 重新委托不等于撤销 | 是 |
| 每票人工共签 | 是 | 不适用 | 不适用 | 是,但不自治 |
| 托管式投票服务 | 是 | 是 | 取决于运营方 | 否 |
| Regent(受限可撤销的 ERC-7710) | `AllowedMethods` = castVote,`AllowedTargets` = 本板 | `LimitedCalls` + `Timestamp` | `disableDelegation` 级联撤销 | 范围由 EVM 强制 |

DAO 本来就支持把投票权重委托给一个地址,由它随意行使。Regent 委托的是一项有界任务:在
这个板上投票,至多 N 次,截至某日,方向由 TEE 逐提案决定,且整件事可以在不动代币的前提
下随时收回。Tamper Probe 现场演示反例:让代理去转账,兑付在 enforcer 处 revert。

### 为什么是链而不是平铺授权

去掉 `parentDelegation`,产品就不成立:

- 一次签名,轮换的代理团队。你只对编排器签一次,它可以通过再委托来启用、替换分析师,
  每次范围更窄,而你不需要再碰 MetaMask。平铺授权意味着每换一个分析师弹一次窗。
- 衰减在兑付时被强制。子委托只能收窄父委托,DelegationManager 在链上对照父级权限校验,
  编排器发不出超过自己持有的权限。
- 终止开关依赖链式结构:每片叶子都通过父哈希挂在根上,一次 `disableDelegation(root)`
  同时撤销所有下游代理。换成 N 份平铺授权,你要逐一追撤,失控的代理在此期间还能投票。

## 🔭 测试网与主网

<div align="center">

<img src="docs/assets/demo-testnet.gif" width="880" alt="Base Sepolia 上常设委托下的一次真实投票:一次点击,无需新签名">

<sub>常设委托下的一次 Base Sepolia 真实投票,边跑边录。一次点击、无需新签名:再委托、
Venice 委员会评议、x402 过路费结算、投票落上 VoteBoard。</sub>

</div>

应用同时搭载两张网,各自回答不同的问题。

| | Base Sepolia(默认) | Base 主网 |
|---|---|---|
| 性质 | 可交互的现场演示:连接 MetaMask、授权、看每票实跑、随时撤销 | 真实录制运行的回放,外加实时的 `eth_getCode` 7702 检查;实际执行通过 CLI 进行(`pnpm 1shot:full --mainnet`) |
| 委托链 | 两跳:你、编排器、分析师(常设:任意提案、票数上限、有效期) | 三跳,终点是 1Shot target,叶委托锁死为恰好 `castVote(提案, 决议值)` |
| 谁铸票、谁付 gas | 分析师兑付整条链,gas 用水龙头领的测试网 ETH | 1Shot 中继器兑付。没有人持有 ETH:burner 用 USDC 赞助费用,1Shot 垫付 gas |
| x402 过路费 | 每次查询 1 mUSDC(6 位小数的 mock),从你授权时签的预算中扣 | 0.001 真 USDC,由已部署的代理钱包支付 |
| EIP-7702 | 未使用;智能账户是 Hybrid(ERC-4337),所以没有 7702 徽章 | 投票 EOA 在铸票的中继调用内原地升级,7702 徽章在那一拍点亮 |
| 撤销 | 一键、现场生效(免私钥 UserOp) | 已录制的链上证据,可在 Sepolia 现场复现 |
| 存在的意义 | 评委可以免费、几分钟内亲手驱动每个机制 | 展示同一套机制在真实资金下的运行 |

同一个产品,直到铸票前是同一条代码路径:测试网用来亲手验证机制,主网运行展示它在真实资金下
的表现。提示:打开
`localhost:3000/?run=<runId>` 可以在驾驶舱实时观看任意编排器运行,CLI 验证脚本会打印这个
id。

## 🌐 已部署合约

Base Sepolia(84532),在线演示:

| | 地址 | 用途 |
|---|---|---|
| VoteBoard(多提案板) | [`0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B`](https://sepolia.basescan.org/address/0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B) | 应用演示,常设仅投票委托在此铸票 |
| VotesToken(ERC20Votes) | [`0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55`](https://sepolia.basescan.org/address/0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55) | CLI / Governor 路径 |
| MandateGovernor(OZ) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://sepolia.basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) | CLI `vote:2hop` 路径(锁死 `proposalId`) |

Base 主网(8453),录制的完整链运行:

| | 地址 | 用途 |
|---|---|---|
| VoteBoard(主网) | [`0x0B878c4A25002c14602ea8b25fD0099Ad6CEebeF`](https://basescan.org/address/0x0B878c4A25002c14602ea8b25fD0099Ad6CEebeF) | 应用回放的 1Shot 中继主网投票落点 |

各赛道收据见 [EVIDENCE.zh-CN.md](./EVIDENCE.zh-CN.md)。

## 🏆 黑客松赛道

一句话概括:一份常设、仅投票、可撤销的 AI 治理委托。代理替你对 DAO 任意提案投票,碰不到
你的资金,你随时能在链上收回整条委托链。A2A 再委托、Venice TEE、x402 和 1Shot 是支撑这件
事的机制。

| 赛道 | 状态 | 证据 |
|---|---|---|
| 通用资格:SAK 智能账户 + ERC-7710 常设授权在主流程中 | live | 授权签名见 [`app/src/lib/wallet.ts`](./app/src/lib/wallet.ts);兑付 tx [`0xc9f4…4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841) |
| 可撤销委托 + 一键断链(核心):撤销禁用根委托,下一次兑付 revert | live | disable UserOp [`0x1475…c74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b);`canRedeem` 由 true 翻为 false;复现 `pnpm revoke:2hop` |
| Best use of Venice AI:TEE 模型逐提案决定 `support`;主流程用到四个 Venice 端点(`/models`、`/chat/completions`、`/tee/attestation`、`/audio/speech`,终裁朗读裁决) | live | 决策有区分度(高风险提案投反对,稳健提案投赞成);`x-venice-tee: true`;attestation 已验证;`tts-kokoro` 朗读;见 [EVIDENCE](./EVIDENCE.zh-CN.md) |
| Best Agent:一次授权,自主分析、决策、投票,一个提案接一个 | live | `pnpm orchestrate`;链上计票桶与 Venice 决策一致;兑付 tx [`0xd830…1356`](https://sepolia.basescan.org/tx/0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356) |
| Best A2A coordination:两跳衰减再委托 | live | 三个参与方、两份签名委托、叶到根兑付;见 [EVIDENCE](./EVIDENCE.zh-CN.md) |
| Best 1Shot Permissionless Relayer:一笔主网中继跑完整条链。三跳链兑付,`castVote` 以用户 SA 身份执行,用户的 7702 升级搭同一笔调用,burner 赞助 USDC 费用;另有签名 webhook 状态流(Ed25519 事件,对中继器 JWKS 验签) | live(Base 主网) | castVote tx [`0xc486…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092)(`getVote(proposal, userSA) = 2`);x402 toll tx [`0xb244…6174`](https://basescan.org/tx/0xb244c3e4b9c701bea6eb8812caf0b71f6d23ab29c6c3084d69bc421deefd6174);费用 0.01 USDC,所有授权钥匙均持 0 ETH;webhook 接收器 [`server.ts`](./agent/orchestrator/src/server.ts),验签器 [`oneshot.ts`](./packages/shared/src/oneshot.ts) |
| Best x402 + ERC-7710:自建卖方,代理经受限委托按次付费 | live | `pnpm x402:demo`:返回 402,签受限 `Erc20TransferAmount` 委托,链上结算,拿到数据 |

## 🚀 快速开始

```bash
pnpm install
pnpm -r build && pnpm -r test          # 201 个测试:108 shared、58 app、20 Foundry、15 agents

# 一次性:生成一次性演示密钥写入 .env,并打印注资清单
pnpm bootstrap:accounts                 # 然后从 Base Sepolia 水龙头给打印出的地址注资

# 在 Base Sepolia 上复现核心机制(只花测试网 gas):
pnpm vote:2hop                          # 两跳衰减委托,在 Governor 上 castVote
pnpm revoke:2hop                        # 断链:禁用根委托,同一条新链兑付 revert
pnpm orchestrate                        # 自治:授权、Venice TEE 决策、真实投票
pnpm proposal --reseed --wait           # 刷新 300 秒的活跃提案窗口

# 完整 UI 演示(两个终端):
pnpm --filter @mandate/orchestrator serve     # 运行 API,:8787
pnpm --filter @mandate/app dev                # Next.js,:3000;连接 MetaMask、授权、撤销
```

演示钱包必须是预置了票权的账户:把 `.env` 中的 `USER_DEMO_PK` 导入 MetaMask,确保连接的
智能账户持有投票权。

## 🗺️ 架构

详见 [ARCHITECTURE.zh-CN.md](./ARCHITECTURE.zh-CN.md)([English](./ARCHITECTURE.md))。
简而言之是一个 pnpm monorepo。代码标识符保留项目原工作名:`@mandate/*` 包名与已部署的
`MandateGovernor` 合约早于改名 Regent。

```
packages/shared/      委托(ERC-7710)、Governor 与提案辅助、Venice 客户端、
                      1Shot 客户端、zod 运行契约
packages/contracts/   Foundry:VotesToken(ERC20Votes,时间戳时钟)、MandateGovernor、
                      部署与提案脚本
agent/orchestrator/   HTTP 服务:持有根委托、收窄后再委托、驱动运行状态机
                      (SSE 流、1Shot webhook 接收器、Venice TTS 代理)
agent/analyst/        在 Venice TEE 内决定 support,兑付整条链来铸票
agent/mandate-mcp/    MCP 服务器:任何代理都能描述或请求一份委托,但请求返回时未签名,
                      只有人的 MetaMask 账户能授予
app/                  Next.js 15:连接、浏览器内授权、实时权限图、撤销
```

## 🛠️ 技术栈

`@metamask/smart-accounts-kit@1.6.0`(ERC-7710 委托与再委托、EIP-7702、Hybrid 智能账户)、
`viem`、OpenZeppelin Contracts 5.6.1 与 Foundry、Venice AI(TEE `e2ee-*` 模型、
`/tee/attestation`)、1Shot 无许可中继器(主网 JSON-RPC、签名 Ed25519 状态 webhook)、
Pimlico 公共 bundler(UserOps)、Next.js 15 / React 19、SSE 运行流(带轮询兜底)、
MCP 服务器、Base(Sepolia 84532、主网 8453)。

## 🔌 Smart Accounts Kit 调用面

每个委托原语都来自真实 SDK,按 `@metamask/smart-accounts-kit@1.6.0` 验证。参见
[`packages/shared/src/delegation.ts`](./packages/shared/src/delegation.ts)、
[`app/src/lib/wallet.ts`](./app/src/lib/wallet.ts) 与
[`app/src/lib/recall.ts`](./app/src/lib/recall.ts)。

| API | 位置 | 角色 |
|---|---|---|
| `toMetaMaskSmartAccount(Implementation.Hybrid)` | `wallet.ts`、agents | 用户、编排器、分析师的 ERC-4337 智能账户 |
| `getSmartAccountsEnvironment(chainId)` | `delegation.ts` | 按链解析 DelegationManager 与 enforcer 地址 |
| `createDelegation({ scope, to, from, environment, salt })` | `delegation.ts` | 根授权 |
| `createDelegation({ …, parentDelegation })` | `delegation.ts` | 衰减再委托,父级链接 |
| `ScopeType.FunctionCall`(`targets`、`selectors`) | `delegation.ts` | 把授权钉在本板的 `castVote` 上,资金转移因此被挡 |
| `createCaveatBuilder(env).addCaveat('timestamp' \| 'limitedCalls')` | `delegation.ts` | 常设边界:有效期与票数上限 |
| `account.signDelegation({ delegation })` | `wallet.ts`、编排器 | 每份委托的 EIP-712 签名 |
| `createExecution({ target, callData })` + `ExecutionMode.SingleDefault` | `delegation.ts` | 链所授权的 `castVote` 动作 |
| `contracts.DelegationManager.encode.redeemDelegations(...)` | `delegation.ts` | 分析师叶到根兑付,`castVote` 以用户智能账户身份执行 |
| `contracts.DelegationManager.encode.disableDelegation(...)` | `delegation.ts` | 终止开关:禁用根委托即级联撤销整条链 |
| `createBundlerClient().sendUserOperation(...)`(viem AA、Pimlico) | `recall.ts` | 撤销作为用户智能账户的免私钥 UserOp 发出 |

用到的 enforcer:`AllowedTargetsEnforcer`、`AllowedMethodsEnforcer`、`TimestampEnforcer`、
`LimitedCallsEnforcer`,单提案 CLI 路径另加 `AllowedCalldataEnforcer`。解码后的授权范围在
应用的 Permission X-Ray 中实时展示。

## ⚖️ 已知局限

- 应用的常设委托跑在自建 `VoteBoard` 上;OpenZeppelin `Governor` 路径是 CLI 复现
  (`pnpm vote:2hop`),同一套原语,范围收紧到锁死的单个 `proposalId`。`votingPeriod`
  设为 300 秒,评委几分钟内即可复现完整的授权、投票、撤销周期。
- mUSDC 是 mock。x402 过路费用自部署的 6 位小数代币在 Base Sepolia 结算;唯一的真 USDC
  环节是 1Shot 主网中继费(0.01 USDC)。
- x402 卖方为自建实现,自行验证并兑付受限委托,未经 Coinbase facilitator 结算。
- Venice 推理走预付费 API key;x402 支付的是提案数据,不是推理本身。
- 应用的主网面板回放录制运行的固定工件(castVote 与 toll 交易,链接到 Basescan),并附带
  实时的 `eth_getCode` 7702 检查。实际主网执行通过 CLI 进行(`pnpm 1shot:full --mainnet`,
  `--estimate` 可免费干跑报价)。
- 主网 Governor 与每个提案都带 `HACKATHON DEMO - NO REAL VALUE` 标记,国库为零。

## 🔐 安全

只用一次性密钥;机密都在 `.env`,已 gitignore。测试网优先:任何主网动作都先现场报价、
明确确认后再签名。网络:Base Sepolia 84532,Base 主网 8453。

## 📄 许可证

[MIT](./LICENSE)
