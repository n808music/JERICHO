import React from 'react';
import * as localAuth from '../state/localAuthStore.js';

// Official local dev credentials: username=james, password=JerichoMVP2026!
// Not production security — local containment credential only.

function PasswordInput({ id, value, onChange, onBlur, autoComplete, label }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-[0.12em] text-muted" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required
          autoComplete={autoComplete}
          className="w-full rounded-md border border-line/70 bg-white px-3 py-2 pr-16 text-sm text-jericho-text focus:border-jericho-accent focus:outline-none"
        />
        <button
          type="button"
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-xs text-muted hover:text-jericho-text"
          tabIndex={-1}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}

export default function LoginGate({ onLogin }) {
  const [mode, setMode] = React.useState(() => (localAuth.hasAccount() ? 'login' : 'create'));
  const [username, setUsername] = React.useState('james');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [confirmTouched, setConfirmTouched] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // Inline mismatch hint — only after confirm field has been touched
  const showMismatch =
    mode === 'create' &&
    confirmTouched &&
    confirm.length > 0 &&
    password.length > 0 &&
    password !== confirm;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await localAuth.login(username, password);
    setLoading(false);
    if (result.success) {
      onLogin(username);
    } else {
      setError(result.error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!confirm) {
      setError('Please confirm your password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    // Auth Containment Stabilization (Rule 4): account+session committed through a
    // single transaction. If session commit fails, account remains durable and the
    // recoverable auto-resume path in AppShell picks it up on next mount.
    const outcome = await localAuth.createAccountTransaction(username, password);
    setLoading(false);
    if (!outcome.committed) {
      setError('Account created, but sign-in could not complete. Reload to continue.');
      return;
    }
    onLogin(username);
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirm('');
    setConfirmTouched(false);
  };

  return (
    <main
      className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6"
      data-testid="login-gate"
    >
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Jericho</p>
        <h1 className="text-2xl font-semibold text-jericho-text">
          {mode === 'login' ? 'Sign in' : 'Create your account'}
        </h1>
        <p className="text-sm text-muted">
          {mode === 'login'
            ? 'Enter your credentials to continue.'
            : 'Set up your local account to access Jericho.'}
        </p>
      </div>

      <form
        onSubmit={mode === 'login' ? handleLogin : handleCreate}
        className="space-y-4"
        data-testid={mode === 'login' ? 'login-form' : 'create-form'}
      >
        <div className="space-y-1">
          <label
            className="text-xs uppercase tracking-[0.12em] text-muted"
            htmlFor="login-username"
          >
            Username
          </label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="w-full rounded-md border border-line/70 bg-white px-3 py-2 text-sm text-jericho-text focus:border-jericho-accent focus:outline-none"
          />
        </div>

        <PasswordInput
          id="login-password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        {mode === 'create' && (
          <PasswordInput
            id="login-confirm"
            label="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            autoComplete="new-password"
          />
        )}

        {showMismatch && (
          <p className="text-xs text-amber-600" role="status" data-testid="mismatch-hint">
            Passwords do not match.
          </p>
        )}

        {error && (
          <p className="text-xs text-red-500" role="alert" data-testid="error-message">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border border-jericho-accent bg-jericho-accent px-4 py-2 text-sm font-semibold text-white hover:bg-jericho-accent/90 disabled:opacity-50"
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-xs text-muted">
        {mode === 'login' ? (
          <>
            No account?{' '}
            <button
              type="button"
              className="text-jericho-accent hover:underline"
              onClick={() => switchMode('create')}
            >
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              className="text-jericho-accent hover:underline"
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </main>
  );
}
