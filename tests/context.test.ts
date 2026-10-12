import { describe, expect, it } from 'vitest';
import {
  buildAdminEditUrl, buildConnectionContext, classifyBridgeData, entityRefFromBridge, isSameLiveEntity, toEntityRef,
} from '../src/sidebar/context';
import { restBaseFromSelfLink, searchParams } from '../src/sidebar/views/browser';
import { loginWithFallback, normalizeRestRoot, plainPermalinkRoot } from '../src/sidebar/views/connections';
import { HttpError } from '../src/lib/token-client';
import type { BridgeData } from '../src/types';

const bridge = (over: Partial<BridgeData> = {}): BridgeData => ({
  authenticated: true, restRoot: 'https://a.test/wp-json/', nonce: 'n', isFrontPage: false,
  post: { id: 7, type: 'page', restBase: 'pages' }, term: null, languages: null, providers: ['core'], editUrl: null,
  ...over,
});

describe('bridge detection', () => {
  it('classifies', () => {
    expect(classifyBridgeData(null)).toEqual({ ok: false, reason: 'notLoggedIn' });
    expect(classifyBridgeData({ authenticated: false })).toEqual({ ok: false, reason: 'notLoggedIn' });
    expect(classifyBridgeData(bridge({ post: null }))).toEqual({ ok: false, reason: 'noPost' });
    expect(classifyBridgeData(bridge({ post: null, isFrontPage: true }))).toMatchObject({ ok: true, entityType: null });
    expect(classifyBridgeData(bridge({ post: null, term: { id: 3, taxonomy: 'category', restBase: 'categories' } })))
      .toMatchObject({ ok: true, entityType: 'term' });
  });

  it('entity refs and identity', () => {
    const ref = entityRefFromBridge(bridge(), 'post');
    expect(ref).toMatchObject({ postId: 7, postType: 'page', restBase: 'pages' });
    expect(isSameLiveEntity(ref, 'live', bridge(), 'post')).toBe(true);
    expect(isSameLiveEntity(ref, 'connection', bridge(), 'post')).toBe(false);
    expect(isSameLiveEntity(ref, 'live', bridge({ post: { id: 8, type: 'page', restBase: 'pages' } }), 'post')).toBe(false);
  });

  it('toEntityRef strips functions (safe to keep after the tab is gone)', () => {
    const ctx = buildConnectionContext({ restRoot: 'r', siteUrl: 'https://a.test' }, { entityType: 'post', postId: 1 });
    expect(Object.values(toEntityRef(ctx)).some((v) => typeof v === 'function')).toBe(false);
  });
});

describe('wp-admin edit URLs in connection mode', () => {
  const site = 'https://a.test/';
  it.each([
    [{ entityType: 'post', postId: 5 }, 'https://a.test/wp-admin/post.php?post=5&action=edit'],
    [{ entityType: 'term', postId: 3, taxonomy: 'pa_color' }, 'https://a.test/wp-admin/term.php?taxonomy=pa_color&tag_ID=3'],
    [{ entityType: null, isFrontPage: true }, 'https://a.test/wp-admin/options-reading.php'],
  ])('%o', (ref, url) => {
    expect(buildAdminEditUrl({ restRoot: '', providers: [], languages: null, isFrontPage: false, ...(ref as any) }, site)).toBe(url);
  });
  it('no site URL → no link', () => {
    expect(buildAdminEditUrl({ restRoot: '', entityType: 'post', postId: 1, providers: [], languages: null, isFrontPage: false })).toBeNull();
  });
});

describe('connections + browser helpers', () => {
  it('normalizes site URLs', () => {
    expect(normalizeRestRoot(' example.com/ ')).toBe('https://example.com/wp-json/');
    expect(normalizeRestRoot('http://x.test')).toBe('http://x.test/wp-json/');
    expect(plainPermalinkRoot('https://x.test/wp-json/')).toBe('https://x.test/?rest_route=/');
  });

  it('falls back to plain permalinks on a 404 even when the message has no number', async () => {
    const tried: string[] = [];
    const fakeLogin = async (root: string) => {
      tried.push(root);
      if (root.endsWith('/wp-json/')) throw new HttpError('No route was found matching the URL', 404);
      return { accessToken: 'a', refreshToken: 'r', expiresIn: 1 };
    };
    const res = await loginWithFallback('x.test', 'u', 'p', fakeLogin);
    expect(res.restRoot).toBe('https://x.test/?rest_route=/');
    expect(tried).toHaveLength(2);
  });

  it('does not retry on bad credentials', async () => {
    const fakeLogin = async () => { throw new HttpError('Invalid credentials.', 401); };
    await expect(loginWithFallback('x.test', 'u', 'p', fakeLogin)).rejects.toThrow('Invalid credentials.');
  });

  it('parses rest_base from search result links', () => {
    expect(restBaseFromSelfLink('https://a.test/wp-json/wp/v2/pages/5')).toBe('pages');
    expect(restBaseFromSelfLink('https://a.test/?rest_route=/wp/v2/product/9')).toBe('product');
    expect(restBaseFromSelfLink('not a url')).toBeNull();
    expect(restBaseFromSelfLink(undefined)).toBeNull();
  });

  it('search params', () => {
    expect(searchParams({ query: 'q', subtype: 'any', page: 2 })).not.toHaveProperty('subtype');
    expect(searchParams({ query: 'q', subtype: 'page', page: 1 })).toMatchObject({ subtype: 'page', per_page: 20, orderby: 'date' });
  });
});
