import type { Field, FieldType, Provider } from '../types';
import { buildRestUrl, expectOk, jsonPost } from '../lib/wp-client';
import { hasPlugin } from './util';

// Yoast doesn't reliably expose its SEO meta as writable REST fields across
// versions, so the bridge plugin registers these meta keys itself
// (register_post_meta with show_in_rest) — they then show up in the ordinary
// wp/v2 post `meta` object regardless of the Yoast version installed.
export const YOAST_POST_FIELDS: Record<string, { label: string; type: FieldType }> = {
  _yoast_wpseo_title: { label: 'SEO Title', type: 'text' },
  _yoast_wpseo_metadesc: { label: 'Meta Description', type: 'textarea' },
  _yoast_wpseo_focuskw: { label: 'Focus Keyword', type: 'text' },
  _yoast_wpseo_canonical: { label: 'Canonical URL', type: 'url' },
};

export function schemaFromFieldMap(map: Record<string, { label: string; type: FieldType }>, data: Record<string, any>): Field[] {
  return Object.entries(map).map(([id, { label, type }]) => ({ id, label, type, value: data[id] ?? '' }));
}

export const yoastProvider: Provider<Record<string, string>> = {
  id: 'yoast',

  detect(ctx) {
    return ctx.entityType === 'post' && hasPlugin(ctx, 'yoast');
  },

  async load(ctx) {
    const url = buildRestUrl(ctx.restRoot, `/wp/v2/${ctx.restBase}/${ctx.postId}`, { context: 'edit' });
    const post = expectOk<{ meta?: Record<string, string> }>(await ctx.request(url, {}), 'Failed to load SEO fields');
    const meta = post?.meta || {};
    const out: Record<string, string> = {};
    Object.keys(YOAST_POST_FIELDS).forEach((key) => { out[key] = meta[key] ?? ''; });
    return out;
  },

  getSchema(data) {
    return schemaFromFieldMap(YOAST_POST_FIELDS, data);
  },

  async save(ctx, values) {
    const url = buildRestUrl(ctx.restRoot, `/wp/v2/${ctx.restBase}/${ctx.postId}`);
    return expectOk(await ctx.request(url, jsonPost({ meta: values })), 'Failed to save SEO fields');
  },
};
