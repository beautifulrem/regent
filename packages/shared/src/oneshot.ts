/**
 * 1Shot permissionless relayer client (ERC-7710 + EIP-7702 gas abstraction).
 *
 * The public relayer takes no API key — anyone POSTs JSON-RPC and pays the per-tx fee in a
 * stablecoin inside the bundle. It is MAINNET-ONLY (Base Sepolia returns empty capabilities),
 * so the actual `send7710Transaction` runs on the mainnet leg (T16, ask-first); the read-only
 * methods (getCapabilities/getFeeData) and all pure helpers below are exercised for free.
 *
 * Method shapes verified against the 1Shot openrpc + the canonical relayer example.
 */
import type { webcrypto } from 'node:crypto'; // type-only → erased at compile (browser-safe)
import type { Address, Hex } from 'viem';

export const ONESHOT_RELAYER_URL = 'https://relayer.1shotapi.com/relayers';

// --- task status ------------------------------------------------------------

export enum RelayStatus {
  Pending = 100,
  Submitted = 110,
  Confirmed = 200,
  Rejected = 400,
  Reverted = 500,
}

const STATUS_LABEL: Record<number, string> = {
  100: 'Pending',
  110: 'Submitted',
  200: 'Confirmed',
  400: 'Rejected',
  500: 'Reverted',
};

export function relayStatusLabel(status: number): string {
  return STATUS_LABEL[status] ?? `Unknown(${status})`;
}

/** Confirmed / Rejected / Reverted are terminal; Pending / Submitted are not. */
export function isTerminalStatus(status: number): boolean {
  return status === RelayStatus.Confirmed || status === RelayStatus.Rejected || status === RelayStatus.Reverted;
}

// --- capabilities / fees ----------------------------------------------------

export interface RelayerToken {
  address: Address;
  symbol: string;
  decimals: string;
}
export interface ChainCapabilities {
  feeCollector: Address;
  targetAddress: Address; // the delegation `to` address (must match or redemption fails)
  tokens: RelayerToken[];
}
export type CapabilitiesResult = Record<string, ChainCapabilities>;

/** Pick a payment token by symbol from a capabilities result. Never hardcode token addresses. */
export function pickPaymentToken(
  caps: CapabilitiesResult,
  chainId: number | string,
  symbol: string,
): RelayerToken {
  const chain = caps[String(chainId)];
  if (!chain) throw new Error(`relayer does not support chain ${chainId}`);
  const token = chain.tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
  if (!token) throw new Error(`relayer chain ${chainId} does not accept ${symbol}`);
  return token;
}

/** Apply the relayer's fee floor: feeAmount = max(convertedFee, minFee). */
export function floorFee(convertedFee: bigint, minFee: bigint): bigint {
  return convertedFee > minFee ? convertedFee : minFee;
}

/** EIP-7702: an upgraded EOA's code is `0xef0100 || <delegate address>`. */
export function is7702Upgraded(code: Hex | null | undefined): boolean {
  return typeof code === 'string' && code.toLowerCase().startsWith('0xef0100');
}

// --- JSON-RPC ---------------------------------------------------------------

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export async function relayerCall<T>(url: string, method: string, params: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await res.json()) as JsonRpcResponse<T>;
  if (!res.ok) throw new Error(`relayer HTTP ${res.status}: ${JSON.stringify(json)}`);
  if (json.error) throw new Error(`relayer ${method}: ${json.error.message} ${JSON.stringify(json.error.data ?? '')}`);
  if (json.result === undefined) throw new Error(`relayer ${method}: empty result`);
  return json.result;
}

export function getCapabilities(chainId: number | string, url = ONESHOT_RELAYER_URL): Promise<CapabilitiesResult> {
  return relayerCall<CapabilitiesResult>(url, 'relayer_getCapabilities', [String(chainId)]);
}

export function getFeeData(
  chainId: number | string,
  token: Address,
  url = ONESHOT_RELAYER_URL,
): Promise<{ gasPrice: string; rate: string; minFee: string; expiry: number; context: unknown }> {
  return relayerCall(url, 'relayer_getFeeData', { chainId: String(chainId), token });
}

export interface Execution {
  target: Address;
  value: string;
  data: Hex;
}

/** Pure: build the relayer_send7710Transaction params (one bundle, one permission context). */
export function buildSend7710Params(args: {
  chainId: number | string;
  permissionContext: unknown[]; // the signed delegation chain (JSON-safe)
  executions: Execution[];
  authorizationList?: unknown[]; // EIP-7702 authorization, first use only
}): Record<string, unknown> {
  return {
    chainId: String(args.chainId),
    ...(args.authorizationList ? { authorizationList: args.authorizationList } : {}),
    transactions: [{ permissionContext: args.permissionContext, executions: args.executions }],
  };
}

/** Submit a 7710 bundle (mainnet). Returns the taskId. */
export function send7710Transaction(
  params: ReturnType<typeof buildSend7710Params>,
  url = ONESHOT_RELAYER_URL,
): Promise<Hex> {
  return relayerCall<Hex>(url, 'relayer_send7710Transaction', params);
}

export function estimate7710Transaction(
  params: ReturnType<typeof buildSend7710Params>,
  url = ONESHOT_RELAYER_URL,
): Promise<{ success: boolean; requiredPaymentAmount?: string; gasUsed?: unknown; context?: unknown; error?: unknown }> {
  return relayerCall(url, 'relayer_estimate7710Transaction', params);
}

export interface RelayTaskStatus {
  status: number;
  message?: string;
  hash?: Hex;
}
export function getStatus(taskId: Hex, url = ONESHOT_RELAYER_URL): Promise<RelayTaskStatus> {
  return relayerCall<RelayTaskStatus>(url, 'relayer_getStatus', { id: taskId, logs: true });
}

// --- webhook signature verification (Ed25519 against the relayer JWKS) -------

/** A JWK Ed25519 public key (kty=OKP, crv=Ed25519, x=base64url). */
export interface Ed25519Jwk {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  kid?: string;
}

/**
 * Verify a relayer webhook's Ed25519 signature over the raw payload bytes. Returns true iff the
 * signature is valid for the given JWKS public key — reject any event that fails before acting.
 * Uses Web Crypto (works in Node 18+ and the browser).
 */
export async function verifyWebhookSignature(
  payload: string | Uint8Array,
  signature: Uint8Array,
  jwk: Ed25519Jwk,
): Promise<boolean> {
  try {
    const key = await globalThis.crypto.subtle.importKey(
      'jwk',
      jwk as unknown as webcrypto.JsonWebKey,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const data = new Uint8Array(typeof payload === 'string' ? new TextEncoder().encode(payload) : payload);
    return await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, key, new Uint8Array(signature), data);
  } catch {
    return false;
  }
}
