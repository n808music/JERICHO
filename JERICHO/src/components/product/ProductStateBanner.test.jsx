import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProductStateBanner from './ProductStateBanner.jsx';

function makeResolution(overrides = {}) {
  return {
    state: 'READY_TO_ACTIVATE',
    label: 'Ready To Activate',
    reason: 'The Sprint has passed review and can be promoted into the Activated Plan.',
    nextAction: 'Activate the plan.',
    blockingIssues: [],
    readinessSummary: {
      profile: 'READY',
      goal: 'READY',
      schedule: 'PRESENT',
      phase: 'P1',
      today: 'NO_WORK_TODAY',
      planQuality: 'PASS',
      dependencyAudit: 'PASS',
      ownerCoverage: 'PASS',
      gateIntegrity: 'PASS',
      firstExecutableDate: '2026-06-08',
      blockCount: 1054,
    },
    ...overrides,
  };
}

describe('ProductStateBanner', () => {
  it('renders READY_TO_ACTIVATE state with lifecycle detail and readiness summary', () => {
    render(<ProductStateBanner resolution={makeResolution()} />);
    const banner = screen.getByRole('region', { name: /product state banner/i });

    expect(screen.getByRole('heading', { name: /ready to activate/i })).toBeInTheDocument();
    expect(screen.getByText(/the sprint has passed review/i)).toBeInTheDocument();
    expect(within(banner).getByText('Profile')).toBeInTheDocument();
    expect(within(banner).getByText('Goal')).toBeInTheDocument();
    expect(within(banner).getByText('Activated Plan')).toBeInTheDocument();
    expect(within(banner).getByText('Phase')).toBeInTheDocument();
    expect(within(banner).getByText('Today')).toBeInTheDocument();
    expect(within(banner).getByText('Next Action')).toBeInTheDocument();
    expect(within(banner).getByText(/activation readiness/i)).toBeInTheDocument();
    expect(within(banner).getByText('Block Count')).toBeInTheDocument();
    expect(within(banner).getByText('First Executable Date')).toBeInTheDocument();
    expect(within(banner).getByText('Plan Quality')).toBeInTheDocument();
    expect(within(banner).getByText('Dependency Audit')).toBeInTheDocument();
  });

  it('renders ACTIVE_EXECUTION state without blocking issues when none are present', () => {
    render(
      <ProductStateBanner
        resolution={makeResolution({
          state: 'ACTIVE_EXECUTION',
          label: 'Active Execution',
          reason: 'The operating loop has an Activated Plan and can be executed from Today.',
          nextAction: 'Work the current Activated Plan and log execution evidence.',
          readinessSummary: {
            profile: 'READY',
            goal: 'READY',
            schedule: 'ACTIVE',
            phase: 'P1',
            today: 'WORK_PRESENT',
          },
        })}
      />
    );

    expect(screen.getByRole('heading', { name: /active execution/i })).toBeInTheDocument();
    expect(screen.queryByText(/blocking issues/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/activation readiness/i)).not.toBeInTheDocument();
    expect(screen.getByText(/work the current activated plan and log execution evidence/i)).toBeInTheDocument();
  });

  it('renders PLAN_REVIEW_REQUIRED with activation blockers and missing-data tolerance', () => {
    render(
      <ProductStateBanner
        resolution={makeResolution({
          state: 'PLAN_REVIEW_REQUIRED',
          label: 'Plan Review Required',
          reason: 'A generated schedule exists, but review or repair is still required before activation.',
          nextAction: 'Review the plan quality, Sprint fit, and activation readiness.',
          blockingIssues: ['PLAN_REVIEW_REQUIRED', 'PLAN_QUALITY_GATE_FAILED'],
          readinessSummary: {
            profile: 'READY',
            goal: 'READY',
            schedule: 'GENERATED',
            phase: 'P1',
            today: 'NO_WORK_TODAY',
            planQuality: 'FAIL',
            dependencyAudit: 'PASS',
            ownerCoverage: 'PASS',
            gateIntegrity: 'UNKNOWN',
          },
        })}
      />
    );

    expect(screen.getByRole('heading', { name: /plan review required/i })).toBeInTheDocument();
    expect(screen.getByText(/activation blockers/i)).toBeInTheDocument();
    expect(screen.getByText('plan review required')).toBeInTheDocument();
    expect(screen.getByText('plan quality gate failed')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders COURSE_CORRECTION_REQUIRED state and shows blocking issues', () => {
    render(
      <ProductStateBanner
        resolution={makeResolution({
          state: 'COURSE_CORRECTION_REQUIRED',
          label: 'Course Correction Required',
          reason: 'Live execution evidence shows enough missed work to require intervention.',
          nextAction: 'Review the correction signal and adjust the plan or dependencies.',
          blockingIssues: ['COURSE_CORRECTION_REQUIRED', 'dependency_blocked'],
          readinessSummary: {
            profile: 'READY',
            goal: 'READY',
            schedule: 'ACTIVE',
            phase: 'P1',
            today: 'WORK_PRESENT',
            dependencyAudit: 'FAIL',
          },
        })}
      />
    );

    expect(screen.getByRole('heading', { name: /course correction required/i })).toBeInTheDocument();
    expect(screen.getByText(/blocking issues/i)).toBeInTheDocument();
    expect(screen.getByText('course correction required')).toBeInTheDocument();
    expect(screen.getByText('dependency blocked')).toBeInTheDocument();
  });

  it('shows blocking issues only when they are present', () => {
    const { rerender } = render(
      <ProductStateBanner
        resolution={makeResolution({
          blockingIssues: ['PLAN_REVIEW_REQUIRED'],
        })}
      />
    );

    expect(screen.getByText(/activation blockers/i)).toBeInTheDocument();
    expect(screen.getByText('plan review required')).toBeInTheDocument();

    rerender(<ProductStateBanner resolution={makeResolution({ blockingIssues: [] })} />);

    expect(screen.queryByText(/activation blockers/i)).not.toBeInTheDocument();
  });

  it('handles missing optional readiness fields gracefully', () => {
    render(
      <ProductStateBanner
        resolution={makeResolution({
          state: 'ACTIVE_EXECUTION',
          label: 'Active Execution',
          reason: 'The operating loop has an Activated Plan and can be executed from Today.',
          nextAction: 'Work the current Activated Plan and log execution evidence.',
          readinessSummary: {
            profile: 'READY',
            goal: 'READY',
            schedule: 'PRESENT',
          },
        })}
      />
    );
    const banner = screen.getByRole('region', { name: /product state banner/i });

    expect(within(banner).getAllByText('READY')).toHaveLength(2);
    expect(within(banner).getByText('PRESENT')).toBeInTheDocument();
    expect(within(banner).getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText(/activation readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/readiness indicators/i)).not.toBeInTheDocument();
  });
});
