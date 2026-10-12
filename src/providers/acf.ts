import type { Field, FieldValues, Provider } from '../types';
import { parseByKind, toAcfDate, toAcfDateTime, toAcfTime, type DateKind } from '../lib/dates';
import { buildRestUrl, expectOk, jsonPost } from '../lib/wp-client';
import { hasPlugin } from './util';

// Goes through the bridge plugin's own /acf/<ref> route (get_field_objects /
// update_field) rather than ACF's built-in REST integration — see the PHP
// comment for why. Works the same for posts and terms; `ref` is either the
// numeric post ID or ACF's "term_<id>" convention (see entityRef below).
//
// Field type coverage: scalar types render as editable inputs, date/time
// pickers get native pickers, image fields get the drag-and-drop upload
// widget, everything else (repeater, gallery, flexible_content, group,
// relationship, ...) renders read-only so the section is never silently
// empty — just says what it can't edit yet.

export interface AcfField {
  key: string;
  name: string;
  label?: string;
  type: string;
  value: any;
  choices?: Record<string, string> | null;
  /** Bridge 0.7.0+: values of date fields are raw storage values, not formatted. */
  raw?: boolean;
  display_format?: string;
}

const TEXT_TYPES = new Set(['text', 'password', 'color_picker', 'oembed']);

const DATE_TYPES: Record<string, { kind: DateKind; toStorage: (v: string) => string }> = {
  date_picker: { kind: 'date', toStorage: toAcfDate },
  date_time_picker: { kind: 'datetime', toStorage: toAcfDateTime },
  time_picker: { kind: 'time', toStorage: toAcfTime },
};

export function entityRef(ctx: { entityType: string | null; postId?: number }): string {
  return ctx.entityType === 'term' ? `term_${ctx.postId}` : String(ctx.postId);
}

export function acfFieldToSchema(f: AcfField): Field {
  const base = { id: f.key, label: f.label || f.name, meta: { acfType: f.type } };

  const dateType = DATE_TYPES[f.type];
  if (dateType) {
    const parsed = parseByKind(dateType.kind, f.value);
    // Unparsable (old bridge sending a formatted "21 May, 2026") → keep the
    // raw string; the renderer shows it read-only instead of a blank picker,
    // and save() never sends it back, so the stored date can't be corrupted.
    return { ...base, type: dateType.kind, value: parsed ?? String(f.value), meta: { ...base.meta, unparsed: parsed === null } };
  }

  switch (f.type) {
    case 'image': {
      const obj = f.value && typeof f.value === 'object' ? f.value : null;
      return {
        ...base, type: 'image',
        value: obj ? obj.id : (f.value || ''),
        previewUrl: obj ? (obj.sizes?.medium || obj.url) : undefined,
      };
    }
    case 'true_false':
      return {
        ...base, type: 'select', value: f.value ? '1' : '',
        options: [{ value: '1', label: 'Yes' }, { value: '', label: 'No' }],
      };
    case 'select':
    case 'radio':
    case 'button_group':
      if (Array.isArray(f.value)) break; // multi-select — not editable as a single <select> yet
      return {
        ...base, type: 'select', value: f.value ?? '',
        options: f.choices ? Object.entries(f.choices).map(([value, label]) => ({ value, label })) : [],
      };
    case 'textarea':
    case 'wysiwyg':
      return { ...base, type: 'textarea', value: f.value ?? '' };
    case 'number':
    case 'range':
      return { ...base, type: 'number', value: f.value ?? '', min: '' };
    case 'email':
      return { ...base, type: 'email', value: f.value ?? '' };
    case 'url':
    case 'link':
      if (f.type === 'link' && f.value && typeof f.value === 'object') break;
      return { ...base, type: 'url', value: f.value ?? '' };
    default:
      if (TEXT_TYPES.has(f.type)) return { ...base, type: 'text', value: f.value ?? '' };
  }
  return { ...base, type: 'readonly', value: f.value };
}

/** Convert panel values back to what update_field() expects, dropping anything we must not write. */
export function acfValuesForSave(values: FieldValues, schema: Field[]): FieldValues {
  const byId = new Map(schema.map((f) => [f.id, f]));
  const out: FieldValues = {};
  for (const [id, value] of Object.entries(values)) {
    const field = byId.get(id);
    const dateType = DATE_TYPES[String(field?.meta?.acfType)];
    if (!dateType) {
      out[id] = value;
      continue;
    }
    const parsed = parseByKind(dateType.kind, value);
    if (parsed === null) continue; // never write back something that isn't a date
    out[id] = parsed === '' ? '' : dateType.toStorage(parsed);
  }
  return out;
}

export const acfProvider: Provider<AcfField[]> = {
  id: 'acf',

  detect(ctx) {
    return hasPlugin(ctx, 'acf') && (ctx.entityType === 'post' || ctx.entityType === 'term');
  },

  async load(ctx) {
    const url = buildRestUrl(ctx.restRoot, `/sidebar-editor/v1/acf/${entityRef(ctx)}`);
    return expectOk<AcfField[]>(await ctx.request(url, {}), 'Failed to load ACF fields') || [];
  },

  getSchema(fields) {
    return fields.map(acfFieldToSchema);
  },

  async save(ctx, values, schema) {
    const url = buildRestUrl(ctx.restRoot, `/sidebar-editor/v1/acf/${entityRef(ctx)}`);
    return expectOk(await ctx.request(url, jsonPost(acfValuesForSave(values, schema))), 'Failed to save ACF fields');
  },
};
