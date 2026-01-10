import React from 'react';
import ZionDashboard from './ZionDashboard.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import HomeScreen from './zion/HomeScreen.jsx';
import OnboardingScreen from './OnboardingScreen.jsx';
import { IdentityProvider, useIdentityStore } from '../state/identityStore.js';
import { DEV } from '../utils/devFlags.js';
import UiWiringOverlay from './debug/UiWiringOverlay.jsx';
import { REDUCE_UI } from '../ui/reduceUIConfig.js';

export default function AppShell() {
  return (
    <IdentityProvider>
      <AppShellInner />
    </IdentityProvider>
  );
}

function AppShellInner() {
  const { meta, completeOnboarding, applyOnboardingInputs, rebalanceToday, applyLenses, lenses, resetIdentity } = useIdentityStore();
  const [view, setView] = React.useState(meta?.onboardingComplete ? 'zion' : 'home');
  const [commandContext, setCommandContext] = React.useState({
    mode: null,
    practice: null,
    note: null
  });
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [assistantInitialPrompt, setAssistantInitialPrompt] = React.useState(null);
  const [identityScanOpen, setIdentityScanOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [initialView, setInitialView] = React.useState(null);
  const [showWiring, setShowWiring] = React.useState(false);

  React.useEffect(() => {
    if (meta?.onboardingComplete && view === 'home') {
      setView('zion');
    }
  }, [meta?.onboardingComplete, view]);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.mode = view === 'zion' ? 'zion' : '';
    }
  }, [view]);

  function handleEnterZion(context) {
    if (typeof context === 'string') {
      setInitialView(context);
      setCommandContext({ mode: null, practice: null, note: null });
    } else if (context) {
      setCommandContext(context);
      setInitialView('today');
    } else {
      setInitialView(null);
    }
    setView('zion');
  }

  function handleBackHome() {
    setView('home');
  }

  function handleMacro(macro) {
    if (macro === 'CLEAR_AFTERNOON') {
      rebalanceToday('CLEAR_AFTERNOON');
      setView('zion');
      return;
    }
    if (macro === 'PROTECT_CREATION') {
      const targets = (lenses?.pattern?.dailyTargets || []).map((t) =>
        t.name === 'Creation' ? { ...t, minutes: t.minutes + 30 } : t
      );
      applyLenses({ pattern: { ...lenses.pattern, dailyTargets: targets } });
      setCommandContext({ mode: 'practice', practice: 'Creation', note: 'protect creation' });
      setView('zion');
      return;
    }
  }

  function handleOnboarding(values) {
    applyOnboardingInputs(values);
    completeOnboarding({ scenarioLabel: values.goalText?.slice(0, 30) || '' });
    setView('zion');
  }

  function handleAssistantQuestion(question) {
    setAssistantInitialPrompt(question);
    setAssistantOpen(true);
    setView('zion');
  }

  function handleResetIdentity() {
    resetIdentity();
    setView('home');
  }

  if (!meta?.onboardingComplete) {
    return <OnboardingScreen onComplete={handleOnboarding} />;
  }

  return (
    <div className="min-h-screen bg-jericho-bg text-jericho-text transition-colors duration-300">
      {view === 'home' ? (
        <HomeScreen
          onEnterZion={handleEnterZion}
          onMacro={handleMacro}
          onResetIdentity={handleResetIdentity}
          onAssistantQuestion={handleAssistantQuestion}
          onOpenIdentityScan={() => setIdentityScanOpen(true)}
          onOpenHowItWorks={() => {
            setAssistantInitialPrompt('how do i use this');
            setAssistantOpen(true);
            setView('zion');
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAssistant={(prompt) => {
            setAssistantInitialPrompt(prompt);
            setAssistantOpen(true);
            setView('zion');
          }}
        />
      ) : (
        <ErrorBoundary>
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
            <header className="flex items-center justify-between border-b border-line/40 pb-3">
              <span className="text-xs uppercase tracking-[0.2em] text-muted">Jericho System</span>
              <div className="flex items-center gap-3">
                {DEV ? (
                  <button
                    onClick={() => setShowWiring((prev) => !prev)}
                    className="text-xs text-muted hover:text-jericho-accent"
                  >
                    {showWiring ? 'Hide UI Wiring' : 'Show UI Wiring'}
                  </button>
                ) : null}
                <button
                  onClick={handleBackHome}
                  className="text-xs text-muted hover:text-jericho-accent"
                >
                  Home
                </button>
              </div>
            </header>
            <ZionDashboard
              onBackHome={handleBackHome}
              commandContext={commandContext}
              assistantOpen={assistantOpen}
              assistantInitialPrompt={assistantInitialPrompt}
              onAssistantClose={() => setAssistantOpen(false)}
              initialView={initialView}
            />
          </div>
        </ErrorBoundary>
      )}
      {!REDUCE_UI ? <UiWiringOverlay open={showWiring} /> : null}
      {identityScanOpen ? (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-xl border border-line/40 bg-jericho-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-jericho-text">Identity scan</p>
              <button className="text-xs text-muted" onClick={() => setIdentityScanOpen(false)}>
                Close
              </button>
            </div>
            <p className="text-sm text-muted">
              Direction: {meta?.scenarioLabel || meta?.direction || '—'}
            </p>
            <p className="text-xs text-muted">Pattern and vector are watching for what you do next.</p>
            <button
              className="w-full rounded-full border border-jericho-accent text-jericho-accent py-2"
              onClick={() => {
                setIdentityScanOpen(false);
                setView('zion');
              }}
            >
              Enter Control Room
            </button>
          </div>
        </div>
      ) : null}
      {settingsOpen ? (
        <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-jericho-surface border-l border-line/40 z-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-jericho-text">Settings</p>
            <button className="text-xs text-muted" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
          <button
            className="w-full rounded-md border border-line/60 px-3 py-2 text-sm text-muted hover:text-jericho-accent"
            onClick={() => {
              handleResetIdentity();
              setSettingsOpen(false);
            }}
          >
            Reset identity
          </button>
        </div>
      ) : null}
    </div>
  );
}
