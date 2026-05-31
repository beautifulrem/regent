/**
 * Venice AI analyst client. A TEE model privately analyses a governance proposal and decides
 * For / Against / Abstain; the decision maps to the OZ `support` the analyst will cast. Each
 * completion runs in a Phala TEE — proven per-response by the `x-venice-tee` header.
 *
 * Pure parsing/model-selection is unit-tested; the HTTP calls are exercised live.
 */
import type { Address } from 'viem';
import { SUPPORT, type Decision, type Support, type VeniceTrace } from './api.js';

export const GOVERNANCE_SYSTEM_PROMPT =
  'You are an impartial DAO governance analyst. Weigh the proposal on alignment, risk, cost, ' +
  'and accountability, then decide. After any reasoning, output ONLY one line of minified JSON: ' +
  '{"decision":"For|Against|Abstain","rationale":"<=20 words"}';

export interface VeniceDecision {
  decision: Decision;
  support: Support; // 0=Against 1=For 2=Abstain (OZ GovernorCountingSimple)
  rationale: string;
}

const DECISION_TO_SUPPORT: Record<Decision, Support> = SUPPORT;

function normalizeDecision(value: unknown): Decision {
  switch (String(value ?? '').trim().toLowerCase()) {
    case 'for':
      return 'For';
    case 'against':
      return 'Against';
    case 'abstain':
      return 'Abstain';
    default:
      throw new Error(`invalid Venice decision: ${JSON.stringify(value)}`);
  }
}

/**
 * Pure: extract {decision, rationale} from a model response and map it to a support code.
 * Scans for flat JSON objects containing `decision` and uses the LAST valid one, so a reasoning
 * model that "thinks" before emitting its final answer is parsed correctly.
 */
export function parseDecision(content: string): VeniceDecision {
  const candidates = content.match(/\{[^{}]*"decision"[^{}]*\}/gi);
  if (!candidates || candidates.length === 0) throw new Error('no JSON object in Venice response');
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(candidates[i]) as { decision?: unknown; rationale?: unknown };
      const decision = normalizeDecision(obj.decision);
      return {
        decision,
        support: DECISION_TO_SUPPORT[decision],
        rationale: String(obj.rationale ?? '').trim(),
      };
    } catch {
      // not this one (malformed or invalid decision) — keep scanning earlier candidates
    }
  }
  throw new Error('no valid decision in Venice response');
}

export interface VeniceModel {
  id: string;
  model_spec?: { capabilities?: { supportsTeeAttestation?: boolean } };
}

/**
 * Pure: pick a TEE-attestation model from a /models listing. Honours `preferred` if it is a
 * TEE model; otherwise prefers a known reasoning model, else the first available.
 */
export function resolveTeeModel(models: VeniceModel[], preferred?: string): string {
  const tee = models.filter((m) => m.model_spec?.capabilities?.supportsTeeAttestation);
  if (tee.length === 0) throw new Error('no TEE-attestation models available from Venice');
  if (preferred && tee.some((m) => m.id === preferred)) return preferred;
  const known = ['e2ee-qwen3-5-122b-a10b', 'e2ee-gpt-oss-120b-p', 'e2ee-gpt-oss-20b-p'];
  for (const id of known) if (tee.some((m) => m.id === id)) return id;
  return tee[0].id;
}

// --- HTTP -------------------------------------------------------------------

export interface VeniceConfig {
  apiUrl: string;
  apiKey: string;
  model?: string;
}

export interface TeeProof {
  verified: boolean;
  provider?: string;
}

export interface AnalysisResult {
  decision: VeniceDecision;
  model: string;
  tee: TeeProof;
  usage?: unknown;
  /** the model's reasoning_content (capped), surfaced for the UI's TEE reasoning stream. */
  reasoning?: string;
}

async function veniceFetch(cfg: VeniceConfig, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${cfg.apiUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.apiKey}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Venice ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

/** List the models Venice currently serves. */
export async function fetchModels(cfg: VeniceConfig): Promise<VeniceModel[]> {
  const res = await veniceFetch(cfg, '/models');
  return ((await res.json()) as { data?: VeniceModel[] }).data ?? [];
}

/** Resolve the TEE model to use (configured one if valid, else a sensible default). */
export async function resolveModel(cfg: VeniceConfig): Promise<string> {
  return resolveTeeModel(await fetchModels(cfg), cfg.model);
}

/** A Venice TEE attestation report, reduced to the fields the demo verifies/badges. */
export interface TeeAttestation {
  model: string;
  verified: boolean;
  /** the enclave's ECDSA signing address (recovers per-completion signatures). */
  signingAddress: Address;
  /** the attestation nonce (freshness). */
  nonce: string;
  teeProvider?: string;
  teeHardware?: string;
}

/** Pure: reduce a raw /tee/attestation response to the badge fields. */
export function mapAttestation(json: Record<string, unknown>): TeeAttestation {
  return {
    model: String(json.model ?? json.model_name ?? ''),
    verified: json.verified === true,
    signingAddress: String(json.signing_address ?? '') as Address,
    nonce: String(json.request_nonce ?? json.nonce ?? ''),
    teeProvider: json.tee_provider ? String(json.tee_provider) : undefined,
    teeHardware: json.tee_hardware ? String(json.tee_hardware) : undefined,
  };
}

/** Fetch + reduce the TEE attestation report for a model (Intel TDX quote, signing address, nonce). */
export async function fetchAttestation(cfg: VeniceConfig, model: string): Promise<TeeAttestation> {
  const res = await veniceFetch(cfg, `/tee/attestation?model=${encodeURIComponent(model)}`);
  return mapAttestation((await res.json()) as Record<string, unknown>);
}

/**
 * Pure: project an analysis result (+ optional attestation) onto the app-facing VeniceTrace
 * contract. decision/support stay consistent (parseDecision guarantees it).
 */
export function toVeniceTrace(result: AnalysisResult, attestation?: TeeAttestation): VeniceTrace {
  return {
    model: result.model,
    support: result.decision.support,
    decision: result.decision.decision,
    rationale: result.decision.rationale,
    reasoning: result.reasoning,
    attestation: {
      verified: result.tee.verified || (attestation?.verified ?? false),
      nonce: attestation?.nonce,
    },
    signature: {
      recovered: attestation?.verified ?? false,
      signingAddress: attestation?.signingAddress,
    },
  };
}

/** Run the private TEE analysis and return the decision + per-completion TEE proof. */
export async function analyzeProposal(cfg: VeniceConfig, proposalText: string): Promise<AnalysisResult> {
  // resolveModel honours cfg.model when it is a live TEE model, else self-heals to a default
  // (so a stale VENICE_MODEL from .env doesn't break the run).
  const model = await resolveModel(cfg);
  const res = await veniceFetch(cfg, '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 2048, // reasoning models need room to finish before the final JSON line
      temperature: 0,
      messages: [
        { role: 'system', content: GOVERNANCE_SYSTEM_PROMPT },
        { role: 'user', content: proposalText },
      ],
    }),
  });
  const tee: TeeProof = {
    verified: res.headers.get('x-venice-tee') === 'true',
    provider: res.headers.get('x-venice-tee-provider') ?? undefined,
  };
  const json = (await res.json()) as {
    choices?: { message?: { content?: string; reasoning_content?: string } }[];
    usage?: unknown;
  };
  const message = json.choices?.[0]?.message;
  const content = message?.content || message?.reasoning_content || '';
  const reasoning = (message?.reasoning_content ?? '').trim().slice(0, 360) || undefined;
  return { decision: parseDecision(content), model, tee, usage: json.usage, reasoning };
}
