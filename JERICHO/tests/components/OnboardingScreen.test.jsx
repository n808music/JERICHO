import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import OnboardingScreen from '../../src/components/OnboardingScreen.jsx';

describe('Onboarding goal contract', () => {
  const interact = async (callback) => {
    await act(async () => {
      await callback();
    });
  };

  const fillRequiredFields = async (user) => {
    await interact(() => user.selectOptions(screen.getByLabelText(/Objective type/i), 'create'));
    await interact(() => user.type(screen.getByLabelText(/Start date/i), '2025-01-20'));
    await interact(() =>
      user.type(screen.getByLabelText(/Deadline \(when it must be done\)/i), '2025-04-01')
    );
    await interact(() => user.selectOptions(screen.getByLabelText(/Days per week/i), '5'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Minutes per day/i), '90'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Primary domain/i), 'Creation'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Work mode/i), 'SHIP'));
    await interact(() => user.type(screen.getByLabelText(/Target count/i), '6'));
    await interact(() =>
      user.selectOptions(screen.getByLabelText(/Target unit/i), 'songs recorded (rough takes)')
    );
  };

  it('keeps CTA disabled until every required field is valid and reports missing fields in order', async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen onComplete={() => {}} />);

    const button = screen.getByRole('button', { name: /Enter Control Room/i });
    expect(button).toBeDisabled();
    const missingSummary = screen.getByText(/^Missing:/i);
    expect(missingSummary).toHaveTextContent(
      'Missing: Objective, Start date, Deadline, Capacity, Primary domain, Work mode, Target count, Target unit, Definition of done'
    );

    await fillRequiredFields(user);
    expect(button).toBeDisabled();
    expect(screen.getByText(/^Missing:/i)).toHaveTextContent('Missing: Definition of done');

    await interact(() =>
      user.type(screen.getByLabelText(/Definition of done/i), 'Rough vocal take + bounce exported')
    );
    expect(button).toBeEnabled();
    expect(screen.queryByText(/^Missing:/i)).toBeNull();
  });

  it('submits a structured goal contract without baseline and includes target metadata', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    await interact(() => user.type(screen.getByLabelText(/Goal label/i), 'Launch demo'));
    await fillRequiredFields(user);
    await interact(() =>
      user.type(screen.getByLabelText(/Definition of done/i), 'Rough vocal take + bounce exported')
    );

    const button = screen.getByRole('button', { name: /Enter Control Room/i });
    await interact(() => user.click(button));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    expect(payload).toHaveProperty('goalContract');
    expect(payload.goalContract).toMatchObject({
      objectiveType: 'create',
      domainPrimary: 'Creation',
      workMode: 'SHIP',
      target: {
        count: 6,
        unit: 'songs recorded (rough takes)',
        definitionOfDone: 'Rough vocal take + bounce exported'
      }
    });
    expect(payload.goalContract.baseline).toBeUndefined();
    expect(payload.goalContract.target.count).toBe(6);
    expect(payload.goalContract.target.unit).toBe('songs recorded (rough takes)');
    expect(payload.goalContract.target.definitionOfDone).toBe('Rough vocal take + bounce exported');
    expect(payload.goalContract.startDateISO).toBe('2025-01-20T00:00:00.000Z');
    expect(payload.goalContract.deadlineISO).toBe('2025-04-01T23:59:59.000Z');
  });

  it('renders the exact deterministic plan preview lines', async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen onComplete={() => {}} />);

    await interact(() => user.type(screen.getByLabelText(/Target count/i), '6'));
    await interact(() =>
      user.selectOptions(screen.getByLabelText(/Target unit/i), 'songs recorded (rough takes)')
    );
    await interact(() => user.type(screen.getByLabelText(/Start date/i), '2025-01-20'));
    await interact(() =>
      user.type(screen.getByLabelText(/Deadline \(when it must be done\)/i), '2025-04-01')
    );
    await interact(() => user.selectOptions(screen.getByLabelText(/Days per week/i), '5'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Minutes per day/i), '90'));
    await interact(() =>
      user.type(screen.getByLabelText(/Definition of done/i), 'Rough vocal take + bounce exported')
    );

    expect(screen.getByText('We will generate work sessions based on your available time.')).toBeInTheDocument();
    expect(screen.getByText('Target: 6 songs recorded (rough takes)')).toBeInTheDocument();
    expect(screen.getByText('Weekly time: 450 minutes')).toBeInTheDocument();
    expect(screen.getByText('Plan window: Jan 20 → Apr 1 (72 days)')).toBeInTheDocument();
  });
});
