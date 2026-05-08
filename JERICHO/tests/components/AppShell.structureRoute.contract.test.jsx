import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from '../../src/components/AppShell.jsx';
import { computeContractHash } from '../../src/domain/goal/GoalAdmissionPolicy.ts';
import { buildValidGoalContract } from '../../src/domain/goal/testHelpers.ts';

const NOW_ISO = '2026-03-18T12:00:00.000Z';

function createValidContract(overrides = {}) {
  const contract = buildValidGoalContract({
    terminalOutcome: {
      text: 'Launch the first SaaS release',
      verificationCriteria: 'Release is live',
      isConcrete: true,
    },
    deadline: { dayKey: '2026-05-01', isHardDeadline: true },
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
    inscription: { inscribedAtISO: NOW_ISO, acknowledgment: 'I accept', isCompromised: false },
    isAspirational: false,
    ...overrides,
  });

  contract.inscription.contractHash = computeContractHash(contract);
  contract.terminalOutcome.hash = contract.inscription.contractHash.slice(0, 16);
  contract.sacrifice.hash = contract.inscription.contractHash.slice(16, 32);
  contract.causalChain.hash = contract.inscription.contractHash.slice(32);
  contract.inscription.acknowledgmentHash = contract.inscription.contractHash.slice(0, 16);
  return contract;
}

describe('AppShell structure route contract', () => {
  let storageValue = null;

  beforeEach(() => {
    window.location.hash = '#/structure';
    vi.stubGlobal('localStorage', {
      getItem: () => storageValue,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  afterEach(() => {
    window.location.hash = '';
    storageValue = null;
    vi.unstubAllGlobals();
  });

  it('renders the canonical Zion Structure entry surface on #/structure', async () => {
    render(<AppShell />);

    expect(await screen.findByRole('button', { name: /Structure/i })).toBeInTheDocument();
    expect(screen.queryByText('Getting Started') || screen.queryByText('Definite Goal')).toBeTruthy();

    expect(screen.queryByText('System Loop')).not.toBeInTheDocument();
  });

  it('renders the post-admission structure surface when an admitted goal exists', async () => {
    render(<AppShell />);

    await act(async () => {
      window.__jerichoDebug__.attemptGoalAdmission(createValidContract());
    });

    await waitFor(() => expect(screen.getByText('Definite Goal')).toBeInTheDocument());
    expect(screen.getByText('Read-only. To change goal, archive this cycle and start a new one.')).toBeInTheDocument();
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument();
    expect(screen.queryByText('Create Your First Goal')).not.toBeInTheDocument();
    expect(screen.queryByText('System Loop')).not.toBeInTheDocument();
  });
});
