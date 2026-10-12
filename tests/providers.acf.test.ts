import { describe, expect, it, vi } from 'vitest';
import { acfFieldToSchema, acfProvider, acfValuesForSave, entityRef, type AcfField } from '../src/providers/acf';
import { makeCtx, ok, sentBody } from './helpers';

const field = (type: string, value: unknown, extra: Partial<AcfField> = {}): AcfField => ({
  key: `field_${type}`, name: type, label: type, type, value, ...extra,
});

describe('ACF date fields', () => {
  it('date_picker with raw Ymd/ISO value becomes a date picker', () => {
    expect(acfFieldToSchema(field('date_picker', '20260521'))).toMatchObject({ type: 'date', value: '2026-05-21' });
    expect(acfFieldToSchema(field('date_picker', '2026-05-21', { raw: true }))).toMatchObject({ type: 'date', value: '2026-05-21' });
  });

  it('date_time_picker and time_picker map to datetime/time', () => {
    expect(acfFieldToSchema(field('date_time_picker', '2026-05-21 10:30:00'))).toMatchObject({ type: 'datetime', value: '2026-05-21T10:30' });
    expect(acfFieldToSchema(field('time_picker', '10:30:00'))).toMatchObject({ type: 'time', value: '10:30' });
  });

  it('empty date stays empty (not unparsed)', () => {
    const f = acfFieldToSchema(field('date_picker', ''));
    expect(f).toMatchObject({ type: 'date', value: '' });
    expect(f.meta?.unparsed).toBe(false);
  });

  it('a formatted value from an old bridge is flagged, not blanked', () => {
    const f = acfFieldToSchema(field('date_picker', '21 Травня, 2026'));
    expect(f.value).toBe('21 Травня, 2026');
    expect(f.meta?.unparsed).toBe(true);
  });

  it('save converts back to ACF storage formats', () => {
    const schema = [
      acfFieldToSchema(field('date_picker', '20260521')),
      acfFieldToSchema(field('date_time_picker', '2026-05-21 10:30:00')),
      acfFieldToSchema(field('time_picker', '10:30:00')),
      acfFieldToSchema(field('text', 'hello')),
    ];
    expect(acfValuesForSave({
      field_date_picker: '2026-06-01',
      field_date_time_picker: '2026-06-01T08:15',
      field_time_picker: '08:15',
      field_text: 'hi',
    }, schema)).toEqual({
      field_date_picker: '20260601',
      field_date_time_picker: '2026-06-01 08:15:00',
      field_time_picker: '08:15:00',
      field_text: 'hi',
    });
  });

  it('save clears a date with an empty string', () => {
    const schema = [acfFieldToSchema(field('date_picker', '20260521'))];
    expect(acfValuesForSave({ field_date_picker: '' }, schema)).toEqual({ field_date_picker: '' });
  });

  it('save never sends back a value that is not a date', () => {
    const schema = [acfFieldToSchema(field('date_picker', '21 Травня, 2026'))];
    expect(acfValuesForSave({ field_date_picker: '21 Травня, 2026' }, schema)).toEqual({});
  });
});

describe('ACF other fields', () => {
  it('true_false becomes a Yes/No select', () => {
    expect(acfFieldToSchema(field('true_false', true))).toMatchObject({ type: 'select', value: '1' });
    expect(acfFieldToSchema(field('true_false', false))).toMatchObject({ type: 'select', value: '' });
  });

  it('select uses choices', () => {
    const f = acfFieldToSchema(field('select', 'b', { choices: { a: 'A', b: 'B' } }));
    expect(f).toMatchObject({ type: 'select', value: 'b', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] });
  });

  it('multi-select (array value) is read-only rather than silently collapsed to one value', () => {
    expect(acfFieldToSchema(field('select', ['a', 'b'], { choices: { a: 'A', b: 'B' } })).type).toBe('readonly');
  });

  it('image keeps the attachment id and a preview', () => {
    const f = acfFieldToSchema(field('image', { id: 7, url: 'u.jpg', sizes: { medium: 'm.jpg' } }));
    expect(f).toMatchObject({ type: 'image', value: 7, previewUrl: 'm.jpg' });
  });

  it('complex types are read-only', () => {
    expect(acfFieldToSchema(field('repeater', [{ a: 1 }])).type).toBe('readonly');
    expect(acfFieldToSchema(field('group', { a: 1 })).type).toBe('readonly');
  });
});

describe('acfProvider', () => {
  it('uses term_<id> refs for terms', () => {
    expect(entityRef({ entityType: 'term', postId: 5 })).toBe('term_5');
    expect(entityRef({ entityType: 'post', postId: 5 })).toBe('5');
  });

  it('is only active with ACF and an actual entity', () => {
    expect(acfProvider.detect(makeCtx({ providers: ['core', 'acf'] }))).toBe(true);
    expect(acfProvider.detect(makeCtx({ providers: ['core'] }))).toBe(false);
    expect(acfProvider.detect(makeCtx({ providers: ['acf'], entityType: null, isFrontPage: true }))).toBe(false);
  });

  it('saves through the bridge route with converted dates', async () => {
    const ctx = makeCtx({ providers: ['acf'], request: vi.fn(async () => ok({ ok: true })) });
    const schema = [acfFieldToSchema(field('date_picker', '20260521'))];
    await acfProvider.save(ctx, { field_date_picker: '2026-07-04' }, schema);
    expect((ctx.request as any).mock.calls[0][0]).toBe('https://example.com/wp-json/sidebar-editor/v1/acf/42');
    expect(sentBody(ctx)).toEqual({ field_date_picker: '20260704' });
  });
});
