import { describe, it, expect } from 'vitest';
import { formatTokenAmount, X402_PHASES, TOLL_PRICE_ATOMS } from './x402-toll';

describe('formatTokenAmount', () => {
  it('formats whole token amounts', () => {
    expect(formatTokenAmount(10n ** 18n, 18)).toBe('1');
  });

  it('formats fractional amounts and trims trailing zeros', () => {
    expect(formatTokenAmount(15n * 10n ** 17n, 18)).toBe('1.5');
    expect(formatTokenAmount(10n ** 17n, 18)).toBe('0.1');
  });

  it('formats zero', () => {
    expect(formatTokenAmount(0n, 18)).toBe('0');
  });
});

describe('X402_PHASES', () => {
  it('is the 402 -> sign -> settle -> 200 toll lifecycle', () => {
    expect(X402_PHASES.map((p) => p.key)).toEqual(['require', 'sign', 'settle', 'data']);
    expect(X402_PHASES[0].code).toBe(402);
    expect(X402_PHASES[X402_PHASES.length - 1].code).toBe(200);
  });
});

describe('TOLL_PRICE_ATOMS', () => {
  it('is 1 MVOTE (1e18) per query', () => {
    expect(TOLL_PRICE_ATOMS).toBe(10n ** 18n);
  });
});
