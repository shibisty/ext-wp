import type { EntityRef } from '../types';

/** Did the bridge report this plugin as active on the site? */
export function hasPlugin(ctx: EntityRef, id: string): boolean {
  return Array.isArray(ctx.providers) && ctx.providers.includes(id);
}
