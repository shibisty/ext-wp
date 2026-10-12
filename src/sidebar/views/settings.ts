import { applyTheme, resolveLang, resolveTheme, saveSettings, t } from '../../lib/i18n';
import type { LangSetting, ThemeSetting } from '../../types';
import { h, labeled } from '../dom';
import { backButton, renderChrome } from '../layout';
import { state } from '../state';

function select<V extends string>(options: Array<[V, string]>, current: V, onChange: (v: V) => void): HTMLSelectElement {
  const el = h('select', null, ...options.map(([value, label]) => h('option', { value, textContent: label, selected: value === current })));
  el.onchange = () => onChange(el.value as V);
  return el;
}

export function showSettings(): void {
  const { lang, settings } = state;
  const langSelect = select<LangSetting>(
    [['auto', t('auto', lang)], ['en', 'English'], ['ru', 'Русский']],
    settings.lang,
    async (v) => {
      settings.lang = v;
      state.lang = resolveLang(settings);
      await saveSettings(settings);
      showSettings();
    },
  );
  const themeSelect = select<ThemeSetting>(
    [['auto', t('auto', lang)], ['light', t('themeLight', lang)], ['dark', t('themeDark', lang)]],
    settings.theme,
    async (v) => {
      settings.theme = v;
      applyTheme(resolveTheme(settings));
      await saveSettings(settings);
    },
  );

  renderChrome(h('div', { className: 'seb-settings' },
    backButton(() => state.lastMainRender()),
    labeled(t('language', lang), langSelect),
    labeled(t('theme', lang), themeSelect),
  ));
}
