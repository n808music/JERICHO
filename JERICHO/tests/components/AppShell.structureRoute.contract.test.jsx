import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeContractHash } from '../../src/domain/goal/GoalAdmissionPolicy.ts';
import { buildValidGoalContract } from '../../src/domain/goal/testHelpers.ts';

vi.mock('../../src/services/syncService.js', () => ({
  pushState: vi.fn(async () => {}),
  pullState: vi.fn(async () => null),
}));

import AppShell from '../../src/components/AppShell.jsx';

const ACCOUNT_RECORD = JSON.stringify({ username: 'james', passwordHash: 'hash', createdAt: 1 });
const SESSION_RECORD = JSON.stringify({ username: 'james', issuedAt: 2 });

function isoAtNoon(date) {
  return `${date.toISOString().slice(0, 10)}T12:00:00.000Z`;
}

function dayKeyAtOffset(daysFromNow) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function createValidContract(overrides = {}) {
  const nowISO = isoAtNoon(new Date());
  const contract = buildValidGoalContract({
    goalId: 'goal-live-structure-route',
    cycleId: 'cycle-live-structure-route',
    terminalOutcome: {
      text: 'Launch the first SaaS release',
      verificationCriteria: 'Release is live',
      isConcrete: true,
    },
    deadline: { dayKey: dayKeyAtOffset(45), isHardDeadline: true },
    sacrifice: {
      whatIsGivenUp: 'Weekend leisure time',
      duration: '6 weeks',
      quantifiedImpact: '8 hours/week',
      rationale: 'Protect focused build time',
    },
    temporalBinding: {
      daysPerWeek: 5,
      activationTime: '09:00',
      sessionDurationMinutes: 90,
      weeklyMinutes: 450,
      startDayKey: '2026-03-18',
    },
    causalChain: { steps: [{ sequence: 1, description: 'Ship the MVP', approximateDayOffset: 7 }] },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Pinned calendar block',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Morning review',
    },
    inscription: { inscribedAtISO: nowISO, acknowledgment: 'I accept', isCompromised: false },
    isAspirational: false,
    createdAtISO: nowISO,
    ...overrides,
    temporalBinding: {
      daysPerWeek: 5,
      activationTime: '09:00',
      sessionDurationMinutes: 90,
      weeklyMinutes: 450,
      startDayKey: dayKeyAtOffset(0),
      ...overrides.temporalBinding,
    },
  });

  contract.inscription.contractHash = computeContractHash(contract);
  contract.terminalOutcome.hash = contract.inscription.contractHash.slice(0, 16);
  contract.sacrifice.hash = contract.inscription.contractHash.slice(16, 32);
  contract.causalChain.hash = contract.inscription.contractHash.slice(32);
  contract.inscription.acknowledgmentHash = contract.inscription.contractHash.slice(0, 16);
  return contract;
}

describe('AppShell structure route contract', () => {
  let storage;

  beforeEach(() => {
    window.location.hash = '#/structure';
    storage = new Map([
      ['jericho-account', ACCOUNT_RECORD],
      ['jericho-session', SESSION_RECORD],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, String(value));
      },
      removeItem: (key) => {
        storage.delete(key);
      },
    });
  });

  afterEach(() => {
    window.location.hash = '';
    storage = null;
    vi.unstubAllGlobals();
  });

  async function enterProfile() {
    fireEvent.click(await screen.findByRole('button', { name: /Create profile/i }));
    const continueButton = screen.queryByRole('button', { name: /Continue as /i });
    if (continueButton) {
      fireEvent.click(continueButton);
    }
    await screen.findByRole('button', { name: /Structure/i });
    await waitFor(() => expect(window.__jerichoDebug__?.activeProfileId).toBeTruthy());
  }

  it('renders the canonical Zion Structure entry surface on #/structure', async () => {
    render(<AppShell />);
    await enterProfile();

    expect(await screen.findByRole('button', { name: /Structure/i })).toBeInTheDocument();
    expect(screen.queryByText('Contract Admission') || screen.queryByText('Definite Goal')).toBeTruthy();

    expect(screen.queryByText('System Loop')).not.toBeInTheDocument();
  });

  it('renders the post-admission structure surface when an admitted goal exists', async () => {
    render(<AppShell />);
    await enterProfile();

    let admissionResult = null;
    await act(async () => {
      admissionResult = window.__jerichoDebug__.attemptGoalAdmission(createValidContract());
    });
    expect(admissionResult?.status).toBe('ADMITTED');

    const continueButton = screen.queryByRole('button', { name: /Continue as /i });
    if (continueButton) {
      fireEvent.click(continueButton);
    }

    await screen.findByRole('button', { name: /Structure/i });

    await waitFor(() => expect(screen.getByText('Definite Goal')).toBeInTheDocument());
    expect(screen.getByText('Read-only. To change goal, archive this cycle and start a new one.')).toBeInTheDocument();
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Your First Goal')).not.toBeInTheDocument();
    expect(screen.queryByText('System Loop')).not.toBeInTheDocument();
  });
});
