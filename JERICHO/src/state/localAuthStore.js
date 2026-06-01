const SESSION_KEY = 'jericho-session';
const ACCOUNT_KEY = 'jericho-account';
const SALT = 'jericho-local-2026';

async function hashPassword(username, password) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback for environments without Web Crypto (tests, SSR)
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
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getSession()?.username);
}

export function setSession(username) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, issuedAt: Date.now() }));
  }
}

export function clearSession() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getAccount() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCOUNT_KEY) : null;
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
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
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
  return { success: true };
}

export function logout() {
  clearSession();
}
