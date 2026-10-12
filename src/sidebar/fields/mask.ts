// Live input masking for number-ish and slug fields.

import IMask from 'imask';
import type { Field } from '../../types';

export function maskOptionsFor(field: Pick<Field, 'type' | 'min'>): Record<string, unknown> | null {
  if (field.type === 'slug') return { mask: /^[a-z0-9-]*$/ };

  const hasMin = field.min !== undefined && field.min !== '';
  const opts: Record<string, unknown> = { mask: Number, radix: '.', mapToRadix: [','], thousandsSeparator: '' };
  if (field.type === 'price') {
    opts.scale = 2;
    opts.min = hasMin ? Number(field.min) : 0;
  } else if (field.type === 'integer') {
    opts.scale = 0;
    opts.min = hasMin ? Number(field.min) : 0;
  } else if (field.type === 'number') {
    opts.scale = 6;
    if (hasMin) opts.min = Number(field.min);
  } else {
    return null;
  }
  return opts;
}

export function attachMask(input: HTMLInputElement, field: Pick<Field, 'type' | 'min'>): void {
  const opts = maskOptionsFor(field);
  if (opts) IMask(input, opts as any);
}
