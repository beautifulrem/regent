// Bilingual UI strings (English / 中文). `type Dict = typeof en` makes the
// TypeScript compiler enforce that zh has exactly the same shape, and the
// i18n.test.ts parity test guards it at runtime too. Code commands, addresses,
// hashes and on-chain vote values (For/Against) stay literal in the JSX.

export type Lang = 'en' | 'zh';

export const LANG_KEY = 'mandate-lang';
export const LANGS: Lang[] = ['en', 'zh'];

const en = {
  themeLabels: { system: 'System', light: 'Light', dark: 'Dark' },

  heroLine1: 'Let an AI vote for you —',
  heroLine2: 'on a leash you can cut anytime.',
  heroSub:
    'You grant an AI agent a STANDING, vote-only permission: it can vote ANY proposal on this DAO for you (never touch your funds), bounded by votes + time. Change your mind? Sever the whole chain in one click — live, on-chain.',

  heroEyebrow: 'Revocable agent governance',
  kpi: { caveats: 'Vote budget', fee: 'Mainnet relay', networks: 'Networks' },
  scorecard: {
    title: 'Track scorecard — every capability, on screen',
    items: [
      { name: 'MetaMask Smart Accounts', proof: 'ERC-4337 Hybrid account signs the delegation' },
      { name: 'ERC-7710 scoped permission', proof: 'Permission X-Ray + live on-chain tamper probe' },
      { name: 'Best A2A · re-delegation', proof: 'Orchestrator attenuates, then re-delegates to the analyst' },
      { name: 'Venice AI · TEE', proof: 'Sealed-enclave reasoning + attestation + signature' },
      { name: 'x402 pay-per-query', proof: 'Scoped ERC-7710 toll + live balanceOf' },
      { name: '1Shot · mainnet 7710 + 7702', proof: 'Permissionless relay + live 7702 upgrade proof' },
    ],
  },
  tally: {
    title: 'DAO proposal · live tally',
    track: 'multi-voter DAO',
    for: 'For',
    against: 'Against',
    abstain: 'Abstain',
    voters: 'voters',
    you: 'You',
    pending: 'VoteBoard not deployed yet — showing the seeded delegates',
  },
  feed: { live: 'Live proposals', voting: 'Voting now', open: 'open' },

  how: [
    { ic: '🎟️', h: '1 · Hand over a locked permission', p: "You sign one permission: an AI may cast this one vote — and nothing else. It can't touch your funds or vote elsewhere." },
    { ic: '🔒', h: '2 · AI decides privately, then votes', p: 'The AI reads the proposal inside a sealed secure enclave (TEE) and casts your vote on-chain — provably untampered.' },
    { ic: '✂️', h: '3 · Cut it loose anytime', p: 'One click severs the chain on-chain. The AI instantly loses all power to vote — watch it die.' },
  ],

  walletLabel: 'Your wallet · root delegator',
  notConnected: 'not connected',
  smartAccount: 'MetaMask smart account',
  connect: 'Connect MetaMask',
  saHeadline: 'MetaMask Smart Account (ERC-4337 · Hybrid)',
  eoaSubline: 'signer EOA · {address}',
  eoaPill: 'EOA',
  sigCaption: 'signs via userSA.signDelegation (EIP-712)',

  permissionInspectorTitle: 'What you actually signed (decoded from the delegation bytes)',
  permissionInspectorProvenance: 'signature {signature} · hash {hash}',
  permissionInspectorPosted: 'this exact object was POSTed to /grant',
  tamperProbeTitle: 'Tamper probe · on-chain enforcement',
  tamperProbeButton: 'Run on-chain check',
  tamperProbeChecking: 'Checking…',
  tamperProbeTimeout:
    'cached fallback: live RPC timed out; the signed scope still shows tampered proposalId is blocked by AllowedCalldataEnforcer.',
  tamperProbeHonest: 'castVote — any proposal',
  tamperProbeTampered: 'tampered — move funds (transfer)',
  tamperProbeIdle: 'not checked',
  tamperProbePass: '✓ would pass',
  tamperProbeRevert: '✗ reverts · {enforcer}',
  tamperProbeFallback: 'cached fallback',
  executedBanner: 'Executed AS your Smart Account {address} — DelegationManager.redeemDelegations(leaf→root)',
  executedSubtext: 'on-chain voter == your smart account, not the analyst EOA',
  viewTx: 'view tx',

  proposalTitle: 'The proposal being voted on',
  governor: 'Governor',
  proposalBody:
    'Proposal: renew the core-dev team budget at 12,000 USDC/quarter, released against public monthly milestone reports via a 2-of-3 multisig, with an unspent-funds clawback. Should the DAO approve?',
  scopeVote: 'any proposal · vote-only',
  scopeFunds: "can't move funds",
  scopeRevocable: 'revocable',

  chainTitle: 'Live authority chain',
  scopeChip: '4 caveats',
  scopeChipAttenuated: 'attenuated',
  nodes: {
    you: { who: 'You', role: 'grant the permission' },
    orch: { who: 'Orchestrator', role: 'narrows the permission' },
    analyst: { who: 'Analyst', role: 'decides + casts the vote' },
  },
  thinking: 'thinking…',
  teeConsoleTitle: 'Sealed enclave · Intel TDX',
  teeFallbackReasoning:
    'Reading the proposal inside the sealed enclave. Weighing alignment, risk, cost and accountability. The public monthly milestone reports, the 2-of-3 multisig release and the unspent-funds clawback materially de-risk the spend. Reaching a verdict…',
  authority: 'Agent authority',
  aiDecided: 'AI decided:',
  teeVerified: 'verified in TEE ✓',
  voteCast: 'Vote cast on-chain',
  voteLogTitle: 'Votes cast under this mandate',
  severedBold: 'Chain severed — the AI can no longer vote.',
  severedRest: 'The next attempt reverts on-chain.',
  proofTx: 'proof tx',

  actionLiveHint: 'Sign once — the agent then votes any proposal on your behalf. Revoke anytime.',
  actionDeadHint: 'Grant severed — letting the agent vote now is rejected on-chain.',
  standingHint: 'Standing grant · {used}/{max} votes used · revocable anytime',
  recall: 'Recall — kill the chain',
  recallTitle: 'DelegationManager.disableDelegation · selector 0x49934047',
  severing: 'Severing…',
  grant: 'Grant standing vote authority',
  voteActive: 'Let the agent vote this proposal',
  grantScopeLabel: 'Standing scope:',
  grantVotesUnit: 'votes',
  grantDaysUnit: 'days',
  boundModeVotes: 'Votes',
  boundModeDays: 'Time',
  boundModeBoth: 'Both',
  mandateStats: { votes: 'Vote budget', validity: 'Valid for', authority: 'Authority' },
  grantSentence: {
    both: 'An AI may vote any proposal on this DAO for {days} days, up to {votes} votes — and never touch your funds.',
    votes: 'An AI may vote any proposal on this DAO, up to {votes} votes — and never touch your funds.',
    days: 'An AI may vote any proposal on this DAO for {days} days — and never touch your funds.',
    enforced: 'enforced on-chain',
  },
  revokedRejected: 'Revoke worked — the agent tried to vote again, but the redemption was rejected on-chain. That is the kill-switch.',
  voteRejected: 'Vote rejected on-chain (revoked)',
  signing: 'Signing…',

  underHood: 'Under the hood · run',
  steps: [
    'You signed the locked permission',
    'Orchestrator narrowed + passed it on',
    'Analyst decided inside the Venice TEE',
    'Vote cast on Base',
  ],
  teeAttested: 'TEE attested ✓',
  castVoteTx: 'castVote tx',
  rootHash: 'Root delegation hash',
  redelegationHash: 'Redelegation hash',

  status: {
    granted: 'Permission granted',
    redelegated: 'Permission narrowed',
    analyzing: 'Deciding in TEE…',
    decided: 'Decided',
    voting: 'Casting…',
    voted: 'Vote cast ✓',
    failed: 'Failed',
    revoked: 'Chain severed',
  },

  oneShotCtaHint: 'The vote above ran on Base Sepolia. The 1Shot mainnet relay is the finale.',
  oneShotCtaBtn: 'Replay the live mainnet 1Shot relay',
  oneShotTitle: '1Shot permissionless relay',
  oneShotMainnet: 'Base Mainnet · 8453',
  relayPhases: { pending: 'Pending', submitted: 'Submitted', confirmed: 'Confirmed' },
  oneShotBurner: 'Burner EOA',
  oneShotChecking: 'reading mainnet code (eth_getCode)…',
  oneShot7702: 'EIP-7702 UPGRADED',
  oneShotImpl: 'delegate impl',
  oneShotNotUpgraded: 'burner is not 7702-upgraded',
  oneShotGasUsdc: 'gas paid in USDC · 0.01',
  oneShotBurnerNoEth: 'burner holds 0 ETH',
  oneShotCastVoteTx: 'mainnet castVote (7710 via 1Shot)',
  oneShotBundle: 'One 7710 bundle: USDC fee → feeCollector + Governor.castVote, relayed by 1Shot.',
  x402: {
    title: 'x402 toll gate',
    hint: 'The analyst pays its data feed per query — settled by a scoped ERC-7710 delegation, not an open allowance.',
    require: 'HTTP 402 · Payment Required',
    scopeTitle: 'Scoped payment delegation (ERC-7710)',
    scopeNote: 'Erc20TransferAmount lets the seller pull AT MOST the toll, to itself, and nothing else — it can never drain the buyer.',
    perQuery: 'query',
    sellerBalance: 'seller balance',
    trace: 'Trace the x402 toll',
    tracing: 'Tracing…',
    reading: 'reading balanceOf (live)…',
    phases: { require: '402 Required', sign: 'Sign scope', settle: 'Seller redeems', data: '200 Data' },
  },
  footer: {
    a: 'Connect any wallet — your smart account is auto-deployed so your agent can join the vote. Start the orchestrator (',
    b: ') and refresh a proposal (',
    c: ') before granting.',
  },
};

export type Dict = typeof en;

const zh: Dict = {
  themeLabels: { system: '跟随系统', light: '浅色', dark: '深色' },

  heroLine1: '让 AI 替你投票 ——',
  heroLine2: '牵着一根你随时能剪断的绳。',
  heroSub:
    '你给 AI 代理一项常驻、仅限投票的权限:它能替你投这个 DAO 的任意提案(永远碰不到你的钱),受票数与时限约束。改主意了?一键斩断整条授权链 —— 实时、链上完成。',

  heroEyebrow: '可撤销的代理治理',
  kpi: { caveats: '投票额度', fee: '主网中继', networks: '网络' },
  scorecard: {
    title: '赛道达成清单 —— 每项能力都在屏上',
    items: [
      { name: 'MetaMask 智能账户', proof: 'ERC-4337 Hybrid 账户签署委托' },
      { name: 'ERC-7710 受限权限', proof: '权限 X 光 + 链上实时篡改探针' },
      { name: 'Best A2A · 再委托', proof: '编排器收窄后再委托给分析员' },
      { name: 'Venice AI · TEE', proof: '密封飞地推理 + 证明 + 签名' },
      { name: 'x402 按次付费', proof: '受限 ERC-7710 通行费 + 实时 balanceOf' },
      { name: '1Shot · 主网 7710 + 7702', proof: '无许可中继 + 实时 7702 升级证明' },
    ],
  },
  tally: {
    title: 'DAO 提案 · 实时计票',
    track: '多人 DAO',
    for: '赞成',
    against: '反对',
    abstain: '弃权',
    voters: '位投票人',
    you: '你',
    pending: 'VoteBoard 尚未部署 —— 先展示已播种的代表',
  },
  feed: { live: '实时提案', voting: '正在投票', open: '开放中' },

  how: [
    { ic: '🎟️', h: '1 · 交出一项锁定权限', p: '你签下一项权限:AI 只能投这一票 —— 别的都不行。它碰不了你的资金,也不能在别处投票。' },
    { ic: '🔒', h: '2 · AI 私密决策,然后投票', p: 'AI 在密封的安全飞地(TEE)里读取提案,并替你链上投票 —— 可证明未被篡改。' },
    { ic: '✂️', h: '3 · 随时一键斩断', p: '一键在链上斩断授权链,AI 立刻失去全部投票权 —— 亲眼看它失效。' },
  ],

  walletLabel: '你的钱包 · 根授权人',
  notConnected: '未连接',
  smartAccount: 'MetaMask 智能账户',
  connect: '连接 MetaMask',
  saHeadline: 'MetaMask 智能账户 (ERC-4337 · Hybrid)',
  eoaSubline: '签名 EOA · {address}',
  eoaPill: 'EOA',
  sigCaption: '通过 userSA.signDelegation 签名 (EIP-712)',

  permissionInspectorTitle: '你实际签署的内容(从 delegation 字节解码)',
  permissionInspectorProvenance: '签名 {signature} · 哈希 {hash}',
  permissionInspectorPosted: '这个确切对象已 POST 到 /grant',
  tamperProbeTitle: '篡改探针 · 链上强制执行',
  tamperProbeButton: '运行链上检查',
  tamperProbeChecking: '检查中…',
  tamperProbeTimeout:
    '缓存回退:实时 RPC 超时;已签名范围仍显示篡改 proposalId 会被 AllowedCalldataEnforcer 阻止。',
  tamperProbeHonest: '投票 castVote(任意提案)',
  tamperProbeTampered: '篡改 —— 想转账动你的钱',
  tamperProbeIdle: '未检查',
  tamperProbePass: '✓ 会通过',
  tamperProbeRevert: '✗ 回滚 · {enforcer}',
  tamperProbeFallback: '缓存回退',
  executedBanner: '以你的智能账户 {address} 执行 — DelegationManager.redeemDelegations(leaf→root)',
  executedSubtext: '链上 voter == 你的智能账户,不是分析员 EOA',
  viewTx: '查看交易',

  proposalTitle: '正在投票的提案',
  governor: 'Governor 合约',
  proposalBody:
    '提案:将核心开发团队预算按每季度 12,000 USDC 续期,凭每月公开的里程碑报告、经 2/3 多签放款,并对未用资金设追回条款。DAO 是否批准?',
  scopeVote: '任意提案 · 仅投票',
  scopeFunds: '不能动用资金',
  scopeRevocable: '可撤销',

  chainTitle: '实时授权链',
  scopeChip: '4 条 caveat',
  scopeChipAttenuated: '已收窄',
  nodes: {
    you: { who: '你', role: '授予权限' },
    orch: { who: '编排器', role: '收窄权限' },
    analyst: { who: '分析员', role: '决策并投票' },
  },
  thinking: '思考中…',
  teeConsoleTitle: '密封飞地 · Intel TDX',
  teeFallbackReasoning:
    '在密封飞地内读取提案。权衡一致性、风险、成本与问责。每月公开里程碑报告、2/3 多签放款与未用资金追回条款显著降低了支出风险。正在得出结论……',
  authority: 'AI 权限',
  aiDecided: 'AI 决定:',
  teeVerified: 'TEE 已验证 ✓',
  voteCast: '已链上投票',
  voteLogTitle: '本次授权已投的票',
  severedBold: '授权链已斩断 —— AI 无法再投票。',
  severedRest: '下一次尝试会在链上回滚。',
  proofTx: '证明交易',

  actionLiveHint: '只签一次,之后 AI 替你投这个 DAO 的任意提案。你随时可撤销。',
  actionDeadHint: '授权已斩断 —— 现在再让 AI 投票会被链上拒绝。',
  standingHint: '常驻授权 · 已用 {used}/{max} 票 · 随时可斩断',
  recall: '撤销 —— 斩断授权链',
  recallTitle: 'DelegationManager.disableDelegation · selector 0x49934047',
  severing: '斩断中…',
  grant: '授予常驻投票权',
  voteActive: '让 AI 投这个提案',
  grantScopeLabel: '常驻授权:',
  grantVotesUnit: '票',
  grantDaysUnit: '天',
  boundModeVotes: '票数',
  boundModeDays: '天数',
  boundModeBoth: '两者',
  mandateStats: { votes: '投票额度', validity: '有效期', authority: '权限' },
  grantSentence: {
    both: 'AI 可替你投这个 DAO 的任意提案,{days} 天内、至多 {votes} 票,且永不动用你的资金。',
    votes: 'AI 可替你投这个 DAO 的任意提案,至多 {votes} 票,且永不动用你的资金。',
    days: 'AI 可替你投这个 DAO 的任意提案,{days} 天内,且永不动用你的资金。',
    enforced: '由链上强制',
  },
  revokedRejected: '撤销生效 —— AI 想再投,但兑现被链上拒绝了。这正是斩断授权的意义。',
  voteRejected: '投票被链上拒绝(已撤销)',
  signing: '签名中…',

  underHood: '底层细节 · 运行',
  steps: [
    '你签署了锁定权限',
    '编排器收窄后向下传递',
    '分析员在 Venice TEE 内决策',
    '已在 Base 上投票',
  ],
  teeAttested: 'TEE 证明 ✓',
  castVoteTx: 'castVote 交易',
  rootHash: '根委托哈希',
  redelegationHash: '再委托哈希',

  status: {
    granted: '已授予权限',
    redelegated: '权限已收窄',
    analyzing: 'TEE 决策中…',
    decided: '已决策',
    voting: '投票中…',
    voted: '已投票 ✓',
    failed: '失败',
    revoked: '授权链已斩断',
  },

  oneShotCtaHint: '上面的投票跑在 Base Sepolia。1Shot 主网中继是压轴。',
  oneShotCtaBtn: '回放真实主网 1Shot 中继',
  oneShotTitle: '1Shot 无许可中继',
  oneShotMainnet: 'Base 主网 · 8453',
  relayPhases: { pending: '待处理', submitted: '已提交', confirmed: '已确认' },
  oneShotBurner: 'Burner EOA',
  oneShotChecking: '读取主网 code(eth_getCode)……',
  oneShot7702: 'EIP-7702 已升级',
  oneShotImpl: '委托实现',
  oneShotNotUpgraded: 'burner 未做 7702 升级',
  oneShotGasUsdc: 'gas 用 USDC 付 · 0.01',
  oneShotBurnerNoEth: 'burner 持有 0 ETH',
  oneShotCastVoteTx: '主网 castVote(经 1Shot 的 7710)',
  oneShotBundle: '一个 7710 bundle:USDC 费 → feeCollector + Governor.castVote,由 1Shot 中继。',
  x402: {
    title: 'x402 收费门',
    hint: '分析员按次为数据源付费 —— 用受限的 ERC-7710 委托结算,而非敞开授权。',
    require: 'HTTP 402 · 需要付款',
    scopeTitle: '受限支付委托(ERC-7710)',
    scopeNote: 'Erc20TransferAmount 让卖方至多取走通行费、且只付给自己,别的都不行 —— 永远掏不空买方。',
    perQuery: '次查询',
    sellerBalance: '卖方余额',
    trace: '追踪 x402 收费',
    tracing: '追踪中…',
    reading: '读取 balanceOf(实时)…',
    phases: { require: '402 需付款', sign: '签署范围', settle: '卖方 redeem', data: '200 数据' },
  },
  footer: {
    a: '连接任意钱包——会自动为你部署智能账户,让你的代理加入投票。先启动编排器(',
    b: '),并刷新提案(',
    c: ')。',
  },
};

const DICTS: Record<Lang, Dict> = { en, zh };

export function getDict(lang: Lang): Dict {
  return DICTS[lang];
}

export function formatMessage(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, value),
    template,
  );
}

export function resolveLang(input?: string | null): Lang {
  return input != null && input.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'zh';
}
