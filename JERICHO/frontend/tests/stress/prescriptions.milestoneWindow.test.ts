import { describe, expect, it } from 'vitest';
import { computePrescriptions } from '../../src/domain/prescriptions.ts';

describe('prescriptions milestone window', () => {
  it('emits EXTEND_MILESTONE_WINDOW with deterministic extension weeks for lowest slack milestones', () => {
    const bundle = computePrescriptions({
      maxScheduledMinutesPerWeek: 300,
      milestoneWindowSlack: {
        infeasibleMilestonesCount: 2,
        byMilestone: {
          'm-early': { slackMinutes: -150, slackRatio: 0.5 },
          'm-late': { slackMinutes: -620, slackRatio: 0.1 },
          'm-ok': { slackMinutes: 20, slackRatio: 1.1 },
        },
      },
    });

    const ext = bundle.prescriptions.filter((entry) => entry.code === 'EXTEND_MILESTONE_WINDOW');
    expect(bundle.primaryConstraint).toBe('MILESTONE_WINDOW_INFEASIBLE');
    expect(ext).toHaveLength(2);
    expect(ext[0].parameters.milestoneId).toBe('m-late');
    expect(ext[0].parameters.extensionWeeks).toBe(3);
    expect(ext[1].parameters.milestoneId).toBe('m-early');
    expect(ext[1].parameters.extensionWeeks).toBe(1);
  });
});
