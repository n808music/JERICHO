import React from 'react';
import * as localAuth from '../state/localAuthStore.js';

export default function LoginGate({ onLogin }) {
  const [mode, setMode] = React.useState(() => (localAuth.hasAccount() ? 'login' : 'create'));
  const [username, setUsername] = React.useState('james');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

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
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    await localAuth.createAccount(username, password);
    localAuth.setSession(username);
    setLoading(false);
    onLogin(username);
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

        <div className="space-y-1">
          <label
            className="text-xs uppercase tracking-[0.12em] text-muted"
            htmlFor="login-password"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-md border border-line/70 bg-white px-3 py-2 text-sm text-jericho-text focus:border-jericho-accent focus:outline-none"
          />
        </div>

        {mode === 'create' && (
          <div className="space-y-1">
            <label
              className="text-xs uppercase tracking-[0.12em] text-muted"
              htmlFor="login-confirm"
            >
              Confirm password
            </label>
            <input
              id="login-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-md border border-line/70 bg-white px-3 py-2 text-sm text-jericho-text focus:border-jericho-accent focus:outline-none"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500" role="alert">
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
              onClick={() => {
                setMode('create');
                setError('');
              }}
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
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </main>
  );
}
