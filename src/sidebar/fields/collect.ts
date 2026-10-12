// Reads the rendered form back into { [sectionId]: { [fieldId]: value } }.

import type { FieldValues } from '../../types';

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export interface Collected {
  bySection: Record<string, FieldValues>;
  /** First control failing native validation (bad email/url, incomplete date, ...). */
  firstInvalid: FormControl | null;
  /** Sections skipped because a JSON field doesn't parse (drafts only — save() reports it). */
  jsonErrors: Array<{ section: string; field: string; message: string }>;
}

export function controlsIn(root: ParentNode): FormControl[] {
  return [...root.querySelectorAll<FormControl>('[data-section]')];
}

export function collectValues(root: ParentNode): Collected {
  const controls = controlsIn(root);
  const firstInvalid = controls.find((el) => el.checkValidity && !el.checkValidity()) || null;
  const bySection: Record<string, FieldValues> = {};
  const jsonErrors: Collected['jsonErrors'] = [];

  for (const el of controls) {
    const { section, field, type } = el.dataset as { section: string; field: string; type: string };
    bySection[section] ||= {};
    if (type === 'json') {
      try {
        bySection[section][field] = JSON.parse(el.value);
      } catch (err) {
        jsonErrors.push({ section, field, message: (err as Error).message });
      }
    } else {
      bySection[section][field] = el.value;
    }
  }
  return { bySection, firstInvalid, jsonErrors };
}
