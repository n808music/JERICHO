const SESSION_KEY = 'jericho-session';
const ACCOUNT_KEY = 'jericho-account';
const CLEAR_REASON_KEY = 'jericho-session-clear-reason';
const LAST_EXPLICIT_SIGNOUT_KEY = 'jericho-last-explicit-signout-at';
const SALT = 'jericho-local-2026';

export const AUTH_STATES = Object.freeze({
  NO_ACCOUNT: 'no_account',
  ACCOUNT_EXISTS_SESSION_ACTIVE: 'account_exists_session_active',
  ACCOUNT_EXISTS_SESSION_MISSING_RECOVERABLE: 'account_exists_session_missing_recoverable',
  ACCOUNT_EXISTS_SESSION_MISSING_EXPLICIT_SIGNOUT: 'account_exists_session_missing_explicit_signout',
  ACCOUNT_EXISTS_SESSION_INVALID: 'account_exists_session_invalid',
});

const VALID_CLEAR_REASONS = new Set([
  'explicit_sign_out',
  'account_switch',
  'invalid_session',
  'provider_crash',
  'transient_runtime_error',
]);

function safeStorage() {
  if (typeof localStorage === 'undefined' || !localStorage) return null;
  if (typeof localStorage.getItem !== 'function') return null;
  return localStorage;
}

async function hashPassword(username, password) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return btoa(username + ':' + password + ':' + SALT);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(username + ':' + password + ':' + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getSession() {
  try {
    const raw = safeStorage()?.getItem(SESSION_KEY) ?? null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getSession()?.username);
}

export function setSession(username) {
  const storage = safeStorage();
  if (storage) {
    storage.setItem(SESSION_KEY, JSON.stringify({ username, issuedAt: Date.now() }));
  }
}

export function clearSession(options) {
  const storage = safeStorage();
  let reason = options?.reason;
  if (!reason) {
    reason = 'invalid_session';
    // eslint-disable-next-line no-console
    console.warn(
      'clearSession() called without an explicit reason — defaulting to "invalid_session"'
    );
  } else if (!VALID_CLEAR_REASONS.has(reason)) {
    // eslint-disable-next-line no-console
    console.warn(`clearSession() called with unknown reason "${reason}" — accepting but flagging`);
  }
  const at = Date.now();
  if (storage) {
    storage.removeItem(SESSION_KEY);
    storage.setItem(CLEAR_REASON_KEY, JSON.stringify({ reason, at }));
    if (reason === 'explicit_sign_out') {
      storage.setItem(LAST_EXPLICIT_SIGNOUT_KEY, String(at));
    }
  }
  return { reason, at };
}

export function getLastClearReason() {
  try {
    const raw = safeStorage()?.getItem(CLEAR_REASON_KEY) ?? null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLastExplicitSignoutAt() {
  const raw = safeStorage()?.getItem(LAST_EXPLICIT_SIGNOUT_KEY) ?? null;
  if (raw == null) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

function clearExplicitSignoutMarker() {
  const storage = safeStorage();
  if (storage) {
    storage.removeItem(LAST_EXPLICIT_SIGNOUT_KEY);
    storage.removeItem(CLEAR_REASON_KEY);
  }
}

export function getAccount() {
  try {
    const raw = safeStorage()?.getItem(ACCOUNT_KEY) ?? null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasAccount() {
  return Boolean(getAccount());
}

export async function createAccount(username, password) {
  const passwordHash = await hashPassword(username, password);
  const account = { username: String(username).trim(), passwordHash, createdAt: Date.now() };
  const storage = safeStorage();
  if (storage) {
    storage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  }
  return account;
}

export async function login(username, password) {
  const account = getAccount();
  if (!account) {
    return { success: false, error: 'No account found. Create an account first.' };
  }
  const normalizedUsername = String(username || '').trim();
  if (account.username !== normalizedUsername) {
    return { success: false, error: 'Invalid username or password.' };
  }
  const hash = await hashPassword(normalizedUsername, password);
  if (hash !== account.passwordHash) {
    return { success: false, error: 'Invalid username or password.' };
  }
  setSession(normalizedUsername);
  clearExplicitSignoutMarker();
  return { success: true };
}

export function logout() {
  return clearSession({ reason: 'explicit_sign_out' });
}

export function evaluateAuthState() {
  const account = getAccount();
  const session = getSession();
  const lastClear = getLastClearReason();
  const lastExplicitSignoutAt = getLastExplicitSignoutAt();

  if (!account?.username) {
    return {
      state: AUTH_STATES.NO_ACCOUNT,
      account: null,
      session: null,
      authenticatedUser: null,
      lastClearReason: lastClear?.reason ?? null,
      lastClearAt: lastClear?.at ?? null,
      lastExplicitSignoutAt,
    };
  }

  if (session && !session.username) {
    return {
      state: AUTH_STATES.ACCOUNT_EXISTS_SESSION_INVALID,
      account,
      session,
      authenticatedUser: null,
      lastClearReason: lastClear?.reason ?? null,
      lastClearAt: lastClear?.at ?? null,
      lastExplicitSignoutAt,
    };
  }

  if (session?.username) {
    return {
      state: AUTH_STATES.ACCOUNT_EXISTS_SESSION_ACTIVE,
      account,
      session,
      authenticatedUser: session.username,
      lastClearReason: lastClear?.reason ?? null,
      lastClearAt: lastClear?.at ?? null,
      lastExplicitSignoutAt,
    };
  }

  const isExplicitSignout =
    lastClear?.reason === 'explicit_sign_out' || lastExplicitSignoutAt != null;
  return {
    state: isExplicitSignout
      ? AUTH_STATES.ACCOUNT_EXISTS_SESSION_MISSING_EXPLICIT_SIGNOUT
      : AUTH_STATES.ACCOUNT_EXISTS_SESSION_MISSING_RECOVERABLE,
    account,
    session: null,
    authenticatedUser: null,
    lastClearReason: lastClear?.reason ?? null,
    lastClearAt: lastClear?.at ?? null,
    lastExplicitSignoutAt,
  };
}

export function resumeSessionIfSafe() {
  const evaluation = evaluateAuthState();
  if (evaluation.state === AUTH_STATES.ACCOUNT_EXISTS_SESSION_ACTIVE) {
    return { resumed: false, reason: 'already_active', username: evaluation.authenticatedUser };
  }
  if (evaluation.state === AUTH_STATES.NO_ACCOUNT) {
    return { resumed: false, reason: 'no_account', username: null };
  }
  if (evaluation.state === AUTH_STATES.ACCOUNT_EXISTS_SESSION_MISSING_EXPLICIT_SIGNOUT) {
    return { resumed: false, reason: 'blocked_by_explicit_sign_out', username: null };
  }
  if (evaluation.state === AUTH_STATES.ACCOUNT_EXISTS_SESSION_INVALID) {
    return { resumed: false, reason: 'invalid_session_record', username: null };
  }
  const username = evaluation.account?.username;
  if (!username) {
    return { resumed: false, reason: 'no_account', username: null };
  }
  setSession(username);
  return { resumed: true, reason: 'recoverable', username };
}

export async function createAccountTransaction(username, password, options = {}) {
  const verifyProviderReady =
    typeof options.verifyProviderReady === 'function' ? options.verifyProviderReady : () => true;

  await createAccount(username, password);
  let providerReady = false;
  try {
    providerReady = Boolean(await verifyProviderReady());
  } catch {
    providerReady = false;
  }

  if (!providerReady) {
    return {
      committed: false,
      recoverable: true,
      account: getAccount(),
    };
  }

  setSession(String(username).trim());
  clearExplicitSignoutMarker();
  return {
    committed: true,
    recoverable: true,
    account: getAccount(),
    session: getSession(),
  };
}

export function getAuthDiagnostics() {
  const evaluation = evaluateAuthState();
  return {
    hasAccount: Boolean(evaluation.account?.username),
    hasSession: Boolean(evaluation.session?.username),
    authState: evaluation.state,
    authenticatedUser: evaluation.authenticatedUser,
    lastSessionClearReason: evaluation.lastClearReason ?? null,
    lastSessionClearAt: evaluation.lastClearAt ?? null,
    lastExplicitSignoutAt: evaluation.lastExplicitSignoutAt ?? null,
  };
}
