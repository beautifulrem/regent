/**
 * @mandate/orchestrator HTTP service. Serves the shared run contract:
 *   POST /grant   → validate a GrantRequest, start the autonomous loop, return { runId }
 *   GET  /run/:id → the current RunStatus
 *   GET  /runs    → all runs (debug/UI)
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
  type Delegation,
} from '@mandate/shared';

import { RunStore } from './runStore.js';
import { runVote, type OrchestratorConfig } from './runVote.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(REPO_ROOT, '.env') });

const cfg: OrchestratorConfig = {
  rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com',
  orchestratorPk: (process.env.ORCHESTRATOR_PK ?? '') as Hex,
  analystPk: (process.env.ANALYST_PK ?? '') as Hex,
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'POST' && url.pathname === '/grant') return void handleGrant(req, res);
  if (req.method === 'GET' && url.pathname === '/runs') return send(res, 200, store.list());
  if (req.method === 'GET' && url.pathname.startsWith('/run/')) {
    const run = store.get(url.pathname.slice('/run/'.length));
    return run ? send(res, 200, run) : send(res, 404, { error: 'run not found' });
  }
  if (req.method === 'GET' && url.pathname === '/config') {
    return send(res, 200, {
      chainId: 84532,
      governor: ADDRESSES.baseSepolia.governor,
      token: ADDRESSES.baseSepolia.token,
      proposalId: ADDRESSES.baseSepolia.proposalId,
      orchestratorSA: ADDRESSES.accounts.orchestrator,
      analyst: privateKeyToAccount(cfg.analystPk).address,
    });
  }
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`orchestrator listening on http://localhost:${PORT}`));
