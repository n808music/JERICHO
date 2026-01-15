import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import OnboardingScreen from '../../src/components/OnboardingScreen.jsx';

describe('Onboarding goal contract', () => {
  const interact = async (callback) => {
    await act(async () => {
      await callback();
    });
  };

  it('keeps CTA disabled until required fields are present', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    const button = screen.getByRole('button', { name: /Enter Control Room/i });
    expect(button).toBeDisabled();

    await interact(() => user.selectOptions(screen.getByLabelText(/Objective type/i), 'create'));
    expect(button).toBeDisabled();
    const missingSummary = screen.getByText(/Missing:/i);
    expect(missingSummary).toHaveTextContent('Start date');
    expect(missingSummary).toHaveTextContent('Deadline');
    expect(missingSummary).toHaveTextContent('Capacity');
    expect(missingSummary).toHaveTextContent('Target count');
    expect(missingSummary).toHaveTextContent('Target unit');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('enables CTA and dispatches structured goal contract when valid', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    await interact(() => user.type(screen.getByLabelText(/Goal label/i), 'Launch demo'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Objective type/i), 'create'));
    await interact(() => user.type(screen.getByLabelText(/Start date/i), '2025-01-20'));
    await interact(() =>
      user.type(screen.getByLabelText(/Deadline \(when it must be done\)/i), '2025-12-31')
    );
    await interact(() => user.type(screen.getByLabelText(/Target count/i), '6'));
    await interact(() =>
      user.selectOptions(screen.getByLabelText(/Target unit/i), 'songs recorded (rough takes)')
    );
    await interact(() => user.selectOptions(screen.getByLabelText(/Days per week/i), '5'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Minutes per day/i), '120'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Primary domain/i), 'Creation'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Work mode/i), 'SHIP'));

    const button = screen.getByRole('button', { name: /Enter Control Room/i });
    expect(button).toBeEnabled();

    await interact(() => user.click(button));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    expect(payload).toHaveProperty('goalContract');
    expect(payload.goalContract).toMatchObject({
      objectiveType: 'create',
      domainPrimary: 'Creation',
      workMode: 'SHIP',
      capacity: {
        daysPerWeek: 5,
        minutesPerDay: 120,
        timeWindow: 'Any'
      }
    });
    expect(payload.goalContract.target).toMatchObject({
      count: 6,
      unit: 'songs recorded (rough takes)',
      definitionOfDone: ''
    });
    expect(payload.goalContract.baseline).toBeUndefined();
    expect(payload.goalContract.startDateISO).toBe('2025-01-20T00:00:00.000Z');
    expect(payload.goalContract.planWindowDays).toBeGreaterThan(0);
  });

  it('renders plan preview copy deterministically', async () => {
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

    expect(screen.getByText(/We will generate work sessions based on your available time\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Target: 6 songs recorded \(rough takes\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Weekly time: 450 minutes')).toBeInTheDocument();
    const planWindow = screen.getByText(/Plan window:/i);
    expect(planWindow.textContent).toContain('Jan 20');
    expect(planWindow.textContent).toContain('Apr 1');
    expect(planWindow.textContent).toContain('(72 days)');
    expect(screen.getByText(/About 10 weeks\./i)).toBeInTheDocument();
  });
});
