// The panel's frame: header (title + connections + settings buttons) and a
// content area that every screen replaces wholesale.

import { t } from '../lib/i18n';
import { button, h } from './dom';
import { state } from './state';

export function appRoot(): HTMLElement {
  const el = document.getElementById('app');
  if (!el) throw new Error('#app missing');
  return el;
}

interface HeaderActions {
  onConnections: (anchor: HTMLElement) => void;
  onSettings: () => void;
}

// Registered once from main.ts — keeps this module free of imports from the
// views (which all import renderChrome from here).
let headerActions: HeaderActions = { onConnections: () => {}, onSettings: () => {} };

export function setHeaderActions(actions: HeaderActions): void {
  headerActions = actions;
}

export function renderChrome(contentEl: HTMLElement): void {
  const app = appRoot();
  app.replaceChildren();
  contentEl.classList.add('seb-content');

  const headerButtons = h('div', { className: 'seb-header-buttons' });
  headerButtons.append(
    button({
      className: 'seb-header-btn', textContent: '🔗', title: t('connections', state.lang),
      onclick: (e) => { e.stopPropagation(); headerActions.onConnections(headerButtons); },
    }),
    button({
      className: 'seb-header-btn', textContent: '⚙', title: t('settings', state.lang),
      onclick: () => headerActions.onSettings(),
    }),
  );

  app.append(
    h('div', { className: 'seb-header' },
      h('span', { className: 'seb-header-title', textContent: t('appTitle', state.lang) }),
      headerButtons,
    ),
    contentEl,
  );
}

export function render(text: string): void {
  state.lastMainRender = () => render(text);
  renderChrome(h('p', { textContent: text }));
}

export function renderStartScreen(message?: string): void {
  state.lastMainRender = () => renderStartScreen(message);
  renderChrome(h('div', null,
    message ? h('p', { textContent: message }) : null,
    h('p', { className: 'seb-hint', textContent: t('startHint', state.lang) }),
  ));
}

export function backButton(onclick: () => void): HTMLButtonElement {
  return button({ className: 'seb-back', textContent: '← ' + t('back', state.lang), onclick });
}
