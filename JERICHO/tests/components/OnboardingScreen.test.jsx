import React from 'react';
import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OnboardingScreen from '../../src/components/OnboardingScreen.jsx';

describe('Onboarding goal contract', () => {
  beforeEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const interact = async (callback) => {
    await act(async () => {
      await callback();
    });
  };

  const fillRequiredFields = async (user) => {
    await interact(() => user.selectOptions(screen.getAllByRole('combobox')[0], 'Fundraising'));
    await interact(() => user.type(screen.getByLabelText(/Start date/i), '2026-03-16'));
    await interact(() =>
      user.type(screen.getByLabelText(/Deadline \(when it must be done\)/i), '2026-06-30')
    );
    await interact(() => user.selectOptions(screen.getByLabelText(/Days per week/i), '5'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Minutes per day/i), '90'));
    await interact(() => user.type(screen.getByLabelText(/Target count/i), '6'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Target unit/i), 'commitments secured'));
  };

  it('keeps CTA disabled until every required field is valid and reports missing fields in order', async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen onComplete={() => {}} />);

    const button = screen.getByRole('button', { name: /Enter Control Room/i });
    expect(button).toBeDisabled();
    const missingSummary = screen.getByText(/^Missing:/i);
    expect(missingSummary).toHaveTextContent(
      'Missing: Execution type, Start date, Deadline, Capacity, Target count, Target unit, Definition of done'
    );

    await fillRequiredFields(user);
    expect(button).toBeDisabled();
    expect(screen.getByText(/^Missing:/i)).toHaveTextContent('Missing: Definition of done');

    await interact(() => user.type(screen.getByPlaceholderText('Count it when...'), 'Rough vocal take + bounce exported'));
    expect(button).toBeEnabled();
    expect(screen.queryByText(/^Missing:/i)).toBeNull();
  });

  it('submits a structured goal contract without baseline and includes target metadata', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    await interact(() => user.type(screen.getByPlaceholderText('e.g., Ship the first draft'), 'Launch demo'));
    await fillRequiredFields(user);
    await interact(() => user.type(screen.getByPlaceholderText('Count it when...'), 'Rough vocal take + bounce exported'));

    const button = screen.getByRole('button', { name: /Enter Control Room/i });
    await interact(() => user.click(button));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    expect(payload).toHaveProperty('goalContract');
    expect(payload.goalContract).toMatchObject({
      objectiveType: 'Fundraising',
      executionType: 'Fundraising',
      target: {
        count: 6,
        unit: 'commitments secured',
        definitionOfDone: 'Rough vocal take + bounce exported'
      }
    });
    expect(payload.goalContract.baseline).toBeUndefined();
    expect(payload.goalContract.target.count).toBe(6);
    expect(payload.goalContract.target.unit).toBe('commitments secured');
    expect(payload.goalContract.target.definitionOfDone).toBe('Rough vocal take + bounce exported');
    expect(payload.goalContract.startDateISO).toBe('2026-03-16T00:00:00.000Z');
    expect(payload.goalContract.deadlineISO).toBe('2026-06-30T23:59:59.000Z');
  });

  it('renders the exact deterministic plan preview lines', async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen onComplete={() => {}} />);

    await interact(() => user.selectOptions(screen.getAllByRole('combobox')[0], 'Fundraising'));
    await interact(() => user.type(screen.getByLabelText(/Target count/i), '6'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Target unit/i), 'commitments secured'));
    await interact(() => user.type(screen.getByLabelText(/Start date/i), '2026-03-16'));
    await interact(() =>
      user.type(screen.getByLabelText(/Deadline \(when it must be done\)/i), '2026-06-30')
    );
    await interact(() => user.selectOptions(screen.getByLabelText(/Days per week/i), '5'));
    await interact(() => user.selectOptions(screen.getByLabelText(/Minutes per day/i), '90'));
    await interact(() => user.type(screen.getByPlaceholderText('Count it when...'), 'Rough vocal take + bounce exported'));

    expect(screen.getByText('We will generate work sessions based on your available time.')).toBeInTheDocument();
    expect(screen.getByText('Target: 6 commitments secured')).toBeInTheDocument();
    expect(screen.getByText('Weekly time: 450 minutes')).toBeInTheDocument();
    expect(screen.getByText('Plan window: Mar 16 → Jun 30 (107 days)')).toBeInTheDocument();
  });

  it('tailors fundraising target unit options to the goal label intent', async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen onComplete={() => {}} />);

    await interact(() =>
      user.type(screen.getByPlaceholderText('e.g., Ship the first draft'), 'Raise 25k in sponsorship commitments for June event')
    );
    await interact(() => user.selectOptions(screen.getAllByRole('combobox')[0], 'Fundraising'));

    expect(screen.getByRole('option', { name: 'sponsorship dollars committed' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'sponsorship agreements signed' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'investor meetings completed' })).toBeNull();
  });

  it('tailors non-fundraising target units from goal label intent', async () => {
    const user = userEvent.setup();
    render(<OnboardingScreen onComplete={() => {}} />);

    await interact(() => user.type(screen.getByPlaceholderText('e.g., Ship the first draft'), 'Reach conversational spanish fluency'));
    await interact(() => user.selectOptions(screen.getAllByRole('combobox')[0], 'SkillAcquisition'));

    expect(screen.getByRole('option', { name: 'conversation sessions completed' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'vocabulary sets mastered' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'projects completed' })).toBeNull();
  });
});
