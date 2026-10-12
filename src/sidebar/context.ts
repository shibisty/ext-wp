// Building the EditorContext providers work against — from a live tab
// (cookie + nonce, requests run inside the page) or from a saved connection
// (bearer token, requests run from the extension itself).

import type { BridgeData, Connection, EditorContext, EntityRef, EntityType } from '../types';
import { tokenFetch, tokenUploadMedia } from '../lib/token-client';
import { pageFetch, uploadMedia } from '../lib/wp-client';

export type Detection =
  | { ok: true; data: BridgeData; entityType: EntityType | null }
  | { ok: false; reason: 'openWpPage' | 'notLoggedIn' | 'noPost' | 'error'; message?: string };

/** Runs in the page: reads what sidebar-editor-bridge.php printed. Must stay self-contained. */
export function readBridgeDataInPage(): BridgeData | { authenticated: false; error?: string } {
  const el = document.getElementById('seb-bridge-data');
  if (!el) return { authenticated: false };
  try {
    return JSON.parse(el.textContent || '');
  } catch (e) {
    return { authenticated: false, error: 'Failed to parse bridge data: ' + (e as Error).message };
  }
}

/** Interprets bridge data without any UI side effects. */
export function classifyBridgeData(data: BridgeData | { authenticated: false } | null | undefined): Detection {
  if (!data || !data.authenticated) return { ok: false, reason: 'notLoggedIn' };
  const bridge = data as BridgeData;
  const entityType: EntityType | null = bridge.post ? 'post' : bridge.term ? 'term' : null;
  if (!entityType && !bridge.isFrontPage) return { ok: false, reason: 'noPost' };
  return { ok: true, data: bridge, entityType };
}

// Pure detection — figures out whether the tab is a WP page the current user
// can edit, without touching whatever the panel is currently showing.
export async function detectLiveContext(tab: chrome.tabs.Tab): Promise<Detection> {
  if (!tab.url || !/^https?:\/\//.test(tab.url) || tab.id === undefined) {
    return { ok: false, reason: 'openWpPage' };
  }
  try {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readBridgeDataInPage });
    return classifyBridgeData(injection?.result as BridgeData | undefined);
  } catch (err) {
    return { ok: false, reason: 'error', message: (err as Error).message };
  }
}

export function entityRefFromBridge(data: BridgeData, entityType: EntityType | null): EntityRef {
  return {
    restRoot: data.restRoot,
    entityType,
    isFrontPage: !!data.isFrontPage,
    providers: data.providers,
    languages: data.languages || null, // Polylang, 2+ languages, post entities only
    ...(entityType === 'post' && data.post
      ? { postId: data.post.id, postType: data.post.type, restBase: data.post.restBase }
      : {}),
    ...(entityType === 'term' && data.term
      ? { postId: data.term.id, taxonomy: data.term.taxonomy, restBase: data.term.restBase }
      : {}),
  };
}

/** Plain-data snapshot of a context (no functions) — what's safe to keep around / persist. */
export function toEntityRef(ctx: EntityRef): EntityRef {
  const { restRoot, entityType, postId, postType, taxonomy, restBase, providers, isFrontPage, languages } = ctx;
  return { restRoot, entityType, postId, postType, taxonomy, restBase, providers, isFrontPage, languages };
}

export function buildLiveContext(tabId: number, data: BridgeData, entityType: EntityType | null): EditorContext {
  const ctx: EditorContext = {
    ...entityRefFromBridge(data, entityType),
    tabId,
    nonce: data.nonce,
    editUrl: data.editUrl || null, // computed server-side via get_edit_post_link()/get_edit_term_link()
    request: (url, opts = {}) =>
      pageFetch(tabId, url, { ...opts, headers: { ...(opts.headers || {}), 'X-WP-Nonce': data.nonce } }),
    uploadImage: (b64, filename, mime) => uploadMedia(tabId, data.restRoot, data.nonce, b64, filename, mime),
  };
  return ctx;
}

export function buildConnectionContext(connection: Connection, ref: Partial<EntityRef>): EditorContext {
  const entity: EntityRef = {
    restRoot: connection.restRoot,
    entityType: ref.entityType ?? null,
    postId: ref.postId,
    postType: ref.postType,
    taxonomy: ref.taxonomy,
    restBase: ref.restBase,
    providers: ref.providers || connection.providers || ['core'],
    isFrontPage: !!ref.isFrontPage,
    languages: ref.languages || null,
  };
  return {
    ...entity,
    editUrl: buildAdminEditUrl(entity, connection.siteUrl),
    request: (url, o = {}) => tokenFetch(connection, url, o),
    uploadImage: (b64, filename, mime) => tokenUploadMedia(connection, b64, filename, mime),
  };
}

// No live page to ask for the real get_edit_post_link() in connection mode,
// so this reconstructs the standard wp-admin URL patterns by hand.
export function buildAdminEditUrl(ref: EntityRef, siteUrl?: string): string | null {
  if (!siteUrl) return null;
  const base = siteUrl.replace(/\/+$/, '');
  if (ref.entityType === 'post' && ref.postId) {
    return `${base}/wp-admin/post.php?post=${ref.postId}&action=edit`;
  }
  if (ref.entityType === 'term' && ref.postId && ref.taxonomy) {
    return `${base}/wp-admin/term.php?taxonomy=${encodeURIComponent(ref.taxonomy)}&tag_ID=${ref.postId}`;
  }
  if (ref.isFrontPage) return `${base}/wp-admin/options-reading.php`;
  return null;
}

export function isSameLiveEntity(
  current: EntityRef | null,
  mode: 'live' | 'connection',
  data: BridgeData,
  entityType: EntityType | null,
): boolean {
  if (!current || mode !== 'live' || current.restRoot !== data.restRoot || current.entityType !== entityType) {
    return false;
  }
  if (entityType === 'post') return current.postId === data.post?.id;
  if (entityType === 'term') return current.postId === data.term?.id;
  return current.isFrontPage === data.isFrontPage;
}

/** Stable identity of a detected target, used to avoid re-offering the same switch. */
export function targetKey(data: BridgeData, entityType: EntityType | null): string {
  return `${data.restRoot}|${entityType}|${data.post?.id || data.term?.id || 'front'}`;
}
