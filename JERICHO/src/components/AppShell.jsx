import React from 'react';
import ZionDashboard from './ZionDashboard.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { IdentityProvider, useIdentityStore } from '../state/identityStore.js';
import { JerichoProvider } from '../core/state.js';

const NOOP = () => {};

function getInitialZionViewFromHash() {
  if (typeof window === 'undefined') {
    return null;
  }
  const hash = window.location.hash || '';
  if (hash.startsWith('#/structure')) {
    return 'structure';
  }
  if (hash.startsWith('#/today')) {
    return 'today';
  }
  if (hash.startsWith('#/stability')) {
    return 'stability';
  }
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
  const store = useIdentityStore();
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

  const profileAccessStatus = String(store?.profileAccess?.status || '').trim();
  const selectedProfileId = store?.profileAccess?.selectedProfileId || null;
  const hasSelectedProfile = Boolean(
    profileAccessStatus === 'profile_selected' &&
      selectedProfileId &&
      store?.activeProfileId === selectedProfileId &&
      store?.profilesById?.[selectedProfileId]
  );

  return (
    <div className="min-h-screen bg-jericho-bg text-jericho-text transition-colors duration-300">
      <ErrorBoundary>
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          <header className="flex items-center justify-between border-b border-line/40 pb-3">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Jericho // LIVE</span>
          </header>
          {hasSelectedProfile ? (
            <ZionDashboard
              commandContext={commandContext}
              assistantOpen={false}
              assistantInitialPrompt={null}
              onAssistantClose={NOOP}
              initialView={initialView}
            />
          ) : (
            <ProfileAccessGate store={store} />
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}

export function ProfileAccessGate({ store }) {
  const profiles = React.useMemo(
    () =>
      Object.values(store?.profilesById || {})
        .filter((profile) => profile?.id)
        .sort((left, right) =>
          String(left?.label || left?.displayName || '').localeCompare(
            String(right?.label || right?.displayName || '')
          )
        ),
    [store?.profilesById]
  );
  const handleCreateProfile = () => {
    const profileId = store?.activeProfileId || 'profile-local-default';
    store?.upsertProfileDetails?.({
      profileId,
      displayName: 'Local Profile',
    });
    store?.selectProfile?.(profileId);
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Profile access</p>
        <h1 className="text-2xl font-semibold text-jericho-text">Welcome to Jericho</h1>
        <p className="text-sm text-muted">
          Select a saved profile before entering the execution system.
        </p>
      </div>
      {profiles.length > 0 ? (
        <div className="space-y-2">
          {profiles.map((profile) => {
            const label = profile.displayName || profile.label || profile.id;
            const role = profile.roleLabel || profile.profileRole || 'Execution profile';
            return (
              <button
                key={profile.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-line/70 bg-white px-4 py-3 text-left hover:border-jericho-accent/60"
                onClick={() => store?.selectProfile?.(profile.id)}
              >
                <span>
                  <span className="block text-sm font-semibold text-jericho-text">Continue as {label}</span>
                  <span className="block text-xs text-muted">{role}</span>
                </span>
                <span className="text-xs uppercase tracking-[0.14em] text-muted">Load</span>
              </button>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          className="w-fit rounded-md border border-jericho-accent px-4 py-2 text-sm font-semibold text-jericho-accent hover:bg-jericho-accent/10"
          onClick={handleCreateProfile}
        >
          Create profile
        </button>
      )}
    </main>
  );
}
