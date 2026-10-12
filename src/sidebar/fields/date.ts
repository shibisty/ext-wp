// Date / datetime / time picker: the browser's native picker (calendar popup,
// keyboard entry, locale-aware display) plus "Today/Now" and "Clear" buttons
// and a long-form preview (weekday, month name) underneath, so a wrong day
// is obvious at a glance. The <input> value is the canonical string from
// lib/dates.ts, so nothing needs converting when the form is collected.

import type { Field } from '../../types';
import { describe, inputTypeFor, nowValue, parseByKind, stepFor, type DateKind } from '../../lib/dates';
import { localeFor, t, type Lang } from '../../lib/i18n';
import { button, h } from '../dom';

export function buildDateField(sectionId: string, field: Field & { type: DateKind }, lang: Lang): HTMLElement {
  const kind = field.type;
  const value = parseByKind(kind, field.value) ?? '';

  const input = h('input', {
    type: inputTypeFor(kind),
    value,
    className: 'seb-date-input',
    dataset: { section: sectionId, field: field.id, type: kind },
  });
  const step = stepFor(kind, value);
  if (step) input.step = step;

  const preview = h('span', { className: 'seb-date-preview' });
  const refreshPreview = () => { preview.textContent = describe(kind, input.value, localeFor(lang)); };
  refreshPreview();
  input.addEventListener('input', refreshPreview);
  input.addEventListener('change', refreshPreview);

  // Open the calendar on any click in the field, not only on the tiny icon.
  input.addEventListener('click', () => {
    try { input.showPicker?.(); } catch { /* not allowed (e.g. no user gesture) — native behaviour still works */ }
  });

  const setValue = (v: string) => {
    input.value = v;
    // Programmatic changes don't fire 'input' — autosave listens for it.
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const nowBtn = button({
    className: 'seb-date-btn',
    textContent: kind === 'date' ? t('today', lang) : t('now', lang),
    onclick: () => setValue(nowValue(kind)),
  });
  const clearBtn = button({
    className: 'seb-date-btn seb-date-clear',
    textContent: '✕',
    title: t('clearValue', lang),
    ariaLabel: t('clearValue', lang),
    onclick: () => setValue(''),
  });

  return h('div', { className: 'seb-date-field' },
    h('div', { className: 'seb-date-row' }, input, nowBtn, clearBtn),
    preview,
  );
}
