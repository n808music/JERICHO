import React from 'react';
import ZionDashboard from './ZionDashboard.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import LoginGate from './LoginGate.jsx';
import { IdentityProvider, useIdentityStore } from '../state/identityStore.js';
import { JerichoProvider } from '../core/state.js';
import * as localAuth from '../state/localAuthStore.js';

const NOOP = () => {};
const IDENTITY_KEY = 'jericho-identity';
const AUTH_TOKEN_KEY = 'jericho-auth-token';

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

const PLACEHOLDER_PROFILE_IDS = new Set(['profile-local-default']);
const PLACEHOLDER_PROFILE_NAMES = new Set(['', 'Local Profile', 'Create profile']);
const PLACEHOLDER_GOAL_IDS = new Set(['goal-1']);
const PLACEHOLDER_CYCLE_IDS = new Set(['cycle-1']);

function isPlaceholderProfile(profileId, profile) {
  const displayName = String(profile?.displayName || profile?.label || '').trim();
  return PLACEHOLDER_PROFILE_IDS.has(String(profileId || '').trim()) && PLACEHOLDER_PROFILE_NAMES.has(displayName);
}

function isProfileOwnedGoal(store, profile, goalId) {
  const normalizedGoalId = String(goalId || '').trim();
  if (!normalizedGoalId) {
    return false;
  }
  const goal = store?.goalsById?.[normalizedGoalId] || null;
  return Boolean(
    goal &&
      goal.profileId === profile.id &&
      Array.isArray(profile.goalIds) &&
      profile.goalIds.includes(normalizedGoalId)
  );
}

function isProfileOwnedCycle(store, profile, cycleId) {
  const normalizedCycleId = String(cycleId || '').trim();
  if (!normalizedCycleId) {
    return false;
  }
  const cycle = store?.cyclesById?.[normalizedCycleId] || null;
  const cycleGoalId =
    cycle?.goalId ||
    cycle?.goalContract?.goalId ||
    cycle?.goalGovernanceContract?.goalId ||
    cycle?.contract?.goalId ||
    null;
  return Boolean(cycle && (!cycle.profileId || cycle.profileId === profile.id) && isProfileOwnedGoal(store, profile, cycleGoalId));
}

function describeProfileCoherenceBlock(reasonCodes = []) {
  const codes = new Set(reasonCodes);
  if (
    codes.has('PLACEHOLDER_PROFILE_CONTEXT') ||
    codes.has('PLACEHOLDER_GOAL_CONTEXT') ||
    codes.has('PLACEHOLDER_CYCLE_CONTEXT')
  ) {
    return 'A default local/demo profile was found. Create or load a real profile before entering Jericho.';
  }
  if (codes.has('PROFILE_NOT_SELECTED')) {
    return 'Select a saved profile before entering the execution system.';
  }
  if (codes.has('ACTIVE_GOAL_UNRESOLVED') || codes.has('ACTIVE_CYCLE_UNRESOLVED')) {
    return 'The saved profile has unresolved goal or cycle pointers. Load a valid profile or restore from backup.';
  }
  if (codes.has('MASTER_CALENDAR_MISSING') || codes.has('MASTER_CALENDAR_UNRESOLVED')) {
    return 'The selected profile is missing calendar context. Restore the profile or create a new one.';
  }
  return 'Profile context is incomplete. Select, restore, or create a coherent profile.';
}

function readStorageValue(key) {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getAppShellAuthState() {
  // Auth Containment Stabilization: if account exists and the session was lost to a
  // crash/reload (no explicit_sign_out marker), restore the session transparently
  // BEFORE evaluating render state. Explicit logout is honored — see resumeSessionIfSafe.
  // `resumed: true` exactly once per crash/reload — used downstream to scope the
  // browser-restart profile auto-restore (see AppShellInner).
  const resumeResult = localAuth.resumeSessionIfSafe();

  const evaluation = localAuth.evaluateAuthState();
  const hasLocalAccount = Boolean(evaluation.account?.username);
  const hasLocalSession = Boolean(evaluation.session?.username);
  const authenticatedUser = evaluation.authenticatedUser;
  const localProfileAvailable = Boolean(readStorageValue(IDENTITY_KEY));
  const devRestoreAvailable =
    typeof window !== 'undefined' && typeof window.__jerichoRestoreOperationEndgame === 'function';
  const syncUnavailable = false;

  return {
    authenticatedUser,
    hasLocalAccount,
    hasLocalSession,
    authStateMachine: evaluation.state,
    lastSessionClearReason: evaluation.lastClearReason,
    lastSessionClearAt: evaluation.lastClearAt,
    localProfileAvailable,
    devRestoreAvailable,
    syncUnavailable,
    sessionJustResumed: Boolean(resumeResult?.resumed),
  };
}

function UnauthenticatedStateNotice({ authState }) {
  if (authState.hasLocalAccount && !authState.hasLocalSession) {
    return (
      <div
        className="rounded-md border border-line/70 bg-white px-4 py-3 text-sm text-muted"
        data-testid="account-signin-required-notice"
      >
        A local account exists on this browser, but you need to sign in again to continue.
      </div>
    );
  }

  if (authState.localProfileAvailable || authState.devRestoreAvailable) {
    return (
      <div
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        data-testid="local-profile-restore-notice"
      >
        Local profile or dev restore data is available on this browser, but it is not authenticated
        account access. Sign in or create/link an account before entering Jericho.
      </div>
    );
  }

  return null;
}

export function evaluateProfileContextCoherence(store) {
  const reasonCodes = [];
  const activeProfileId = String(store?.activeProfileId || '').trim();
  const profileAccessStatus = String(store?.profileAccess?.status || '').trim();
  const selectedProfileId = String(store?.profileAccess?.selectedProfileId || '').trim();
  const profile = activeProfileId ? store?.profilesById?.[activeProfileId] || null : null;

  if (!activeProfileId) {
    reasonCodes.push('ACTIVE_PROFILE_MISSING');
  }
  if (!profile) {
    reasonCodes.push('ACTIVE_PROFILE_RECORD_MISSING');
  }
  if (profile && isPlaceholderProfile(activeProfileId, profile)) {
    reasonCodes.push('PLACEHOLDER_PROFILE_CONTEXT');
  }
  if (profileAccessStatus !== 'profile_selected' || selectedProfileId !== activeProfileId) {
    reasonCodes.push('PROFILE_NOT_SELECTED');
  }

  const masterCalendarId = String(profile?.masterCalendarId || '').trim();
  const masterCalendar = masterCalendarId ? store?.masterCalendarsById?.[masterCalendarId] || null : null;
  const hasMasterPlanContext = Boolean(profile?.activeMasterPlanId && store?.masterPlansById?.[profile.activeMasterPlanId]);
  if (!masterCalendarId) {
    reasonCodes.push('MASTER_CALENDAR_MISSING');
  } else if (!masterCalendar && !hasMasterPlanContext) {
    reasonCodes.push('MASTER_CALENDAR_UNRESOLVED');
  }

  const activeGoalId = String(store?.activeGoalId || profile?.activeGoalId || '').trim();
  if (activeGoalId) {
    if (PLACEHOLDER_GOAL_IDS.has(activeGoalId)) {
      reasonCodes.push('PLACEHOLDER_GOAL_CONTEXT');
    }
    if (!profile || !isProfileOwnedGoal(store, profile, activeGoalId)) {
      reasonCodes.push('ACTIVE_GOAL_UNRESOLVED');
    }
  }

  const activeCycleId = String(store?.activeCycleId || '').trim();
  if (activeCycleId) {
    if (PLACEHOLDER_CYCLE_IDS.has(activeCycleId)) {
      reasonCodes.push('PLACEHOLDER_CYCLE_CONTEXT');
    }
    if (!profile || !isProfileOwnedCycle(store, profile, activeCycleId)) {
      reasonCodes.push('ACTIVE_CYCLE_UNRESOLVED');
    }
  }

  const activeMasterPlanId = String(profile?.activeMasterPlanId || '').trim();
  if (activeMasterPlanId) {
    const plan = store?.masterPlansById?.[activeMasterPlanId] || null;
    if (!plan || (plan.profileId && plan.profileId !== profile?.id)) {
      reasonCodes.push('ACTIVE_MASTER_PLAN_UNRESOLVED');
    }
  }

  const coherent = reasonCodes.length === 0;
  const recoverableProfiles = Object.values(store?.profilesById || {}).filter(
    (candidate) => candidate?.id && !isPlaceholderProfile(candidate.id, candidate)
  );
  return {
    coherent,
    reasonCodes,
    accessState: coherent
      ? 'profile_selected'
      : recoverableProfiles.length > 0
        ? 'profile_restore_available'
        : 'profile_required',
  };
}

export default function AppShell() {
  const [authState, setAuthState] = React.useState(() => getAppShellAuthState());

  const handleLogin = React.useCallback(() => {
    setAuthState(getAppShellAuthState());
  }, []);

  const handleLogout = React.useCallback(() => {
    localAuth.logout();
    setAuthState(getAppShellAuthState());
  }, []);

  if (!authState.authenticatedUser) {
    return (
      <div className="min-h-screen bg-jericho-bg text-jericho-text transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          <header className="flex items-center justify-between border-b border-line/40 pb-3">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Jericho</span>
          </header>
          <UnauthenticatedStateNotice authState={authState} />
          <LoginGate onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <JerichoProvider>
      <IdentityProvider>
        <AppShellInner onLogout={handleLogout} initialAuthState={authState} />
      </IdentityProvider>
    </JerichoProvider>
  );
}

function AppShellInner({ onLogout = NOOP, initialAuthState = null }) {
  const store = useIdentityStore();
  // Browser-restart auto-restore: scoped to the exact mount where session was just
  // resumed (crash/reload). Fresh login paths keep the manual ProfileAccessGate.
  const sessionJustResumed = Boolean(initialAuthState?.sessionJustResumed);
  const autoRestoreFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (autoRestoreFiredRef.current) {
      return;
    }
    if (!sessionJustResumed) {
      return;
    }
    autoRestoreFiredRef.current = true;

    const coherence = evaluateProfileContextCoherence(store);
    if (coherence.coherent) {
      return;
    }

    const activeProfileId = String(store?.activeProfileId || '').trim();
    const activeProfile = activeProfileId ? store?.profilesById?.[activeProfileId] || null : null;
    const isRealActiveProfile =
      activeProfile && !isPlaceholderProfile(activeProfileId, activeProfile);

    if (
      isRealActiveProfile &&
      store?.profileAccess?.status !== 'profile_selected' &&
      typeof store?.selectProfile === 'function'
    ) {
      store.selectProfile(activeProfileId);
      return;
    }

    const hasAnyRealProfile = Object.values(store?.profilesById || {}).some(
      (profile) => profile?.id && !isPlaceholderProfile(profile.id, profile)
    );
    if (
      !hasAnyRealProfile &&
      store?.operationEndgameRestoreAvailable &&
      typeof store?.restoreOperationEndgameProfile === 'function'
    ) {
      store.restoreOperationEndgameProfile();
    }
  }, [sessionJustResumed, store]);
  const commandContext = React.useMemo(
    () => ({
      mode: null,
      practice: null,
      note: null,
    }),
    []
  );
  const initialView = getInitialZionViewFromHash();

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.mode = 'zion';
      document.title = 'Jericho';
    }
  }, []);

  const profileCoherence = React.useMemo(() => evaluateProfileContextCoherence(store), [store]);
  const authState = getAppShellAuthState();
  const sessionLabel = authState.authenticatedUser ? `Signed in as ${authState.authenticatedUser}` : null;

  return (
    <div className="min-h-screen bg-jericho-bg text-jericho-text transition-colors duration-300">
      <ErrorBoundary>
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
          <header className="flex items-center justify-between border-b border-line/40 pb-3">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Jericho // LIVE</span>
            <div className="flex items-center gap-4">
              {sessionLabel && (
                <span className="text-xs text-muted">{sessionLabel}</span>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="text-xs uppercase tracking-[0.14em] text-muted hover:text-jericho-text"
              >
                Sign out
              </button>
            </div>
          </header>
          {profileCoherence.coherent ? (
            <ZionDashboard
              commandContext={commandContext}
              assistantOpen={false}
              assistantInitialPrompt={null}
              onAssistantClose={NOOP}
              initialView={initialView}
            />
          ) : (
            <ProfileAccessGate store={store} profileCoherence={profileCoherence} />
          )}
        </div>
      </ErrorBoundary>
    </div>
  );
}

export function ProfileAccessGate({ store, profileCoherence = null }) {
  const profiles = React.useMemo(
    () =>
      Object.values(store?.profilesById || {})
        .filter((profile) => profile?.id)
        .filter((profile) => !isPlaceholderProfile(profile.id, profile))
        .sort((left, right) =>
          String(left?.label || left?.displayName || '').localeCompare(
            String(right?.label || right?.displayName || '')
          )
        ),
    [store?.profilesById]
  );
  const handleCreateProfile = () => {
    const profileId =
      store?.activeProfileId && !PLACEHOLDER_PROFILE_IDS.has(store.activeProfileId)
        ? store.activeProfileId
        : `profile-local-${Date.now()}`;
    store?.upsertProfileDetails?.({
      profileId,
      displayName: 'New Profile',
    });
    store?.selectProfile?.(profileId);
  };
  const handleRestoreOperationEndgame = () => {
    store?.restoreOperationEndgameProfile?.();
  };
  const canRestoreOperationEndgame = Boolean(
    store?.operationEndgameRestoreAvailable && typeof store?.restoreOperationEndgameProfile === 'function'
  );

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Profile access</p>
        <h1 className="text-2xl font-semibold text-jericho-text">Welcome to Jericho</h1>
        <p className="text-sm text-muted">
          Sign in to continue your execution system.
        </p>
        {profileCoherence?.reasonCodes?.length ? (
          <p className="text-xs text-muted">
            {describeProfileCoherenceBlock(profileCoherence.reasonCodes)}
          </p>
        ) : null}
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
      ) : null}
      <div className="flex flex-wrap gap-3">
        {canRestoreOperationEndgame && profiles.length === 0 ? (
          <button
            type="button"
            className="w-fit rounded-md border border-jericho-accent bg-jericho-accent px-4 py-2 text-sm font-semibold text-white hover:bg-jericho-accent/90"
            onClick={handleRestoreOperationEndgame}
          >
            Continue as James
          </button>
        ) : null}
        <button
          type="button"
          className="w-fit rounded-md border border-jericho-accent px-4 py-2 text-sm font-semibold text-jericho-accent hover:bg-jericho-accent/10"
          onClick={handleCreateProfile}
        >
          Create profile
        </button>
      </div>
    </main>
  );
}
