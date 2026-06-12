# Regent:分赛道证据地图

[English](./EVIDENCE.md) · [**简体中文**](./EVIDENCE.zh-CN.md)

各黑客松赛道的链上收据。测试网工件在 Base Sepolia(chainId 84532,
`https://sepolia.basescan.org`);1Shot 环节在 Base 主网(8453,`https://basescan.org`)。

> 两条流程,同一套原语。交互式应用在 VoteBoard 上行使一份常设、仅投票、可撤销的委托
> (任意提案,受票数与时间约束)。下方收据来自 CLI/Governor 复现(`pnpm vote:2hop` 等),
> 它用同一套 MetaMask Smart Accounts 原语对真实的 OpenZeppelin `Governor` 投票,范围收紧
> 到锁死的单个 `proposalId`。

## 已部署(Base Sepolia)

| 项目 | 地址 |
|---|---|
| VotesToken(ERC20Votes,时间戳时钟) | [`0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55`](https://sepolia.basescan.org/address/0x56FC5fA996f9D0e15e40fE7D738C6cA055d1Ad55) |
| MandateGovernor(delay 60s,period 300s) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://sepolia.basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) |
| 用户智能账户(根委托人、投票人) | [`0xEb35F7b58EB654383092569Adc527220A7E89383`](https://sepolia.basescan.org/address/0xEb35F7b58EB654383092569Adc527220A7E89383) |
| 编排器智能账户 | [`0x2caa4D4583015F418F2d962e2E38F7D5E724d16e`](https://sepolia.basescan.org/address/0x2caa4D4583015F418F2d962e2E38F7D5E724d16e) |
| 分析师 EOA(叶委托受托人) | [`0x31f898937F29c089b748750b00668Cf8ED5a5F28`](https://sepolia.basescan.org/address/0x31f898937F29c089b748750b00668Cf8ED5a5F28) |
| DelegationManager(MetaMask SAK) | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |

## 赛道总览

| # | 赛道 | 状态 | 证据 |
|---|---|---|---|
| 1 | 通用资格:SAK 智能账户 + ERC-7710 在主流程中 | 完成 | 下方兑付交易通过 `@metamask/smart-accounts-kit` 投出链上一票 |
| 2 | Best A2A coordination:两跳衰减再委托,链上兑付 | 完成 | 下方投票与撤销交易;三个参与方、两份签名委托、叶到根兑付 |
| 3 | Best 1Shot relayer:一笔主网中继跑完整条链(三跳兑付、7702 随调用升级、赞助 USDC 费用) | 完成(主网) | 下方主网小节的 castVote 与 toll 交易 |
| 4 | Best Venice AI:TEE 模型决定 `support`,attestation 已验证 | 完成 | 决策有区分度(高风险投反对,稳健投赞成);`x-venice-tee: true`;attestation 验证通过 |
| 5 | x402 + ERC-7710:自建卖方按次收费,买方经受限委托付费 | 完成 | 402,签 `Erc20TransferAmount` 受限委托,链上结算,拿到数据(`pnpm x402:demo`) |
| 6 | Best Agent:一次授权后自主分析、决策、投票 | 完成 | `pnpm orchestrate`;链上计票桶与决策一致 |
| 7 | 一键断链:撤销禁用根委托,下一次兑付 revert | 完成 | 下方 disable UserOp 与因果明确的 revert |
| 8 | 合规:开源仓库、地址、视频 | 视频待录 | 本仓库与本文件 |

## A2A 再委托(实跑,Base Sepolia)

- 两跳衰减、终点是 `castVote`(分析师兑付整条链,DelegationManager 以用户 SA 身份执行):
  [`0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841`](https://sepolia.basescan.org/tx/0xc9f49a3ba3020deb40cdb2fc27c9247caabf8333adea15ce6edf6d4ff2ef4841),
  之后 `hasVoted(userSA) = true`,`proposalVotes.For = 1000e18`。复现:`pnpm vote:2hop`。
- 因果明确的级联撤销(用户 SA 通过 UserOp 禁用根委托;同一条全新、未投票的链随后在模拟中
  revert):disable UserOp
  [`0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b`](https://sepolia.basescan.org/tx/0x147517e3b3120bb2bc60ee98a0de2017b4d4412ad9cbf58d06954a8e4d4dc74b),
  `canRedeem` 由 true 翻为 false。复现:`pnpm revoke:2hop`。

> 每次演示都会重新播种新提案(votingPeriod 300 秒),所以提案 id 与具体交易哈希逐次不同;
> 上面的交易是一次实跑留下的收据。

## Venice AI(实跑)

- TEE 模型决定 `support`,没有任何硬编码。在 `e2ee-qwen3-5-122b-a10b`(Phala / NEAR-AI,
  Intel TDX)上,一个匿名、未审计的高风险提案被投了反对(support 0),一个带审计、里程碑
  和追回条款的拨款被投了赞成(support 1)。每次补全都返回 `x-venice-tee: true`。
- Attestation:`GET /tee/attestation?model=…` 返回 `verified: true`,
  `server_verification.tdx` 全部有效,飞地签名地址
  `0x6525e128afcffebf7eed05d485d7be983cdae934`,新鲜 nonce,Intel TDX quote 与 NVIDIA
  Hopper 证据。可经 `analyzeProposal` / `fetchAttestation` 复现。

## 1Shot 主网中继(实跑)

同一套 Governor 与代币部署在 Base 主网,代币名带有
`HACKATHON DEMO - NO REAL VALUE / 0 TREASURY` 标记。

| 项目 | 值 |
|---|---|
| MandateGovernor(主网) | [`0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5`](https://basescan.org/address/0x1BC00C1c14bE7eaC46237C4bcBD0530bb9655FD5) |
| 用户智能账户(根委托人,本次运行中 7702 升级) | [`0x578215EB18099f48978dFF14a5d03a74242a0dA3`](https://basescan.org/address/0x578215EB18099f48978dFF14a5d03a74242a0dA3) |
| 编排器(衰减再委托人) | [`0x82FBd69A5b1643196374F13Fc015935B9e3F9B0B`](https://basescan.org/address/0x82FBd69A5b1643196374F13Fc015935B9e3F9B0B) |
| 分析师(叶委托受托人,x402 卖方) | [`0x31f898937F29c089b748750b00668Cf8ED5a5F28`](https://basescan.org/address/0x31f898937F29c089b748750b00668Cf8ED5a5F28) |
| Burner(7702 中继赞助方) | [`0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991`](https://basescan.org/address/0x83cA7AF35e85Db90938391290Cdb6A3e6FfaA991) |

一笔主网运行跑完整条链(2026-06-12)。复现:先 `pnpm 1shot:full --mainnet --estimate`
免费报价,再 `pnpm 1shot:full --mainnet`:

- A2A:三跳衰减链。用户 SA 到编排器(根:本板、至多 3 票、7 天有效期),编排器到
  分析师(追加 `limitedCalls 1`),分析师到 1Shot target,叶委托锁死为恰好
  `castVote(proposalId, decidedSupport)`。哈希:根 `0x206a9adc…`、中 `0x669df36a…`、
  叶 `0x42233d2f…`。
- TEE:Venice 委员会(四个视角加一位终裁)在叶委托签名之前裁定了赞成。attestation 验证
  通过,飞地 nonce `83fbc5a9…`。
- x402:代理的 USDC 预算在链上支付了分析师 0.001 USDC 的数据费,交易
  [`0xb244c3e4…6174`](https://basescan.org/tx/0xb244c3e4b9c701bea6eb8812caf0b71f6d23ab29c6c3084d69bc421deefd6174)。
- 1Shot:中继器兑付三跳链。`castVote` 以用户 SA 身份执行,用户的 EIP-7702 升级搭载同一笔
  中继调用,burner 赞助 USDC 费用。castVote 交易
  [`0xc48632ca…5092`](https://basescan.org/tx/0xc48632ca8bc72db8c68eabd3e7dde90c5eae37b6afef60e70b1e686a8f8b5092)
  (区块 47228284)。事后链上:`getVote(proposalId, userSA) = 2`(已投,support 1),用户
  代码为 `0xef0100` 加实现地址,0.01 USDC 费用由赞助方支付。应用回放的就是这次运行。

更早的最小验证(2026-06-09)是一笔仅 burner 的 castVote
[`0x3b5448aa…6a07`](https://basescan.org/tx/0x3b5448aaac605e1416be48e238c12a755532b762d392dd70f4025e5a152a6a07),
已被上面的完整链运行取代。单腿复现:`pnpm 1shot:vote`。

## x402 + ERC-7710 按次付费(实跑,Base Sepolia)

自建的 HTTP 数据卖方以 `erc7710` scheme 返回 `402 Payment Required`。买方(持有 MVOTE
余额的智能账户)签一份受限 `Erc20TransferAmount` 委托,带 `X-PAYMENT` 头重试;卖方在链上
兑付该委托完成结算(1 MVOTE 从买方转到卖方),然后返回数据。这与 Venice 推理是分开的,
后者由 API key 预付。复现:`pnpm x402:demo`。

## 自治代理闭环(实跑)

`pnpm orchestrate`:一次签名授权之后,编排器再委托,分析师在 Venice TEE 内决策、兑付链、
铸票。投出的 `support` 就是 Venice 的结论;证明方式是看哪个计票桶收到票。例如 Venice 投了
赞成,`proposalVotes.For` 变为 `1000e18`,兑付交易
[`0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356`](https://sepolia.basescan.org/tx/0xd8303a62b68b21e8f9578e054061de64fcab5880084973feb30026326b6c1356)。
