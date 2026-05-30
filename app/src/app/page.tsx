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

  return (
    <div className="wrap">
      <h1 className="title">Mandate</h1>
      <p className="sub">Revocable, scoped delegation of governance voting to an AI agent — on Base.</p>

      <div className="panel row spread">
        <div>
          <div className="label">Your wallet (root delegator)</div>
          <div className="mono">{conn ? conn.address : 'not connected'}</div>
          {conn && (
            <div className="label">
              smart account&nbsp;<span className="mono">{shortHex(conn.userSA.address, 6)}</span>
            </div>
          )}
        </div>
        {!conn && <button onClick={onConnect}>Connect MetaMask</button>}
      </div>

      <div className="panel">
        <div className="row spread">
          <div className="label">
            Active proposal {cfg && <span className="mono">#{shortHex(cfg.proposalId, 5)}</span>}
          </div>
          {cfg && (
            <a className="mono" href={`${BASESCAN}/address/${cfg.governor}`} target="_blank" rel="noreferrer">
              Governor {shortHex(cfg.governor, 4)} ↗
            </a>
          )}
        </div>
        <p style={{ marginBottom: 0 }}>{DEMO_PROPOSAL}</p>
      </div>

      <div className="panel">
        <div className="label" style={{ marginBottom: 10 }}>Authority chain</div>
        <div className="graph">
          <GraphNode who="You" role="root delegator" addr={youAddr} active={!!conn} link />
          <div className="arrow">→</div>
          <GraphNode who="Orchestrator" role="attenuates & redelegates" addr={orchAddr} active={reached(s, 'redelegated')} link />
          <div className="arrow">→</div>
          <GraphNode who="Analyst" role="Venice TEE · casts vote" addr={analystAddr} active={reached(s, 'analyzing')} link />
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <span className="pill">2 signed delegations</span>
          <span className="pill">3 participants</span>
          <span className="pill">caveat: target = Governor</span>
          <span className="pill">caveat: selector = castVote</span>
          <span className="pill">caveat: proposalId locked · support free</span>
          <span className="pill">revocable</span>
        </div>
      </div>

      <div className="panel row spread">
        <div className="label">
          Grant scoped authority to vote on this proposal. You can revoke the whole chain anytime.
        </div>
        <button onClick={onGrant} disabled={busy || !cfg || (!!s && s !== 'failed') || killed}>
          {busy ? 'Signing…' : 'Grant & run'}
        </button>
      </div>

      {error && <div className="panel err">⚠ {error}</div>}

      {run && (
        <div className="panel">
          <div className="row spread" style={{ marginBottom: 12 }}>
            <div className="label">Run <span className="mono">{shortHex(run.runId, 6)}</span></div>
            <StatusPill status={killed ? 'revoked' : run.status} />
          </div>

          <div className="steps">
            <Step done={reached(s, 'granted')} label="You signed the root delegation (MetaMask)" extra={`hash ${shortHex(run.delegations.rootHash, 5)}`} />
            <Step
              done={reached(s, 'redelegated')}
              label="Orchestrator attenuated-redelegated to the analyst"
              extra={run.delegations.redelegationHash ? `hash ${shortHex(run.delegations.redelegationHash, 5)}` : undefined}
            />
            <Step done={reached(s, 'decided')} label="Analyst analysed the proposal in a Venice TEE">
              {venice && (
                <div>
                  <span className={`pill ${decisionClass(venice.decision)}`}>{venice.decision}</span>{' '}
                  {venice.attestation.verified && <span className="pill green">TEE attested ✓</span>}{' '}
                  <span className="mono label">{venice.model}</span>
                  <div className="rationale">“{venice.rationale}”</div>
                </div>
              )}
            </Step>
            <Step done={reached(s, 'voted')} fail={s === 'failed'} label="Analyst cast the vote on-chain">
              {run.vote && (
                <a className="mono" href={`${BASESCAN}/tx/${run.vote.txHash}`} target="_blank" rel="noreferrer">
                  castVote tx {shortHex(run.vote.txHash, 5)} ↗
                </a>
              )}
            </Step>
          </div>

          {run.error && <div className="err" style={{ marginTop: 10 }}>⚠ {run.error.code}: {run.error.message}</div>}

          <div className="row spread" style={{ marginTop: 16 }}>
            <div className="label">
              {killed
                ? 'Root delegation disabled — every redemption of this chain now reverts.'
                : 'Kill the chain: disable the root delegation; the next redemption reverts.'}
            </div>
            <button
              className="danger"
              onClick={onRecall}
              disabled={recalling || killed || run.status !== 'voted' || !rootDel || !conn}
            >
              {recalling ? 'Recalling…' : killed ? 'Chain killed 🔪' : 'Recall'}
            </button>
          </div>

          {killed && (
            <div className="panel" style={{ marginTop: 12, background: 'var(--panel-2)' }}>
              🔪 <strong>Chain killed.</strong> Root delegation disabled via your smart account.{' '}
              <a className="mono" href={`${BASESCAN}/tx/${recallTx}`} target="_blank" rel="noreferrer">
                disable tx {shortHex(recallTx ?? undefined, 5)} ↗
              </a>
              <div className="label" style={{ marginTop: 4 }}>The agents can no longer vote with this grant — the next redeemDelegations reverts.</div>
            </div>
          )}
        </div>
      )}

      <p className="label" style={{ marginTop: 24 }}>
        Demo wallet must be the seeded voter. Start the orchestrator (<span className="mono">pnpm --filter @mandate/orchestrator serve</span>) and refresh a proposal (<span className="mono">pnpm proposal --reseed</span>) before granting.
      </p>
    </div>
  );
}

function GraphNode({ who, role, addr, active, link }: { who: string; role: string; addr?: string; active?: boolean; link?: boolean }) {
  return (
    <div className={`node ${active ? 'active' : ''}`}>
      <div className="who">{who}</div>
      <div className="label">{role}</div>
      {addr && (
        link ? (
          <a className="mono label" href={`${BASESCAN}/address/${addr}`} target="_blank" rel="noreferrer">
            {shortHex(addr, 4)}
          </a>
        ) : (
          <span className="mono label">{shortHex(addr, 4)}</span>
        )
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'voted' ? 'green' : status === 'failed' || status === 'revoked' ? 'red' : 'amber';
  return <span className={`pill ${cls}`}>{status}</span>;
}

function Step({
  done,
  fail,
  label,
  extra,
  children,
}: {
  done?: boolean;
  fail?: boolean;
  label: string;
  extra?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`step ${fail ? 'fail' : done ? 'done' : ''}`}>
      <div className="dot" />
      <div>
        <div>
          {label} {extra && <span className="mono label">· {extra}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}
