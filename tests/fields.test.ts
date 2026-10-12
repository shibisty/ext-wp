import { describe, expect, it, vi } from 'vitest';
import { collectValues } from '../src/sidebar/fields/collect';
import { maskOptionsFor } from '../src/sidebar/fields/mask';
import { buildFieldsEl, type RenderDeps } from '../src/sidebar/fields/render';
import { applyDraft } from '../src/sidebar/views/editor';
import type { Field } from '../src/types';

const deps: RenderDeps = { lang: 'en', uploadImage: vi.fn() };

function mount(fields: Field[], section = 'acf'): HTMLElement {
  const root = document.createElement('div');
  root.append(buildFieldsEl(section, fields, deps));
  document.body.replaceChildren(root);
  return root;
}

describe('date picker fields', () => {
  it('renders native inputs with canonical values', () => {
    const root = mount([
      { id: 'd', label: 'Start', type: 'date', value: '2026-05-21' },
      { id: 'dt', label: 'At', type: 'datetime', value: '2026-05-21T10:30' },
      { id: 't', label: 'Time', type: 'time', value: '10:30:15' },
    ]);
    const [d, dt, t] = root.querySelectorAll('input');
    expect([d.type, d.value]).toEqual(['date', '2026-05-21']);
    expect([dt.type, dt.value]).toEqual(['datetime-local', '2026-05-21T10:30']);
    expect([t.type, t.value, t.step]).toEqual(['time', '10:30:15', '1']);
    expect(root.querySelector('.seb-date-preview')?.textContent).toMatch(/Thursday,? 21 May 2026/);
  });

  it('Today and Clear set the value and fire input (for autosave)', () => {
    const root = mount([{ id: 'd', label: 'Start', type: 'date', value: '2026-05-21' }]);
    const input = root.querySelector('input')!;
    const onInput = vi.fn();
    root.addEventListener('input', onInput);
    const [todayBtn, clearBtn] = root.querySelectorAll<HTMLButtonElement>('.seb-date-btn');

    clearBtn.click();
    expect(input.value).toBe('');
    expect(root.querySelector('.seb-date-preview')?.textContent).toBe('');

    todayBtn.click();
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onInput).toHaveBeenCalledTimes(2);
  });

  it('an unparsable value is shown read-only and excluded from the form', () => {
    const root = mount([{ id: 'd', label: 'Start', type: 'date', value: '21 Травня, 2026', meta: { unparsed: true } }]);
    expect(root.querySelector('input')).toBeNull();
    expect(root.querySelector('pre')?.textContent).toBe('21 Травня, 2026');
    expect(root.querySelector('.seb-field-hint')?.textContent).toMatch(/bridge plugin/);
    expect(collectValues(root).bySection).toEqual({});
  });
});

describe('form collection', () => {
  it('collects values per section, parses JSON, skips read-only', () => {
    const root = document.createElement('div');
    root.append(
      buildFieldsEl('core', [
        { id: 'title', label: 'Title', type: 'text', value: 'Hello' },
        { id: 'status', label: 'Status', type: 'select', value: 'draft', options: ['publish', 'draft'] },
        { id: 'date', label: 'Date', type: 'datetime', value: '2026-05-21T10:30' },
      ], deps),
      buildFieldsEl('acf', [
        { id: 'cfg', label: 'Cfg', type: 'json', value: { a: 1 } },
        { id: 'rep', label: 'Rep', type: 'readonly', value: [1, 2] },
      ], deps),
    );
    const { bySection, firstInvalid, jsonErrors } = collectValues(root);
    expect(bySection).toEqual({
      core: { title: 'Hello', status: 'draft', date: '2026-05-21T10:30' },
      acf: { cfg: { a: 1 } },
    });
    expect(firstInvalid).toBeNull();
    expect(jsonErrors).toEqual([]);
  });

  it('reports broken JSON and invalid inputs', () => {
    const root = mount([
      { id: 'cfg', label: 'Cfg', type: 'json', value: {} },
      { id: 'mail', label: 'Mail', type: 'email', value: 'not-an-email' },
    ]);
    root.querySelector('textarea')!.value = '{oops';
    const { jsonErrors, firstInvalid } = collectValues(root);
    expect(jsonErrors[0]).toMatchObject({ section: 'acf', field: 'cfg' });
    expect(firstInvalid?.dataset.field).toBe('mail');
  });

  it('select marks the current value', () => {
    const root = mount([{ id: 's', label: 'S', type: 'select', value: '', options: [{ value: '1', label: 'Yes' }, { value: '', label: 'No' }] }]);
    expect(root.querySelector('select')!.value).toBe('');
  });
});

describe('drafts overlay', () => {
  const schema: Field[] = [
    { id: 'a', label: 'A', type: 'text', value: '1' },
    { id: 'b', label: 'B', type: 'date', value: '2026-05-21' },
  ];
  it('marks hasDraft only when something differs', () => {
    expect(applyDraft(schema, null).hasDraft).toBe(false);
    expect(applyDraft(schema, { a: '1' }).hasDraft).toBe(false);
    const r = applyDraft(schema, { b: '2026-06-01' });
    expect(r.hasDraft).toBe(true);
    expect(r.schema[1].value).toBe('2026-06-01');
    expect(schema[1].value).toBe('2026-05-21'); // baseline untouched
  });
});

describe('masks', () => {
  it('price/integer default to min 0, number is unbounded', () => {
    expect(maskOptionsFor({ type: 'price' })).toMatchObject({ scale: 2, min: 0 });
    expect(maskOptionsFor({ type: 'integer' })).toMatchObject({ scale: 0, min: 0 });
    expect(maskOptionsFor({ type: 'number', min: '' })).not.toHaveProperty('min');
    expect(maskOptionsFor({ type: 'text' })).toBeNull();
  });
});

describe('editor sections', () => {
  it('an initially open section is loaded exactly once, even after the native toggle event', async () => {
    const { state } = await import('../src/sidebar/state');
    const { renderSections } = await import('../src/sidebar/views/editor');
    const { makeCtx } = await import('./helpers');
    document.body.innerHTML = '<div id="app"></div>';
    const load = vi.fn(async () => ({ title: { raw: 'T' }, status: 'publish', date: null }));
    const ctx = makeCtx();
    state.ctx = ctx;
    state.settings = { lang: 'auto', theme: 'auto', sections: {} };
    const registry = await import('../src/providers/registry');
    const core = registry.allProviders[0];
    const spy = vi.spyOn(core, 'load').mockImplementation(load as any);

    renderSections();
    document.querySelectorAll('details').forEach((d) => d.dispatchEvent(new Event('toggle')));
    await new Promise((r) => setTimeout(r, 0));
    expect(load).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
