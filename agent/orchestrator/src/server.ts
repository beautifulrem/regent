/**
 * @mandate/orchestrator HTTP service. Serves the shared run contract:
 *   POST /grant            → validate a GrantRequest, start the autonomous loop, return { runId }
 *   GET  /run/:id          → the current RunStatus
 *   GET  /run/:id/events   → Server-Sent Events stream of the run's state changes (no polling)
 *   GET  /run/:id/verdict-audio → the TEE verdict spoken via Venice /audio/speech (mp3)
 *   POST /webhooks/1shot   → 1Shot relayer status webhooks (Ed25519-verified against the JWKS)
 *   GET  /relay/events     → the received relayer webhook events (newest first)
 *   GET  /runs             → all runs (debug/UI)
 *
 * Signs the redelegation with ORCHESTRATOR_PK and casts with ANALYST_PK (from .env).
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import {
  ADDRESSES,
  delegationHash,
  delegationManagerAddress,
  GrantRequestSchema,
  ONESHOT_JWKS_URL,
  synthesizeSpeech,
  verifyRelayerWebhook,
  WEBHOOK_TYPE_LABEL,
  type Delegation,
  type Ed25519Jwk,
  type RelayerWebhookEvent,
} from '@mandate/shared';

import { RunStore } from './runStore.js';
import { runVote, voteAgain, chainMeta, type OrchestratorConfig } from './runVote.js';
import { provisionSmartAccount } from './provision.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(REPO_ROOT, '.env') });

const chain = (process.env.MANDATE_CHAIN ?? 'sepolia') as 'sepolia' | 'mainnet';
const isMainnet = chain === 'mainnet';
const addrs = isMainnet ? ADDRESSES.baseMainnet : ADDRESSES.baseSepolia;

const cfg: OrchestratorConfig = {
  rpcUrl: isMainnet
    ? (process.env.BASE_MAINNET_RPC_URL || 'https://base-rpc.publicnode.com')
    : (process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com'),
  orchestratorPk: (process.env.ORCHESTRATOR_PK ?? '') as Hex,
  analystPk: (process.env.ANALYST_PK ?? '') as Hex,
  paymentToken: addrs.paymentToken as Address,
  veniceCfg: {
    apiUrl: process.env.VENICE_API_URL || 'https://api.venice.ai/api/v1',
    apiKey: process.env.VENICE_API_KEY || '',
    model: process.env.VENICE_MODEL || undefined,
  },
};

const store = new RunStore();
const PORT = Number(process.env.PORT ?? 8787);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

async function handleGrant(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!cfg.orchestratorPk || !cfg.analystPk || !cfg.veniceCfg.apiKey) {
    return send(res, 500, { error: 'orchestrator not configured (ORCHESTRATOR_PK/ANALYST_PK/VENICE_API_KEY)' });
  }
  const parsed = GrantRequestSchema.safeParse(await readJson(req).catch(() => null));
  if (!parsed.success) return send(res, 400, { error: 'invalid grant', issues: parsed.error.issues });
  const grant = parsed.data;

  const dm = delegationManagerAddress(grant.chainId);
  const analyst = privateKeyToAccount(cfg.analystPk).address;
  const run = store.create({
    chainId: grant.chainId,
    governor: grant.governor as Address,
    proposalId: grant.proposalId,
    delegations: {
      rootHash: delegationHash(grant.rootDelegation as unknown as Delegation, grant.chainId, dm),
      participants: {
        user: grant.rootDelegation.delegator as Address,
        orchestrator: grant.rootDelegation.delegate as Address,
        analyst,
      },
    },
  });

  // run the autonomous loop in the background; the client polls GET /run/:id
  void runVote(store, run.runId, grant, cfg);
  send(res, 201, { runId: run.runId });
}

/**
 * Deploy a connecting wallet's smart account so it can be voted-as on the shared VoteBoard.
 * Any judge can join: we derive their Hybrid SA from the EOA and pay the one-time deploy.
 */
async function handleProvision(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const deployerPk = (process.env.DEPLOYER_PK ?? '') as Hex;
  if (!deployerPk) return send(res, 500, { error: 'orchestrator not configured (DEPLOYER_PK)' });
  const body = (await readJson(req).catch(() => null)) as { eoa?: string } | null;
  const eoa = body?.eoa;
  if (!eoa || !/^0x[0-9a-fA-F]{40}$/.test(eoa)) return send(res, 400, { error: 'invalid eoa' });
  try {
    const result = await provisionSmartAccount(
      { rpcUrl: cfg.rpcUrl, deployerPk, paymentToken: cfg.paymentToken as Address },
      eoa as Address,
    );
    send(res, 200, result);
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Cast on ANOTHER proposal reusing an existing run's STANDING chain — no new user signature.
 * Creates a fresh run that re-redeems the cached chain; reverts on-chain (run → failed) if the
 * grant is exhausted (LimitedCalls), expired (Timestamp), or revoked (disableDelegation).
 */
async function handleVoteAgain(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!cfg.orchestratorPk || !cfg.analystPk || !cfg.veniceCfg.apiKey) {
    return send(res, 500, { error: 'orchestrator not configured' });
  }
  const body = (await readJson(req).catch(() => null)) as
    | { runId?: string; proposalId?: string; proposalText?: string }
    | null;
  const fromRunId = body?.runId;
  const proposalId = body?.proposalId;
  if (!fromRunId || !proposalId) return send(res, 400, { error: 'runId + proposalId required' });
  const meta = chainMeta(fromRunId);
  const origRun = store.get(fromRunId);
  if (!meta || !origRun) return send(res, 404, { error: 'no standing chain for that run — grant first' });

  const newRun = store.create({
    chainId: meta.chainId,
    governor: meta.governor,
    proposalId,
    delegations: { rootHash: origRun.delegations.rootHash, participants: origRun.delegations.participants },
  });
  void voteAgain(store, fromRunId, newRun.runId, BigInt(proposalId), body?.proposalText ?? '', cfg);
  send(res, 201, { runId: newRun.runId });
}

/**
 * SSE stream of one run's state changes: the current state immediately, then a push on every
 * RunStore patch (sub-second, no client polling). A comment heartbeat keeps proxies from
 * idling the connection out.
 */
function handleRunEvents(req: http.IncomingMessage, res: http.ServerResponse, runId: string): void {
  const run = store.get(runId);
  if (!run) return send(res, 404, { error: 'run not found' });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...CORS,
  });
  const write = (r: unknown) => res.write(`data: ${JSON.stringify(r)}\n\n`);
  write(run);
  const unsubscribe = store.subscribe(runId, write);
  const heartbeat = setInterval(() => res.write(': hb\n\n'), 15_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

// --- 1Shot relayer webhooks: signed status events instead of polling ---------------------------

interface ReceivedRelayEvent extends RelayerWebhookEvent {
  receivedAt: string;
  /** Ed25519 signature checked against the relayer JWKS — act only on verified events. */
  verified: boolean;
  label?: string;
}

const relayEvents: ReceivedRelayEvent[] = [];
let jwksCache: { keys: Ed25519Jwk[] } | null = null;

async function relayerJwks(): Promise<{ keys: Ed25519Jwk[] }> {
  if (!jwksCache) {
    const res = await fetch(process.env.ONESHOT_JWKS_URL || ONESHOT_JWKS_URL);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    jwksCache = (await res.json()) as { keys: Ed25519Jwk[] };
  }
  return jwksCache;
}

async function handleRelayerWebhook(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = (await readJson(req).catch(() => null)) as RelayerWebhookEvent | null;
  if (!body || typeof body.type !== 'number') return send(res, 400, { error: 'invalid webhook body' });
  let verified = false;
  try {
    verified = await verifyRelayerWebhook(body, await relayerJwks());
  } catch {
    verified = false; // JWKS unreachable — record the event, but never as verified
  }
  relayEvents.unshift({ ...body, receivedAt: new Date().toISOString(), verified, label: WEBHOOK_TYPE_LABEL[body.type] });
  if (relayEvents.length > 200) relayEvents.pop();
  console.log(`1shot webhook: type=${body.type} (${WEBHOOK_TYPE_LABEL[body.type] ?? '?'}) verified=${verified}`);
  send(res, 202, { ok: true, verified });
}

// --- Venice TTS: the TEE verdict, spoken (a second Venice modality in the main flow) ------------

const audioCache = new Map<string, Uint8Array>();

async function handleVerdictAudio(res: http.ServerResponse, runId: string): Promise<void> {
  const run = store.get(runId);
  if (!run?.venice) return send(res, 404, { error: 'no verdict for that run yet' });
  if (!cfg.veniceCfg.apiKey) return send(res, 500, { error: 'orchestrator not configured (VENICE_API_KEY)' });
  try {
    let bytes = audioCache.get(runId);
    if (!bytes) {
      const text = `The committee verdict is: ${run.venice.decision}. ${run.venice.rationale}`;
      bytes = await synthesizeSpeech(cfg.veniceCfg, { text });
      audioCache.set(runId, bytes);
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.byteLength), ...CORS });
    res.end(Buffer.from(bytes));
  } catch (err) {
    send(res, 502, { error: err instanceof Error ? err.message : String(err) });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'POST' && url.pathname === '/grant') return void handleGrant(req, res);
  if (req.method === 'POST' && url.pathname === '/vote-again') return void handleVoteAgain(req, res);
  if (req.method === 'POST' && url.pathname === '/provision') return void handleProvision(req, res);
  if (req.method === 'POST' && url.pathname === '/webhooks/1shot') return void handleRelayerWebhook(req, res);
  if (req.method === 'GET' && url.pathname === '/relay/events') return send(res, 200, relayEvents);
  if (req.method === 'GET' && url.pathname === '/runs') return send(res, 200, store.list());
  if (req.method === 'GET' && url.pathname.startsWith('/run/')) {
    const rest = url.pathname.slice('/run/'.length);
    if (rest.endsWith('/events')) return handleRunEvents(req, res, rest.slice(0, -'/events'.length));
    if (rest.endsWith('/verdict-audio')) return void handleVerdictAudio(res, rest.slice(0, -'/verdict-audio'.length));
    const run = store.get(rest);
    return run ? send(res, 200, run) : send(res, 404, { error: 'run not found' });
  }
  if (req.method === 'GET' && url.pathname === '/config') {
    return send(res, 200, {
      chainId: isMainnet ? 8453 : 84532,
      governor: addrs.governor,
      token: addrs.token,
      paymentToken: addrs.paymentToken,
      proposalId: addrs.proposalId,
      orchestratorSA: ADDRESSES.accounts.orchestrator,
      analyst: privateKeyToAccount(cfg.analystPk).address,
    });
  }
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`orchestrator listening on http://localhost:${PORT}`));
