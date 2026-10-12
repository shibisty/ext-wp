// Bearer-token fetch, run directly from the extension's own context (side
// panel) — NOT through chrome.scripting.executeScript like pageFetch. No
// cookies are involved here, so there's no SameSite issue to route around;
// host_permissions: ["<all_urls>"] already lets the extension fetch
// cross-origin without the server's CORS headers. This is what makes
// "connections" work when the site isn't open in any tab.

import type { Connection, RequestOptions, RestResponse, TokenResponse } from '../types';
import { updateConnection } from './connections';
import { base64ToBlob, buildRestUrl, toRestResponse } from './wp-client';

/** Refresh a little before actual expiry, not after. */
export const REFRESH_LEEWAY_MS = 30_000;

async function rawFetch(url: string, options: RequestInit = {}): Promise<RestResponse> {
  return toRestResponse(await fetch(url, options));
}

/** Error carrying the HTTP status, so callers can branch on it (e.g. 404 → try plain permalinks). */
export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function login(restRoot: string, username: string, password: string): Promise<TokenResponse> {
  const url = buildRestUrl(restRoot, '/sidebar-editor/v1/auth/login');
  const res = await rawFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new HttpError(res.json?.message || `Login failed (${res.status})`, res.status);
  return res.json as TokenResponse;
}

// Concurrent requests that all notice an expired token must share ONE
// refresh: the bridge rotates the refresh token on every use, so a second
// parallel refresh would present an already-rotated token and fail.
const inflightRefresh = new Map<string, Promise<Connection>>();

export function refresh(connection: Connection): Promise<Connection> {
  const pending = inflightRefresh.get(connection.restRoot);
  if (pending) return pending;
  const p = doRefresh(connection).finally(() => inflightRefresh.delete(connection.restRoot));
  inflightRefresh.set(connection.restRoot, p);
  return p;
}

async function doRefresh(connection: Connection): Promise<Connection> {
  const url = buildRestUrl(connection.restRoot, '/sidebar-editor/v1/auth/refresh');
  const res = await rawFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: connection.refreshToken }),
  });
  if (!res.ok) throw new Error('SESSION_EXPIRED');
  const tokens = res.json as TokenResponse;
  const patch = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
  await updateConnection(connection.restRoot, patch);
  Object.assign(connection, patch); // callers hold this object — keep it current
  return connection;
}

export function needsRefresh(connection: Connection, now = Date.now()): boolean {
  return !!connection.expiresAt && now > connection.expiresAt - REFRESH_LEEWAY_MS;
}

async function ensureFreshToken(connection: Connection): Promise<void> {
  if (needsRefresh(connection)) await refresh(connection);
}

/** Runs `doFetch` with a fresh token; on 401 refreshes once and retries. */
async function withAuthRetry(connection: Connection, doFetch: () => Promise<RestResponse>): Promise<RestResponse> {
  await ensureFreshToken(connection);
  let res = await doFetch();
  if (res.status === 401) {
    // Access token rejected outright (clock skew, stale expiresAt) — try once more.
    await refresh(connection);
    res = await doFetch();
  }
  return res;
}

// Same RestResponse shape as pageFetch, so providers don't care which
// transport ctx.request ends up using.
export function tokenFetch(connection: Connection, url: string, options: RequestOptions = {}): Promise<RestResponse> {
  return withAuthRetry(connection, () =>
    rawFetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${connection.accessToken}` },
    }),
  );
}

// Mirrors wp-client's uploadMedia, but as a direct extension-side fetch
// with a Bearer header — there's no tab to inject into in connection mode.
export function tokenUploadMedia(
  connection: Connection,
  base64Data: string,
  filename: string,
  mimeType: string,
): Promise<RestResponse> {
  const blob = base64ToBlob(base64Data, mimeType);
  const url = buildRestUrl(connection.restRoot, '/wp/v2/media');
  return withAuthRetry(connection, () =>
    rawFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        Authorization: `Bearer ${connection.accessToken}`,
      },
      body: blob,
    }),
  );
}
