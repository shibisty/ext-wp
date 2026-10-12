// Shared REST helpers used by providers to read/write WordPress content.
//
// Bootstrapping (who's logged in, which post, the nonce) does NOT go through
// this file — the side panel reads it straight out of the page (a
// <script id="seb-bridge-data"> tag the bridge plugin prints for logged-in
// editors). WordPress' REST cookie auth silently treats any cookie-
// authenticated REST request with no X-WP-Nonce as anonymous, which makes a
// REST-based "fetch me a nonce" bootstrap circular. See the bridge plugin's
// PHP comments for the full explanation.
//
// What's here: building correct REST URLs (pretty vs plain permalinks) and
// running fetch() inside the page's own context so cookies travel same-site.

import type { RequestOptions, RestResponse } from '../types';

export function buildRestUrl(
  restRoot: string,
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): string {
  const url = new URL(restRoot);

  if (url.searchParams.has('rest_route')) {
    // Plain permalinks: extend the existing rest_route value instead of the pathname.
    const base = (url.searchParams.get('rest_route') || '/').replace(/\/$/, '');
    url.searchParams.set('rest_route', base + path);
  } else {
    // Pretty permalinks: append to the pathname (usually ".../wp-json/").
    url.pathname = url.pathname.replace(/\/$/, '') + path;
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

/** Parse a fetch() Response into the transport-independent RestResponse shape. */
export async function toRestResponse(res: Response): Promise<RestResponse> {
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    json: parseJson(text),
    text,
    total: parseInt(res.headers.get('X-WP-Total') || '0', 10),
    totalPages: parseInt(res.headers.get('X-WP-TotalPages') || '1', 10),
  };
}

export function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// WP's REST error responses carry a real message ({code, message, data}) —
// surfacing it beats a bare status code, and specifically for the
// "authenticated but not allowed to edit THIS item" case (context=edit
// permission, not a broken token — WP core oddly returns 401 for this
// rather than 403) it's worth a pointed hint, since that's easy to mistake
// for an auth/token problem otherwise.
export function restErrorMessage(res: Pick<RestResponse, 'json'>, fallback: string): string {
  const code = res.json?.code;
  const message = res.json?.message || fallback;
  if (code === 'rest_forbidden_context' || code === 'rest_cannot_edit') {
    return `${message} — the connected user likely lacks edit rights for this specific item (check its author / the account's role capabilities), not a token problem.`;
  }
  return message;
}

/** Throws a readable error unless the response is 2xx. Returns the JSON body. */
export function expectOk<T = any>(res: RestResponse, what: string): T {
  if (!res.ok) throw new Error(restErrorMessage(res, `${what} (${res.status})`));
  return res.json as T;
}

export function jsonPost(body: unknown): RequestOptions {
  return {
    method: 'POST', // WP REST treats POST to an existing item as an update
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ---- Page-injected transport (live mode) ----
//
// The injected functions below are serialized by chrome.scripting and run in
// the page — they must be fully self-contained (no imports, no closures).

type InjectedResult = (RestResponse & { error?: undefined }) | { ok: false; error: string };

async function runInPage<A extends any[]>(
  tabId: number,
  func: (...args: A) => Promise<InjectedResult>,
  args: A,
  emptyMessage: string,
): Promise<RestResponse> {
  const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  const result = injection?.result as InjectedResult | undefined;
  if (!result) throw new Error(emptyMessage);
  if ('error' in result && result.error) throw new Error(result.error);
  return result as RestResponse;
}

export function pageFetch(tabId: number, url: string, options: RequestOptions = {}): Promise<RestResponse> {
  return runInPage(
    tabId,
    async (fetchUrl: string, fetchOptions: RequestOptions) => {
      try {
        const res = await fetch(fetchUrl, { ...fetchOptions, credentials: 'include' });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* response wasn't JSON */ }
        return { ok: res.ok, status: res.status, json, text };
      } catch (err) {
        return { ok: false as const, error: (err as Error).message };
      }
    },
    [url, options],
    'No response from page (did the tab navigate away?).',
  );
}

// Uploads a file to WordPress' media library. `base64Data` is the file's
// content WITHOUT the "data:mime;base64," prefix — File/Blob objects can't
// cross the executeScript boundary (args must be structured-cloneable/JSON),
// so the panel reads the dropped file as base64 first and this rebuilds a
// Blob inside the page before POSTing.
export function uploadMedia(
  tabId: number,
  restRoot: string,
  nonce: string,
  base64Data: string,
  filename: string,
  mimeType: string,
): Promise<RestResponse> {
  const url = buildRestUrl(restRoot, '/wp/v2/media');
  return runInPage(
    tabId,
    async (fetchUrl: string, b64: string, name: string, mime: string, wpNonce: string) => {
      try {
        const byteChars = atob(b64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const res = await fetch(fetchUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': mime,
            'Content-Disposition': `attachment; filename="${name}"`,
            'X-WP-Nonce': wpNonce,
          },
          body: new Blob([bytes], { type: mime }),
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        return { ok: res.ok, status: res.status, json, text };
      } catch (err) {
        return { ok: false as const, error: (err as Error).message };
      }
    },
    [url, base64Data, filename, mimeType, nonce],
    'No response from page during upload.',
  );
}

export function base64ToBlob(base64Data: string, mimeType: string): Blob {
  const byteChars = atob(base64Data);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
