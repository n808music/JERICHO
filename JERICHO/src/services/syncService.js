const API_BASE = 'http://localhost:8000';
const DEVICE_ID_KEY = 'jericho-device-id';
const AUTH_TOKEN_KEY = 'jericho-auth-token';

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function ensureAuth() {
  const existing = localStorage.getItem(AUTH_TOKEN_KEY);
  if (existing) return existing;

  const deviceId = getOrCreateDeviceId();
  const resp = await fetch(`${API_BASE}/api/auth/device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId }),
  });
  if (!resp.ok) throw new Error(`Device auth failed: ${resp.status}`);
  const { access_token } = await resp.json();
  localStorage.setItem(AUTH_TOKEN_KEY, access_token);
  return access_token;
}

export async function pushState(stateBlob) {
  try {
    const token = await ensureAuth();
    const resp = await fetch(`${API_BASE}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        state_blob: JSON.stringify(stateBlob),
        client_updated_at: new Date().toISOString(),
      }),
    });
    if (resp.status === 401) {
      // Token expired — clear and retry once
      localStorage.removeItem(AUTH_TOKEN_KEY);
      const freshToken = await ensureAuth();
      await fetch(`${API_BASE}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({
          state_blob: JSON.stringify(stateBlob),
          client_updated_at: new Date().toISOString(),
        }),
      });
    }
  } catch {
    // Backend offline — localStorage is the fallback, do nothing
  }
}

export async function pullState() {
  try {
    const token = await ensureAuth();
    const resp = await fetch(`${API_BASE}/api/sync/pull`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const { state_blob } = await resp.json();
    return state_blob ? JSON.parse(state_blob) : null;
  } catch {
    return null;
  }
}
