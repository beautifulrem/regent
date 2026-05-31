'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delegation, RunStatus } from '@mandate/shared';
import { AnimatedBeam } from '../components/AnimatedBeam';
import { LangToggle } from '../components/LangToggle';
import { NumberTicker } from '../components/NumberTicker';
import { OneShotFinale } from '../components/OneShotFinale';
import { PermissionInspector } from '../components/PermissionInspector';
import { ScopeChip } from '../components/ScopeChip';
import { TamperProbe } from '../components/TamperProbe';
import { TeeReasoningStream } from '../components/TeeReasoningStream';
import { BASESCAN, CHAIN_ID, shortHex } from '../lib/config';
import { grantDisabled } from '../lib/flow';
import { formatMessage, getDict, isLang, LANG_KEY, resolveLang, type Lang } from '../lib/i18n';
import { getConfig, getRun, postGrant, type DemoConfig } from '../lib/orchestrator';
import { recall } from '../lib/recall';
import { fireSever } from '../lib/sever';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { useAccount, useWalletClient } from 'wagmi';
import { deriveSmartAccount, signGrant, type SmartAccount } from '../lib/wallet';
import { motion, useReducedMotion } from 'motion/react';
import { Award, Ban, Coins, FileText, Gauge, KeyRound, Lock, Network, Scissors, ShieldCheck, Sparkles, Ticket, Undo2, Wallet } from 'lucide-react';
import { Panel, PanelHeader } from '../components/ui/Panel';
import { Badge, StatusDot, TrackTag } from '../components/ui/Badge';
import { Stat } from '../components/ui/Stat';

const ORDER = ['granted', 'redelegated', 'analyzing', 'decided', 'voting', 'voted'];
const reached = (s: string | undefined, target: string) =>
  s != null && (ORDER.indexOf(s) >= ORDER.indexOf(target) || s === 'revoked');
const decisionClass = (d?: string) => (d === 'For' ? 'green' : d === 'Against' ? 'red' : 'amber');
const statusClass = (status: string) =>
  status === 'voted' ? 'green' : status === 'failed' || status === 'revoked' ? 'red' : 'amber';

const EASE_FLUID: [number, number, number, number] = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_FLUID } },
};
const HOW_ICONS = [Ticket, Lock, Scissors];

export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [userSA, setUserSA] = useState<SmartAccount | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [rootDel, setRootDel] = useState<Delegation | null>(null);
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

  async function onGrant() {
    if (!cfg || !userSA) return;
    setBusy(true);
    setError(null);
    setRecallTx(null);
    try {
      const grant = await signGrant(userSA, { governor: cfg.governor, proposalId: cfg.proposalId, orchestratorSA: cfg.orchestratorSA });
      setRootDel(grant.rootDelegation);
      const { runId: id } = await postGrant(grant);
      setRun(null);
      setRunId(id);
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
        <div className="body decision mt-sm">
          <span className={`pill ${decisionClass(venice.decision)}`}>{venice.decision}</span>{' '}
          {venice.attestation.verified && <span className="pill green">{t.teeAttested}</span>}{' '}
          <span className="mono label">{venice.model}</span>
          <div className="rationale">“{venice.rationale}”</div>
        </div>
      ) : null,
    },
    {
      done: reached(s, 'voted'), fail: s === 'failed', label: t.steps[3],
      node: run?.vote ? (
        <a className="mono body mt-sm" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{t.castVoteTx} {shortHex(run.vote.txHash, 5)} ↗</a>
      ) : null,
    },
  ];
  const terminal = ['voted', 'failed', 'revoked'].includes(s ?? '');
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

      {/* proposal */}
      <Panel pad="lg" className="mb-3.5">
        <PanelHeader
          icon={FileText}
          title={t.proposalTitle}
          right={
            cfg ? (
              <a
                className="font-mono text-xs text-info hover:underline"
                href={`${BASESCAN}/address/${cfg.governor}`}
                target="_blank"
                rel="noreferrer"
              >
                {t.governor} {shortHex(cfg.governor, 4)} ↗
              </a>
            ) : undefined
          }
        />
        {cfg && <div className="-mt-2 mb-3 font-mono text-xs text-ink-mute">#{shortHex(cfg.proposalId, 5)}</div>}
        <p className="text-[14px] leading-relaxed text-ink-soft">{t.proposalBody}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand"><Lock className="size-3" /> {t.scopeVote}</Badge>
          <Badge tone="brand"><Ban className="size-3" /> {t.scopeFunds}</Badge>
          <Badge tone="brand"><Undo2 className="size-3" /> {t.scopeRevocable}</Badge>
        </div>
      </Panel>

      {rootDel && cfg && userSA && (
        <>
          <PermissionInspector rootDel={rootDel} chainId={CHAIN_ID} />
          <TamperProbe
            rootDel={rootDel}
            userSA={userSA}
            governor={cfg.governor}
            proposalId={BigInt(cfg.proposalId)}
            chainId={CHAIN_ID}
          />
        </>
      )}

      {/* the animated authority chain — centerpiece */}
      <div className="card">
        <div className="label mb-0">{t.chainTitle}</div>
        <div className={`chain ${killed ? 'killed' : ''} mt-md`} ref={chainRef}>
          <ChainNode nodeRef={youRef} avatar="🧑" who={t.nodes.you.who} role={t.nodes.you.role} addr={youAddr} active={isConnected} killed={killed} />
          <ChainNode nodeRef={orchRef} avatar="🤖" who={t.nodes.orch.who} role={t.nodes.orch.role} addr={orchAddr} active={reached(s, 'redelegated')} working={s === 'granted'} killed={killed} />
          <ChainNode nodeRef={analystRef} avatar="🔎" who={t.nodes.analyst.who} role={t.nodes.analyst.role} addr={analystAddr} active={reached(s, 'analyzing')} working={s === 'redelegated' || s === 'analyzing'} tee={s === 'analyzing'} thinking={t.thinking} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={youRef} toRef={orchRef} live={reached(s, 'redelegated')} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={orchRef} toRef={analystRef} live={reached(s, 'analyzing')} killed={killed} />
          {run && !killed && (
            <ScopeChip containerRef={chainRef} youRef={youRef} orchRef={orchRef} analystRef={analystRef} redelegated={reached(s, 'redelegated')} redelegationHash={run.delegations.redelegationHash} t={t} />
          )}
        </div>

        {/* agent-authority meter — full while the grant is live, snaps to 0 on sever */}
        {run && (
          <div className={`authority ${killed ? 'killed' : ''} mt-md`}>
            <span className="label">{t.authority}</span>
            <div className="ameter"><div className="afill" style={{ width: killed ? '0%' : '100%' }} /></div>
            <span className="aval"><NumberTicker value={killed ? 0 : 100} suffix="%" /></span>
          </div>
        )}

        {/* live result */}
        {venice && !killed && <TeeReasoningStream venice={venice} t={t} />}
        {run?.vote && !killed && (
          <div className="vote-proof mt-md">
            <div className="vote-burst">
              <span className="check">✓</span>
              <span>{t.voteCast}</span>
              <a className="mono" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{shortHex(run.vote.txHash, 5)} ↗</a>
            </div>
            {userSA && (
              <div className="executed-banner mt-sm">
                <div className="row gap-sm">
                  <span>{formatMessage(t.executedBanner, { address: shortHex(userSA.address, 6) })}</span>
                  <a className="mono" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{t.viewTx} ↗</a>
                </div>
                <div className="label mt-sm">{t.executedSubtext}</div>
              </div>
            )}
          </div>
        )}
        {killed && (
          <div className="recall-confirmation">
            🔪 <strong>{t.severedBold}</strong> {t.severedRest}{' '}
            <a className="mono" href={`${BASESCAN}/tx/${recallTx}`} target="_blank" rel="noreferrer">{t.proofTx} {shortHex(recallTx ?? undefined, 5)} ↗</a>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="card row spread">
        <div className="label">{killed ? t.actionDeadHint : t.actionLiveHint}</div>
        {run && run.status === 'voted' && !killed ? (
          <button className="danger big" onClick={onRecall} disabled={recalling || !rootDel || !userSA} title={t.recallTitle}>{recalling ? t.severing : t.recall}</button>
        ) : (
          <button className="big" onClick={onGrant} disabled={grantDisabled({ busy, hasConfig: !!cfg, connected: isConnected && !!userSA, status: s, killed })}>{busy ? t.signing : t.grant}</button>
        )}
      </div>

      {error && <div className="card err">⚠ {error}</div>}

      {/* technical detail / proof */}
      {run && (
        <div className="card">
          <div className="row spread mb-0">
            <div className="label">{t.underHood} <span className="mono">{shortHex(run.runId, 6)}</span></div>
            <StatusPill cls={statusClass(statusKey)} label={t.status[statusKey as keyof typeof t.status] ?? statusKey} />
          </div>
          <div className="steps">
            {steps.map((st, i) => (
              <Step key={i} done={st.done} current={i === currentIdx} fail={st.fail} label={st.label}>{st.node}</Step>
            ))}
          </div>
          <div className="hashes">
            <div className="hrow"><span className="label">{t.rootHash}</span><span className="mono">{shortHex(run.delegations.rootHash, 6)}</span></div>
            <div className="hrow"><span className="label">{t.redelegationHash}</span><span className="mono">{run.delegations.redelegationHash ? shortHex(run.delegations.redelegationHash, 6) : '—'}</span></div>
          </div>
          {run.error && <div className="err mt-md">⚠ {run.error.code}: {run.error.message}</div>}
        </div>
      )}

      <OneShotFinale t={t} />

      <p className="label mt-lg">
        {t.footer.a}<span className="mono">pnpm --filter @mandate/orchestrator serve</span>{t.footer.b}<span className="mono">pnpm proposal --reseed</span>{t.footer.c}
      </p>
    </div>
  );
}

function ChainNode({ nodeRef, avatar, who, role, addr, active, working, tee, thinking, killed }: { nodeRef?: React.RefObject<HTMLDivElement | null>; avatar: string; who: string; role: string; addr?: string; active?: boolean; working?: boolean; tee?: boolean; thinking?: string; killed?: boolean }) {
  return (
    <div ref={nodeRef} className={`cnode ${killed ? 'killed' : working ? 'working active' : active ? 'active' : ''}`}>
      <span className="avatar">{avatar}</span>
      <div className="who">{who}</div>
      <div className="role">{role}</div>
      {tee && !killed && <div className="tee"><span className="sweep" />{thinking}</div>}
      {addr && (
        <a className="mono label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }} href={`${BASESCAN}/address/${addr}`} target="_blank" rel="noreferrer">
          <Jazzicon diameter={15} seed={jsNumberForAddress(addr)} />
          {shortHex(addr, 4)} ↗
        </a>
      )}
    </div>
  );
}

function StatusPill({ cls, label }: { cls: string; label: string }) {
  return <span className={`pill ${cls}`}>{label}</span>;
}

function Step({ done, current, fail, label, children }: { done?: boolean; current?: boolean; fail?: boolean; label: string; children?: React.ReactNode }) {
  return (
    <div className={`step ${fail ? 'fail' : done ? 'done' : current ? 'current' : ''}`}>
      <div className="rail"><div className="dot" /><div className="line" /></div>
      <div><div>{label}</div>{children}</div>
    </div>
  );
}
