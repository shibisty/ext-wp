import type { Provider } from '../types';
import { buildRestUrl, expectOk, jsonPost } from '../lib/wp-client';

interface WpTerm { name?: string; slug?: string; description?: string }

// Same "core" id as the post provider on purpose — the two never both match
// the same page (post vs. term is mutually exclusive), and sharing the id
// keeps "open by default" behaviour working for both.
export const termCoreProvider: Provider<WpTerm> = {
  id: 'core',

  detect(ctx) {
    return ctx.entityType === 'term';
  },

  async load(ctx) {
    const url = buildRestUrl(ctx.restRoot, `/wp/v2/${ctx.restBase}/${ctx.postId}`, { context: 'edit' });
    return expectOk<WpTerm>(await ctx.request(url, {}), 'Failed to load term');
  },

  getSchema(term) {
    return [
      { id: 'name', label: 'Name', type: 'text', value: term.name ?? '' },
      { id: 'slug', label: 'Slug', type: 'slug', value: term.slug ?? '' },
      { id: 'description', label: 'Description', type: 'textarea', value: term.description ?? '' },
    ];
  },

  async save(ctx, data) {
    const url = buildRestUrl(ctx.restRoot, `/wp/v2/${ctx.restBase}/${ctx.postId}`);
    return expectOk(await ctx.request(url, jsonPost(data)), 'Failed to save term');
  },
};
