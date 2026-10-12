// Connections dropdown (header 🔗) and the add/edit-connection form.

import type { Connection, TokenResponse } from '../../types';
import { connectionFromTokens, listConnections, removeConnection, upsertConnection } from '../../lib/connections';
import { t } from '../../lib/i18n';
import { login } from '../../lib/token-client';
import { button, h, labeled } from '../dom';
import { backButton, renderChrome, renderStartScreen } from '../layout';
import { state } from '../state';
import { showContentBrowser } from './browser';

let dropdownEl: HTMLElement | null = null;

export async function toggleConnectionsDropdown(anchorEl: HTMLElement): Promise<void> {
  if (dropdownEl) { closeConnectionsDropdown(); return; }
  const { lang } = state;
  const list = await listConnections();
  const dd = h('div', { className: 'seb-conn-dropdown' });

  if (!list.length) dd.append(h('div', { className: 'seb-conn-empty', textContent: t('noConnections', lang) }));

  for (const c of list) {
    dd.append(h('div', { className: 'seb-conn-row' },
      h('span', {
        className: 'seb-conn-name', textContent: c.siteUrl || c.restRoot, title: c.userLogin || '',
        onclick: () => { closeConnectionsDropdown(); showContentBrowser(c); },
      }),
      button({
        className: 'seb-conn-edit', textContent: '✎', title: t('editConnection', lang),
        onclick: (e) => { e.stopPropagation(); closeConnectionsDropdown(); showAddConnectionPopup(c); },
      }),
      button({
        className: 'seb-conn-remove', textContent: '✕', title: t('removeConnection', lang),
        onclick: async (e) => {
          e.stopPropagation();
          await removeConnection(c.restRoot);
          closeConnectionsDropdown();
          toggleConnectionsDropdown(anchorEl);
        },
      }),
    ));
  }

  dd.append(button({
    className: 'seb-conn-add', textContent: '+ ' + t('addConnection', lang),
    onclick: () => { closeConnectionsDropdown(); showAddConnectionPopup(); },
  }));

  anchorEl.append(dd);
  dropdownEl = dd;
  setTimeout(() => document.addEventListener('click', onDocClick), 0);
}

function closeConnectionsDropdown(): void {
  dropdownEl?.remove();
  dropdownEl = null;
  document.removeEventListener('click', onDocClick);
}

function onDocClick(e: MouseEvent): void {
  if (dropdownEl && !dropdownEl.contains(e.target as Node)) closeConnectionsDropdown();
}

// ---- Add / edit connection ----

/** "example.com" / "https://example.com/" → "https://example.com/wp-json/". */
export function normalizeRestRoot(rawUrl: string): string {
  let u = rawUrl.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/+$/, '') + '/wp-json/';
}

/** Same site with plain permalinks: ".../wp-json/" → ".../?rest_route=/". */
export function plainPermalinkRoot(prettyRoot: string): string {
  return prettyRoot.replace(/\/wp-json\/$/, '/?rest_route=/');
}

export async function loginWithFallback(
  rawUrl: string, username: string, password: string,
  doLogin: typeof login = login,
): Promise<{ tokens: TokenResponse; restRoot: string }> {
  const prettyRoot = normalizeRestRoot(rawUrl);
  try {
    return { tokens: await doLogin(prettyRoot, username, password), restRoot: prettyRoot };
  } catch (err) {
    // A WP 404 carries a JSON message without the number in it — check the status.
    const status = (err as { status?: number }).status;
    if (status !== 404 && !/404/.test((err as Error).message)) throw err;
    // Pretty permalinks assumption was wrong — retry the plain-permalinks form.
    const plainRoot = plainPermalinkRoot(prettyRoot);
    return { tokens: await doLogin(plainRoot, username, password), restRoot: plainRoot };
  }
}

export function showAddConnectionPopup(existing: Connection | null = null): void {
  const { lang } = state;
  const urlInput = h('input', { type: 'url', placeholder: 'https://example.com' });
  const userInput = h('input', { type: 'text' });
  const passInput = h('input', { type: 'password' });
  if (existing) {
    urlInput.value = existing.siteUrl || existing.restRoot;
    userInput.value = existing.userLogin || '';
    // Password is never stored — re-enter it to reconnect.
    passInput.placeholder = t('reenterPassword', lang);
  }
  const errorEl = h('p', { className: 'seb-conn-error' });
  const idleLabel = existing ? t('reconnect', lang) : t('connect', lang);

  const submitBtn = button({ id: 'seb-save', textContent: idleLabel });
  submitBtn.onclick = async () => {
    errorEl.textContent = '';
    if (!urlInput.value.trim() || !userInput.value.trim() || !passInput.value) {
      errorEl.textContent = t('fillAllFields', lang);
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = t('connecting', lang);
    try {
      const { tokens, restRoot } = await loginWithFallback(urlInput.value, userInput.value.trim(), passInput.value);
      await upsertConnection(connectionFromTokens(tokens, { restRoot, siteUrl: urlInput.value.trim() }));
      renderStartScreen();
    } catch (err) {
      errorEl.textContent = (err as Error).message;
      submitBtn.disabled = false;
      submitBtn.textContent = idleLabel;
    }
  };

  state.lastMainRender = () => showAddConnectionPopup(existing);
  renderChrome(h('div', { className: 'seb-popup' },
    backButton(() => (existing ? renderStartScreen() : state.lastMainRender())),
    h('h3', { textContent: existing ? t('editConnection', lang) : t('addConnection', lang) }),
    labeled(t('siteUrl', lang), urlInput),
    labeled(t('username', lang), userInput),
    labeled(t('password', lang), passInput),
    errorEl,
    submitBtn,
  ));
}
