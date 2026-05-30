import { describe, expect, it } from 'vitest';
import { mapAttestation, parseDecision, resolveTeeModel, type VeniceModel } from './venice.js';

describe('parseDecision', () => {
  it('maps For/Against/Abstain to OZ support codes', () => {
    expect(parseDecision('{"decision":"For","rationale":"good"}')).toEqual({ decision: 'For', support: 1, rationale: 'good' });
    expect(parseDecision('{"decision":"Against","rationale":"bad"}').support).toBe(0);
    expect(parseDecision('{"decision":"Abstain","rationale":"unsure"}').support).toBe(2);
  });

  it('is case-insensitive on the decision label', () => {
    expect(parseDecision('{"decision":"for","rationale":"x"}').decision).toBe('For');
    expect(parseDecision('{"decision":"AGAINST","rationale":"x"}').decision).toBe('Against');
  });

  it('extracts the JSON even with reasoning text or fences around it', () => {
    const noisy = 'Thinking... the grant is small and audited.\n```json\n{"decision":"For","rationale":"audited, milestone, clawback"}\n```';
    expect(parseDecision(noisy)).toEqual({ decision: 'For', support: 1, rationale: 'audited, milestone, clawback' });
  });

  it('throws on an invalid decision value', () => {
    expect(() => parseDecision('{"decision":"Maybe","rationale":"x"}')).toThrow(/no valid decision/);
  });

  it('throws when there is no JSON object', () => {
    expect(() => parseDecision('I refuse to answer.')).toThrow(/no JSON object/);
  });

  it('uses the final decision when a reasoning model emits intermediate ones', () => {
    const reasoning = 'First I lean {"decision":"Against"} but on reflection {"decision":"For","rationale":"safeguards"}';
    expect(parseDecision(reasoning)).toEqual({ decision: 'For', support: 1, rationale: 'safeguards' });
  });
});

describe('resolveTeeModel', () => {
  const models: VeniceModel[] = [
    { id: 'llama-3.3-70b', model_spec: { capabilities: { supportsTeeAttestation: false } } },
    { id: 'e2ee-gpt-oss-20b-p', model_spec: { capabilities: { supportsTeeAttestation: true } } },
    { id: 'e2ee-qwen3-5-122b-a10b', model_spec: { capabilities: { supportsTeeAttestation: true } } },
  ];

  it('honours a preferred model when it supports TEE attestation', () => {
    expect(resolveTeeModel(models, 'e2ee-gpt-oss-20b-p')).toBe('e2ee-gpt-oss-20b-p');
  });

  it('ignores a preferred model that is not a TEE model and falls back to a known default', () => {
    expect(resolveTeeModel(models, 'llama-3.3-70b')).toBe('e2ee-qwen3-5-122b-a10b');
  });

  it('picks the first TEE model when none of the known defaults are present', () => {
    const only = [{ id: 'e2ee-glm-5-1', model_spec: { capabilities: { supportsTeeAttestation: true } } }];
    expect(resolveTeeModel(only)).toBe('e2ee-glm-5-1');
  });

  it('throws when no TEE-attestation model is available', () => {
    expect(() => resolveTeeModel([{ id: 'llama-3.3-70b' }])).toThrow(/no TEE-attestation models/);
  });
});

describe('mapAttestation', () => {
  it('reduces a raw attestation report to the badge fields', () => {
    const raw = {
      model: 'e2ee-qwen3-5-122b-a10b',
      model_name: 'Qwen/Qwen3.5-122B-A10B',
      verified: true,
      signing_address: '0x6525e128afcffebf7eed05d485d7be983cdae934',
      request_nonce: 'c0d6ae1e4fd58b421b58b84ccddb810a3a94326276fd8755be',
      tee_provider: 'near-ai',
      tee_hardware: 'intel-tdx',
    };
    expect(mapAttestation(raw)).toEqual({
      model: 'e2ee-qwen3-5-122b-a10b',
      verified: true,
      signingAddress: '0x6525e128afcffebf7eed05d485d7be983cdae934',
      nonce: 'c0d6ae1e4fd58b421b58b84ccddb810a3a94326276fd8755be',
      teeProvider: 'near-ai',
      teeHardware: 'intel-tdx',
    });
  });

  it('treats a non-true verified flag as unverified', () => {
    expect(mapAttestation({ verified: 'yes', signing_address: '0xabc', nonce: 'n' }).verified).toBe(false);
  });
});
