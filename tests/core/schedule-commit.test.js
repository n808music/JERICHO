import path from 'path';
import { rm } from 'fs/promises';

const tempStore = path.join(process.cwd(), 'tmp-schedule-commit-state.json');
process.env.STATE_PATH = tempStore;

describe('Schedule commit dependency validation', () => {
  let commitScheduleBlocks;
  let validateScheduleProposal;

  beforeAll(async () => {
    const module = await import('../../src/core/schedule-commit.js');
    commitScheduleBlocks = module.commitScheduleBlocks;
    validateScheduleProposal = module.validateScheduleProposal;
  });

  afterEach(async () => {
    try {
      await rm(tempStore);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  });

  it('rejects proposals with transitive dependency violations', async () => {
    const violatingBlocks = [
      {
        blockId: 'b-gate',
        actionId: 'gate',
        status: 'suggested',
        date: '2026-04-20',
        startTime: '10:00',
        endTime: '11:00',
        scheduledDate: '2026-04-20T10:00:00.000Z',
        completionDate: '2026-04-20T11:00:00.000Z',
        directDependencyIds: [],
        transitiveDependencyIds: []
      },
      {
        blockId: 'b-leaf',
        actionId: 'leaf',
        status: 'suggested',
        date: '2026-04-20',
        startTime: '09:00',
        endTime: '10:00',
        scheduledDate: '2026-04-20T09:00:00.000Z',
        completionDate: '2026-04-20T10:00:00.000Z',
        directDependencyIds: ['mid'],
        transitiveDependencyIds: ['mid', 'gate']
      },
      {
        blockId: 'b-mid',
        actionId: 'mid',
        status: 'suggested',
        date: '2026-04-20',
        startTime: '08:00',
        endTime: '09:00',
        scheduledDate: '2026-04-20T08:00:00.000Z',
        completionDate: '2026-04-20T09:00:00.000Z',
        directDependencyIds: ['gate'],
        transitiveDependencyIds: ['gate']
      }
    ];

    const validation = validateScheduleProposal({
      proposedBlocks: violatingBlocks,
      schedulingStatus: 'COMPLETE'
    });
    expect(validation.valid).toBe(false);
    expect(validation.constraintViolations).toHaveLength(2);

    const result = await commitScheduleBlocks(violatingBlocks, { goalId: 'goal-1' }, null);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('DEPENDENCY_ORDER_VIOLATED');
    expect(result.constraintViolations).toHaveLength(2);
  });

  it('rejects a deserialized proposal and preserves dependency ids through JSON round-trip', async () => {
    const proposal = {
      proposedBlocks: [
        {
          blockId: 'b-gate',
          actionId: 'gate',
          status: 'suggested',
          date: '2026-04-20',
          startTime: '10:00',
          endTime: '11:00',
          scheduledDate: '2026-04-20T10:00:00.000Z',
          completionDate: '2026-04-20T11:00:00.000Z',
          directDependencyIds: [],
          transitiveDependencyIds: []
        },
        {
          blockId: 'b-leaf',
          actionId: 'leaf',
          status: 'suggested',
          date: '2026-04-20',
          startTime: '09:00',
          endTime: '10:00',
          scheduledDate: '2026-04-20T09:00:00.000Z',
          completionDate: '2026-04-20T10:00:00.000Z',
          directDependencyIds: ['mid'],
          transitiveDependencyIds: ['mid', 'gate']
        },
        {
          blockId: 'b-mid',
          actionId: 'mid',
          status: 'suggested',
          date: '2026-04-20',
          startTime: '08:00',
          endTime: '09:00',
          scheduledDate: '2026-04-20T08:00:00.000Z',
          completionDate: '2026-04-20T09:00:00.000Z',
          directDependencyIds: ['gate'],
          transitiveDependencyIds: ['gate']
        }
      ],
      schedulingStatus: 'COMPLETE'
    };

    const parsedProposal = JSON.parse(JSON.stringify(proposal));

    expect(parsedProposal.proposedBlocks[1].transitiveDependencyIds).toEqual(['mid', 'gate']);

    const validation = validateScheduleProposal(parsedProposal);
    expect(validation.valid).toBe(false);
    expect(validation.constraintViolations).toHaveLength(2);

    const result = await commitScheduleBlocks(parsedProposal.proposedBlocks, { goalId: 'goal-2' }, null);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('DEPENDENCY_ORDER_VIOLATED');
  });
});
