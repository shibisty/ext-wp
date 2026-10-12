import type { Field, Provider } from '../types';
import { parseDateTime, toWpDateTime } from '../lib/dates';
import { buildRestUrl, expectOk, jsonPost } from '../lib/wp-client';

interface WpPost {
  title?: { raw?: string };
  excerpt?: { raw?: string };
  content?: { raw?: string };
  status: string;
  date?: string | null;
  featured_media?: number;
  _embedded?: { 'wp:featuredmedia'?: Array<{ source_url?: string }> };
}

/** Fields only sent when actually changed — re-sending an untouched publish date would e.g. pin a draft's floating date. */
const SEND_ONLY_IF_CHANGED = ['date'];

export const coreProvider: Provider<WpPost> = {
  id: 'core',

  detect(ctx) {
    return ctx.entityType === 'post'; // taxonomy terms are handled by term-core
  },

  async load(ctx) {
    const url = buildRestUrl(ctx.restRoot, `/wp/v2/${ctx.restBase}/${ctx.postId}`, {
      context: 'edit',
      _embed: 'wp:featuredmedia',
    });
    return expectOk<WpPost>(await ctx.request(url, {}), 'Failed to load post');
  },

  getSchema(post): Field[] {
    const featuredUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    return [
      { id: 'title', label: 'Title', type: 'text', value: post.title?.raw ?? '' },
      { id: 'excerpt', label: 'Excerpt', type: 'textarea', value: post.excerpt?.raw ?? '' },
      { id: 'content', label: 'Content', type: 'textarea', value: post.content?.raw ?? '' },
      {
        id: 'status', label: 'Status', type: 'select', value: post.status,
        options: ['publish', 'draft', 'pending', 'private', 'future'],
      },
      { id: 'date', label: 'Publish date', type: 'datetime', value: parseDateTime(post.date) ?? '' },
      {
        id: 'featured_media', label: 'Featured Image', type: 'image',
        value: post.featured_media || '', previewUrl: featuredUrl,
      },
    ];
  },

  async save(ctx, data, schema) {
    const payload: Record<string, unknown> = { ...data };
    for (const id of SEND_ONLY_IF_CHANGED) {
      const original = schema.find((f) => f.id === id)?.value;
      if (id in payload && payload[id] === original) delete payload[id];
    }
    if ('date' in payload) {
      // WP can't "clear" a post date; an emptied picker just means "leave it".
      if (payload.date) payload.date = toWpDateTime(String(payload.date));
      else delete payload.date;
    }
    if ('featured_media' in payload) {
      payload.featured_media = payload.featured_media ? parseInt(String(payload.featured_media), 10) : 0;
    }
    const url = buildRestUrl(ctx.restRoot, `/wp/v2/${ctx.restBase}/${ctx.postId}`);
    return expectOk(await ctx.request(url, jsonPost(payload)), 'Failed to save');
  },
};
