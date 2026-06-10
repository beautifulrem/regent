'use client';

import { useEffect, useRef, useState } from 'react';
import type { Delegation, RunStatus } from '@mandate/shared';
import { PROPOSALS, VOTE_BOARD_ADDRESS, isVoteBoardLive, withVotingPolicy } from '@mandate/shared';
import { presetFor } from '../lib/presets';
import { getDict, isLang, LANG_KEY, resolveLang, type Lang } from '../lib/i18n';
import { getConfig, getRun, postGrant, provision, voteAgain, type DemoConfig } from '../lib/orchestrator';
import { recall } from '../lib/recall';
import { fireSever } from '../lib/sever';
import { sfxGrant, sfxSever } from '../lib/sfx';
import { useAccount, useWalletClient } from 'wagmi';
import { deriveSmartAccount, signGrant, type SmartAccount } from '../lib/wallet';
import { MissionControl, type MissionVM } from '../components/MissionControl';
import { useMainnetReplay } from '../lib/useMainnetReplay';
import { MAINNET_SNAPSHOT } from '../lib/mainnet-snapshot';
import { type VoteRecord } from '../components/panels/VoteLog';

/**
 * Thin orchestrator: owns ALL run-flow state, effects, and actions, builds the view-model, and
 * hands it to the single-screen <MissionControl>. No presentation here — every region renders
 * from `vm`. Business logic (grant/vote/recall, polling, rotation) is unchanged from the prior UI.
 */
export default function Home() {
  const [lang, setLang] = useState<Lang>('en');
  const [network, setNetwork] = useState<'sepolia' | 'mainnet'>('sepolia');
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const { address, isConnected, isReconnecting } = useAccount();
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
  // Bumped on every disconnect/account-switch reset; async actions capture it at start and drop their
  // late writes if it changed mid-flight, so a vote/recall settling after disconnect can't re-light.
  const session = useRef(0);

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

  // Wipe the previous session's run-flow state when the wallet disconnects (or switches accounts), so
  // the cockpit drops back to its pristine, never-connected look — nothing left lit from the old run.
  // Guarded on the previous address: the initial undefined→connect must NOT clear a fresh grant (so a
  // hydration flicker can't wipe it either); we reset only when LEAVING a real account — → undefined on
  // disconnect, or A→B on switch. userSA is already cleared by the walletClient effect above.
  const prevAddress = useRef<typeof address>(undefined);
  useEffect(() => {
    const prev = prevAddress.current;
    if (prev === address) return;
    prevAddress.current = address;
    if (prev === undefined) return; // first connect — there's nothing from a prior session to clear
    session.current += 1; // invalidate any in-flight grant/vote/recall so its late write is dropped
    setRunId(null);
    setRun(null);
    setRootDel(null);
    setGrantedProposalId(null);
    setGrantRunId(null);
    setVotesUsed(0);
    setGrantedAt(null);
    setVoteLog([]);
    setRecallTx(null);
    setError(null);
    setBusy(false);
    setRecalling(false);
  }, [address]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false; // a fresh runId / disconnect must drop a late poll, not re-light the cockpit
    const tick = async () => {
      try {
        const r = await getRun(runId);
        if (cancelled) return;
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
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [runId]);

  // The wow-moment: fire the fracture burst + the power-down sweep the instant the chain is severed.
  // (fireSever skips the visual under prefers-reduced-motion; the audio is not motion, so it stays.)
  useEffect(() => {
    if (!recallTx) return;
    void fireSever(graphStageRef.current);
    sfxSever();
  }, [recallTx]);

  // Rotate the active proposal so new ones "open"; pause while a grant/run is in flight AND keep it
  // pinned once a vote has landed (or the chain was revoked), so the HUD + VoteBoard stay on the exact
  // proposal that was just voted — they no longer drift to another proposal under the orange "voted"
  // board. Only a failed run re-opens rotation (so the judge can retry); the proposal chips still let
  // the user move manually at any time.
  const rotationPaused = busy || network === 'mainnet' || (run != null && run.status !== 'failed');
  useEffect(() => {
    if (rotationPaused) return;
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % PROPOSALS.length), 24000);
    return () => clearInterval(id);
  }, [rotationPaused, activeIdx]);

  // Voting-mandate presets: one click sets bounds + an owner policy (passed to the TEE analyst as
  // decision context). Clicking the active preset clears it (back to "decide on merits").
  function applyPreset(key: string) {
    // 'default' is the no-policy baseline (decide on merits); selecting it (or re-clicking the
    // active stance) clears any owner mandate.
    if (key === 'default' || key === presetKey) {
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
    const mine = session.current;
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
        paymentToken: cfg.paymentToken,
        analyst: cfg.analyst,
        proposalText: activeProposal.body.en,
        maxVotes: boundMode === 'days' ? undefined : maxVotes,
        ttlDays: boundMode === 'votes' ? undefined : ttlDays,
        policy,
      });
      const { runId: id } = await postGrant(grant);
      if (session.current !== mine) return; // wallet disconnected/switched mid-grant — abandon this run
      setRootDel(grant.rootDelegation);
      setGrantedProposalId(activeProposal.id);
      setRun(null);
      setRunId(id);
      setGrantRunId(id);
      setVotesUsed(0); // the grant only establishes the standing mandate — no vote cast yet
      setGrantedAt(Date.now());
      sfxGrant();
    } catch (e) {
      if (session.current === mine) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (session.current === mine) setBusy(false);
    }
  }

  // Standing authority in action: vote on the CURRENT proposal reusing the existing grant — NO new
  // signature. Succeeds while the grant is live; reverts on-chain once revoked / exhausted / expired.
  async function onVoteActive() {
    if (!grantRunId || busy || recallTx) return; // chain severed → the mandate is dead, no more votes
    const mine = session.current;
    setBusy(true);
    setError(null);
    try {
      const { runId: id } = await voteAgain(grantRunId, activeProposal.id.toString(), withVotingPolicy(activeProposal.body.en, policy));
      if (session.current !== mine) return; // wallet left mid-vote — don't re-light a wiped cockpit
      setRun(null);
      setRunId(id);
      setVotesUsed((v) => v + 1);
    } catch (e) {
      if (session.current === mine) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (session.current === mine) setBusy(false);
    }
  }

  async function onRecall() {
    if (!userSA || !rootDel) return;
    const mine = session.current;
    setRecalling(true);
    setError(null);
    try {
      const { txHash } = await recall(userSA, rootDel);
      if (session.current !== mine) return; // disconnected mid-recall — don't resurrect a wiped cockpit
      setRecallTx(txHash);
    } catch (e) {
      if (session.current === mine) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (session.current === mine) setRecalling(false);
    }
  }

  const s = run?.status;
  const killed = !!recallTx;
  const terminal = ['voted', 'failed', 'revoked'].includes(s ?? '');
  // Is the (single, latest) run actually for the proposal currently on screen? The mandate is global,
  // but a run/vote is per-proposal — so when the user flips to a DIFFERENT proposal, the graph + TEE
  // console must fall back to the resting mandate state instead of replaying this run's progression.
  const runOnActive = !!run && run.proposalId === activeProposal.id.toString();

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
    reconnecting: isReconnecting,
    userSA,
    run,
    s,
    venice: run?.venice,
    lenses: run?.lenses,
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
    runOnActive,
    // 'granted' is the resting standing-mandate state (the run sleeps there after a grant — no vote
    // in flight), so it must NOT count as "running", or the "let AI vote" button stays disabled forever.
    // Only the redelegate→analyzing→deciding→voting stages are a vote actually in flight.
    running: !!run && !terminal && s !== 'granted',
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

  // Mainnet replay: a completed Base-mainnet 1Shot run rebuilt from the snapshot (null until recorded).
  const mainnetAvailable = !!MAINNET_SNAPSHOT;
  const toggleNetwork = () => setNetwork((n) => (n === 'sepolia' ? 'mainnet' : 'sepolia'));
  const replayVm = useMainnetReplay({ lang, t, toggleLang, graphStageRef, active: network === 'mainnet' });

  const netProps = { network, toggleNetwork, mainnetAvailable };
  const shown: MissionVM =
    network === 'mainnet' && replayVm ? { ...replayVm, ...netProps } : { ...vm, ...netProps };

  return <MissionControl vm={shown} />;
}
