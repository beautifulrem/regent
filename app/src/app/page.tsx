'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delegation, RunStatus } from '@mandate/shared';
import { BASESCAN, DEMO_PROPOSAL, shortHex } from '../lib/config';
import { getConfig, getRun, postGrant, type DemoConfig } from '../lib/orchestrator';
import { recall } from '../lib/recall';
import { connect, signGrant, type Connection } from '../lib/wallet';

const ORDER = ['granted', 'redelegated', 'analyzing', 'decided', 'voting', 'voted'];
const reached = (s: string | undefined, target: string) =>
  s != null && (ORDER.indexOf(s) >= ORDER.indexOf(target) || s === 'revoked');
const decisionClass = (d?: string) => (d === 'For' ? 'green' : d === 'Against' ? 'red' : 'amber');

const STATUS_LABEL: Record<string, string> = {
  granted: 'Granted',
  redelegated: 'Redelegated',
  analyzing: 'Deciding in TEE…',
  decided: 'Decided',
  voting: 'Casting…',
  voted: 'Voted',
  failed: 'Failed',
  revoked: 'Revoked',
};

export default function Home() {
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  const [conn, setConn] = useState<Connection | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [rootDel, setRootDel] = useState<Delegation | null>(null);
  const [busy, setBusy] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [recallTx, setRecallTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getConfig().then(setCfg).catch((e) => setError(String(e.message ?? e)));
  }, []);

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
    timer.current = setInterval(tick, 2500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [runId]);

  async function onConnect() {
    setError(null);
    try {
      setConn(await connect());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onGrant() {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    setRecallTx(null);
    try {
      const c = conn ?? (await connect());
      setConn(c);
      const grant = await signGrant(c.userSA, {
        governor: cfg.governor,
        proposalId: cfg.proposalId,
        orchestratorSA: cfg.orchestratorSA,
      });
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
    if (!conn || !rootDel) return;
    setRecalling(true);
    setError(null);
    try {
      const { txHash } = await recall(conn.userSA, rootDel);
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
  const youAddr = parts?.user ?? conn?.userSA.address;
  const orchAddr = parts?.orchestrator ?? cfg?.orchestratorSA;
  const analystAddr = parts?.analyst ?? cfg?.analyst;
  const killed = !!recallTx;
  const chainLive = reached(s, 'redelegated');

  const steps = [
    { done: reached(s, 'granted'), label: 'Root delegation signed', node: null as React.ReactNode },
    { done: reached(s, 'redelegated'), label: 'Orchestrator redelegated with tighter scope', node: null as React.ReactNode },
    {
      done: reached(s, 'decided'),
      label: 'Venice TEE decision verified',
      node: venice ? (
        <div className="mt-sm">
          <span className={`pill ${decisionClass(venice.decision)}`}>{venice.decision}</span>{' '}
          {venice.attestation.verified && <span className="pill green">TEE attested ✓</span>}{' '}
          <span className="mono label">{venice.model}</span>
          <div className="rationale">“{venice.rationale}”</div>
        </div>
      ) : null,
    },
    {
      done: reached(s, 'voted'),
      fail: s === 'failed',
      label: 'Analyst cast vote on Base',
      node: run?.vote ? (
        <a className="mono mt-sm" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">
          castVote tx {shortHex(run.vote.txHash, 5)} ↗
        </a>
      ) : null,
    },
  ];
  const terminal = ['voted', 'failed', 'revoked'].includes(s ?? '');
  const currentIdx = run && !terminal ? steps.findIndex((st) => !st.done) : -1;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">
          <span className="fox">🦊</span>
          <span><span className="mark">Mandate</span></span>
        </div>
        <span className="chain-badge">Base Sepolia</span>
      </div>

      <div className="hero">
        <h1 className="title">Revocable AI governance delegation</h1>
        <p className="sub">
          Grant an agent a scoped, revocable right to cast one vote on your behalf — then kill the
          whole delegation chain on-chain in one click.
        </p>
      </div>

      {/* connect */}
      <div className={`card connect-bar ${conn ? 'live' : ''} row spread`}>
        <div>
          <div className="label">Your wallet · root delegator</div>
          <div className="mono">{conn ? conn.address : 'not connected'}</div>
          {conn && <div className="label mt-sm">MetaMask smart account derived&nbsp;<span className="mono">{shortHex(conn.userSA.address, 6)}</span></div>}
        </div>
        {!conn && <button onClick={onConnect}>Connect MetaMask</button>}
      </div>

      {/* proposal */}
      <div className="card">
        <div className="row spread">
          <div className="card-title">Active proposal {cfg && <span className="mono label">#{shortHex(cfg.proposalId, 5)}</span>}</div>
          {cfg && (
            <a className="mono" href={`${BASESCAN}/address/${cfg.governor}`} target="_blank" rel="noreferrer">
              Governor {shortHex(cfg.governor, 4)} ↗
            </a>
          )}
        </div>
        <p className="mt-sm mb-0">{DEMO_PROPOSAL}</p>
        <div className="row gap-sm mt-md">
          <span className="pill">Base Sepolia</span>
          <span className="pill">Governor.castVote</span>
          <span className="pill brand">Proposal ID locked</span>
          <span className="pill brand">Support choice private</span>
        </div>
      </div>

      {/* authority graph */}
      <div className="card">
        <div className="label mb-0">Authority chain</div>
        <div className="graph mt-md">
          <GraphNode who="Root delegator" role="you (MetaMask)" addr={youAddr} active={!!conn} />
          <div className={`arrow ${chainLive ? 'live' : ''}`}>→</div>
          <GraphNode who="Orchestrator" role="attenuates &amp; redelegates" addr={orchAddr} active={reached(s, 'redelegated')} />
          <div className={`arrow ${reached(s, 'analyzing') ? 'live' : ''}`}>→</div>
          <GraphNode who="Analyst" role="Venice TEE · casts vote" addr={analystAddr} active={reached(s, 'analyzing')} />
        </div>
        <div className="row gap-sm mt-md">
          <span className="pill">2 signed delegations</span>
          <span className="pill">3 participants</span>
          <span className="pill brand">revocable</span>
        </div>
      </div>

      {/* action */}
      <div className="card row spread">
        <div className="label">Scope: Governor.castVote only · Proposal ID locked · Support choice private.</div>
        <button onClick={onGrant} disabled={busy || !cfg || (!!s && s !== 'failed') || killed}>
          {busy ? 'Signing…' : 'Grant one-vote authority'}
        </button>
      </div>

      {error && <div className="card err">⚠ {error}</div>}

      {/* run */}
      {run && (
        <div className="card">
          <div className="row spread mb-0">
            <div className="label">Run <span className="mono">{shortHex(run.runId, 6)}</span></div>
            <StatusPill status={killed ? 'revoked' : run.status} />
          </div>

          <div className="steps mt-md">
            {steps.map((st, i) => (
              <Step key={i} done={st.done} current={i === currentIdx} fail={st.fail} label={st.label}>
                {st.node}
              </Step>
            ))}
          </div>

          {/* the two delegation hashes */}
          <div className="hashes">
            <div className="hrow">
              <span className="label">Root delegation hash</span>
              <span className="mono">{shortHex(run.delegations.rootHash, 6)}</span>
            </div>
            <div className="hrow">
              <span className="label">Redelegation hash</span>
              <span className="mono">{run.delegations.redelegationHash ? shortHex(run.delegations.redelegationHash, 6) : '—'}</span>
            </div>
          </div>

          {run.error && <div className="err mt-md">⚠ {run.error.code}: {run.error.message}</div>}

          {/* recall */}
          <div className="row spread mt-lg">
            <div className="label">
              {killed ? 'Root delegation disabled — every redemption now reverts.' : 'Kill the chain: disable the root; the next redemption reverts.'}
            </div>
            <button className="danger" onClick={onRecall} disabled={recalling || killed || run.status !== 'voted' || !rootDel || !conn}>
              {recalling ? 'Recalling…' : killed ? 'Chain killed' : 'Recall root delegation'}
            </button>
          </div>

          {killed && (
            <div className="recall-confirmation">
              🔪 <strong>Chain killed — next redemption reverts.</strong>{' '}
              <a className="mono" href={`${BASESCAN}/tx/${recallTx}`} target="_blank" rel="noreferrer">
                disable tx {shortHex(recallTx ?? undefined, 5)} ↗
              </a>
            </div>
          )}
        </div>
      )}

      <p className="label mt-lg">
        Demo wallet must be the seeded voter. Start the orchestrator (<span className="mono">pnpm --filter @mandate/orchestrator serve</span>) and refresh a proposal (<span className="mono">pnpm proposal --reseed</span>) before granting.
      </p>
    </div>
  );
}

function GraphNode({ who, role, addr, active }: { who: string; role: string; addr?: string; active?: boolean }) {
  return (
    <div className={`node ${active ? 'active' : ''}`}>
      <div className="who">{who}</div>
      <div className="label">{role}</div>
      {addr && (
        <a className="mono label" href={`${BASESCAN}/address/${addr}`} target="_blank" rel="noreferrer">
          {shortHex(addr, 4)}
        </a>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'voted' ? 'green' : status === 'failed' || status === 'revoked' ? 'red' : 'amber';
  return <span className={`pill ${cls}`}>{STATUS_LABEL[status] ?? status}</span>;
}

function Step({
  done,
  current,
  fail,
  label,
  children,
}: {
  done?: boolean;
  current?: boolean;
  fail?: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`step ${fail ? 'fail' : done ? 'done' : current ? 'current' : ''}`}>
      <div className="rail">
        <div className="dot" />
        <div className="line" />
      </div>
      <div>
        <div>{label}</div>
        {children}
      </div>
    </div>
  );
}
