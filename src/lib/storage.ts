// Thin typed wrapper over chrome.storage.local. Everything persistent in the
// extension goes through here, so tests only need to fake these three calls.

export async function storageGet<T>(key: string): Promise<T | undefined> {
  const stored = await chrome.storage.local.get(key);
  return stored[key] as T | undefined;
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function storageRemove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

interface Stamped<T> {
  ts: number;
  [field: string]: unknown;
  payload?: T;
}

/**
 * Read a `{ ts, ... }` entry and return it only if it is younger than `ttlMs`.
 * Shared by the schema cache and the drafts store, which differ only in TTL
 * and in the name of the payload field (kept for backward compatibility with
 * entries written by the pre-TypeScript version).
 */
export async function getFresh<T>(key: string, field: string, ttlMs: number, now = Date.now()): Promise<T | null> {
  const entry = await storageGet<Stamped<T>>(key);
  if (!entry || typeof entry.ts !== 'number' || now - entry.ts > ttlMs) return null;
  return (entry[field] as T) ?? null;
}

export async function setStamped<T>(key: string, field: string, value: T, now = Date.now()): Promise<void> {
  await storageSet(key, { [field]: value, ts: now });
}
