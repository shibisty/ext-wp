// Toolbar icon → open the panel.
//
// Chrome: the native side panel (chrome.sidePanel), with setPanelBehavior so
// the icon opens it directly instead of a popup.
// Firefox: sidebar_action — browser.sidebarAction.toggle() must run
// synchronously inside the click handler (user-gesture requirement).

// Firefox exposes sidebarAction only on the `browser` namespace.
const ffBrowser = (globalThis as { browser?: { sidebarAction?: { toggle(): Promise<void> } } }).browser;

const sidePanel = (chrome as any).sidePanel as typeof chrome.sidePanel | undefined;

if (sidePanel) {
  chrome.runtime.onInstalled.addListener(() => {
    sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  });
}

chrome.action.onClicked.addListener((tab) => {
  if (sidePanel) {
    // Fallback in case setPanelBehavior isn't honored on some Chrome versions —
    // harmless no-op if the panel already opened via the behavior above.
    if (tab.windowId !== undefined) sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    return;
  }
  ffBrowser?.sidebarAction?.toggle().catch(() => {});
});
