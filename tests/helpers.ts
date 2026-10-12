import { vi } from 'vitest';
import type { EditorContext, RestResponse } from '../src/types';

export function ok(json: unknown, extra: Partial<RestResponse> = {}): RestResponse {
  return { ok: true, status: 200, json, text: JSON.stringify(json), ...extra };
}

export function fail(status: number, json: unknown = null): RestResponse {
  return { ok: false, status, json, text: JSON.stringify(json) };
}

export function makeCtx(overrides: Partial<EditorContext> = {}): EditorContext {
  return {
    restRoot: 'https://example.com/wp-json/',
    entityType: 'post',
    postId: 42,
    postType: 'page',
    restBase: 'pages',
    providers: ['core'],
    isFrontPage: false,
    languages: null,
    editUrl: null,
    request: vi.fn(async () => ok({})),
    uploadImage: vi.fn(async () => ok({ id: 1 })),
    ...overrides,
  };
}

/** Body of the n-th ctx.request call, parsed. */
export function sentBody(ctx: EditorContext, call = 0): any {
  const opts = (ctx.request as any).mock.calls[call][1];
  return JSON.parse(opts.body);
}
