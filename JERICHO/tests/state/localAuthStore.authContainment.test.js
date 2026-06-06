import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store = {};
const warnSpy = vi.fn();

beforeEach(() => {
  store = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    },
    writable: true,
    configurable: true,
  });
  warnSpy.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(warnSpy);
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('localAuthStore — Auth Containment Stabilization', () => {
  describe('Rule 1: reasoned clearSession', () => {
    it('clearSession with explicit reason persists the reason and a timestamp', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      localAuth.setSession('james');
      localAuth.clearSession({ reason: 'explicit_sign_out' });

      expect(store['jericho-session']).toBeUndefined();
      expect(store['jericho-session-clear-reason']).toBeDefined();
      const record = JSON.parse(store['jericho-session-clear-reason']);
      expect(record.reason).toBe('explicit_sign_out');
      expect(typeof record.at).toBe('number');
    });

    it('explicit_sign_out also persists a separate last-explicit-signout-at marker', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      localAuth.setSession('james');
      localAuth.clearSession({ reason: 'explicit_sign_out' });

      expect(store['jericho-last-explicit-signout-at']).toBeDefined();
      const ts = Number(store['jericho-last-explicit-signout-at']);
      expect(Number.isFinite(ts)).toBe(true);
      expect(ts).toBeGreaterThan(0);
    });

    it('clearSession with non-signout reason does NOT set the explicit signout marker', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      localAuth.setSession('james');
      localAuth.clearSession({ reason: 'provider_crash' });

      expect(store['jericho-last-explicit-signout-at']).toBeUndefined();
      const record = JSON.parse(store['jericho-session-clear-reason']);
      expect(record.reason).toBe('provider_crash');
    });

    it('clearSession with no reason defaults to invalid_session and emits a warning', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      localAuth.setSession('james');
      localAuth.clearSession();

      const record = JSON.parse(store['jericho-session-clear-reason']);
      expect(record.reason).toBe('invalid_session');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = String(warnSpy.mock.calls[0]?.[0] ?? '');
      expect(msg).toMatch(/clearSession.*reason/i);
    });

    it('getLastClearReason returns the persisted record', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      localAuth.setSession('james');
      localAuth.clearSession({ reason: 'account_switch' });
      const recalled = localAuth.getLastClearReason();
      expect(recalled?.reason).toBe('account_switch');
      expect(typeof recalled?.at).toBe('number');
    });

    it('logout() is an alias for clearSession({ reason: "explicit_sign_out" })', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      localAuth.setSession('james');
      localAuth.logout();

      const record = JSON.parse(store['jericho-session-clear-reason']);
      expect(record.reason).toBe('explicit_sign_out');
      expect(store['jericho-last-explicit-signout-at']).toBeDefined();
    });

    it('successful login() clears any prior explicit signout marker', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.logout();
      expect(store['jericho-last-explicit-signout-at']).toBeDefined();

      const result = await localAuth.login('james', 'JerichoMVP2026!');
      expect(result.success).toBe(true);
      expect(store['jericho-last-explicit-signout-at']).toBeUndefined();
    });
  });

  describe('Rule 2: explicit auth state machine', () => {
    it('reports no_account when neither account nor session exists', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      expect(localAuth.evaluateAuthState().state).toBe('no_account');
    });

    it('reports account_exists_session_active when both account and session are present', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.setSession('james');
      const result = localAuth.evaluateAuthState();
      expect(result.state).toBe('account_exists_session_active');
      expect(result.authenticatedUser).toBe('james');
    });

    it('reports account_exists_session_missing_recoverable after crash/reload with no explicit signout', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.setSession('james');
      // Simulate a crash that drops the session without an explicit signout
      localAuth.clearSession({ reason: 'provider_crash' });

      const result = localAuth.evaluateAuthState();
      expect(result.state).toBe('account_exists_session_missing_recoverable');
      expect(result.account?.username).toBe('james');
      expect(result.lastClearReason).toBe('provider_crash');
    });

    it('reports account_exists_session_missing_explicit_signout after an explicit sign-out', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.setSession('james');
      localAuth.logout();

      const result = localAuth.evaluateAuthState();
      expect(result.state).toBe('account_exists_session_missing_explicit_signout');
      expect(result.account?.username).toBe('james');
    });

    it('reports account_exists_session_invalid when the persisted session has no username', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      store['jericho-session'] = JSON.stringify({ issuedAt: 1 });

      const result = localAuth.evaluateAuthState();
      expect(result.state).toBe('account_exists_session_invalid');
    });
  });

  describe('Rule 3: safe auto-resume', () => {
    it('resumeSessionIfSafe restores the session when account exists and last clear is not explicit_sign_out', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.setSession('james');
      localAuth.clearSession({ reason: 'provider_crash' });

      const outcome = localAuth.resumeSessionIfSafe();
      expect(outcome.resumed).toBe(true);
      expect(outcome.username).toBe('james');
      expect(store['jericho-session']).toBeDefined();
      expect(JSON.parse(store['jericho-session']).username).toBe('james');
    });

    it('resumeSessionIfSafe refuses to resume after an explicit sign-out', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.setSession('james');
      localAuth.logout();

      const outcome = localAuth.resumeSessionIfSafe();
      expect(outcome.resumed).toBe(false);
      expect(outcome.reason).toBe('blocked_by_explicit_sign_out');
      expect(store['jericho-session']).toBeUndefined();
    });

    it('resumeSessionIfSafe refuses to resume when no account exists', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      const outcome = localAuth.resumeSessionIfSafe();
      expect(outcome.resumed).toBe(false);
      expect(outcome.reason).toBe('no_account');
    });

    it('resumeSessionIfSafe is a no-op when the session is already active', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.setSession('james');
      const before = store['jericho-session'];

      const outcome = localAuth.resumeSessionIfSafe();
      expect(outcome.resumed).toBe(false);
      expect(outcome.reason).toBe('already_active');
      expect(store['jericho-session']).toBe(before);
    });
  });

  describe('Rule 4: createAccount transaction boundary', () => {
    it('createAccountTransaction commits account and session atomically on success', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      const outcome = await localAuth.createAccountTransaction('james', 'JerichoMVP2026!', {
        verifyProviderReady: () => true,
      });
      expect(outcome.committed).toBe(true);
      expect(store['jericho-account']).toBeDefined();
      expect(store['jericho-session']).toBeDefined();
      const sessionRecord = JSON.parse(store['jericho-session']);
      expect(sessionRecord.username).toBe('james');
    });

    it('createAccountTransaction leaves a recoverable state if provider readiness check fails', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      const outcome = await localAuth.createAccountTransaction('james', 'JerichoMVP2026!', {
        verifyProviderReady: () => false,
      });
      expect(outcome.committed).toBe(false);
      expect(outcome.recoverable).toBe(true);
      // Account is persisted so the user can recover, but session is not started
      expect(store['jericho-account']).toBeDefined();
      expect(store['jericho-session']).toBeUndefined();
      // The auth state machine should now report a recoverable missing-session state
      expect(localAuth.evaluateAuthState().state).toBe('account_exists_session_missing_recoverable');
    });

    it('createAccountTransaction does NOT leave an explicit signout marker on provider failure', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccountTransaction('james', 'JerichoMVP2026!', {
        verifyProviderReady: () => false,
      });
      expect(store['jericho-last-explicit-signout-at']).toBeUndefined();
    });
  });

  describe('Rule 5: diagnostics surface', () => {
    it('getAuthDiagnostics exposes the full observable state', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      await localAuth.createAccount('james', 'JerichoMVP2026!');
      localAuth.setSession('james');
      localAuth.clearSession({ reason: 'transient_runtime_error' });

      const diag = localAuth.getAuthDiagnostics();
      expect(diag).toMatchObject({
        hasAccount: true,
        hasSession: false,
        authState: 'account_exists_session_missing_recoverable',
        lastSessionClearReason: 'transient_runtime_error',
      });
      expect(typeof diag.lastSessionClearAt).toBe('number');
    });

    it('getAuthDiagnostics on a clean store reports no_account with null clear fields', async () => {
      const localAuth = await import('../../src/state/localAuthStore.js');
      const diag = localAuth.getAuthDiagnostics();
      expect(diag.hasAccount).toBe(false);
      expect(diag.hasSession).toBe(false);
      expect(diag.authState).toBe('no_account');
      expect(diag.lastSessionClearReason).toBeNull();
      expect(diag.lastSessionClearAt).toBeNull();
    });
  });
});
