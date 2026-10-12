// Saved site connections. Stored in chrome.storage.local under one key (not
// per-connection) since the list is small and read/written together.
// Passwords are never stored — only the token pair minted by the bridge.

import type { Connection, TokenResponse } from '../types';
import { storageGet, storageSet } from './storage';

const STORAGE_KEY = 'seb_connections';

export async function listConnections(): Promise<Connection[]> {
  return (await storageGet<Connection[]>(STORAGE_KEY)) || [];
}

export async function findConnectionByRestRoot(restRoot: string): Promise<Connection | null> {
  const list = await listConnections();
  return list.find((c) => c.restRoot === restRoot) || null;
}

async function saveAll(list: Connection[]): Promise<void> {
  await storageSet(STORAGE_KEY, list);
}

// Adds a new connection, or updates an existing one for the same restRoot —
// matched by restRoot alone (one connection per site; the logged-in user on
// that site can change without creating duplicates).
export async function upsertConnection(fields: Connection): Promise<Connection> {
  const list = await listConnections();
  const idx = list.findIndex((c) => c.restRoot === fields.restRoot);
  const merged = idx >= 0 ? { ...list[idx], ...fields } : { ...fields };
  if (idx >= 0) list[idx] = merged;
  else list.push(merged);
  await saveAll(list);
  return merged;
}

export async function updateConnection(restRoot: string, patch: Partial<Connection>): Promise<Connection | null> {
  const list = await listConnections();
  const idx = list.findIndex((c) => c.restRoot === restRoot);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  await saveAll(list);
  return list[idx];
}

export async function removeConnection(restRoot: string): Promise<void> {
  const list = await listConnections();
  await saveAll(list.filter((c) => c.restRoot !== restRoot));
}

/** Shape a token response into the fields we persist for a connection. */
export function connectionFromTokens(
  tokens: TokenResponse,
  fallback: { restRoot: string; siteUrl: string },
  now = Date.now(),
): Connection {
  return {
    restRoot: tokens.site?.restRoot || fallback.restRoot,
    siteUrl: tokens.site?.url || fallback.siteUrl,
    userLogin: tokens.user?.login,
    userName: tokens.user?.name,
    userId: tokens.user?.id,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: now + tokens.expiresIn * 1000,
    providers: tokens.providers,
  };
}
