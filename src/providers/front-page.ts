import type { Provider } from '../types';
import { buildRestUrl, expectOk, jsonPost } from '../lib/wp-client';

interface FrontPageData {
  settings: { show_on_front: string; page_on_front?: number; page_for_posts?: number };
  pages: Array<{ id: number; title?: { rendered?: string; raw?: string } }>;
}

// Equivalent of Settings → Reading → "Your homepage displays". Shows up on
// the front page regardless of whether it's currently a static page or the
// latest-posts listing. If a static page is assigned, core handles that
// page's own content separately — this provider is only about *which*
// page/mode is shown, via /wp/v2/settings (requires manage_options).
export const frontPageProvider: Provider<FrontPageData> = {
  id: 'front-page',

  detect(ctx) {
    return ctx.isFrontPage === true;
  },

  async load(ctx) {
    const settingsUrl = buildRestUrl(ctx.restRoot, '/wp/v2/settings');
    const pagesUrl = buildRestUrl(ctx.restRoot, '/wp/v2/pages', { per_page: 100, context: 'edit', _fields: 'id,title' });
    const [settingsRes, pagesRes] = await Promise.all([ctx.request(settingsUrl, {}), ctx.request(pagesUrl, {})]);
    return {
      settings: expectOk(settingsRes, 'Failed to load reading settings'),
      pages: pagesRes.ok ? pagesRes.json : [],
    };
  },

  getSchema({ settings, pages }) {
    const pageOptions = [
      { value: '', label: '—' },
      ...pages.map((p) => ({ value: String(p.id), label: p.title?.rendered || p.title?.raw || `#${p.id}` })),
    ];
    return [
      {
        id: 'show_on_front', label: 'Homepage displays', type: 'select', value: settings.show_on_front,
        options: [
          { value: 'posts', label: 'Your latest posts' },
          { value: 'page', label: 'A static page' },
        ],
      },
      { id: 'page_on_front', label: 'Front page', type: 'select', value: String(settings.page_on_front || ''), options: pageOptions },
      { id: 'page_for_posts', label: 'Posts page', type: 'select', value: String(settings.page_for_posts || ''), options: pageOptions },
    ];
  },

  async save(ctx, values) {
    const payload = {
      show_on_front: values.show_on_front,
      page_on_front: values.page_on_front ? parseInt(values.page_on_front, 10) : 0,
      page_for_posts: values.page_for_posts ? parseInt(values.page_for_posts, 10) : 0,
    };
    const url = buildRestUrl(ctx.restRoot, '/wp/v2/settings');
    return expectOk(await ctx.request(url, jsonPost(payload)), 'Failed to save reading settings');
  },
};
