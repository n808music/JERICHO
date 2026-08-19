function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getConfiguredApiBase() {
  const envBase =
    (typeof process !== 'undefined' && (process.env?.VITE_API_BASE || process.env?.JERICHO_API_BASE)) || '';
  if (envBase) {
    return trimTrailingSlash(envBase);
  }
  if (typeof window !== 'undefined') {
    // In the browser, prefer same-origin /api requests so Vite dev proxy can
    // forward to the backend without tripping CORS on localhost.
    return '';
  }
  return 'http://localhost:8000';
}

function buildApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getConfiguredApiBase();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

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
  if (existing) {return existing;}

  const deviceId = getOrCreateDeviceId();
  const deviceUrl = new URL(buildApiUrl('/api/auth/device'), typeof window !== 'undefined' ? window.location.origin : undefined);
  deviceUrl.searchParams.set('device_id', deviceId);
  const requestUrl =
    typeof window !== 'undefined' && getConfiguredApiBase() === ''
      ? `${deviceUrl.pathname}${deviceUrl.search}`
      : deviceUrl.toString();
  const resp = await fetch(requestUrl, {
    method: 'POST',
  });
  if (!resp.ok) {throw new Error(`Device auth failed: ${resp.status}`);}
  const { access_token } = await resp.json();
  localStorage.setItem(AUTH_TOKEN_KEY, access_token);
  return access_token;
}

// Returns { ok, status? } / { ok:false, error } and never throws: the debounced
// auto-sync ignores the result, while the explicit Save Progress action reads it
// to show a visible saved/failed status. LocalStorage remains the fallback.
export async function pushState(stateBlob) {
  try {
    const token = await ensureAuth();
    const pushUrl = buildApiUrl('/api/sync/push');
    const body = JSON.stringify({
      state_blob: JSON.stringify(stateBlob),
      client_updated_at: new Date().toISOString(),
    });
    let resp = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
    });
    if (resp.status === 401) {
      // Token expired — clear and retry once
      localStorage.removeItem(AUTH_TOKEN_KEY);
      const freshToken = await ensureAuth();
      resp = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body,
      });
    }
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    // Backend offline — localStorage is the fallback.
    return { ok: false, error: err?.message || 'offline' };
  }
}

export async function pullState() {
  try {
    const token = await ensureAuth();
    const resp = await fetch(buildApiUrl('/api/sync/pull'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {return null;}
    const { state_blob } = await resp.json();
    return state_blob ? JSON.parse(state_blob) : null;
  } catch {
    return null;
  }
}
