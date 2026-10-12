import type { Field, FieldValues, Provider } from '../types';
import { parseDateTime, toWpDateTime } from '../lib/dates';
import { buildRestUrl, expectOk, jsonPost } from '../lib/wp-client';
import { hasPlugin } from './util';

interface WcProduct {
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  stock_status?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  weight?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;
}

const SALE_DATES = ['date_on_sale_from', 'date_on_sale_to'] as const;

// Full/short description are plain WP content — WooCommerce stores them in
// post_content / post_excerpt, so they're already editable via "core". This
// provider only adds the WooCommerce-specific structured data.
export const woocommerceProvider: Provider<WcProduct> = {
  id: 'woocommerce',

  detect(ctx) {
    return ctx.postType === 'product' && hasPlugin(ctx, 'woocommerce');
  },

  async load(ctx) {
    const url = buildRestUrl(ctx.restRoot, `/wc/v3/products/${ctx.postId}`);
    return expectOk<WcProduct>(await ctx.request(url, {}), 'Failed to load WooCommerce product');
  },

  getSchema(product): Field[] {
    return [
      { id: 'sku', label: 'SKU', type: 'text', value: product.sku ?? '' },
      { id: 'regular_price', label: 'Regular price', type: 'price', value: product.regular_price ?? '' },
      { id: 'sale_price', label: 'Sale price', type: 'price', value: product.sale_price ?? '' },
      // Full datetime on purpose: WooCommerce stores "to" as 23:59:59 of the
      // chosen day — a date-only picker would silently move it to 00:00.
      { id: 'date_on_sale_from', label: 'Sale from', type: 'datetime', value: parseDateTime(product.date_on_sale_from) ?? '' },
      { id: 'date_on_sale_to', label: 'Sale to', type: 'datetime', value: parseDateTime(product.date_on_sale_to) ?? '' },
      {
        id: 'stock_status', label: 'Stock status', type: 'select', value: product.stock_status,
        options: ['instock', 'outofstock', 'onbackorder'],
      },
      {
        id: 'manage_stock', label: 'Manage stock?', type: 'select',
        value: product.manage_stock ? 'yes' : 'no', options: ['yes', 'no'],
      },
      { id: 'stock_quantity', label: 'Stock quantity', type: 'integer', value: product.stock_quantity ?? '' },
      { id: 'weight', label: 'Weight', type: 'number', value: product.weight ?? '' },
    ];
  },

  async save(ctx, values, schema) {
    const url = buildRestUrl(ctx.restRoot, `/wc/v3/products/${ctx.postId}`);
    return expectOk(await ctx.request(url, jsonPost(woocommercePayload(values, schema))), 'Failed to save WooCommerce product');
  },
};

export function woocommercePayload(values: FieldValues, schema: Field[]): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    sku: values.sku,
    regular_price: values.regular_price,
    sale_price: values.sale_price,
    stock_status: values.stock_status,
    manage_stock: values.manage_stock === 'yes',
    stock_quantity: values.stock_quantity === '' ? null : Number(values.stock_quantity),
    weight: values.weight,
  };
  for (const id of SALE_DATES) {
    if (!(id in values)) continue;
    const original = schema.find((f) => f.id === id)?.value ?? '';
    if (values[id] === original) continue; // untouched — don't re-send
    // '' clears the schedule in WC's REST API.
    payload[id] = values[id] ? toWpDateTime(values[id]) : '';
  }
  return payload;
}
