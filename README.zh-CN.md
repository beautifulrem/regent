<div align="center">

<img src="docs/assets/logo.svg" width="96" alt="Mandate 标志:切面对勾:起笔是一节链环,长臂上嵌着可拔出的锁定销(链上撤销开关)">

# Mandate

**授予 AI 一份受限、可撤销的 DAO 治理投票权,并可随时一键在链上撕掉整条委托链。**

[English](./README.md) · [**简体中文**](./README.zh-CN.md)

[![Live demo](https://img.shields.io/badge/在线演示-vercel-f6851b?logo=vercel&logoColor=white)](https://mandate-app-murex.vercel.app)
[![Base mainnet](https://img.shields.io/badge/Base-主网_8453-0052ff?logo=coinbase&logoColor=white)](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092)
[![ERC-7710](https://img.shields.io/badge/ERC--7710-委托-e2761b)](https://eips.ethereum.org/EIPS/eip-7710)
[![EIP-7702](https://img.shields.io/badge/EIP--7702-原地升级-e2761b)](https://eips.ethereum.org/EIPS/eip-7702)
[![Tests](https://img.shields.io/badge/测试-201_全绿-2ea043)](#-快速开始)
[![License](https://img.shields.io/badge/license-MIT-8b95a7)](./LICENSE)

[在线演示](https://mandate-app-murex.vercel.app) · [链上证据](./EVIDENCE.md) · [架构](./ARCHITECTURE.md) · [提交文案](./SUBMISSION.md)

<img src="docs/assets/hero.gif" width="880" alt="应用回放真实 Base 主网运行:授权 → A2A 再委托 → Venice TEE 委员会 → x402 过路费 → 1Shot 中继 → 投票上链">

<sub>应用内回放的真实 <b>Base 主网</b>运行:三跳 A2A 委托、Venice TEE 委员会、x402 过路费、1Shot 中继;
投票以用户自己的智能账户落账,每个工件都可在 Basescan 验证。</sub>

</div>

---

黑客松参赛作品:**MetaMask Smart Accounts Kit × 1Shot API × Venice AI「Dev Cook-Off」**(截止 2026-06-15)。

## ✨ 亮点

- 🛡️ **常设、仅投票、可撤销的 AI 委托**:一份 ERC-7710 委托让代理可对 DAO 板上*任意*提案投票,**可证明碰不到你的资金**(应用内 Tamper Probe 现场演示越权调用在 enforcer 处 revert)。
- ✂️ **一键终止开关**:`disableDelegation(root)` 级联撤销*整条*代理链;下一次兑付直接在链上 revert。看得见的自托管。
- 🤝 **真实的 A2A 衰减**:用户 → 编排器 → 分析师,每一跳权限可证明地*更窄*(票数上限、有效期、`limitedCalls`),在兑付时由链上验证。
- 🔒 **Venice TEE 委员会**:四个视角 + 一位终裁在密封的 Intel TDX 飞地内决定每一票:有远程证明、有签名,甚至能**开口朗读裁决**(`/audio/speech`)。
- 💸 **x402 按次付费**:代理从受限的 `Erc20TransferAmount` 预算里向数据源支付 0.001 USDC 过路费,链上结算。
- 🚀 **经 1Shot 的零 ETH 主网投票**:三跳链在一笔中继调用内兑付:`castVote` 以**用户自己的智能账户**身份执行,用户的 **EIP-7702 升级搭同一笔调用**,赞助账户付 USDC 费用,中继器垫付 ETH gas。
- 🧾 **每一条都有收据**:以上每个声明都在 [`EVIDENCE.md`](./EVIDENCE.md) 链接到真实交易。

## 🧭 工作原理

1. **授予常设委托**:你的 MetaMask 智能账户签署**一份** ERC-7710 委托:AI 可对这个 DAO 板上的**任意**提案 `castVote`,**仅限投票**(永远碰不到资金),受你设定的**票数上限 + 有效窗口**约束,随时可撤销。(Caveats:`AllowedTargets` + `AllowedMethods`,外加 `LimitedCalls` / `Timestamp`。)
2. **再委托(机制)**:**编排器**智能账户把这份权利衰减后再委托给**分析师**。这条 2-hop ERC-7710 链是委托*可衰减*、*可级联撤销*的根基;它是管道,不是卖点。
3. **决策**:分析师在 **Venice TEE**(Intel TDX)内对**每个**提案做私密分析,决定赞成 / 反对 / 弃权;投出的 `support` 可证明来自模型,不是硬编码。
4. **投票**:分析师从叶到根兑付整条链;DelegationManager 以**你的智能账户**身份执行 `castVote`。一份授权之下,代理一个提案接一个提案地投,直到你的上限。
5. **撤销(高光时刻)**:你按下 **Recall** → 对根委托的一次 `disableDelegation` 级联撤销整条链;下一次兑付在链上 revert。*看得见的自托管。*

> 仓库还附带一条 CLI 路径(`pnpm vote:2hop`),用**同一套**机制对真实的 OpenZeppelin `Governor` 投票,
> 且 scope 进一步收紧到单个**锁死的 `proposalId`**:同一份委托的更窄变体,为 `EVIDENCE.md` 里的
> Governor 链上收据而保留。

### 🪙 零 gas 成员资格:主网实跑为真实 DAO 证明了什么

录制的 Base 主网投票([`0xc486…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092))
把一票拆成**一笔原子中继交易里的两份委托**:这个拆分是产品形态,不是演示技巧:

- **成员只签授权,别的什么都不签。** 投票人的钥匙持有 **0 ETH、0 USDC**;连它的 EIP-7702 升级都搭在同一笔中继调用里。链上记录的投票人就是成员自己的智能账户。
- **DAO 自营费用赞助账户。** 一个国库注资的账户签署*仅限 USDC 转账*的委托(可加单笔 / 累计预算 / 有效期上限)。它只能报销中继费,干不了别的,也拿不到一丝投票权。
- **1Shot 把两者原子地粘合**,并垫付真实 ETH gas:要么投票落地*且*费用付清,要么两者都不发生。

于是 DAO 只需配置一次「投票 gas 账户」,成员从此不再操心 gas。赞助方补贴的是*参与*而非*方向*:它在任何决策存在之前就已签字,无法按投票结果选择性付费。(本仓库中赞助角色由一次性 burner 扮演;生产环境中就是 DAO 的运营国库。)

## 🧱 为什么是 ERC-7710:更弱的方案没有一个能同时给齐四件事

让 AI 投*你的*治理票,要求**四个性质同时成立**,只有受限、可撤销的 ERC-7710 委托能全部满足。每个更弱的选项至少缺一个:

| 方案 | 仅投票(碰不到资金) | 有界(≤N 票、会过期) | 一键链上撤销 | 保持自托管(私钥不外泄) |
|---|:--:|:--:|:--:|:--:|
| 把私钥 / 助记词交给代理 | ❌ 什么都能干 | ❌ | ❌ 只能换钥匙 | ❌ |
| 宽泛 session key / 全账户委托 | ❌ 能动资金 | ⚠️ | ⚠️ | ✅ |
| `delegate()` 投票权(ERC20Votes) | ⚠️ 委托的是*票重给一个地址*,不是*有界的代理任务* | ❌ | ❌ 重新委托 ≠ 撤销一个代理 | ✅ |
| 每票都人工共签 | ✅ | 不适用 | 不适用 | ✅ 但 ❌ 不自治 |
| 托管式「AI 投票」服务 | ✅ | ✅ | ⚠️ 信任运营方 | ❌ |
| **Mandate(ERC-7710 受限 + 可撤销)** | ✅ `AllowedMethods`=castVote · `AllowedTargets`=本板 | ✅ `LimitedCalls` + `Timestamp` caveats | ✅ `disableDelegation` 级联撤销整条链 | ✅ EVM 强制执行,代理无法越权 |

投票代理是 7710 的*理想*用例:你希望它**反复、自治地行动**(常设委托),又要可证明地**只投票、绝不花钱**,还要在它失控的**瞬间拔掉插头**。「重复执行 · 锁定单一方法 · 零资金 · 即时链上撤销」这个形态,正是 ERC-7710 caveats 加 `disableDelegation` 给出的,而裸私钥、session key、token 票重 `delegate()` 都给不出。注意对比:DAO 本来就允许你把投票*权重*委托给一个你信任的地址、由*它*随意投;Mandate 委托的则是**受限、有界、可撤销的代理任务,每个提案在 TEE 里独立决策**:而且你随时可以拔线,代币一动不动。**Tamper Probe** 现场证明反面:让被委托的代理去动资金,兑付在 enforcer 处**链上 revert**。

### ……以及为什么必须是*链*(再委托,而不是 N 份平铺授权)

编排器→分析师这一跳不是装饰:拿掉 `parentDelegation`,产品就塌了:

- **一个签名,轮换的代理队伍。** 你只对编排器签一次。它可以通过再委托(每次更窄)来启用、退役、替换分析师代理(新钥匙、新 TEE 会话),永远不用把你拉回 MetaMask 弹窗。平铺授权意味着每个分析师都要弹一次窗,没完没了。
- **衰减是被强制的,不是被承诺的。** 子委托只能**收窄**父委托。分析师的 scope(本板、仅 `castVote`、更少票数、更短窗口)在兑付时由链上对照父级权限验证;编排器*发不出*超过自己持有的权限。
- **终止开关之所以存在,正因为它是条链。** 每片叶子都通过父哈希挂在根上,所以一次 `disableDelegation(root)` 同时撤销所有下游代理,这就是 Recall。换成 N 份平铺授权,你得追着撤 N 次,而失控的代理还在继续投票。

## 🔭 测试网 vs 主网:两张网,两份职责

<div align="center">

<img src="docs/assets/demo-testnet.gif" width="880" alt="Base Sepolia 上常设委托下的一次真实投票:一次点击、无需新签名:再委托、Venice TEE 委员会、x402 过路费、链上铸票">

<sub>常设委托下的一次 <b>Base Sepolia 真实投票</b>,边跑边录:一次点击、<b>无需新签名</b>:
衰减再委托 → Venice TEE 委员会评议 → x402 过路费结算(收据在终裁处盖章)→ 投票落上 VoteBoard。</sub>

</div>

应用刻意同时搭载两张网,各自回答不同的问题:

| | **Base Sepolia**(默认) | **Base 主网** |
|---|---|---|
| 它是什么 | **可交互的现场演示**:连接 MetaMask、授权、看每一票实跑、随时 Recall | 真实录制运行的**诚实回放**,外加实时 `eth_getCode` 7702 检查;实际执行保持 CLI 端 opt-in(`pnpm 1shot:full --mainnet`) |
| 委托链 | 2-hop:你 → 编排器 → 分析师(常设:任意提案 · ≤N 票 · 有效期) | 3-hop:用户 → 编排器 → 分析师 → **1Shot target**,叶委托锁死为恰好 `castVote(提案, 决议值)` |
| 谁铸票 · 谁付 gas | 分析师兑付整条链,付**测试网 ETH**(免费水龙头) | **1Shot 中继器**兑付,**没有任何人持有 ETH**:burner 用 USDC 赞助费用,1Shot 垫付真实 gas |
| x402 过路费 | 每次查询 1 **mUSDC**(自建 6 位小数 mock),从**你**授权时签的预算中扣 | 0.001 **真 USDC**,由已部署的代理钱包(burner)支付 |
| EIP-7702 | 未使用:Hybrid(ERC-4337)智能账户,所以没有 7702 徽章 | 投票 EOA 在铸票的中继调用内**原地升级**;7702 徽章在那一拍点亮 |
| Recall | ✅ 一键、现场生效(免私钥 UserOp) | 已录制的链上证据;可在 Sepolia 现场复现 |
| 存在的意义 | 评委可以**免费、几分钟内亲手驱动每个机制** | 证明同一套机制在**真金白银的条件下**依然成立 |

同一个产品、直到铸票前同一条代码路径:测试网证明你*摸得到*它,主网证明它是*真的*。
(小技巧:打开 `localhost:3000/?run=<runId>` 可在驾驶舱实时观看任意编排器运行;CLI 验证脚本会打印这个 id。)

## 🌐 已部署合约

**Base Sepolia(84532)**:在线演示:

| | 地址 | 用途 |
|---|---|---|
| **VoteBoard**(多提案板) | [`0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B`](https://sepolia.basescan.org/address/0x4E0CA4E2c45a94bC5974Fab93c3F1Df55F0c3e2B) | **应用演示**:常设仅投票委托在此铸票 |
| VotesToken(ERC20Votes) | [`0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55`](https://sepolia.basescan.org/address/0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55) | CLI / Governor 路径 |
| MandateGovernor(OZ) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://sepolia.basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) | CLI `vote:2hop`(锁死 `proposalId`)路径 |

**Base 主网(8453)**:录制的完整链运行:

| | 地址 | 用途 |
|---|---|---|
| **VoteBoard**(主网) | [`0x0B878c4A25002c14602ea8b25fD0099Ad6CEebeF`](https://basescan.org/address/0x0B878c4A25002c14602ea8b25fD0099Ad6CEebeF) | 应用回放的 1Shot 中继主网投票落点 |

各赛道链上收据见 **[`EVIDENCE.md`](./EVIDENCE.md)**。

## 🏆 黑客松赛道

**一句话定位:**一份*常设、仅投票、可撤销*的 AI 治理委托:代理替你对 DAO 任意提案投票,**可证明碰不到你的资金**,而且你能**一键在链上撕掉整条委托链**。下面的 A2A 再委托、Venice TEE、x402、1Shot 都是把这件事做实的机制(新颖点是治理用例 + 终止开关,不是跳数)。

| 赛道 | 状态 | 证据 |
|---|---|---|
| 通用资格:SAK 智能账户 + ERC-7710 **常设授权**在主流程中 | ✅ live | 授权签名见 [`app/src/lib/wallet.ts`](./app/src/lib/wallet.ts);兑付 tx [`0xc9f4…4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841) |
| **可撤销治理委托 + 撕链(核心)**:Recall 禁用根委托;下一次兑付链上 revert | ✅ live | disable UserOp [`0x1475…c74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b) → `canRedeem` 从 `true` 翻为 `false`;复现 `pnpm revoke:2hop` |
| **Best use of Venice AI**:TEE 模型逐提案决定 `support`;attestation 已验证;主流程用到 **4 个 Venice 端点**(`/models` · `/chat/completions` · `/tee/attestation` · `/audio/speech`:终裁*朗读*裁决) | ✅ live | 决策有区分度(高风险 → 反对,稳健 → 赞成);`x-venice-tee: true`;attestation `verified: true`;`tts-kokoro` 朗读裁决;[EVIDENCE](./EVIDENCE.md#best-venice-ai-live) |
| **Best Agent**:一次授权 → 自治地分析 → 决策 → 投票,一个提案接一个 | ✅ live | `pnpm orchestrate`;链上计票桶 == Venice 决策,兑付 tx [`0xd830…1356`](https://sepolia.basescan.org/tx/0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356) |
| Best A2A coordination:2-hop 衰减再委托(委托背后的机制) | ✅ live | 3 个参与方、2 份签名委托、叶→根兑付;[EVIDENCE](./EVIDENCE.md#checkpoint-a--best-a2a-live-base-sepolia) |
| **Best 1Shot Permissionless Relayer**:一笔主网中继跑完整条链:3-hop A2A 兑付、`castVote` 以**用户 SA** 身份执行、用户的 7702 升级搭同一笔调用、burner **赞助 USDC 费用**(sponsored-fee 模式);**webhook 状态流**(签名 Ed25519 事件 → `POST /webhooks/1shot`,对中继器 JWKS 验签) | ✅ live on Base **mainnet** | castVote tx [`0xc486…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092)(`getVote(proposal, userSA)=2`);x402 toll tx [`0xb244…6174`](https://basescan.org/tx/0xb244c3e4b9c701bea6eb8812caf0b71f6d23ab29c6c3084d69bc421deefd6174);费用 0.01 USDC,所有授权钥匙均持 0 ETH;webhook 接收器 [`server.ts`](./agent/orchestrator/src/server.ts) + 验签器 [`oneshot.ts`](./packages/shared/src/oneshot.ts) |
| **Best x402 + ERC-7710**:自建卖方;代理经受限委托按次付费 | ✅ live | `pnpm x402:demo` → `402 → 受限 Erc20TransferAmount 委托 → 链上结算 → 数据` |

各赛道完整收据:[`EVIDENCE.md`](./EVIDENCE.md)。

## 🚀 快速开始

```bash
pnpm install
pnpm -r build && pnpm -r test          # 201 个测试全绿:108 shared · 58 app · 20 Foundry · 15 agents

# 一次性:生成一次性演示密钥写入 .env + 打印注资清单
pnpm bootstrap:accounts                 # 然后从 Base Sepolia 水龙头给打印出的地址注资

# 现场复现核心机制(Base Sepolia,只花测试网 gas):
pnpm vote:2hop                          # 真实 2-hop 衰减委托 → 在 Governor 上 castVote
pnpm revoke:2hop                        # 撕链:禁用根委托 → 同一条新链兑付 revert
pnpm orchestrate                        # 自治:授权 → Venice TEE 决策 → 真实投票
pnpm proposal --reseed --wait           # 刷新(300 秒的)活跃提案窗口

# 完整 UI 演示:
pnpm --filter @mandate/orchestrator serve     # HTTP 运行 API,:8787
pnpm --filter @mandate/app dev                # Next.js 应用,:3000(连接 MetaMask → Grant → Recall)
```

> 演示钱包必须是被预置投票权的账户:把 `.env` 的 `USER_DEMO_PK` 导入 MetaMask,确保连接的智能账户就是被预置票权的那一个。

## 🗺️ 架构

详见 **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**。简而言之,一个 pnpm monorepo:

```
packages/shared/      委托 (ERC-7710) · Governor/提案辅助 · Venice 客户端 · 1Shot 客户端 · 运行契约 (zod)
packages/contracts/   Foundry:VotesToken (ERC20Votes, 时间戳时钟) + MandateGovernor + 部署/提案脚本
agent/orchestrator/   HTTP 服务:持有根委托、衰减再委托、驱动运行状态机
                      (SSE 运行流 · 1Shot webhook 接收器 · Venice TTS 代理)
agent/analyst/        在 Venice TEE 内决定 support,通过兑付整条链来铸票
agent/mandate-mcp/    MCP 服务器:任何代理都能「描述/请求」一份委托,但请求返回时是未签名的;
                      只有人的 MetaMask 智能账户能授予。不存在自我授权。
app/                  Next.js 15:连接、授权(浏览器签名)、实时权限图、Recall
```

## 🛠️ 技术栈

`@metamask/smart-accounts-kit@1.6.0`(ERC-7710 委托/再委托、EIP-7702、Hybrid 智能账户)·
`viem` · OpenZeppelin Contracts `5.6.1` + Foundry · Venice AI(TEE `e2ee-*` 模型、`/tee/attestation`)·
1Shot 无许可中继器(主网 JSON-RPC · 签名 Ed25519 状态 webhook)· Pimlico 公共 bundler(UserOps)·
Next.js 15 / React 19 · SSE 运行流(EventSource,轮询兜底)· MCP 服务器 ·
Base(Sepolia 84532 · 主网 8453)。

## 🔌 Smart Accounts Kit 调用面:Mandate 实际用到的 SDK

每个委托原语都是真实 SDK,按 `@metamask/smart-accounts-kit@1.6.0` 验证
(见 [`packages/shared/src/delegation.ts`](./packages/shared/src/delegation.ts)、
[`app/src/lib/wallet.ts`](./app/src/lib/wallet.ts)、[`app/src/lib/recall.ts`](./app/src/lib/recall.ts)):

| API | 位置 | 在委托中的角色 |
|---|---|---|
| `toMetaMaskSmartAccount(Implementation.Hybrid)` | `wallet.ts`、agents | 用户 / 编排器 / 分析师的 ERC-4337 智能账户(EIP-7702 Hybrid) |
| `getSmartAccountsEnvironment(chainId)` | `delegation.ts` | 按链解析 `DelegationManager` + enforcer 地址 |
| `createDelegation({ scope, to, from, environment, salt })` | `delegation.ts` | **根**授权 |
| `createDelegation({ …, parentDelegation })` | `delegation.ts` | **衰减再委托**(编排器 → 分析师),父级链接 |
| `ScopeType.FunctionCall`(`targets`、`selectors`) | `delegation.ts` | 把授权绑定到本板的 `castVote` → `AllowedTargets` + `AllowedMethods` enforcers(「动资金」就是被这个挡住的) |
| `createCaveatBuilder(env).addCaveat('timestamp' \| 'limitedCalls')` | `delegation.ts` | 常设边界 → `Timestamp`(过期)+ `LimitedCalls`(≤ 票数上限)enforcers |
| `account.signDelegation({ delegation })` | `wallet.ts`、编排器 | 对每份委托(根 + 再委托)的 EIP-712 签名 |
| `createExecution({ target, callData })` + `ExecutionMode.SingleDefault` | `delegation.ts` | 链所授权的 `castVote` 动作 |
| `contracts.DelegationManager.encode.redeemDelegations(...)` | `delegation.ts` | 分析师**叶→根**兑付整条链 → 以*用户智能账户*身份执行 `castVote` |
| `contracts.DelegationManager.encode.disableDelegation(...)` | `delegation.ts` | **终止开关**:禁用根委托即级联撤销整条链 |
| `createBundlerClient().sendUserOperation(...)`(viem AA、Pimlico) | `recall.ts` | Recall 是用户智能账户发出的免私钥 UserOp |

用到的 enforcers:`AllowedTargetsEnforcer` · `AllowedMethodsEnforcer` · `TimestampEnforcer` ·
`LimitedCallsEnforcer`(单提案 CLI 路径另加 `AllowedCalldataEnforcer`,锁死 `proposalId`)。
解码后的 scope 在应用的 **Permission X-Ray** 中实时渲染。

## ⚖️ 诚实的局限

是有记录的取舍,不是暗藏的桩:

- **演示级治理范围。** 应用的常设委托跑在自建 `VoteBoard` 上;OpenZeppelin `Governor` 路径是 CLI 复现(`pnpm vote:2hop`):同一套 SAK 原语,scope 收紧到一个锁死的 `proposalId`。`votingPeriod` 为 **300 秒**,评委几分钟就能复现完整的授权 → 投票 → 撤销周期,不用等几天。
- **mUSDC 是 mock。** x402 过路费用我们在 Base Sepolia 上的 6 位小数 `MockUSDC` 结算。唯一的真 USDC 资金腿是 1Shot 主网中继费(0.01 USDC)。
- **自建 x402 卖方。** 卖方自己验证并兑付受限的 ERC-7710 委托;不经 Coinbase 的 x402 facilitator 结算。
- **Venice 推理是预付费的。** x402 支付的是提案数据过路费;Venice TEE 调用本身计费在预付费 API key 上。
- **应用的主网面板是诚实回放。** 它回放的是固定的真实 Base 主网工件(完整链 castVote + x402 toll 交易,链接到 Basescan),并带有真正**实时**的 `eth_getCode` 7702 检查;实际主网执行保持 CLI 端 opt-in(`pnpm 1shot:full --mainnet`,`--estimate` 免费干跑报价)。
- 主网 Governor 与每个提案都带 `HACKATHON DEMO - NO REAL VALUE` 标记和 0 国库。

## 🔐 安全 / 边界

只用一次性密钥;机密都在 `.env`(gitignored)。测试网优先。任何主网动作(1Shot 腿,约 $5 USDC)都是
opt-in 且签名前现场报价。主网 Governor + 每个提案都带 `HACKATHON DEMO - NO REAL VALUE` 免责声明。

## 📄 许可证

[MIT](./LICENSE)
