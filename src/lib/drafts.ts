// Unsaved-edit safety net, separate from cache.ts's server-confirmed cache:
// while typing, the panel periodically writes the current form values here
// so a closed tab / switched tab / crashed browser doesn't lose them.
// Cleared automatically once the section is actually saved.

import type { EntityRef, FieldValues } from '../types';
import { SCHEMA_VERSION } from './cache';
import { getFresh, setStamped, storageRemove } from './storage';

// 24h — long enough to survive an accidental close, short enough not to resurrect ancient edits.
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type KeyCtx = Pick<EntityRef, 'restRoot' | 'entityType' | 'postId'>;

// Versioned together with the schema cache: a draft holds values in the
// shape of the schema it was typed against.
export function draftKey(ctx: KeyCtx, providerId: string): string {
  return `seb_draft:v${SCHEMA_VERSION}:${ctx.restRoot}|${ctx.entityType}|${ctx.postId}|${providerId}`;
}

export function getDraft(ctx: KeyCtx, providerId: string): Promise<FieldValues | null> {
  return getFresh<FieldValues>(draftKey(ctx, providerId), 'values', DRAFT_TTL_MS);
}

export function setDraft(ctx: KeyCtx, providerId: string, values: FieldValues): Promise<void> {
  return setStamped(draftKey(ctx, providerId), 'values', values);
}

export function clearDraft(ctx: KeyCtx, providerId: string): Promise<void> {
  return storageRemove(draftKey(ctx, providerId));
}
