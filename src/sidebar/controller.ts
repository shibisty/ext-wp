// Switching what the panel edits: a live tab (cookie + nonce) or a saved
// connection (bearer token, works with no tab open at all).

import type { BridgeData, Connection, EntityRef, EntityType } from '../types';
import { connectionFromTokens, findConnectionByRestRoot, upsertConnection } from '../lib/connections';
import type { TokenResponse } from '../types';
import { buildRestUrl, pageFetch } from '../lib/wp-client';
import { buildConnectionContext, buildLiveContext, toEntityRef } from './context';
import { renderStartScreen } from './layout';
import { state } from './state';
import { renderSections } from './views/editor';

function currentLangSlug(languages: EntityRef['languages']): string | null {
  return (languages || []).find((l) => l.current)?.slug || null;
}

export function applyLiveContext(tabId: number, data: BridgeData, entityType: EntityType | null): void {
  state.mode = 'live';
  state.activeConnection = null;
  state.sections = {};
  state.ctx = buildLiveContext(tabId, data, entityType);
  state.activeLangSlug = currentLangSlug(data.languages);
  state.lastLiveCtx = toEntityRef(state.ctx);
  syncConnection(tabId, data).catch(() => {}); // silent — see below
  renderSections();
}

export function enterConnectionMode(connection: Connection, ref: Partial<EntityRef>, opts: { offline?: boolean } = {}): void {
  state.mode = 'connection';
  state.activeConnection = connection;
  state.sections = {};
  state.ctx = buildConnectionContext(connection, ref);
  state.activeLangSlug = currentLangSlug(state.ctx.languages);
  renderSections({ offlineBadge: opts.offline });
}

export async function tryContinueOffline(message?: string): Promise<void> {
  if (state.lastLiveCtx) {
    const connection = await findConnectionByRestRoot(state.lastLiveCtx.restRoot);
    if (connection?.accessToken) {
      enterConnectionMode(connection, state.lastLiveCtx, { offline: true });
      return;
    }
  }
  renderStartScreen(message);
}

// While cookie-logged-in on a WP tab, quietly mint/refresh a token pair for
// this site+user via the cookie+nonce-protected /auth/session route and keep
// the saved connection current — so it's there by the time it's needed
// (tab closed, switched away, ...).
async function syncConnection(tabId: number, bridge: BridgeData): Promise<void> {
  const url = buildRestUrl(bridge.restRoot, '/sidebar-editor/v1/auth/session');
  const res = await pageFetch(tabId, url, { headers: { 'X-WP-Nonce': bridge.nonce } });
  if (!res.ok) return;
  await upsertConnection(connectionFromTokens(res.json as TokenResponse, { restRoot: bridge.restRoot, siteUrl: bridge.restRoot }));
}
