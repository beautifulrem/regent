import { describe, expect, it } from 'vitest';
import { ACCOUNT_ROLES, eoaAddress, fundingPlan, getRole } from './accounts.js';

describe('ACCOUNT_ROLES', () => {
  it('defines the five Mandate roles in a stable order', () => {
    expect(ACCOUNT_ROLES.map((r) => r.id)).toEqual([
      'userDemo',
      'orchestrator',
      'analyst',
      'veniceWallet',
      'oneShotBurner',
    ]);
  });

  it('marks the two delegating participants as smart accounts, the rest as EOAs', () => {
    expect(getRole('userDemo').kind).toBe('smartAccount');
    expect(getRole('orchestrator').kind).toBe('smartAccount');
    expect(getRole('analyst').kind).toBe('eoa');
    expect(getRole('veniceWallet').kind).toBe('eoa');
    expect(getRole('oneShotBurner').kind).toBe('eoa');
  });

  it('requires USDC funding only for the Venice wallet', () => {
    expect(getRole('veniceWallet').fundUsdcMin).toBeGreaterThan(0);
    for (const role of ACCOUNT_ROLES) {
      if (role.id !== 'veniceWallet') expect(role.fundUsdcMin).toBe(0);
    }
  });

  it('gives every gas-paying role a positive ETH minimum (burner pays gas in USDC via 1Shot)', () => {
    expect(getRole('oneShotBurner').fundEthMin).toBe(0);
    for (const role of ACCOUNT_ROLES) {
      if (role.id !== 'oneShotBurner') expect(role.fundEthMin).toBeGreaterThan(0);
    }
  });

  it('uses a unique env var per role', () => {
    const keys = ACCOUNT_ROLES.map((r) => r.envKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('getRole', () => {
  it('throws for an unknown role id', () => {
    expect(() => getRole('nope')).toThrow(/Unknown account role/);
  });
});

describe('eoaAddress', () => {
  it('derives the canonical checksummed address for a known private key', () => {
    // Anvil/Hardhat account #0 — a fixed, public test vector.
    expect(
      eoaAddress('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
    ).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  });

  it('is deterministic for the same key', () => {
    const pk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    expect(eoaAddress(pk)).toBe(eoaAddress(pk));
  });
});

describe('fundingPlan', () => {
  const ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const;

  it('treats a fully-unfunded matrix as needing every minimum', () => {
    const plan = fundingPlan({}, {});
    const venice = plan.find((p) => p.id === 'veniceWallet')!;
    expect(venice.needEth).toBe(0.005);
    expect(venice.needUsdc).toBe(5);
    expect(venice.funded).toBe(false);
    // the 1Shot burner needs nothing on Base Sepolia (gas paid in USDC on mainnet)
    expect(plan.find((p) => p.id === 'oneShotBurner')!.funded).toBe(true);
  });

  it('marks a role funded once balances meet the minimum', () => {
    const plan = fundingPlan(
      { analyst: ADDR },
      { analyst: { eth: 0.05, usdc: 0 } },
    );
    const analyst = plan.find((p) => p.id === 'analyst')!;
    expect(analyst.funded).toBe(true);
    expect(analyst.needEth).toBe(0);
    expect(analyst.address).toBe(ADDR);
  });

  it('reports the remaining shortfall when a balance is partial', () => {
    const plan = fundingPlan({}, { veniceWallet: { eth: 0.002, usdc: 1 } });
    const venice = plan.find((p) => p.id === 'veniceWallet')!;
    expect(venice.needEth).toBe(0.003);
    expect(venice.needUsdc).toBe(4);
    expect(venice.funded).toBe(false);
  });

  it('does not report float-dust shortfalls', () => {
    const plan = fundingPlan({}, { userDemo: { eth: 0.02, usdc: 0 } });
    expect(plan.find((p) => p.id === 'userDemo')!.needEth).toBe(0);
  });
});
