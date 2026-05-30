import { describe, expect, it } from 'vitest';
import { getDict, isLang, LANGS, resolveLang } from './i18n';

function leafPaths(v: unknown, prefix = ''): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => leafPaths(x, `${prefix}[${i}]`));
  if (v && typeof v === 'object') {
    return Object.entries(v).flatMap(([k, x]) => leafPaths(x, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

function leafValues(v: unknown): unknown[] {
  if (Array.isArray(v)) return v.flatMap(leafValues);
  if (v && typeof v === 'object') return Object.values(v).flatMap(leafValues);
  return [v];
}

describe('i18n dictionaries', () => {
  it('exposes exactly en and zh', () => {
    expect(LANGS).toEqual(['en', 'zh']);
  });

  it('en and zh have identical key structure — no missing/extra translations', () => {
    const en = leafPaths(getDict('en')).sort();
    const zh = leafPaths(getDict('zh')).sort();
    expect(zh).toEqual(en);
  });

  it('every leaf is a non-empty string in both languages', () => {
    for (const lang of LANGS) {
      for (const val of leafValues(getDict(lang))) {
        expect(typeof val).toBe('string');
        expect((val as string).trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('resolveLang', () => {
  it('maps zh* locales to zh and everything else to en', () => {
    expect(resolveLang('zh')).toBe('zh');
    expect(resolveLang('zh-CN')).toBe('zh');
    expect(resolveLang('ZH-Hant')).toBe('zh');
    expect(resolveLang('en-US')).toBe('en');
    expect(resolveLang('fr')).toBe('en');
    expect(resolveLang(undefined)).toBe('en');
    expect(resolveLang(null)).toBe('en');
  });
});

describe('isLang', () => {
  it('guards untrusted stored values', () => {
    expect(isLang('en')).toBe(true);
    expect(isLang('zh')).toBe(true);
    expect(isLang('jp')).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
