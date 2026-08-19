import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pullState } from '../../src/services/syncService.js';

describe('syncService device auth bootstrap', () => {
  beforeEach(() => {
    const storage = new Map();
    global.localStorage = {
      getItem: vi.fn((key) => storage.get(key) ?? null),
      setItem: vi.fn((key, value) => {
        storage.set(key, String(value));
      }),
      removeItem: vi.fn((key) => {
        storage.delete(key);
      }),
    };
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'device-12345678'),
    });
  });

  it('uses a same-origin query-param device auth request in the browser without JSON headers that trigger preflight', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state_blob: null }),
      });
    global.fetch = fetchMock;

    await pullState();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/auth/device?device_id=device-12345678',
      { method: 'POST' }
    );
  });
});
