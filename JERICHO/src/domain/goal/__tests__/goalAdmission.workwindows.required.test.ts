import { describe, expect, it } from 'vitest';
import { validateGoalAdmission } from '../GoalAdmissionPolicy';
import { GoalRejectionCode } from '../GoalRejectionCode';
import { buildValidGoalContract } from '../testHelpers';

describe('GoalAdmissionPolicy - work windows requirement', () => {
  it('rejects admission when workWindows has no valid windows', () => {
    const contract = buildValidGoalContract({
      workWindows: {
        mon: [],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    });

    const result = validateGoalAdmission(contract, '2026-01-10T12:00:00.000Z');

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes).toContain(GoalRejectionCode.NO_WORK_WINDOWS);
  });
});
