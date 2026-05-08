import React from 'react';
import ZionDashboard from './ZionDashboard.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { IdentityProvider } from '../state/identityStore.js';
import { JerichoProvider } from '../core/state.js';

const NOOP = () => {};

function getInitialZionViewFromHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  if (hash.startsWith('#/structure')) return 'structure';
  if (hash.startsWith('#/today')) return 'today';
  if (hash.startsWith('#/stability')) return 'stability';
  return null;
}

export default function AppShell() {
  return (
    <JerichoProvider>
      <IdentityProvider>
        <AppShellInner />
      </IdentityProvider>
    </JerichoProvider>
  );
}

function AppShellInner() {
  const commandContext = React.useMemo(
    () => ({
      mode: null,
      practice: null,
      note: null,
    }),
    []
  );
  const initialView = React.useMemo(() => getInitialZionViewFromHash(), []);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.mode = 'zion';
    }
  }, []);

  return (
    <div className="min-h-screen bg-jericho-bg text-jericho-text transition-colors duration-300">
      <ErrorBoundary>
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          <header className="flex items-center justify-between border-b border-line/40 pb-3">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Jericho // LIVE</span>
          </header>
          <ZionDashboard
            commandContext={commandContext}
            assistantOpen={false}
            assistantInitialPrompt={null}
            onAssistantClose={NOOP}
            initialView={initialView}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
}
