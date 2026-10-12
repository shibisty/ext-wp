import { describe, expect, it } from 'vitest';
import { buildManifest } from '../src/manifest';

describe('manifest', () => {
  it('chrome uses the native side panel and a module service worker', () => {
    const m = buildManifest('chrome', '1.2.3') as any;
    expect(m).toMatchObject({
      manifest_version: 3, version: '1.2.3',
      background: { service_worker: 'background.js', type: 'module' },
      side_panel: { default_path: 'sidebar/index.html' },
    });
    expect(m.permissions).toContain('sidePanel');
    expect(m).not.toHaveProperty('sidebar_action');
  });

  it('firefox uses sidebar_action, background scripts and gecko settings', () => {
    const m = buildManifest('firefox', '1.2.3') as any;
    expect(m.sidebar_action.default_panel).toBe('sidebar/index.html');
    expect(m.background).toEqual({ scripts: ['background.js'], type: 'module' });
    expect(m.permissions).not.toContain('sidePanel');
    expect(m.browser_specific_settings.gecko.data_collection_permissions).toEqual({ required: ['none'] });
    expect(m).not.toHaveProperty('side_panel');
  });
});
