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
    'You hand an AI agent ONE locked permission to cast a single DAO vote. It decides privately and votes on-chain. Change your mind? Sever the whole chain in one click — live, on-chain.',

  heroEyebrow: 'Revocable agent governance',
  kpi: { caveats: 'Scoped caveats', fee: 'Mainnet relay', networks: 'Networks' },

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
  tamperProbeHonest: 'honest calldata',
  tamperProbeTampered: 'tampered proposalId=999',
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
  scopeVote: 'only this vote',
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
  severedBold: 'Chain severed — the AI can no longer vote.',
  severedRest: 'The next attempt reverts on-chain.',
  proofTx: 'proof tx',

  actionLiveHint: 'Sign once. The agents do the rest. Revoke whenever you want.',
  actionDeadHint: 'This grant is dead. Re-connect or reload to start over.',
  recall: '✂️ Recall — kill the chain',
  recallTitle: 'DelegationManager.disableDelegation · selector 0x49934047',
  severing: 'Severing…',
  grant: 'Grant one-vote authority',
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
  oneShotCtaBtn: '▶ Replay the live mainnet 1Shot relay',
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
  footer: {
    a: 'Demo wallet must be the seeded voter. Start the orchestrator (',
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
    '你只给 AI 代理一项锁定权限:替你投出某一次 DAO 投票。它私密决策并上链投票。改主意了?一键斩断整条授权链 —— 实时、链上完成。',

  heroEyebrow: '可撤销的代理治理',
  kpi: { caveats: '锁定 caveat', fee: '主网中继', networks: '网络' },

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
  tamperProbeHonest: '真实 calldata',
  tamperProbeTampered: '篡改 proposalId=999',
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
  scopeVote: '仅限这一票',
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
  severedBold: '授权链已斩断 —— AI 无法再投票。',
  severedRest: '下一次尝试会在链上回滚。',
  proofTx: '证明交易',

  actionLiveHint: '只签一次,余下交给代理。你随时可以撤销。',
  actionDeadHint: '该授权已失效。重新连接或刷新页面可重新开始。',
  recall: '✂️ 撤销 —— 斩断授权链',
  recallTitle: 'DelegationManager.disableDelegation · selector 0x49934047',
  severing: '斩断中…',
  grant: '授予一次投票权',
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
  oneShotCtaBtn: '▶ 回放真实主网 1Shot 中继',
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
  footer: {
    a: '演示钱包必须是已播种的投票人。授权前请先启动编排器(',
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
