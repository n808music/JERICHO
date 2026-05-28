import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginGate from '../../src/components/LoginGate.jsx';
import * as localAuth from '../../src/state/localAuthStore.js';

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
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows sign-in form when an account already exists', async () => {
    await localAuth.createAccount('james', 'endgame2026');

    render(<LoginGate onLogin={vi.fn()} />);

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('creates account and calls onLogin with username on successful create', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();

    render(<LoginGate onLogin={onLogin} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'james');
    await user.type(screen.getByLabelText(/^password$/i), 'endgame2026');
    await user.type(screen.getByLabelText(/confirm password/i), 'endgame2026');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('james'));
    expect(localAuth.isAuthenticated()).toBe(true);
    expect(localAuth.hasAccount()).toBe(true);
  });

  it('rejects mismatched passwords at create time', async () => {
    const user = userEvent.setup();

    render(<LoginGate onLogin={vi.fn()} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'james');
    await user.type(screen.getByLabelText(/^password$/i), 'endgame2026');
    await user.type(screen.getByLabelText(/confirm password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/passwords do not match/i);
    expect(localAuth.isAuthenticated()).toBe(false);
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const user = userEvent.setup();

    render(<LoginGate onLogin={vi.fn()} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'james');
    await user.type(screen.getByLabelText(/^password$/i), 'abc');
    await user.type(screen.getByLabelText(/confirm password/i), 'abc');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 6 characters/i);
    expect(localAuth.isAuthenticated()).toBe(false);
  });

  it('successful login calls onLogin and sets session', async () => {
    await localAuth.createAccount('james', 'endgame2026');

    const user = userEvent.setup();
    const onLogin = vi.fn();

    render(<LoginGate onLogin={onLogin} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'james');
    await user.type(screen.getByLabelText(/^password$/i), 'endgame2026');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('james'));
    expect(localAuth.isAuthenticated()).toBe(true);
  });

  it('rejects wrong password and shows error without setting session', async () => {
    await localAuth.createAccount('james', 'endgame2026');

    const user = userEvent.setup();
    const onLogin = vi.fn();

    render(<LoginGate onLogin={onLogin} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'james');
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid username or password/i);
    expect(onLogin).not.toHaveBeenCalled();
    expect(localAuth.isAuthenticated()).toBe(false);
  });

  it('rejects wrong username', async () => {
    await localAuth.createAccount('james', 'endgame2026');

    const user = userEvent.setup();
    const onLogin = vi.fn();

    render(<LoginGate onLogin={onLogin} />);

    await user.clear(screen.getByLabelText(/username/i));
    await user.type(screen.getByLabelText(/username/i), 'notjames');
    await user.type(screen.getByLabelText(/^password$/i), 'endgame2026');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid username or password/i);
    expect(onLogin).not.toHaveBeenCalled();
  });
});

describe('session persistence', () => {
  it('isAuthenticated returns false with no session in localStorage', () => {
    expect(localAuth.isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when a valid session exists in localStorage', () => {
    localAuth.setSession('james');
    expect(localAuth.isAuthenticated()).toBe(true);
  });

  it('logout clears session from localStorage but leaves account intact', async () => {
    await localAuth.createAccount('james', 'endgame2026');
    localAuth.setSession('james');

    expect(localAuth.isAuthenticated()).toBe(true);
    expect(localAuth.hasAccount()).toBe(true);

    localAuth.logout();

    expect(localAuth.isAuthenticated()).toBe(false);
    expect(localAuth.hasAccount()).toBe(true);
  });

  it('profile data key is separate from session key — logout does not touch profile data', () => {
    localStorageStore['jericho-identity'] = JSON.stringify({ someProfileData: true });
    localAuth.setSession('james');

    localAuth.logout();

    expect(localStorageStore['jericho-identity']).toBeDefined();
    expect(localStorageStore['jericho-session']).toBeUndefined();
  });

  it('simulated refresh while signed in: isAuthenticated reads persisted session', () => {
    localAuth.setSession('james');
    // Simulate a new "page load" by reading directly from localStorage
    expect(localAuth.isAuthenticated()).toBe(true);
    expect(localAuth.getSession()?.username).toBe('james');
  });

  it('simulated refresh after logout: isAuthenticated returns false', () => {
    localAuth.setSession('james');
    localAuth.logout();
    // Simulate a new "page load"
    expect(localAuth.isAuthenticated()).toBe(false);
    expect(localAuth.getSession()).toBeNull();
  });
});
