// Side panel entry point: settings/theme, tab tracking, wiring.

import './styles.css';
import { applyTheme, detectBrowserTheme, loadSettings, resolveLang, resolveTheme, t } from '../lib/i18n';
import { hideBanner, hideCheckingIndicator, showCheckingIndicator, showSwitchBanner } from './banner';
import { detectLiveContext, isSameLiveEntity, targetKey } from './context';
import { applyLiveContext, tryContinueOffline } from './controller';
import { appRoot, render, setHeaderActions } from './layout';
import { state } from './state';
import { toggleConnectionsDropdown } from './views/connections';
import { onGlobalKeydown, scheduleAutosave } from './views/editor';
import { showSettings } from './views/settings';

async function init(): Promise<void> {
  state.settings = await loadSettings();
  state.lang = resolveLang(state.settings);
  applyTheme(resolveTheme(state.settings));
  state.lastMainRender = () => render(t('detecting', state.lang));

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'auto') applyTheme(detectBrowserTheme());
  });

  setHeaderActions({ onConnections: toggleConnectionsDropdown, onSettings: showSettings });
  appRoot().addEventListener('input', scheduleAutosave); // delegated — survives DOM rebuilds
  document.addEventListener('keydown', onGlobalKeydown);

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId).then(loadForTab).catch(() => {});
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === state.currentTabId && changeInfo.status === 'complete') loadForTab(tab);
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) await loadForTab(tab);
  else await tryContinueOffline();
}

// Runs on every tab switch, but only touches the visible UI when there's a
// real reason to: a genuinely different editable WP page showed up.
// Everything else (leaving WP, an unrelated site, the same page refocused)
// happens silently — no "Detecting…" flash, no surprise reload of whatever
// is being edited.
async function loadForTab(tab: chrome.tabs.Tab): Promise<void> {
  state.currentTabId = tab.id ?? null;

  showCheckingIndicator();
  const detection = await detectLiveContext(tab);
  hideCheckingIndicator();

  if (!detection.ok) {
    hideBanner(true); // whatever was pending is no longer relevant
    if (!state.ctx) {
      // Nothing shown yet — fine to explain why (not WP / not logged in / ...).
      const msg = detection.reason === 'error'
        ? t('error', state.lang) + ': ' + detection.message
        : t(detection.reason, state.lang);
      await tryContinueOffline(msg);
    }
    return; // otherwise leave the current view exactly as it is
  }

  const { data, entityType } = detection;
  if (isSameLiveEntity(state.ctx, state.mode, data, entityType)) {
    hideBanner(true);
    return;
  }

  const tabId = tab.id!;
  if (!state.ctx) {
    applyLiveContext(tabId, data, entityType); // nothing shown yet — nothing to lose
  } else {
    // Already editing something — offer the switch instead of yanking it
    // away (autosave protects in-progress edits either way).
    showSwitchBanner(targetKey(data, entityType), () => applyLiveContext(tabId, data, entityType));
  }
}

init();
