import { afterEach, describe, expect, it, vi } from 'vitest';
import { listConnections, upsertConnection } from '../src/lib/connections';
import { HttpError, login, needsRefresh, tokenFetch } from '../src/lib/token-client';
import type { Connection } from '../src/types';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => fetchMock.mockReset());

const tokens = (n: number) => ({ accessToken: `A${n}`, refreshToken: `R${n}`, expiresIn: 3600 });

describe('token client', () => {
  it('login throws HttpError with the status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { code: 'rest_no_route', message: 'No route' }));
    const err = await login('https://a.test/wp-json/', 'u', 'p').catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
  });

  it('refreshes ahead of expiry', () => {
    expect(needsRefresh({ restRoot: 'r', expiresAt: 100_000 }, 50_000)).toBe(false);
    expect(needsRefresh({ restRoot: 'r', expiresAt: 100_000 }, 75_000)).toBe(true);
    expect(needsRefresh({ restRoot: 'r' }, 75_000)).toBe(false);
  });

  it('on 401 refreshes once, persists the new pair and retries', async () => {
    const conn: Connection = { restRoot: 'https://a.test/wp-json/', accessToken: 'A0', refreshToken: 'R0', expiresAt: Date.now() + 3_600_000 };
    await upsertConnection({ ...conn });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, tokens(1)))
      .mockResolvedValueOnce(jsonResponse(200, { id: 5 }));

    const res = await tokenFetch(conn, 'https://a.test/wp-json/wp/v2/pages/5');
    expect(res.json).toEqual({ id: 5 });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer A1');
    expect(conn.accessToken).toBe('A1');
    expect((await listConnections())[0].refreshToken).toBe('R1');
  });

  it('parallel requests with an expired token share ONE refresh (the bridge rotates refresh tokens)', async () => {
    const conn: Connection = { restRoot: 'https://b.test/wp-json/', accessToken: 'A0', refreshToken: 'R0', expiresAt: Date.now() - 1 };
    await upsertConnection({ ...conn });
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/auth/refresh') ? jsonResponse(200, tokens(2)) : jsonResponse(200, { ok: true }),
    );
    await Promise.all([tokenFetch(conn, 'https://b.test/wp-json/x'), tokenFetch(conn, 'https://b.test/wp-json/y')]);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('failed refresh surfaces SESSION_EXPIRED', async () => {
    const conn: Connection = { restRoot: 'https://c.test/wp-json/', accessToken: 'A0', refreshToken: 'R0', expiresAt: Date.now() - 1 };
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    await expect(tokenFetch(conn, 'https://c.test/wp-json/x')).rejects.toThrow('SESSION_EXPIRED');
  });
});
