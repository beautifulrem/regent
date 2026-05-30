'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delegation, RunStatus } from '@mandate/shared';
import { AnimatedBeam } from '../components/AnimatedBeam';
import { LangToggle } from '../components/LangToggle';
import { NumberTicker } from '../components/NumberTicker';
import { ThemeToggle } from '../components/ThemeToggle';
import { BASESCAN, shortHex } from '../lib/config';
import { grantDisabled } from '../lib/flow';
import { getDict, isLang, LANG_KEY, resolveLang, type Lang } from '../lib/i18n';
import { getConfig, getRun, postGrant, type DemoConfig } from '../lib/orchestrator';
import { recall } from '../lib/recall';
import { fireSever } from '../lib/sever';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient } from 'wagmi';
import { deriveSmartAccount, signGrant, type SmartAccount } from '../lib/wallet';

const ORDER = ['granted', 'redelegated', 'analyzing', 'decided', 'voting', 'voted'];
const reached = (s: string | undefined, target: string) =>
  s != null && (ORDER.indexOf(s) >= ORDER.indexOf(target) || s === 'revoked');
const decisionClass = (d?: string) => (d === 'For' ? 'green' : d === 'Against' ? 'red' : 'amber');
const statusClass = (status: string) =>
  status === 'voted' ? 'green' : status === 'failed' || status === 'revoked' ? 'red' : 'amber';

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
    <div className="app-shell">
      <div className="topbar">
        <div className="brand"><span className="fox">🦊</span><span><span className="mark">Mandate</span></span></div>
        <div className="topbar-controls">
          <LangToggle lang={lang} onToggle={toggleLang} />
          <ThemeToggle labels={t.themeLabels} />
          <span className="chain-badge">Base Sepolia</span>
        </div>
      </div>

      <div className="hero">
        <h1 className="title">{t.heroLine1}<br /><span className="hl">{t.heroLine2}</span></h1>
        <p className="sub">{t.heroSub}</p>
      </div>

      {/* plain-language explainer */}
      <div className="how">
        {t.how.map((step, i) => (
          <div className="how-step" key={i}>
            <div className="ic">{step.ic}</div>
            <div className="h">{step.h}</div>
            <div className="p">{step.p}</div>
          </div>
        ))}
      </div>

      {/* connect — RainbowKit owns wallet selection (EIP-6963) + chain switching */}
      <div className={`card connect-bar ${isConnected ? 'live' : ''} row spread`}>
        <div>
          <div className="label">{t.walletLabel}</div>
          <div className="mono">{address ?? t.notConnected}</div>
          {userSA && <div className="label mt-sm">{t.smartAccount}&nbsp;<span className="mono">{shortHex(userSA.address, 6)}</span></div>}
        </div>
        <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
      </div>

      {/* proposal */}
      <div className="card">
        <div className="row spread">
          <div className="card-title">{t.proposalTitle} {cfg && <span className="mono label">#{shortHex(cfg.proposalId, 5)}</span>}</div>
          {cfg && <a className="mono" href={`${BASESCAN}/address/${cfg.governor}`} target="_blank" rel="noreferrer">{t.governor} {shortHex(cfg.governor, 4)} ↗</a>}
        </div>
        <p className="mt-sm mb-0">{t.proposalBody}</p>
        <div className="row gap-sm mt-md">
          <span className="pill brand">{t.scopeVote}</span>
          <span className="pill brand">{t.scopeFunds}</span>
          <span className="pill brand">{t.scopeRevocable}</span>
        </div>
      </div>

      {/* the animated authority chain — centerpiece */}
      <div className="card">
        <div className="label mb-0">{t.chainTitle}</div>
        <div className={`chain ${killed ? 'killed' : ''} mt-md`} ref={chainRef}>
          <ChainNode nodeRef={youRef} avatar="🧑" who={t.nodes.you.who} role={t.nodes.you.role} addr={youAddr} active={isConnected} killed={killed} />
          <ChainNode nodeRef={orchRef} avatar="🤖" who={t.nodes.orch.who} role={t.nodes.orch.role} addr={orchAddr} active={reached(s, 'redelegated')} working={s === 'granted'} killed={killed} />
          <ChainNode nodeRef={analystRef} avatar="🔎" who={t.nodes.analyst.who} role={t.nodes.analyst.role} addr={analystAddr} active={reached(s, 'analyzing')} working={s === 'redelegated' || s === 'analyzing'} tee={s === 'analyzing'} thinking={t.thinking} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={youRef} toRef={orchRef} live={reached(s, 'redelegated')} killed={killed} />
          <AnimatedBeam containerRef={chainRef} fromRef={orchRef} toRef={analystRef} live={reached(s, 'analyzing')} killed={killed} />
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
        {venice && !killed && (
          <div className="decision mt-lg row gap-sm">
            <span className="label">{t.aiDecided}</span>
            <span className={`pill ${decisionClass(venice.decision)}`}>{venice.decision}</span>
            {venice.attestation.verified && <span className="pill green">{t.teeVerified}</span>}
            <span className="rationale" style={{ flexBasis: '100%' }}>“{venice.rationale}”</span>
          </div>
        )}
        {run?.vote && !killed && (
          <div className="vote-burst mt-md">
            <span className="check">✓</span>
            <span>{t.voteCast}</span>
            <a className="mono" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">{shortHex(run.vote.txHash, 5)} ↗</a>
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
          <button className="danger big" onClick={onRecall} disabled={recalling || !rootDel || !userSA}>{recalling ? t.severing : t.recall}</button>
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
      {addr && <a className="mono label" style={{ display: 'inline-block', marginTop: 6 }} href={`${BASESCAN}/address/${addr}`} target="_blank" rel="noreferrer">{shortHex(addr, 4)}</a>}
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
