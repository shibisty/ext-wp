// Generic form renderer: Field[] (from any provider) → DOM. Every editable
// control carries data-section / data-field / data-type, which is all
// collect.ts needs to turn the form back into per-provider values.

import type { Field } from '../../types';
import { isDateKind } from '../../lib/dates';
import { t, type Lang } from '../../lib/i18n';
import { h, labeled } from '../dom';
import { buildDateField } from './date';
import { buildImageField, type UploadImage } from './image';
import { attachMask } from './mask';

export interface RenderDeps {
  lang: Lang;
  uploadImage: UploadImage;
}

function readonlyBlock(value: unknown, title: string): HTMLElement {
  return h('pre', {
    className: 'seb-readonly',
    title,
    textContent: value !== null && typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? ''),
  });
}

export function buildControl(sectionId: string, field: Field, deps: RenderDeps): HTMLElement {
  const data = { section: sectionId, field: field.id, type: field.type };

  if (field.type === 'image') return buildImageField(sectionId, field, deps.lang, deps.uploadImage);

  // Intentionally no data-section/data-field — excluded from save().
  if (field.type === 'readonly') return readonlyBlock(field.value, t('notEditableYet', deps.lang));

  if (isDateKind(field.type)) {
    if (field.meta?.unparsed) return readonlyBlock(field.value, t('unparsedDate', deps.lang));
    return buildDateField(sectionId, field as Field & { type: typeof field.type }, deps.lang);
  }

  if (field.type === 'textarea' || field.type === 'json') {
    return h('textarea', {
      value: field.type === 'json' ? JSON.stringify(field.value, null, 2) : String(field.value ?? ''),
      dataset: data,
    });
  }

  if (field.type === 'select') {
    const select = h('select', { dataset: data });
    for (const opt of field.options || []) {
      const value = typeof opt === 'object' ? opt.value : opt;
      const label = typeof opt === 'object' ? opt.label : opt;
      select.append(h('option', { value: String(value), textContent: String(label), selected: String(value) === String(field.value) }));
    }
    return select;
  }

  if (field.type === 'price' || field.type === 'integer' || field.type === 'number' || field.type === 'slug') {
    const input = h('input', {
      type: 'text', // IMask requires type="text"
      inputMode: field.type === 'slug' ? 'text' : 'decimal',
      value: String(field.value ?? ''),
      dataset: data,
    });
    attachMask(input, field);
    return input;
  }

  const inputType = field.type === 'email' || field.type === 'url' ? field.type : 'text';
  return h('input', { type: inputType, value: String(field.value ?? ''), dataset: data });
}

export function buildFieldsEl(sectionId: string, fields: Field[], deps: RenderDeps): HTMLElement {
  const wrap = h('div');
  const unparsedHint = (f: Field) => (isDateKind(f.type) && f.meta?.unparsed ? t('unparsedDate', deps.lang) : f.hint);
  for (const field of fields) {
    wrap.append(labeled(field.label, buildControl(sectionId, field, deps), unparsedHint(field)));
  }
  return wrap;
}
