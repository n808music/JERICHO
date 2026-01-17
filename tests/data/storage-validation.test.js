import { safeReadState } from '../../src/data/storage.js';
import { promises as fs } from 'fs';
import path from 'path';

const TEST_STATE_PATH = path.join(process.cwd(), 'src', 'data', 'state_test_validation.json');

describe('storage validation integration', () => {
  beforeEach(async () => {
    process.env.STATE_PATH = TEST_STATE_PATH;
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_STATE_PATH);
    } catch (e) { /* ignore */ }
    delete process.env.STATE_PATH;
  });

  it('returns validation errors for invalid state', async () => {
    const invalidState = {
      goals: ['Test'],
      tasks: [{ id: 'task-1', status: 'completed' }],
      history: [], // Missing history entry for completed task
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    await fs.writeFile(TEST_STATE_PATH, JSON.stringify(invalidState));

    const result = await safeReadState({ validate: true });
    expect(result.ok).toBe(true); // File is readable
    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.violations?.length).toBeGreaterThan(0);
  });
});
