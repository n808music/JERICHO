import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginGate from '../../src/components/LoginGate.jsx';
import * as localAuth from '../../src/state/localAuthStore.js';

// Official local dev credentials
const OFFICIAL_USERNAME = 'james';
const OFFICIAL_PASSWORD = 'JerichoMVP2026!';

// Isolate localStorage between tests
let localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, value) => { localStorageStore[key] = String(value); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { localStorageStore = {}; },
};

beforeEach(() => {
  localStorageStore = {};
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  localStorageStore = {};
});

describe('LoginGate containment', () => {
  it('cold load shows login form, not profile tools or execution nav', () => {
    render(<LoginGate onLogin={vi.fn()} />);

    expect(screen.getByTestId('login-gate')).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Structure/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Today/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Stability/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Plan/i })).not.toBeInTheDocument();
  });

  it('shows create-account form when no account exists', () => {
    render(<LoginGate onLogin={vi.fn()} />);

    expect(screen.getByTestId('create-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows sign-in form when an account already exists', async () => {
    await localAuth.createAccount(OFFICIAL_USERNAME, OFFICIAL_PASSWORD);

    render(<LoginGate onLogin={vi.fn()} />);

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});

describe('password field usability', () => {
  it('password input is enabled and accepts text', () => {
    render(<LoginGate onLogin={vi.fn()} />);

    const field = screen.getByLabelText(/^password$/i);
    expect(field).toBeEnabled();
    expect(field).toHaveAttribute('type', 'password');
  });

  it('confirm password input is enabled and accepts text', () => {
    render(<LoginGate onLogin={vi.fn()} />);

    const field = screen.getByLabelText('Confirm password', { exact: true });
    expect(field).toBeEnabled();
    expect(field).toHaveAttribute('type', 'password');
  });

  it('Show toggle on Password reveals the typed value', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.type(screen.getByLabelText(/^password$/i), OFFICIAL_PASSWORD);
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text');
  });

  it('Hide toggle on Password conceals the value again', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
  });

  it('Show toggle on Confirm Password reveals the typed value', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.type(screen.getByLabelText('Confirm password', { exact: true }), OFFICIAL_PASSWORD);
    expect(screen.getByLabelText('Confirm password', { exact: true })).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show confirm password/i }));
    expect(screen.getByLabelText('Confirm password', { exact: true })).toHaveAttribute('type', 'text');
  });

  it('Hide toggle on Confirm Password conceals the value again', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /show confirm password/i }));
    await user.click(screen.getByRole('button', { name: /hide confirm password/i }));

    expect(screen.getByLabelText('Confirm password', { exact: true })).toHaveAttribute('type', 'password');
  });
});

describe('validation behavior', () => {
  it('mismatch error does not appear before confirm field is touched', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.type(screen.getByLabelText(/^password$/i), OFFICIAL_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password', { exact: true }), 'wrong');
    // NOT blurred — still typing

    expect(screen.queryByTestId('mismatch-hint')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mismatch hint appears after confirm field is blurred with mismatched values', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.type(screen.getByLabelText(/^password$/i), OFFICIAL_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password', { exact: true }), 'wrong');
    await user.tab(); // blur confirm field

    expect(await screen.findByTestId('mismatch-hint')).toHaveTextContent(/passwords do not match/i);
  });

  it('mismatch error shows on submit with mismatched passwords', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), OFFICIAL_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), OFFICIAL_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password', { exact: true }), 'wrongpass!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i);
    expect(localAuth.isAuthenticated()).toBe(false);
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const user = userEvent.setup();
    render(<LoginGate onLogin={vi.fn()} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), OFFICIAL_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), 'abc');
    await user.type(screen.getByLabelText('Confirm password', { exact: true }), 'abc');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 6 characters/i);
    expect(localAuth.isAuthenticated()).toBe(false);
  });

  it('rejects wrong password on login and shows error without setting session', async () => {
    await localAuth.createAccount(OFFICIAL_USERNAME, OFFICIAL_PASSWORD);

    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginGate onLogin={onLogin} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), OFFICIAL_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid username or password/i);
    expect(onLogin).not.toHaveBeenCalled();
    expect(localAuth.isAuthenticated()).toBe(false);
  });
});

describe('official local MVP credentials', () => {
  it('account creation with official credentials succeeds', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginGate onLogin={onLogin} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), OFFICIAL_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), OFFICIAL_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password', { exact: true }), OFFICIAL_PASSWORD);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(OFFICIAL_USERNAME));
    expect(localAuth.isAuthenticated()).toBe(true);
    expect(localAuth.hasAccount()).toBe(true);
    expect(localStorageStore['jericho-account']).toBeDefined();
    expect(localStorageStore['jericho-session']).toBeDefined();
  });

  it('login with official credentials succeeds after account is created', async () => {
    await localAuth.createAccount(OFFICIAL_USERNAME, OFFICIAL_PASSWORD);

    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginGate onLogin={onLogin} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), OFFICIAL_USERNAME);
    await user.type(screen.getByLabelText(/^password$/i), OFFICIAL_PASSWORD);
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(OFFICIAL_USERNAME));
    expect(localAuth.isAuthenticated()).toBe(true);
  });

  it('logout clears session but preserves account — re-login succeeds', async () => {
    await localAuth.createAccount(OFFICIAL_USERNAME, OFFICIAL_PASSWORD);
    localAuth.setSession(OFFICIAL_USERNAME);

    localAuth.logout();

    expect(localAuth.isAuthenticated()).toBe(false);
    expect(localAuth.hasAccount()).toBe(true);

    const result = await localAuth.login(OFFICIAL_USERNAME, OFFICIAL_PASSWORD);
    expect(result.success).toBe(true);
    expect(localAuth.isAuthenticated()).toBe(true);
  });

  it('logout clears only jericho-session, not jericho-account or jericho-identity', async () => {
    localStorageStore['jericho-identity'] = JSON.stringify({ someProfileData: true });
    await localAuth.createAccount(OFFICIAL_USERNAME, OFFICIAL_PASSWORD);
    localAuth.setSession(OFFICIAL_USERNAME);

    localAuth.logout();

    expect(localStorageStore['jericho-identity']).toBeDefined();
    expect(localStorageStore['jericho-account']).toBeDefined();
    expect(localStorageStore['jericho-session']).toBeUndefined();
  });
});

describe('session persistence', () => {
  it('isAuthenticated returns false with no session in localStorage', () => {
    expect(localAuth.isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when a valid session exists in localStorage', () => {
    localAuth.setSession(OFFICIAL_USERNAME);
    expect(localAuth.isAuthenticated()).toBe(true);
  });

  it('simulated refresh while signed in: isAuthenticated reads persisted session', () => {
    localAuth.setSession(OFFICIAL_USERNAME);
    expect(localAuth.isAuthenticated()).toBe(true);
    expect(localAuth.getSession()?.username).toBe(OFFICIAL_USERNAME);
  });

  it('simulated refresh after logout: isAuthenticated returns false', () => {
    localAuth.setSession(OFFICIAL_USERNAME);
    localAuth.logout();
    expect(localAuth.isAuthenticated()).toBe(false);
    expect(localAuth.getSession()).toBeNull();
  });
});
