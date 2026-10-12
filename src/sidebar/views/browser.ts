// Content browser for a saved connection: search + type filter + pagination
// (sorted by date), and "create new" — all over the bearer-token transport.

import type { Connection } from '../../types';
import { t } from '../../lib/i18n';
import { tokenFetch } from '../../lib/token-client';
import { buildRestUrl, expectOk, jsonPost } from '../../lib/wp-client';
import { enterConnectionMode } from '../controller';
import { button, h, labeled } from '../dom';
import { backButton, renderChrome, renderStartScreen } from '../layout';
import { state } from '../state';

export interface BrowserState {
  query: string;
  subtype: string;
  page: number;
}

interface SearchItem {
  id: number;
  title?: string;
  type?: string;
  subtype?: string;
  _links?: { self?: Array<{ href: string }> };
}

// /wp/v2/search doesn't return a rest_base, but each item's _links.self
// points at its real REST URL — parse the base out of that instead of a
// separate /wp/v2/types lookup.
export function restBaseFromSelfLink(selfHref: string | undefined): string | null {
  if (!selfHref) return null;
  try {
    const u = new URL(selfHref);
    const path = u.searchParams.get('rest_route') || u.pathname;
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 2] || null;
  } catch {
    return null;
  }
}

export function searchParams(s: BrowserState): Record<string, string | number> {
  const params: Record<string, string | number> = {
    search: s.query, page: s.page, per_page: 20, orderby: 'date', order: 'desc', type: 'post',
  };
  if (s.subtype !== 'any') params.subtype = s.subtype;
  return params;
}

// The shell (search input, type select, list/pager) is built ONCE per visit;
// search/type/pagination only re-fill listEl/pagerEl, so the search input is
// never recreated and never loses focus while typing.
export function showContentBrowser(connection: Connection, initial: Partial<BrowserState> = {}): void {
  const { lang } = state;
  const s: BrowserState = { query: initial.query || '', subtype: initial.subtype || 'any', page: initial.page || 1 };

  const searchInput = h('input', { type: 'search', placeholder: t('search', lang), value: s.query });
  const typeSelect = h('select', null,
    ...([['any', t('typeAny', lang)], ['post', 'Post'], ['page', 'Page'], ['product', 'Product']] as const)
      .map(([v, l]) => h('option', { value: v, textContent: l, selected: v === s.subtype })),
  );
  const listEl = h('div', { className: 'seb-browser-list' });
  const pagerEl = h('div', { className: 'seb-browser-pager' });
  const rerun = () => runSearch(connection, listEl, pagerEl, s);

  let debounce: ReturnType<typeof setTimeout> | undefined;
  searchInput.oninput = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { s.query = searchInput.value; s.page = 1; rerun(); }, 350);
  };
  typeSelect.onchange = () => { s.subtype = typeSelect.value; s.page = 1; rerun(); };

  state.lastMainRender = () => showContentBrowser(connection, s);
  renderChrome(h('div', { className: 'seb-browser' },
    backButton(() => renderStartScreen()),
    h('div', { className: 'seb-browser-toolbar' },
      searchInput,
      typeSelect,
      button({ className: 'seb-link-btn', textContent: '+ ' + t('createNew', lang), onclick: () => showCreateContentPopup(connection) }),
    ),
    listEl,
    pagerEl,
  ));
  rerun();
}

async function runSearch(connection: Connection, listEl: HTMLElement, pagerEl: HTMLElement, s: BrowserState): Promise<void> {
  listEl.textContent = t('loadingFields', state.lang);
  pagerEl.replaceChildren();
  try {
    const url = buildRestUrl(connection.restRoot, '/wp/v2/search', searchParams(s));
    const res = await tokenFetch(connection, url, {});
    const items = expectOk<SearchItem[]>(res, 'Search failed') || [];
    renderResults(listEl, pagerEl, connection, items, res.totalPages || 1, s);
  } catch (err) {
    listEl.textContent = t('error', state.lang) + ': ' + (err as Error).message;
  }
}

function renderResults(
  listEl: HTMLElement, pagerEl: HTMLElement, connection: Connection,
  items: SearchItem[], totalPages: number, s: BrowserState,
): void {
  listEl.replaceChildren();
  if (!items.length) listEl.textContent = t('noResults', state.lang);
  for (const item of items) {
    listEl.append(h('div', { className: 'seb-browser-item', onclick: () => openBrowserItem(connection, item) },
      h('span', { className: 'seb-browser-item-title', textContent: item.title || '(untitled)' }),
      h('span', { className: 'seb-browser-item-meta', textContent: item.subtype || item.type || '' }),
    ));
  }

  pagerEl.replaceChildren();
  if (totalPages > 1) {
    const go = (delta: number) => { s.page += delta; runSearch(connection, listEl, pagerEl, s); };
    pagerEl.append(
      button({ className: 'seb-link-btn', textContent: '←', disabled: s.page <= 1, onclick: () => go(-1) }),
      h('span', { className: 'seb-browser-page-label', textContent: `${s.page} / ${totalPages}` }),
      button({ className: 'seb-link-btn', textContent: '→', disabled: s.page >= totalPages, onclick: () => go(1) }),
    );
  }
}

function openBrowserItem(connection: Connection, item: SearchItem): void {
  enterConnectionMode(connection, {
    entityType: 'post',
    postId: item.id,
    postType: item.subtype,
    restBase: restBaseFromSelfLink(item._links?.self?.[0]?.href) || item.subtype,
    providers: connection.providers || ['core'],
    isFrontPage: false,
    languages: null,
  });
}

// ---- Create new content ----

async function showCreateContentPopup(connection: Connection): Promise<void> {
  const { lang } = state;
  const typeSelect = h('select', { disabled: true });
  const titleInput = h('input', { type: 'text' });
  const errorEl = h('p', { className: 'seb-conn-error' });
  const createBtn = button({ id: 'seb-save', textContent: t('create', lang), disabled: true });

  createBtn.onclick = async () => {
    const opt = typeSelect.selectedOptions[0];
    if (!opt || !titleInput.value.trim()) {
      errorEl.textContent = t('fillAllFields', lang);
      return;
    }
    createBtn.disabled = true;
    createBtn.textContent = t('creating', lang);
    try {
      const url = buildRestUrl(connection.restRoot, `/wp/v2/${opt.value}`);
      const created = expectOk<{ id: number }>(
        await tokenFetch(connection, url, jsonPost({ title: titleInput.value.trim(), status: 'draft' })),
        'Create failed',
      );
      enterConnectionMode(connection, {
        entityType: 'post',
        postId: created.id,
        postType: opt.dataset.slug,
        restBase: opt.value,
        providers: connection.providers || ['core'],
        isFrontPage: false,
        languages: null,
      });
    } catch (err) {
      errorEl.textContent = (err as Error).message;
      createBtn.disabled = false;
      createBtn.textContent = t('create', lang);
    }
  };

  state.lastMainRender = () => showCreateContentPopup(connection);
  renderChrome(h('div', null,
    backButton(() => showContentBrowser(connection)),
    labeled(t('contentType', lang), typeSelect),
    labeled(t('title', lang), titleInput),
    errorEl,
    createBtn,
  ));

  try {
    const url = buildRestUrl(connection.restRoot, '/wp/v2/types');
    const types = expectOk<Record<string, { rest_base?: string; name?: string }>>(
      await tokenFetch(connection, url, {}), 'Failed to load content types',
    );
    for (const [slug, def] of Object.entries(types || {})) {
      if (!def.rest_base) continue;
      typeSelect.append(h('option', { value: def.rest_base, textContent: def.name || slug, dataset: { slug } }));
    }
    typeSelect.disabled = false;
    createBtn.disabled = false;
  } catch (err) {
    errorEl.textContent = (err as Error).message;
  }
}
