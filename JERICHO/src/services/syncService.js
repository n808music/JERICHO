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

// Browsers cap the combined body of all in-flight keepalive requests at 64KB and
// reject anything over it. Headroom is left for headers and any concurrent
// keepalive request.
const KEEPALIVE_MAX_BYTES = 56 * 1024;

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
  const deviceUrl = new URL(buildApiUrl('/api/auth/device'), typeof window !== 'undefined' ? window.location.origin : undefined);
  deviceUrl.searchParams.set('device_id', deviceId);
  const requestUrl =
    typeof window !== 'undefined' && getConfiguredApiBase() === ''
      ? `${deviceUrl.pathname}${deviceUrl.search}`
      : deviceUrl.toString();
  const resp = await fetch(requestUrl, {
    method: 'POST',
  });
  if (!resp.ok) throw new Error(`Device auth failed: ${resp.status}`);
  const { access_token } = await resp.json();
  localStorage.setItem(AUTH_TOKEN_KEY, access_token);
  return access_token;
}

// Returns { ok, status? } / { ok:false, error } and never throws: the debounced
// auto-sync ignores the result, while the explicit Save Progress action reads it
// to show a visible saved/failed status. LocalStorage remains the fallback.
export async function pushState(stateBlob, options = {}) {
  try {
    const token = await ensureAuth();
    const pushUrl = buildApiUrl('/api/sync/push');
    // `clientUpdatedAt` is the moment the state was last written LOCALLY, not the
    // moment of this push. The mount-time pull compares it against the local
    // stamp to decide which side is newer, so both sides must mean the same
    // thing — a push-time stamp would make a stale server blob look fresh.
    const body = JSON.stringify({
      state_blob: JSON.stringify(stateBlob),
      client_updated_at: options.clientUpdatedAt || new Date().toISOString(),
    });
    // keepalive lets a flush survive page teardown (pagehide/unload), where a
    // normal fetch is cancelled by the browser. BUT browsers cap the total
    // keepalive body at 64KB and REJECT anything larger — a real Jericho state
    // blob is 200KB+, so an unconditional keepalive made every flush fail
    // ("Reached maximum amount of queued data of 64Kb", surfaced by Safari as
    // "cannot load ... due to access control checks"). Only opt in when the body
    // actually fits; otherwise send a normal fetch, which at least succeeds
    // whenever the page is not being torn down.
    const bodyBytes =
      typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(body).length : body.length;
    const keepalive = Boolean(options.keepalive) && bodyBytes <= KEEPALIVE_MAX_BYTES;
    let resp = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
      keepalive,
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

// Returns { state, clientUpdatedAt } or null. `clientUpdatedAt` MUST be
// surfaced: the caller compares it against the local write stamp to decide
// which copy is newer. Returning the blob alone (as this did before) forces the
// caller to apply server state blind, which silently regresses a client whose
// last push never landed.
export async function pullState() {
  try {
    const token = await ensureAuth();
    const resp = await fetch(buildApiUrl('/api/sync/pull'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const { state_blob: stateBlob, client_updated_at: clientUpdatedAt } = await resp.json();
    if (!stateBlob) return null;
    return { state: JSON.parse(stateBlob), clientUpdatedAt: clientUpdatedAt || null };
  } catch {
    return null;
  }
}
