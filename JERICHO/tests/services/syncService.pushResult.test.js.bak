import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pushState } from '../../src/services/syncService.js';

describe('pushState reports a result so Save Progress can show status', () => {
  beforeEach(() => {
    // Pre-seed an auth token so ensureAuth() short-circuits and pushState hits sync.
    const storage = new Map([['jericho-auth-token', 'tok']]);
    global.localStorage = {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    };
  });

  it('returns ok:true when the server accepts the push', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 });
    await expect(pushState({ any: 'state' })).resolves.toEqual({ ok: true, status: 200 });
  });

  it('returns ok:false with status when the server rejects the push', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await pushState({ any: 'state' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });

  it('returns ok:false (never throws) when the network is offline', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('network down'));
    const res = await pushState({ any: 'state' });
    expect(res.ok).toBe(false);
  });
});
