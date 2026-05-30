'use client';

import { useEffect, useRef, useState } from 'react';
import type { RunStatus } from '@mandate/shared';
import { BASESCAN, DEMO_PROPOSAL, shortHex } from '../lib/config';
import { getConfig, getRun, postGrant, type DemoConfig } from '../lib/orchestrator';
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
  const [busy, setBusy] = useState(false);
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
    try {
      const c = conn ?? (await connect());
      setConn(c);
      const grant = await signGrant(c.userSA, {
        governor: cfg.governor,
        proposalId: cfg.proposalId,
        orchestratorSA: cfg.orchestratorSA,
      });
      const { runId: id } = await postGrant(grant);
      setRun(null);
      setRunId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const s = run?.status;
  const venice = run?.venice;

  return (
    <div className="wrap">
      <h1 className="title">Mandate</h1>
      <p className="sub">Revocable, scoped delegation of governance voting to an AI agent — on Base.</p>

      {/* connection */}
      <div className="panel row spread">
        <div>
          <div className="label">Your wallet (root delegator)</div>
          <div className="mono">{conn ? conn.address : 'not connected'}</div>
          {conn && <div className="label">smart account&nbsp;<span className="mono">{shortHex(conn.userSA.address, 6)}</span></div>}
        </div>
        {!conn && <button onClick={onConnect}>Connect MetaMask</button>}
      </div>

      {/* proposal */}
      <div className="panel">
        <div className="row spread">
          <div className="label">Active proposal {cfg && <span className="mono">#{shortHex(cfg.proposalId, 5)}</span>}</div>
          {cfg && (
            <a className="mono" href={`${BASESCAN}/address/${cfg.governor}`} target="_blank" rel="noreferrer">
              Governor {shortHex(cfg.governor, 4)} ↗
            </a>
          )}
        </div>
        <p style={{ marginBottom: 0 }}>{DEMO_PROPOSAL}</p>
      </div>

      {/* authority graph */}
      <div className="panel">
        <div className="label" style={{ marginBottom: 10 }}>Authority chain</div>
        <div className="graph">
          <div className={`node ${conn ? 'active' : ''}`}>
            <div className="who">You</div>
            <div className="label">root delegator</div>
          </div>
          <div className="arrow">→</div>
          <div className={`node ${reached(s, 'redelegated') ? 'active' : ''}`}>
            <div className="who">Orchestrator</div>
            <div className="label">attenuates &amp; redelegates</div>
          </div>
          <div className="arrow">→</div>
          <div className={`node ${reached(s, 'analyzing') ? 'active' : ''}`}>
            <div className="who">Analyst</div>
            <div className="label">Venice TEE · casts vote</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <span className="pill">2 signed delegations</span>
          <span className="pill">3 participants</span>
          <span className="pill">scope: castVote · proposalId locked · support free</span>
        </div>
      </div>

      {/* action */}
      <div className="panel row spread">
        <div className="label">
          Grant scoped authority to vote on this proposal. You can revoke the whole chain anytime.
        </div>
        <button onClick={onGrant} disabled={busy || !cfg || (!!s && s !== 'failed')}>
          {busy ? 'Signing…' : 'Grant & run'}
        </button>
      </div>

      {error && <div className="panel err">⚠ {error}</div>}

      {/* run status */}
      {run && (
        <div className="panel">
          <div className="row spread" style={{ marginBottom: 12 }}>
            <div className="label">Run <span className="mono">{shortHex(run.runId, 6)}</span></div>
            <StatusPill status={run.status} />
          </div>

          <div className="steps">
            <Step done={reached(s, 'granted')} label="You signed the root delegation (MetaMask)" />
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

          {/* Recall — wired in the kill-the-chain step */}
          <div className="row spread" style={{ marginTop: 16 }}>
            <div className="label">Kill the chain: disable the root delegation; the next redemption reverts.</div>
            <button className="danger" disabled title="Recall lands in the kill-the-chain step">
              Recall (soon)
            </button>
          </div>
        </div>
      )}

      <p className="label" style={{ marginTop: 24 }}>
        Demo wallet must be the seeded voter. Start the orchestrator (<span className="mono">pnpm --filter @mandate/orchestrator serve</span>) and refresh a proposal (<span className="mono">pnpm proposal --reseed</span>) before granting.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'voted' ? 'green' : status === 'failed' ? 'red' : status === 'revoked' ? 'red' : 'amber';
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
