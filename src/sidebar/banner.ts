// "New page detected" banner + background-check indicator. Both float above
// whatever renderChrome() currently has in #app (appended directly to
// <body>), so they survive DOM rebuilds from any screen.

import { t } from '../lib/i18n';
import { button, h } from './dom';
import { state } from './state';

let bannerEl: HTMLElement | null = null;
let pendingKey: string | null = null;
let checkingEl: HTMLElement | null = null;
let checkingTimer: ReturnType<typeof setTimeout> | undefined;

export function showCheckingIndicator(): void {
  // Small delay so a fast check never visibly flashes — the indicator is for
  // background work that's actually taking a moment.
  clearTimeout(checkingTimer);
  checkingTimer = setTimeout(() => {
    if (checkingEl) return;
    checkingEl = h('div', { className: 'seb-checking-indicator', title: t('checking', state.lang) });
    document.body.append(checkingEl);
  }, 250);
}

export function hideCheckingIndicator(): void {
  clearTimeout(checkingTimer);
  checkingEl?.remove();
  checkingEl = null;
}

/** Offer to switch to another editable page; no-op if this exact target is already offered. */
export function showSwitchBanner(key: string, onApply: () => void): void {
  if (pendingKey === key) return;
  hideBanner(true);
  pendingKey = key;
  bannerEl = h('div', { className: 'seb-switch-banner' },
    h('span', { textContent: t('newPageDetected', state.lang) }),
    button({ textContent: t('switchNow', state.lang), onclick: () => { hideBanner(true); onApply(); } }),
    button({ className: 'seb-switch-dismiss', textContent: '✕', onclick: () => hideBanner(true) }),
  );
  document.body.append(bannerEl);
}

export function hideBanner(clearPending = false): void {
  bannerEl?.remove();
  bannerEl = null;
  if (clearPending) pendingKey = null;
}
