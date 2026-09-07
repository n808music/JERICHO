import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/syncService.js', () => ({
  pushState: vi.fn(async () => ({ ok: true })),
  pullState: vi.fn(async () => null),
}));

import { IdentityProvider, buildBlankIdentityState } from '../../src/state/identityStore.js';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

// A session shaped the way hasResumableIntake / MatrixIntake require: an engine
// snapshot plus the slot it stopped on.
function resumableSession(slotId = 'slot:project') {
  return {
    phase: 'engine',
    slotQueue: [slotId],
    currentSlotId: slotId,
    engineSnapshot: { slotId, captured: { name: 'Romance Riot' } },
    inputValue: '',
    rosterNames: [],
    rosterIndex: 0,
    rosterSlotId: null,
  };
}

function stateWith({ cycleId, activeCycleId, hasMasterPlan, session }) {
  const s = buildBlankIdentityState({});
  s.cyclesById = {
    ...(s.cyclesById || {}),
    [cycleId]: {
      id: cycleId,
      status: 'active',
      goalContract: { terminalOutcome: { text: 'Ship the record' } },
    },
  };
  s.cycleOrder = [cycleId];
  s.activeCycleId = activeCycleId;
  s.intakeSessionByCycleId = session ? { [cycleId]: session } : {};
  if (hasMasterPlan) {
    const pid = s.activeProfileId || 'profile-local-default';
    s.activeProfileId = pid;
    s.profilesById = {
      ...(s.profilesById || {}),
      [pid]: { ...(s.profilesById?.[pid] || { id: pid }), id: pid, activeMasterPlanId: 'mp-1' },
    };
  }
  return s;
}

function renderPage(state) {
  return render(
    <IdentityProvider initialState={state}>
      <StructurePageConsolidated />
    </IdentityProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal('localStorage', (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
      setItem: (k, v) => { m.set(String(k), String(v)); },
      removeItem: (k) => { m.delete(String(k)); },
      clear: () => { m.clear(); },
      key: (i) => Array.from(m.keys())[i] ?? null,
      get length() { return m.size; },
    };
  })());
});

describe('MODE B — an unfinished intake never auto-mounts over control mode', () => {
  // SUPERSEDES the earlier Mode B priority fix. That change made
  // hasResumableIntake outrank hasActiveMasterPlan and mount MatrixIntake on
  // load, so signing in dropped the operator straight into a survey they had
  // deliberately left. The session must stay REACHABLE without being FORCED:
  // control mode renders, and the button is the only way in.
  //
  // "Contract Admission" appears in more than one module header, so these tests
  // discriminate on the intake testids instead — those exist only when
  // MatrixIntake is actually mounted.
  it('renders control mode, not the survey, when a resumable session exists', async () => {
    renderPage(
      stateWith({
        cycleId: 'cycle-1',
        activeCycleId: 'cycle-1',
        hasMasterPlan: true,
        session: resumableSession(),
      })
    );

    // The offer is present…
    await waitFor(() => {
      expect(screen.getByTestId('resume-unfinished-intake')).toBeInTheDocument();
    });
    // …and the survey is NOT mounted. The section pill is rendered by every
    // intake branch, so its absence rules out ALL of them — not just the probe.
    expect(screen.queryByTestId('intake-question')).not.toBeInTheDocument();
    expect(screen.queryByTestId('intake-section-pill')).not.toBeInTheDocument();
  });

  it('offers the button first in the Operating Cycle module for the ACTIVE cycle', async () => {
    renderPage(
      stateWith({
        cycleId: 'cycle-1',
        activeCycleId: 'cycle-1',
        hasMasterPlan: true,
        session: resumableSession(),
      })
    );

    const resume = await screen.findByTestId('resume-unfinished-intake');
    const moduleRoot = resume.closest('details');
    expect(moduleRoot).toBeTruthy();
    expect(moduleRoot.textContent).toMatch(/Operating Cycle/i);

    const buttons = Array.from(moduleRoot.querySelectorAll('button'));
    expect(buttons[0]).toBe(resume);
    const startIdx = buttons.findIndex((b) => /Start Operating Cycle|Replace Active Operating Cycle/i.test(b.textContent || ''));
    expect(startIdx).toBeGreaterThan(0);

    // Expanded, or the button is real but unreachable — the bug this replaces.
    expect(moduleRoot).toHaveAttribute('open');
  });

  it('mounts the survey only after the button is clicked', async () => {
    const user = userEvent.setup();
    renderPage(
      stateWith({
        cycleId: 'cycle-1',
        activeCycleId: 'cycle-1',
        hasMasterPlan: true,
        session: resumableSession(),
      })
    );

    const button = await screen.findByTestId('resume-unfinished-intake');
    // Nothing from MatrixIntake is on screen before the click.
    expect(screen.queryByTestId('intake-section-pill')).not.toBeInTheDocument();

    await user.click(button);

    // The resumed survey took over, and the offer is no longer being made.
    // Assert on the section pill, not on `intake-resume-banner`: the banner is
    // only rendered by the probe screen, and a restored session may legitimately
    // land on the loop-check / roster screen instead. The pill is rendered by
    // every intake branch, so it is the branch-independent "mounted" marker.
    await waitFor(() => {
      expect(screen.getByTestId('intake-section-pill')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('resume-unfinished-intake')).not.toBeInTheDocument();
  }, 30000);
});

describe('MODE A — an orphaned session (no active cycle) is reachable by explicit choice', () => {
  // REGRESSION: hasResumableIntake requires activeCycleId, so once the cycle
  // stopped being active the stored session became invisible — no auto-resume,
  // and no button anywhere to reach it.
  it('surfaces a resume affordance when a session exists but its cycle is not active', async () => {
    renderPage(
      stateWith({
        cycleId: 'cycle-orphan',
        activeCycleId: null,
        hasMasterPlan: true,
        session: resumableSession(),
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('resume-unfinished-intake')).toBeInTheDocument();
    });
    expect(screen.getByTestId('resumable-survey-hint')).toBeInTheDocument();
  });

  // The previous attempt rendered a notice in the correct render path but not
  // where the operator looks. Pin BOTH facts: it is inside the Operating Cycle
  // module, and it is the FIRST button — ahead of "Start Operating Cycle".
  it('renders the button inside the Operating Cycle module, as the first button', async () => {
    renderPage(
      stateWith({
        cycleId: 'cycle-orphan',
        activeCycleId: null,
        hasMasterPlan: true,
        session: resumableSession(),
      })
    );

    const resume = await screen.findByTestId('resume-unfinished-intake');

    // Inside the Operating Cycle <details> block.
    const moduleRoot = resume.closest('details');
    expect(moduleRoot).toBeTruthy();
    expect(moduleRoot.textContent).toMatch(/Operating Cycle/i);

    // First in the button cluster, before Start Operating Cycle.
    const buttons = Array.from(moduleRoot.querySelectorAll('button'));
    expect(buttons[0]).toBe(resume);
    const startIdx = buttons.findIndex((b) => /Start Operating Cycle/i.test(b.textContent || ''));
    expect(startIdx).toBeGreaterThan(0);
    expect(buttons.indexOf(resume)).toBeLessThan(startIdx);

    // The module is expanded, so the button is not hidden inside a collapsed
    // <details> — a button nobody can see is the bug being fixed.
    expect(moduleRoot).toHaveAttribute('open');
  });

  it('does NOT auto-redirect — the survey appears only after the operator clicks resume', async () => {
    const user = userEvent.setup();
    renderPage(
      stateWith({
        cycleId: 'cycle-orphan',
        activeCycleId: null,
        hasMasterPlan: true,
        session: resumableSession(),
      })
    );

    // "Contract Admission" is in BOTH module headers, so it cannot discriminate.
    // The routing transition itself is the observable: the offer is on screen
    // beforehand, and is replaced by the resumed survey only after the click.
    const button = await screen.findByTestId('resume-unfinished-intake');
    expect(screen.queryByTestId('intake-section-pill')).not.toBeInTheDocument();

    await user.click(button);

    // The resume view took over — the survey is mounted (positive: the section
    // pill, rendered by every intake branch) and the offer is withdrawn.
    await waitFor(() => {
      expect(screen.getByTestId('intake-section-pill')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('resume-unfinished-intake')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resumable-survey-hint')).not.toBeInTheDocument();
  });

  it('shows no affordance when there is no unfinished session', async () => {
    renderPage(
      stateWith({
        cycleId: 'cycle-1',
        activeCycleId: null,
        hasMasterPlan: true,
        session: null,
      })
    );

    await waitFor(() => {
      expect(screen.queryByTestId('resume-unfinished-intake')).not.toBeInTheDocument();
    });
  });
});
