import { describe, expect, it } from 'vitest';
import { coreProvider } from '../src/providers/core';
import { frontPageProvider } from '../src/providers/front-page';
import { getProvidersFor } from '../src/providers/registry';
import { termYoastProvider } from '../src/providers/term-yoast';
import { woocommerceProvider, woocommercePayload } from '../src/providers/woocommerce';
import { yoastProvider } from '../src/providers/yoast';
import { fail, makeCtx, ok, sentBody } from './helpers';

describe('registry', () => {
  it('post page with everything', () => {
    const ctx = makeCtx({ providers: ['core', 'acf', 'yoast', 'woocommerce'], postType: 'product' });
    expect(getProvidersFor(ctx).map((p) => p.id)).toEqual(['core', 'acf', 'woocommerce', 'yoast']);
  });

  it('term page never gets the post-only providers', () => {
    const ctx = makeCtx({ entityType: 'term', taxonomy: 'category', providers: ['core', 'acf', 'yoast'] });
    const active = getProvidersFor(ctx);
    expect(active.map((p) => p.id)).toEqual(['core', 'acf', 'yoast']);
    expect(active).toContain(termYoastProvider);
    expect(active).not.toContain(yoastProvider);
    expect(active).not.toContain(coreProvider);
  });

  it('latest-posts front page shows only the reading settings', () => {
    const ctx = makeCtx({ entityType: null, postId: undefined, isFrontPage: true, providers: ['core', 'acf', 'yoast'] });
    expect(getProvidersFor(ctx)).toEqual([frontPageProvider]);
  });
});

describe('core provider', () => {
  const post = {
    title: { raw: 'T' }, excerpt: { raw: '' }, content: { raw: 'C' }, status: 'future',
    date: '2026-05-21T10:30:00', featured_media: 9,
    _embedded: { 'wp:featuredmedia': [{ source_url: 'f.jpg' }] },
  };

  it('exposes the publish date as a datetime field and keeps scheduled status selectable', () => {
    const schema = coreProvider.getSchema(post);
    expect(schema.find((f) => f.id === 'date')).toMatchObject({ type: 'datetime', value: '2026-05-21T10:30' });
    expect(schema.find((f) => f.id === 'status')?.options).toContain('future');
  });

  it('does not send an untouched date', async () => {
    const ctx = makeCtx();
    const schema = coreProvider.getSchema(post);
    await coreProvider.save(ctx, { title: 'New', date: '2026-05-21T10:30', featured_media: '9' }, schema);
    expect(sentBody(ctx)).toEqual({ title: 'New', featured_media: 9 });
  });

  it('sends a changed date with seconds', async () => {
    const ctx = makeCtx();
    await coreProvider.save(ctx, { date: '2026-06-01T08:00' }, coreProvider.getSchema(post));
    expect(sentBody(ctx)).toEqual({ date: '2026-06-01T08:00:00' });
  });

  it('surfaces the WP error message', async () => {
    const ctx = makeCtx({ request: async () => fail(401, { code: 'rest_cannot_edit', message: 'Nope' }) });
    await expect(coreProvider.load(ctx)).rejects.toThrow(/Nope — the connected user likely lacks edit rights/);
  });
});

describe('woocommerce provider', () => {
  const product = {
    sku: 'S', regular_price: '10', sale_price: '8', stock_status: 'instock', manage_stock: true,
    stock_quantity: 3, weight: '1', date_on_sale_from: '2026-05-01T00:00:00', date_on_sale_to: '2026-05-31T23:59:59',
  };
  const schema = woocommerceProvider.getSchema(product);
  const base = { sku: 'S', regular_price: '10', sale_price: '8', stock_status: 'instock', manage_stock: 'yes', stock_quantity: '3', weight: '1' };

  it('sale dates are datetime pickers that keep the 23:59:59 end', () => {
    expect(schema.find((f) => f.id === 'date_on_sale_to')).toMatchObject({ type: 'datetime', value: '2026-05-31T23:59:59' });
  });

  it('untouched sale dates are not re-sent', () => {
    const payload = woocommercePayload({ ...base, date_on_sale_from: '2026-05-01T00:00', date_on_sale_to: '2026-05-31T23:59:59' }, schema);
    expect(payload).not.toHaveProperty('date_on_sale_from');
    expect(payload).not.toHaveProperty('date_on_sale_to');
    expect(payload).toMatchObject({ manage_stock: true, stock_quantity: 3 });
  });

  it('changed and cleared sale dates are sent', () => {
    const payload = woocommercePayload({ ...base, date_on_sale_from: '2026-06-01T00:00', date_on_sale_to: '' }, schema);
    expect(payload).toMatchObject({ date_on_sale_from: '2026-06-01T00:00:00', date_on_sale_to: '' });
  });

  it('empty stock quantity becomes null', () => {
    expect(woocommercePayload({ ...base, stock_quantity: '' }, schema).stock_quantity).toBeNull();
  });
});

describe('yoast provider', () => {
  it('reads registered meta keys and saves under meta', async () => {
    const ctx = makeCtx({ providers: ['yoast'], request: async () => ok({ meta: { _yoast_wpseo_title: 'SEO' } }) });
    const data = await yoastProvider.load(ctx);
    expect(data._yoast_wpseo_title).toBe('SEO');
    expect(data._yoast_wpseo_metadesc).toBe('');

    const saveCtx = makeCtx();
    await yoastProvider.save(saveCtx, { _yoast_wpseo_title: 'X' }, []);
    expect(sentBody(saveCtx)).toEqual({ meta: { _yoast_wpseo_title: 'X' } });
  });
});

describe('front page provider', () => {
  it('converts page ids to numbers on save', async () => {
    const ctx = makeCtx({ isFrontPage: true });
    await frontPageProvider.save(ctx, { show_on_front: 'page', page_on_front: '12', page_for_posts: '' }, []);
    expect(sentBody(ctx)).toEqual({ show_on_front: 'page', page_on_front: 12, page_for_posts: 0 });
  });
});
