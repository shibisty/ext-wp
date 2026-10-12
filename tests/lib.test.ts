import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TTL_MS, cacheKey, getCachedSchema, setCachedSchema } from '../src/lib/cache';
import { connectionFromTokens, findConnectionByRestRoot, listConnections, removeConnection, updateConnection, upsertConnection } from '../src/lib/connections';
import { clearDraft, DRAFT_TTL_MS, draftKey, getDraft, setDraft } from '../src/lib/drafts';
import { loadSettings, resolveLang, saveSettings, t } from '../src/lib/i18n';
import { buildRestUrl, restErrorMessage } from '../src/lib/wp-client';
import type { Field } from '../src/types';
import { memoryStorage } from './setup';

const ref = { restRoot: 'https://a.test/wp-json/', entityType: 'post' as const, postId: 5 };

describe('buildRestUrl', () => {
  it('pretty permalinks', () => {
    expect(buildRestUrl('https://a.test/wp-json/', '/wp/v2/pages/5', { context: 'edit' }))
      .toBe('https://a.test/wp-json/wp/v2/pages/5?context=edit');
  });
  it('plain permalinks extend rest_route', () => {
    expect(buildRestUrl('https://a.test/?rest_route=/', '/wp/v2/pages/5', { context: 'edit' }))
      .toBe('https://a.test/?rest_route=%2Fwp%2Fv2%2Fpages%2F5&context=edit');
  });
  it('subdirectory installs', () => {
    expect(buildRestUrl('https://a.test/blog/wp-json', '/x')).toBe('https://a.test/blog/wp-json/x');
  });
  it('skips undefined params', () => {
    expect(buildRestUrl('https://a.test/wp-json/', '/x', { a: undefined, b: 1 })).toBe('https://a.test/wp-json/x?b=1');
  });
});

describe('restErrorMessage', () => {
  it('uses the WP message, with a hint for per-item permission errors', () => {
    expect(restErrorMessage({ json: { code: 'x', message: 'Boom' } }, 'fallback')).toBe('Boom');
    expect(restErrorMessage({ json: null }, 'fallback')).toBe('fallback');
    expect(restErrorMessage({ json: { code: 'rest_forbidden_context', message: 'No' } }, 'f')).toMatch(/^No — .*not a token problem/);
  });
});

describe('schema cache', () => {
  afterEach(() => vi.useRealTimers());
  const schema: Field[] = [{ id: 'title', label: 'Title', type: 'text', value: 'x' }];

  it('stores and returns within TTL, expires after', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    await setCachedSchema(ref, 'core', schema);
    expect(await getCachedSchema(ref, 'core')).toEqual(schema);
    vi.setSystemTime(1_000_000 + CACHE_TTL_MS + 1);
    expect(await getCachedSchema(ref, 'core')).toBeNull();
  });

  it('keys are versioned so pre-upgrade entries are ignored', async () => {
    expect(cacheKey(ref, 'acf')).toMatch(/^seb_cache:v\d+:/);
    memoryStorage.set('seb_cache:https://a.test/wp-json/|post|5|acf', { schema, ts: Date.now() });
    expect(await getCachedSchema(ref, 'acf')).toBeNull();
  });
});

describe('drafts', () => {
  afterEach(() => vi.useRealTimers());

  it('round-trips, expires after 24h, and clears', async () => {
    vi.useFakeTimers({ now: 5_000 });
    await setDraft(ref, 'core', { title: 'draft' });
    expect(await getDraft(ref, 'core')).toEqual({ title: 'draft' });
    await clearDraft(ref, 'core');
    expect(await getDraft(ref, 'core')).toBeNull();

    await setDraft(ref, 'core', { title: 'draft' });
    vi.setSystemTime(5_000 + DRAFT_TTL_MS + 1);
    expect(await getDraft(ref, 'core')).toBeNull();
  });

  it('keys are versioned too', () => expect(draftKey(ref, 'core')).toMatch(/^seb_draft:v\d+:/));
});

describe('connections', () => {
  it('upserts by restRoot, updates and removes', async () => {
    await upsertConnection({ restRoot: 'r1', userLogin: 'a' });
    await upsertConnection({ restRoot: 'r2' });
    await upsertConnection({ restRoot: 'r1', userLogin: 'b' });
    expect((await listConnections()).map((c) => [c.restRoot, c.userLogin])).toEqual([['r1', 'b'], ['r2', undefined]]);

    await updateConnection('r2', { accessToken: 'T' });
    expect((await findConnectionByRestRoot('r2'))?.accessToken).toBe('T');
    expect(await updateConnection('nope', {})).toBeNull();

    await removeConnection('r1');
    expect((await listConnections()).map((c) => c.restRoot)).toEqual(['r2']);
  });

  it('builds a connection from a token response', () => {
    const c = connectionFromTokens(
      { accessToken: 'a', refreshToken: 'r', expiresIn: 3600, user: { id: 1, name: 'N', login: 'l' }, site: { url: 'https://s', restRoot: 'https://s/wp-json/' }, providers: ['core'] },
      { restRoot: 'fallback', siteUrl: 'fallback' },
      1000,
    );
    expect(c).toMatchObject({ restRoot: 'https://s/wp-json/', siteUrl: 'https://s', userLogin: 'l', expiresAt: 1000 + 3_600_000 });
  });
});

describe('i18n + settings', () => {
  it('falls back to English, then the key', () => {
    expect(t('save', 'ru')).toBe('Сохранить');
    expect(t('today', 'en')).toBe('Today');
    expect(t('nope' as any, 'ru')).toBe('nope');
  });

  it('settings default and persist', async () => {
    expect(await loadSettings()).toEqual({ lang: 'auto', theme: 'auto', sections: {} });
    await saveSettings({ lang: 'ru', theme: 'dark', sections: { acf: true } });
    const s = await loadSettings();
    expect(s.sections).toEqual({ acf: true });
    expect(resolveLang(s)).toBe('ru');
    expect(resolveLang({ ...s, lang: 'auto' })).toBe('en'); // mocked UI language is en-US
  });

  it('every RU string exists in EN', async () => {
    const { translations } = await import('../src/lib/i18n');
    expect(Object.keys(translations.ru).sort()).toEqual(Object.keys(translations.en).sort());
  });
});
