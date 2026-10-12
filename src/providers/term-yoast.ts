import type { FieldType, Provider } from '../types';
import { buildRestUrl, expectOk, jsonPost } from '../lib/wp-client';
import { hasPlugin } from './util';
import { schemaFromFieldMap } from './yoast';

// Term-level Yoast SEO isn't stored as term meta — it lives in the
// wpseo_taxonomy_meta option, exposed by the bridge plugin's own
// /sidebar-editor/v1/term-seo/<taxonomy>/<term_id> route.
// Same "yoast" id as the post provider — mutually exclusive by detect().
const FIELDS: Record<string, { label: string; type: FieldType }> = {
  wpseo_title: { label: 'SEO Title', type: 'text' },
  wpseo_desc: { label: 'Meta Description', type: 'textarea' },
  wpseo_focuskw: { label: 'Focus Keyword', type: 'text' },
  wpseo_canonical: { label: 'Canonical URL', type: 'url' },
};

export const termYoastProvider: Provider<Record<string, string>> = {
  id: 'yoast',

  detect(ctx) {
    return ctx.entityType === 'term' && hasPlugin(ctx, 'yoast');
  },

  async load(ctx) {
    const url = buildRestUrl(ctx.restRoot, `/sidebar-editor/v1/term-seo/${ctx.taxonomy}/${ctx.postId}`);
    return expectOk(await ctx.request(url, {}), 'Failed to load term SEO');
  },

  getSchema(data) {
    return schemaFromFieldMap(FIELDS, data);
  },

  async save(ctx, values) {
    const url = buildRestUrl(ctx.restRoot, `/sidebar-editor/v1/term-seo/${ctx.taxonomy}/${ctx.postId}`);
    return expectOk(await ctx.request(url, jsonPost(values)), 'Failed to save term SEO');
  },
};
