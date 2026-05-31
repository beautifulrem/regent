'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delegation, RunStatus } from '@mandate/shared';
import { PROPOSALS, VOTE_BOARD_ADDRESS, isVoteBoardLive } from '@mandate/shared';
import { AnimatedBeam } from '../components/AnimatedBeam';
import { LangToggle } from '../components/LangToggle';
import { NumberTicker } from '../components/NumberTicker';
import { OneShotFinale } from '../components/OneShotFinale';
import { X402TollGate } from '../components/X402TollGate';
import { ScoreCard } from '../components/ScoreCard';
import { VoteTally } from '../components/VoteTally';
import { ProposalFeed } from '../components/ProposalFeed';
import { PermissionInspector } from '../components/PermissionInspector';
import { ScopeChip } from '../components/ScopeChip';
import { TamperProbe } from '../components/TamperProbe';
import { TeeReasoningStream } from '../components/TeeReasoningStream';
import { BASESCAN, CHAIN_ID, shortHex } from '../lib/config';
import { grantDisabled } from '../lib/flow';
import { formatMessage, getDict, isLang, LANG_KEY, resolveLang, type Lang } from '../lib/i18n';
import { getConfig, getRun, postGrant, provision, voteAgain, type DemoConfig } from '../lib/orchestrator';
import { recall } from '../lib/recall';
import { fireSever } from '../lib/sever';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { useAccount, useWalletClient } from 'wagmi';
import { deriveSmartAccount, signGrant, type SmartAccount } from '../lib/wallet';
import { motion, useReducedMotion } from 'motion/react';
import { Activity, AlertTriangle, Award, Bot, CheckCircle2, Coins, Gauge, GitBranch, KeyRound, Lock, Network, ScanSearch, Scissors, ShieldCheck, Sparkles, Ticket, User, Vote, Wallet, Workflow } from 'lucide-react';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { Badge, StatusDot, TrackTag } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';
import { cn } from '../lib/cn';

const ORDER = ['granted', 'redelegated', 'analyzing', 'decided', 'voting', 'voted'];
const reached = (s: string | undefined, target: string) =>
  s != null && (ORDER.indexOf(s) >= ORDER.indexOf(target) || s === 'revoked');
const decisionTone = (d?: string): 'ok' | 'bad' | 'warn' => (d === 'For' ? 'ok' : d === 'Against' ? 'bad' : 'warn');
const statusTone = (status: string): 'ok' | 'bad' | 'warn' =>
  status === 'voted' ? 'ok' : status === 'failed' || status === 'revoked' ? 'bad' : 'warn';

const EASE_FLUID: [number, number, number, number] = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_FLUID } },
};
const HOW_ICONS = [Ticket, Lock, Scissors];

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [userSA, setUserSA] = useState<SmartAccount | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [rootDel, setRootDel] = useState<Delegation | null>(null);
  const [grantedProposalId, setGrantedProposalId] = useState<bigint | null>(null);
  const [grantRunId, setGrantRunId] = useState<string | null>(null);
  const [votesUsed, setVotesUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [recallTx, setRecallTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const youRef = useRef<HTMLDivElement>(null);
  const orchRef = useRef<HTMLDivElement>(null);
  const analystRef = useRef<HTMLDivElement>(null);

  const t = getDict(lang);
  const reduce = useReducedMotion();
  const activeProposal = PROPOSALS[activeIdx];

  // Pick language after mount (stored choice, else browser locale) so the first
  // client render matches the server's 'en' default — no hydration mismatch.
  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY);
    const initial = isLang(stored) ? stored : resolveLang(typeof navigator !== 'undefined' ? navigator.language : 'en');
    setLang(initial);
    document.documentElement.lang = initial === 'zh' ? 'zh-CN' : 'en';
  }, []);

  const toggleLang = () => {
    setLang((prev) => {
      const next: Lang = prev === 'en' ? 'zh' : 'en';
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        /* private mode */
      }
      document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
      return next;
    });
  };

  useEffect(() => {
    getConfig().then(setCfg).catch((e) => setError(String(e.message ?? e)));
  }, []);

  // Derive the MetaMask smart account whenever the connected EOA wallet changes.
  useEffect(() => {
    if (!walletClient) {
      setUserSA(null);
      return;
    }
    let cancelled = false;
    deriveSmartAccount(walletClient)
      .then((sa) => { if (!cancelled) setUserSA(sa); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, [walletClient]);

  useEffect(() => {
    if (!runId) return;
    const tick = async () => {
      try {
        const r = await getRun(runId);
        setRun(r);
        if (['voted', 'failed', 'revoked'].includes(r.status) && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      } catch {
        /* keep polling */
      }
    };
    void tick();
    timer.current = setInterval(tick, 2000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [runId]);

  // The wow-moment: fire the fracture burst the instant the chain is severed.
  useEffect(() => {
    if (recallTx) void fireSever(chainRef.current);
  }, [recallTx]);

  // Rotate the active proposal so new ones "open"; pause while a grant/run is in flight.
  const rotationPaused = busy || (run != null && !['voted', 'failed', 'revoked'].includes(run.status));
  useEffect(() => {
    if (rotationPaused) return;
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % PROPOSALS.length), 24000);
    return () => clearInterval(id);
  }, [rotationPaused, activeIdx]);

  async function onGrant() {
    if (!cfg || !userSA || !address) return;
    setBusy(true);
    setError(null);
    setRecallTx(null);
    try {
      if (!isVoteBoardLive(VOTE_BOARD_ADDRESS)) {
        throw new Error('VoteBoard not deployed yet — run script/DeployVoteBoard.s.sol, then set VOTE_BOARD_ADDRESS.');
      }
      // deploy the judge's smart account on-chain so the agent can vote AS it on the shared board
      await provision(address);
      const grant = await signGrant(userSA, {
        governor: VOTE_BOARD_ADDRESS,
        proposalId: activeProposal.id.toString(),
        orchestratorSA: cfg.orchestratorSA,
        proposalText: activeProposal.body.en,
      });
      setRootDel(grant.rootDelegation);
      setGrantedProposalId(activeProposal.id);
      const { runId: id } = await postGrant(grant);
      setRun(null);
      setRunId(id);
      setGrantRunId(id);
      setVotesUsed(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // Standing authority in action: vote on the CURRENT proposal reusing the existing grant — NO new
  // signature. Succeeds while the grant is live; reverts on-chain once revoked / exhausted / expired.
  async function onVoteActive() {
    if (!grantRunId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { runId: id } = await voteAgain(grantRunId, activeProposal.id.toString(), activeProposal.body.en);
      setRun(null);
      setRunId(id);
      setVotesUsed((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRecall() {
    if (!userSA || !rootDel) return;
    setRecalling(true);
    setError(null);
    try {
      const { txHash } = await recall(userSA, rootDel);
      setRecallTx(txHash);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecalling(false);
    }
  }

  const s = run?.status;
  const venice = run?.venice;
  const parts = run?.delegations.participants;
  const youAddr = parts?.user ?? userSA?.address;
  const orchAddr = parts?.orchestrator ?? cfg?.orchestratorSA;
  const analystAddr = parts?.analyst ?? cfg?.analyst;
  const killed = !!recallTx;
  const authorityPct = run && !killed ? 100 : 0;
  const kpis: {
    label: string;
    value: React.ReactNode;
    unit?: string;
    tone: 'ink' | 'brand' | 'eth';
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { label: t.authority, value: <NumberTicker value={authorityPct} suffix="%" />, tone: killed ? 'ink' : 'brand', icon: Gauge },
    { label: t.kpi.caveats, value: '4', unit: 'locked', tone: 'ink', icon: Lock },
    { label: t.kpi.fee, value: '0.01', unit: 'USDC', tone: 'eth', icon: Coins },
    { label: t.kpi.networks, value: '2', unit: 'chains', tone: 'ink', icon: Network },
  ];

  const steps = [
    { done: reached(s, 'granted'), label: t.steps[0], node: null as React.ReactNode },
    { done: reached(s, 'redelegated'), label: t.steps[1], node: null as React.ReactNode },
    {
      done: reached(s, 'decided'), label: t.steps[2],
      node: venice ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={decisionTone(venice.decision)}>{venice.decision}</Badge>
          {venice.attestation.verified && <Badge tone="ok">{t.teeAttested}</Badge>}
          <span className="font-mono text-[11px] text-ink-mute">{venice.model}</span>
          <span className="w-full text-[13px] italic text-ink-soft">“{venice.rationale}”</span>
        </div>
      ) : null,
    },
    {
      done: reached(s, 'voted'), fail: s === 'failed', label: t.steps[3],
      node: run?.vote ? (
        <a className="mt-2 inline-block font-mono text-[13px] text-info hover:underline" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{t.castVoteTx} {shortHex(run.vote.txHash, 5)} ↗</a>
      ) : null,
    },
  ];
  const terminal = ['voted', 'failed', 'revoked'].includes(s ?? '');
  const running = !!run && !terminal;
  const currentIdx = run && !terminal ? steps.findIndex((st) => !st.done) : -1;
  const statusKey = killed ? 'revoked' : run?.status ?? '';

  return (
    <div className="relative mx-auto w-full max-w-5xl px-5 pb-28 pt-6 sm:px-7">
      {/* top bar */}
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-brand shadow-[0_0_24px_-8px_var(--color-brand)]">
            <ShieldCheck className="size-5" strokeWidth={2} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">Mandate</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle lang={lang} onToggle={toggleLang} />
          <span className="inline-flex items-center gap-2 rounded-chip border border-hairline bg-surface/60 px-3 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur">
            <StatusDot tone="ok" /> Base Sepolia
          </span>
        </div>
      </header>

      {/* hero */}
      <motion.section
        className="mb-9"
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
      >
        <motion.div
          variants={fadeUp}
          className="mb-4 inline-flex items-center gap-2 rounded-chip border border-brand/25 bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand"
        >
          <Sparkles className="size-3.5" /> {t.heroEyebrow}
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl"
        >
          {t.heroLine1}
          <br />
          <span className="bg-gradient-to-r from-brand via-brand-soft to-brand bg-clip-text text-transparent">
            {t.heroLine2}
          </span>
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {t.heroSub}
        </motion.p>

        {/* live KPI strip */}
        <motion.div
          variants={fadeUp}
          className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-hairline bg-hairline sm:grid-cols-4"
        >
          {kpis.map((k) => (
            <div key={k.label} className="bg-surface/70 px-4 py-3.5 backdrop-blur">
              <Stat label={k.label} value={k.value} unit={k.unit} tone={k.tone} icon={k.icon} />
            </div>
          ))}
        </motion.div>
      </motion.section>

      {/* how it works */}
      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        {t.how.map((step, i) => {
          const HowIcon = HOW_ICONS[i];
          return (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: EASE_FLUID }}
            >
              <Panel pad="md" className="h-full">
                <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-brand">
                  <HowIcon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="font-display text-[15px] font-semibold text-ink">{step.h}</div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{step.p}</p>
              </Panel>
            </motion.div>
          );
        })}
      </section>

      <ScoreCard t={t} />

      {/* connect + Smart Account identity — Track: MetaMask Smart Accounts */}
      <Panel tone={userSA ? 'brand' : 'default'} glow={!!userSA} pad="lg" className="mb-3.5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TrackTag tone="brand" icon={Award}>Smart Accounts · ERC-4337</TrackTag>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">
          <Wallet className="size-3.5" /> {t.walletLabel}
        </div>
        {userSA ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <Jazzicon diameter={24} seed={jsNumberForAddress(userSA.address)} />
              <span className="break-all font-mono text-[15px] font-medium text-ink">{userSA.address}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{t.saHeadline}</Badge>
              <Badge tone="neutral">{t.eoaPill}</Badge>
              <span className="font-mono text-xs text-ink-mute">{formatMessage(t.eoaSubline, { address: address ?? t.notConnected })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-mute">
              <KeyRound className="size-3" /> {t.sigCaption}
            </div>
          </div>
        ) : (
          <div className="mt-2 font-mono text-sm text-ink-soft">{address ?? t.notConnected}</div>
        )}
      </Panel>

      {/* rotating live governance feed — a new proposal opens every ~24s */}
      <ProposalFeed activeIdx={activeIdx} onSelect={setActiveIdx} lang={lang} t={t} />

      {cfg && <VoteTally proposalId={activeProposal.id} seed={activeProposal.seed} you={userSA?.address} t={t} />}

      {rootDel && cfg && userSA && (
        <>
          <PermissionInspector rootDel={rootDel} chainId={CHAIN_ID} />
          <TamperProbe
            rootDel={rootDel}
            governor={VOTE_BOARD_ADDRESS}
            proposalId={grantedProposalId ?? activeProposal.id}
            chainId={CHAIN_ID}
          />
        </>
      )}

      {/* the animated authority chain — centerpiece · Track: A2A re-delegation */}
      <Panel pad="lg" className="mb-3.5">
        <PanelHeader
          icon={GitBranch}
          title={t.chainTitle}
          track={<TrackTag tone="info" icon={Workflow}>A2A · ERC-7710 re-delegation</TrackTag>}
        />
        <div className={cn('chain mt-2', killed && 'killed')} ref={chainRef}>
          <ChainNode nodeRef={youRef} icon={User} who={t.nodes.you.who} role={t.nodes.you.role} addr={youAddr} active={isConnected} killed={killed} />
          <ChainNode nodeRef={orchRef} icon={Bot} who={t.nodes.orch.who} role={t.nodes.orch.role} addr={orchAddr} active={reached(s, 'redelegated')} working={s === 'granted'} killed={killed} />
          <ChainNode nodeRef={analystRef} icon={ScanSearch} who={t.nodes.analyst.who} role={t.nodes.analyst.role} addr={analystAddr} active={reached(s, 'analyzing')} working={s === 'redelegated' || s === 'analyzing'} tee={s === 'analyzing'} thinking={t.thinking} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={youRef} toRef={orchRef} live={reached(s, 'redelegated')} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={orchRef} toRef={analystRef} live={reached(s, 'analyzing')} killed={killed} />
          {run && !killed && (
            <ScopeChip containerRef={chainRef} youRef={youRef} orchRef={orchRef} analystRef={analystRef} redelegated={reached(s, 'redelegated')} t={t} />
          )}
        </div>

        {/* agent-authority meter — full while the grant is live, snaps to 0 on sever */}
        {run && (
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{t.authority}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-chip border border-hairline bg-surface-2">
              <motion.div
                className={cn('h-full rounded-chip', killed ? 'bg-bad' : 'bg-gradient-to-r from-brand-deep to-brand shadow-[0_0_12px_var(--color-brand)]')}
                initial={false}
                animate={{ width: killed ? '0%' : '100%' }}
                transition={{ duration: reduce ? 0 : 0.8, ease: EASE_FLUID }}
              />
            </div>
            <span className={cn('w-12 text-right font-mono text-sm font-bold tabular-nums', killed ? 'text-bad' : 'text-brand')}>
              <NumberTicker value={killed ? 0 : 100} suffix="%" />
            </span>
          </div>
        )}

        {/* live result — Venice console re-skinned in Slice 7, vote/recall in Slice 8 */}
        {venice && !killed && <TeeReasoningStream venice={venice} t={t} />}
        {run?.vote && !killed && (
          <div className="mt-4 space-y-2">
            <motion.div
              initial={reduce ? false : { scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className="inline-flex items-center gap-2 rounded-chip border border-ok/35 bg-ok/12 px-3 py-1.5 text-sm font-semibold text-ok"
            >
              <CheckCircle2 className="size-4" /> {t.voteCast}
              <a className="font-mono text-xs hover:underline" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{shortHex(run.vote.txHash, 5)} ↗</a>
            </motion.div>
            {userSA && (
              <div className="rounded-xl border border-ok/25 bg-ok/8 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
                  <span>{formatMessage(t.executedBanner, { address: shortHex(userSA.address, 6) })}</span>
                  <a className="font-mono text-info hover:underline" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{t.viewTx} ↗</a>
                </div>
                <div className="mt-1.5 text-[11px] text-ink-mute">{t.executedSubtext}</div>
              </div>
            )}
          </div>
        )}
        {killed && (
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-bad/30 bg-bad/8 px-4 py-3 text-[13px] text-ink-soft"
          >
            <Scissors className="size-4 shrink-0 text-bad" />
            <strong className="text-bad">{t.severedBold}</strong> {t.severedRest}
            <a className="font-mono text-info hover:underline" href={`${BASESCAN}/tx/${recallTx}`} target="_blank" rel="noreferrer">{t.proofTx} {shortHex(recallTx ?? undefined, 5)} ↗</a>
          </motion.div>
        )}
      </Panel>

      {/* actions */}
      <Panel pad="md" className="mb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-ink-soft">
            {killed
              ? t.actionDeadHint
              : grantRunId
                ? formatMessage(t.standingHint, { used: String(votesUsed), max: '10' })
                : t.actionLiveHint}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!grantRunId ? (
              <button
                className="big"
                onClick={onGrant}
                disabled={grantDisabled({ busy, hasConfig: !!cfg, connected: isConnected && !!userSA, status: s, killed })}
              >
                {busy ? t.signing : t.grant}
              </button>
            ) : (
              <>
                <button className="inline-flex items-center gap-2" onClick={onVoteActive} disabled={busy || running}>
                  <Vote className="size-4" /> {busy ? t.signing : t.voteActive}
                </button>
                {!killed && (
                  <button
                    className="danger inline-flex items-center gap-2"
                    onClick={onRecall}
                    disabled={recalling || running || !rootDel || !userSA}
                    title={t.recallTitle}
                  >
                    <Scissors className="size-4" /> {recalling ? t.severing : t.recall}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </Panel>

      {error && (
        <Panel tone="bad" pad="md" className="mb-3.5">
          <div className="flex items-center gap-2 text-[13px] text-bad">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        </Panel>
      )}

      {/* technical detail / proof */}
      {run && (
        <Panel pad="lg" className="mb-3.5">
          <PanelHeader
            icon={Activity}
            title={
              <span className="flex items-center gap-2">
                {t.underHood} <span className="font-mono text-xs text-ink-mute">{shortHex(run.runId, 6)}</span>
              </span>
            }
            right={<Badge tone={statusTone(statusKey)}>{t.status[statusKey as keyof typeof t.status] ?? statusKey}</Badge>}
          />
          <div className="mt-1">
            {steps.map((st, i) => (
              <Step key={i} done={st.done} current={i === currentIdx} fail={st.fail} last={i === steps.length - 1} label={st.label}>
                {st.node}
              </Step>
            ))}
          </div>
          <div className="mt-3 grid gap-2 rounded-xl border border-hairline bg-surface-2/60 px-4 py-3">
            <div className="flex justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{t.rootHash}</span>
              <span className="font-mono text-xs text-ink-soft">{shortHex(run.delegations.rootHash, 6)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">{t.redelegationHash}</span>
              <span className="font-mono text-xs text-ink-soft">{run.delegations.redelegationHash ? shortHex(run.delegations.redelegationHash, 6) : '—'}</span>
            </div>
          </div>
          {run.error && (
            <div className="mt-3 flex items-center gap-2 text-[13px] text-bad">
              <AlertTriangle className="size-4 shrink-0" /> {run.error.code}: {run.error.message}
            </div>
          )}
        </Panel>
      )}

      {cfg && <X402TollGate cfg={cfg} t={t} />}
      <OneShotFinale t={t} />

      <p className="mt-10 text-center text-[11px] leading-relaxed text-ink-mute">
        {t.footer.a}<span className="font-mono text-ink-soft">pnpm --filter @mandate/orchestrator serve</span>{t.footer.b}<span className="font-mono text-ink-soft">pnpm proposal --reseed</span>{t.footer.c}
      </p>
    </div>
  );
}

function ChainNode({
  nodeRef,
  icon: Icon,
  who,
  role,
  addr,
  active,
  working,
  tee,
  thinking,
  killed,
}: {
  nodeRef?: React.RefObject<HTMLDivElement | null>;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  who: string;
  role: string;
  addr?: string;
  active?: boolean;
  working?: boolean;
  tee?: boolean;
  thinking?: string;
  killed?: boolean;
}) {
  return (
    <div
      ref={nodeRef}
      className={cn(
        'relative z-[1] flex-1 rounded-xl border bg-surface-2/80 px-3 py-4 text-center backdrop-blur transition-all duration-300',
        killed
          ? 'border-bad/40 opacity-40 grayscale'
          : active
            ? 'border-brand shadow-[0_0_0_1px_var(--color-brand),0_12px_34px_-16px_var(--color-brand)]'
            : 'border-hairline',
        working && !killed && 'motion-safe:animate-glow',
      )}
    >
      <span
        className={cn(
          'mx-auto mb-2 grid size-11 place-items-center rounded-full border transition-colors duration-300',
          active && !killed ? 'border-brand/50 bg-brand/15 text-brand' : 'border-hairline bg-surface text-ink-soft',
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="font-display text-sm font-semibold text-ink">{who}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-ink-mute">{role}</div>
      {tee && !killed && (
        <div className="relative mt-2 flex h-6 items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed border-info/45 bg-info/10 text-[10.5px] text-info motion-safe:animate-pulse">
          <Lock className="size-3" /> {thinking}
        </div>
      )}
      {addr && (
        <a
          className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-mute transition-colors hover:text-info"
          href={`${BASESCAN}/address/${addr}`}
          target="_blank"
          rel="noreferrer"
        >
          <Jazzicon diameter={14} seed={jsNumberForAddress(addr)} />
          {shortHex(addr, 4)} ↗
        </a>
      )}
    </div>
  );
}

function Step({
  done,
  current,
  fail,
  last,
  label,
  children,
}: {
  done?: boolean;
  current?: boolean;
  fail?: boolean;
  last?: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-none flex-col items-center">
        <span
          className={cn(
            'mt-1.5 size-2.5 flex-none rounded-full transition-colors',
            fail ? 'bg-bad' : done ? 'bg-ok' : current ? 'bg-brand motion-safe:animate-glow' : 'bg-line',
          )}
        />
        {!last && <span className="mt-1 w-px flex-1 bg-hairline" />}
      </div>
      <div className="pb-3">
        <div className={cn('text-[13.5px]', done || current ? 'text-ink' : 'text-ink-mute')}>{label}</div>
        {children}
      </div>
    </div>
  );
}
