// Single source for both browsers' manifest.json — generated at build time
// by the plugin in vite.config.ts, so the two can't drift apart.

export type Target = 'chrome' | 'firefox';

export const GECKO_ID = 'wp-sidebar-editor@local';

const DESCRIPTION = 'Edit WordPress pages, posts and custom fields from the browser side panel without opening wp-admin.';
const SIDEBAR_PATH = 'sidebar/index.html';

export function buildManifest(target: Target, version: string): Record<string, unknown> {
  const common = {
    manifest_version: 3,
    name: 'WP Sidebar Editor',
    version,
    description: DESCRIPTION,
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Open WP Sidebar Editor' },
  };

  if (target === 'chrome') {
    return {
      ...common,
      permissions: ['storage', 'activeTab', 'scripting', 'sidePanel', 'tabs'],
      background: { service_worker: 'background.js', type: 'module' },
      side_panel: { default_path: SIDEBAR_PATH },
    };
  }

  return {
    ...common,
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    background: { scripts: ['background.js'], type: 'module' },
    sidebar_action: {
      default_title: 'WP Sidebar Editor',
      default_panel: SIDEBAR_PATH,
      open_at_install: false,
    },
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '140.0',
        // Required by AMO for new submissions. The extension sends data only
        // to the WordPress sites the user edits, which is not "collection".
        data_collection_permissions: { required: ['none'] },
      },
    },
  };
}
