import { describe, expect, it } from 'vitest';
import { parse7702Code } from './oneshot-finale';

describe('parse7702Code', () => {
  it('extracts the delegate implementation from a real EIP-7702-upgraded account code', () => {
    // the live Base-mainnet burner code captured from eth_getCode
    const r = parse7702Code('0xef010063c0c19a282a1b52b07dd5a65b58948a07dae32b');
    expect(r.upgraded).toBe(true);
    expect(r.implementation).toBe('0x63c0c19a282a1b52b07dd5a65b58948a07dae32b');
  });

  it('reports not upgraded for a plain EOA (empty code) or missing code', () => {
    expect(parse7702Code('0x').upgraded).toBe(false);
    expect(parse7702Code(null).upgraded).toBe(false);
    expect(parse7702Code(undefined).upgraded).toBe(false);
  });

  it('ignores a malformed 0xef0100 prefix without a full 20-byte delegate', () => {
    expect(parse7702Code('0xef010012').upgraded).toBe(false);
  });
});
