// Caches each section's already-rendered field schema (not the raw provider
// data) in chrome.storage.local, keyed by site + entity + provider, so that
// reloading the WP tab after a save doesn't force every open section to
// re-fetch over the network — the panel already knows the values it just
// wrote. TTL is a safety net for changes made outside the panel (another
// editor, a webhook, etc.); the per-section "Refresh" button bypasses it
// on demand.

import type { EntityRef, Field } from '../types';
import { getFresh, setStamped } from './storage';

export const CACHE_TTL_MS = 15 * 60 * 1000;

// Bump SCHEMA_VERSION whenever the Field shape a provider produces changes
// meaningfully (e.g. ACF date fields went from formatted 'text' to raw
// 'date'), so stale entries from the previous build are simply ignored.
export const SCHEMA_VERSION = 2;

type KeyCtx = Pick<EntityRef, 'restRoot' | 'entityType' | 'postId'>;

export function cacheKey(ctx: KeyCtx, providerId: string): string {
  return `seb_cache:v${SCHEMA_VERSION}:${ctx.restRoot}|${ctx.entityType}|${ctx.postId}|${providerId}`;
}

export function getCachedSchema(ctx: KeyCtx, providerId: string): Promise<Field[] | null> {
  return getFresh<Field[]>(cacheKey(ctx, providerId), 'schema', CACHE_TTL_MS);
}

export function setCachedSchema(ctx: KeyCtx, providerId: string, schema: Field[]): Promise<void> {
  return setStamped(cacheKey(ctx, providerId), 'schema', schema);
}
