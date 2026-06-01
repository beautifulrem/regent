'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delegation, RunStatus } from '@mandate/shared';
import { PROPOSALS, VOTE_BOARD_ADDRESS, isVoteBoardLive, withVotingPolicy } from '@mandate/shared';
import { presetFor } from '../lib/presets';
import { getDict, isLang, LANG_KEY, resolveLang, type Lang } from '../lib/i18n';
import { getConfig, getRun, postGrant, provision, voteAgain, type DemoConfig } from '../lib/orchestrator';
import { recall } from '../lib/recall';
import { fireSever } from '../lib/sever';
import { useAccount, useWalletClient } from 'wagmi';
import { deriveSmartAccount, signGrant, type SmartAccount } from '../lib/wallet';
import { MissionControl, type MissionVM } from '../components/MissionControl';
import { type VoteRecord } from '../components/panels/VoteLog';

/**
 * Thin orchestrator: owns ALL run-flow state, effects, and actions, builds the view-model, and
 * hands it to the single-screen <MissionControl>. No presentation here — every region renders
 * from `vm`. Business logic (grant/vote/recall, polling, rotation) is unchanged from the prior UI.
 */
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
  const [grantedAt, setGrantedAt] = useState<number | null>(null);
  const [voteLog, setVoteLog] = useState<VoteRecord[]>([]);
  const [policy, setPolicy] = useState<string | undefined>(undefined);
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const [maxVotes, setMaxVotes] = useState(10);
  const [ttlDays, setTtlDays] = useState(30);
  const [boundMode, setBoundMode] = useState<'votes' | 'days' | 'both'>('both');
  const [busy, setBusy] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [recallTx, setRecallTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const graphStageRef = useRef<HTMLDivElement>(null);

  const t = getDict(lang);
  const activeProposal = PROPOSALS[activeIdx];

  // Pick language after mount (stored choice, else browser locale) so the first client render
  // matches the server's 'en' default — no hydration mismatch.
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
      .then((sa) => {
        if (!cancelled) setUserSA(sa);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [walletClient]);

  useEffect(() => {
    if (!runId) return;
    const tick = async () => {
      try {
        const r = await getRun(runId);
        setRun(r);
        if (r.status === 'voted' && r.vote) {
          const txHash = r.vote.txHash;
          setVoteLog((log) =>
            log.some((e) => e.runId === r.runId)
              ? log
              : [
                  {
                    runId: r.runId,
                    proposalId: r.proposalId,
                    decision: r.venice?.decision,
                    rationale: r.venice?.rationale,
                    txHash,
                    attested: !!r.venice?.attestation.verified,
                  },
                  ...log,
                ],
          );
        }
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
    if (recallTx) void fireSever(graphStageRef.current);
  }, [recallTx]);

  // Rotate the active proposal so new ones "open"; pause while a grant/run is in flight.
  const rotationPaused = busy || (run != null && !['voted', 'failed', 'revoked'].includes(run.status));
  useEffect(() => {
    if (rotationPaused) return;
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % PROPOSALS.length), 24000);
    return () => clearInterval(id);
  }, [rotationPaused, activeIdx]);

  // Voting-mandate presets: one click sets bounds + an owner policy (passed to the TEE analyst as
  // decision context). Clicking the active preset clears it (back to "decide on merits").
  function applyPreset(key: string) {
    if (key === presetKey) {
      setPresetKey(null);
      setPolicy(undefined);
      return;
    }
    const p = presetFor(key);
    if (!p) return;
    setPresetKey(key);
    setPolicy(p.policy);
    setBoundMode('both');
    setMaxVotes(p.maxVotes);
    setTtlDays(p.ttlDays);
  }

  async function onGrant() {
    if (!cfg || !userSA || !address) return;
    setBusy(true);
    setError(null);
    setRecallTx(null);
    setVoteLog([]);
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
        maxVotes: boundMode === 'days' ? undefined : maxVotes,
        ttlDays: boundMode === 'votes' ? undefined : ttlDays,
        policy,
      });
      setRootDel(grant.rootDelegation);
      setGrantedProposalId(activeProposal.id);
      const { runId: id } = await postGrant(grant);
      setRun(null);
      setRunId(id);
      setGrantRunId(id);
      setVotesUsed(1);
      setGrantedAt(Date.now());
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
      const { runId: id } = await voteAgain(grantRunId, activeProposal.id.toString(), withVotingPolicy(activeProposal.body.en, policy));
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
  const killed = !!recallTx;
  const terminal = ['voted', 'failed', 'revoked'].includes(s ?? '');

  const vm: MissionVM = {
    lang,
    t,
    toggleLang,
    cfg,
    activeIdx,
    setActiveIdx,
    activeProposal,
    proposalCount: PROPOSALS.length,
    address,
    isConnected,
    userSA,
    run,
    s,
    venice: run?.venice,
    rootDel,
    grantedProposalId,
    grantRunId,
    votesUsed,
    grantedAt,
    voteLog,
    youAddr: run?.delegations.participants?.user ?? userSA?.address,
    orchAddr: run?.delegations.participants?.orchestrator ?? cfg?.orchestratorSA,
    analystAddr: run?.delegations.participants?.analyst ?? cfg?.analyst,
    killed,
    terminal,
    running: !!run && !terminal,
    statusKey: killed ? 'revoked' : (run?.status ?? ''),
    authorityPct: run && !killed ? 100 : 0,
    maxVotes,
    setMaxVotes,
    ttlDays,
    setTtlDays,
    boundMode,
    setBoundMode,
    presetKey,
    applyPreset,
    busy,
    recalling,
    recallTx,
    error,
    graphStageRef,
    onGrant,
    onVoteActive,
    onRecall,
  };

  return <MissionControl vm={vm} />;
}
