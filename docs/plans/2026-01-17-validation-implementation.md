# Validation Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement comprehensive validation for Jericho state, invariants, and pipeline with health reporting.

**Architecture:** Five-layer validation: (1) Schema validators for entity shapes, (2) Invariant assertions for business rules, (3) Pipeline guards for pre/post conditions, (4) Storage integration for quarantine, (5) Health endpoint for reporting.

**Tech Stack:** JavaScript/ES Modules, Jest for testing, existing storage.js and state-validator.js patterns.

---

## Task 1: Extend Schema Validators - Task Entity

**Files:**
- Modify: `src/core/state-validator.js`
- Modify: `tests/core/state-validator.test.js`

**Step 1: Write failing test for task schema validation**

Add to `tests/core/state-validator.test.js`:

```javascript
describe('validateTask', () => {
  it('accepts a valid task', () => {
    const task = {
      id: 'task-1',
      title: 'Test task',
      domain: 'focus',
      capability: 'deep-work',
      status: 'pending',
      dueDate: '2026-01-20T00:00:00.000Z',
      createdAt: '2026-01-17T00:00:00.000Z'
    };
    const result = validateTask(task);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects task with missing required fields', () => {
    const task = { title: 'No ID' };
    const result = validateTask(task);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('task_missing_id');
    expect(result.errors).toContain('task_missing_domain');
    expect(result.errors).toContain('task_missing_status');
  });

  it('rejects task with invalid status enum', () => {
    const task = {
      id: 'task-1',
      title: 'Test',
      domain: 'focus',
      capability: 'deep-work',
      status: 'invalid_status'
    };
    const result = validateTask(task);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('task_invalid_status');
  });
});
```

Update import at top:
```javascript
import { validateState, validateTask } from '../../src/core/state-validator.js';
```

**Step 2: Run test to verify it fails**

```bash
cd /Volumes/Containers/jericho/.worktrees/validation
npm test -- --testPathPattern="state-validator" -t "validateTask"
```

Expected: FAIL - `validateTask is not a function`

**Step 3: Write minimal implementation**

Add to `src/core/state-validator.js`:

```javascript
const VALID_TASK_STATUSES = ['pending', 'completed', 'missed'];

export function validateTask(task) {
  const errors = [];

  if (!task || typeof task !== 'object') {
    return { ok: false, errors: ['task_invalid'] };
  }

  if (!task.id || typeof task.id !== 'string') {
    errors.push('task_missing_id');
  }
  if (!task.domain || typeof task.domain !== 'string') {
    errors.push('task_missing_domain');
  }
  if (!task.status) {
    errors.push('task_missing_status');
  } else if (!VALID_TASK_STATUSES.includes(task.status)) {
    errors.push('task_invalid_status');
  }

  return { ok: errors.length === 0, errors };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="state-validator" -t "validateTask"
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/core/state-validator.js tests/core/state-validator.test.js
git commit -m "feat(validation): add validateTask schema validator"
```

---

## Task 2: Extend Schema Validators - History Entry Entity

**Files:**
- Modify: `src/core/state-validator.js`
- Modify: `tests/core/state-validator.test.js`

**Step 1: Write failing test for history entry validation**

Add to `tests/core/state-validator.test.js`:

```javascript
describe('validateHistoryEntry', () => {
  it('accepts a valid task record entry', () => {
    const entry = {
      id: 'task-1',
      taskId: 'task-1',
      domain: 'focus',
      capability: 'deep-work',
      status: 'completed',
      timestamp: '2026-01-17T12:00:00.000Z'
    };
    const result = validateHistoryEntry(entry);
    expect(result.ok).toBe(true);
  });

  it('accepts a valid cycle snapshot entry', () => {
    const entry = {
      timestamp: '2026-01-17T12:00:00.000Z',
      goalId: 'goal-1',
      integrity: { score: 50 },
      identityBefore: [],
      identityAfter: [],
      changes: []
    };
    const result = validateHistoryEntry(entry);
    expect(result.ok).toBe(true);
  });

  it('rejects entry missing timestamp', () => {
    const entry = { id: 'task-1', status: 'completed' };
    const result = validateHistoryEntry(entry);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('history_missing_timestamp');
  });
});
```

Update import:
```javascript
import { validateState, validateTask, validateHistoryEntry } from '../../src/core/state-validator.js';
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="state-validator" -t "validateHistoryEntry"
```

Expected: FAIL - `validateHistoryEntry is not a function`

**Step 3: Write minimal implementation**

Add to `src/core/state-validator.js`:

```javascript
export function validateHistoryEntry(entry) {
  const errors = [];

  if (!entry || typeof entry !== 'object') {
    return { ok: false, errors: ['history_invalid'] };
  }

  if (!entry.timestamp || typeof entry.timestamp !== 'string') {
    errors.push('history_missing_timestamp');
  }

  // Detect entry type: task record has taskId, cycle snapshot has goalId
  const isTaskRecord = 'taskId' in entry || 'id' in entry;
  const isCycleSnapshot = 'goalId' in entry;

  if (isTaskRecord && !isCycleSnapshot) {
    if (!entry.status || !VALID_TASK_STATUSES.includes(entry.status)) {
      errors.push('history_invalid_status');
    }
  }

  return { ok: errors.length === 0, errors };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="state-validator" -t "validateHistoryEntry"
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/core/state-validator.js tests/core/state-validator.test.js
git commit -m "feat(validation): add validateHistoryEntry schema validator"
```

---

## Task 3: Create Invariant Checker Module

**Files:**
- Create: `src/core/validation/invariants.js`
- Create: `tests/core/validation/invariants.test.js`

**Step 1: Write failing test for task-history consistency invariant**

Create `tests/core/validation/invariants.test.js`:

```javascript
import { checkInvariants } from '../../../src/core/validation/invariants.js';

describe('checkInvariants', () => {
  it('passes when completed tasks have history entries', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'completed' }],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails when completed task has no history entry', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'completed' }],
      history: [],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.valid).toBe(false);
    expect(result.violations[0].invariant).toBe('INV-001');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="invariants"
```

Expected: FAIL - Cannot find module

**Step 3: Create directory and write minimal implementation**

```bash
mkdir -p src/core/validation
mkdir -p tests/core/validation
```

Create `src/core/validation/invariants.js`:

```javascript
/**
 * Check all state invariants.
 * @param {object} state - The full application state
 * @returns {{ valid: boolean, violations: Array<{ invariant: string, message: string, context: object }> }}
 */
export function checkInvariants(state) {
  const violations = [];

  // INV-001: Task-History Consistency
  const completedTasks = (state.tasks || []).filter(t => t.status === 'completed' || t.status === 'missed');
  for (const task of completedTasks) {
    const hasHistoryEntry = (state.history || []).some(h => h.taskId === task.id || h.id === task.id);
    if (!hasHistoryEntry) {
      violations.push({
        invariant: 'INV-001',
        message: `Completed/missed task "${task.id}" has no history entry`,
        context: { taskId: task.id, status: task.status }
      });
    }
  }

  return { valid: violations.length === 0, violations };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="invariants"
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/core/validation/invariants.js tests/core/validation/invariants.test.js
git commit -m "feat(validation): add INV-001 task-history consistency invariant"
```

---

## Task 4: Add Integrity Count Coherence Invariant

**Files:**
- Modify: `src/core/validation/invariants.js`
- Modify: `tests/core/validation/invariants.test.js`

**Step 1: Write failing test for integrity count coherence**

Add to `tests/core/validation/invariants.test.js`:

```javascript
describe('INV-002: Integrity count coherence', () => {
  it('passes when counts match task statuses', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'pending' }
      ],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 1, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-002')).toEqual([]);
  });

  it('fails when completedCount does not match', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'pending' }
      ],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 5, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.invariant === 'INV-002')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="invariants" -t "INV-002"
```

Expected: FAIL - no violations found

**Step 3: Add invariant implementation**

Add to `checkInvariants` function in `src/core/validation/invariants.js`:

```javascript
  // INV-002: Integrity Score Coherence
  const tasks = state.tasks || [];
  const actualCompleted = tasks.filter(t => t.status === 'completed').length;
  const actualPending = tasks.filter(t => t.status === 'pending').length;
  const integrity = state.integrity || {};

  if (integrity.completedCount !== undefined && integrity.completedCount !== actualCompleted) {
    violations.push({
      invariant: 'INV-002',
      message: `completedCount (${integrity.completedCount}) does not match actual completed tasks (${actualCompleted})`,
      context: { expected: actualCompleted, actual: integrity.completedCount }
    });
  }

  if (integrity.pendingCount !== undefined && integrity.pendingCount !== actualPending) {
    violations.push({
      invariant: 'INV-002',
      message: `pendingCount (${integrity.pendingCount}) does not match actual pending tasks (${actualPending})`,
      context: { expected: actualPending, actual: integrity.pendingCount }
    });
  }
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="invariants" -t "INV-002"
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/core/validation/invariants.js tests/core/validation/invariants.test.js
git commit -m "feat(validation): add INV-002 integrity count coherence invariant"
```

---

## Task 5: Add No Orphaned References Invariant

**Files:**
- Modify: `src/core/validation/invariants.js`
- Modify: `tests/core/validation/invariants.test.js`

**Step 1: Write failing test for orphaned references**

Add to `tests/core/validation/invariants.test.js`:

```javascript
describe('INV-003: No orphaned references', () => {
  it('passes when task.goalLink references existing goal', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'pending', goalLink: 'Test goal' }],
      history: [],
      goals: ['Test goal'],
      integrity: { score: 0, completedCount: 0, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-003')).toEqual([]);
  });

  it('fails when task.goalLink references non-existent goal', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'pending', goalLink: 'Non-existent goal' }],
      history: [],
      goals: ['Different goal'],
      integrity: { score: 0, completedCount: 0, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.some(v => v.invariant === 'INV-003')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="invariants" -t "INV-003"
```

Expected: FAIL - no violations found

**Step 3: Add invariant implementation**

Add to `checkInvariants` function in `src/core/validation/invariants.js`:

```javascript
  // INV-003: No Orphaned References
  const goals = state.goals || [];
  const goalStrings = goals.map(g => typeof g === 'string' ? g : g?.raw || g?.text || '');

  for (const task of tasks) {
    if (task.goalLink && !goalStrings.includes(task.goalLink)) {
      violations.push({
        invariant: 'INV-003',
        message: `Task "${task.id}" references non-existent goal "${task.goalLink}"`,
        context: { taskId: task.id, goalLink: task.goalLink, availableGoals: goalStrings }
      });
    }
  }
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="invariants" -t "INV-003"
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/core/validation/invariants.js tests/core/validation/invariants.test.js
git commit -m "feat(validation): add INV-003 no orphaned references invariant"
```

---

## Task 6: Add Identity Level Bounds Invariant

**Files:**
- Modify: `src/core/validation/invariants.js`
- Modify: `tests/core/validation/invariants.test.js`

**Step 1: Write failing test for identity level bounds**

Add to `tests/core/validation/invariants.test.js`:

```javascript
describe('INV-004: Identity level bounds', () => {
  it('passes when all levels are 1-5', () => {
    const state = {
      tasks: [],
      history: [],
      goals: [],
      identity: {
        focus: { 'deep-work': { level: 3 } },
        health: { 'movement': { level: 5 } }
      },
      integrity: { score: 0, completedCount: 0, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-004')).toEqual([]);
  });

  it('fails when level is out of bounds', () => {
    const state = {
      tasks: [],
      history: [],
      goals: [],
      identity: {
        focus: { 'deep-work': { level: 10 } }
      },
      integrity: { score: 0, completedCount: 0, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.violations.some(v => v.invariant === 'INV-004')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="invariants" -t "INV-004"
```

Expected: FAIL - no violations found

**Step 3: Add invariant implementation**

Add to `checkInvariants` function in `src/core/validation/invariants.js`:

```javascript
  // INV-004: Identity Level Bounds
  const identity = state.identity || {};
  for (const [domain, capabilities] of Object.entries(identity)) {
    if (typeof capabilities !== 'object' || capabilities === null) continue;
    for (const [capability, data] of Object.entries(capabilities)) {
      const level = data?.level;
      if (level !== undefined && (typeof level !== 'number' || level < 1 || level > 5 || !Number.isInteger(level))) {
        violations.push({
          invariant: 'INV-004',
          message: `Identity level for ${domain}.${capability} is out of bounds: ${level}`,
          context: { domain, capability, level }
        });
      }
    }
  }
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="invariants" -t "INV-004"
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/core/validation/invariants.js tests/core/validation/invariants.test.js
git commit -m "feat(validation): add INV-004 identity level bounds invariant"
```

---

## Task 7: Add No Duplicate IDs Invariant

**Files:**
- Modify: `src/core/validation/invariants.js`
- Modify: `tests/core/validation/invariants.test.js`

**Step 1: Write failing test for duplicate IDs**

Add to `tests/core/validation/invariants.test.js`:

```javascript
describe('INV-006: No duplicate IDs', () => {
  it('passes when all task IDs are unique', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'pending' },
        { id: 'task-2', status: 'pending' }
      ],
      history: [],
      goals: [],
      integrity: { score: 0, completedCount: 0, pendingCount: 2 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-006')).toEqual([]);
  });

  it('fails when duplicate task IDs exist', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'pending' },
        { id: 'task-1', status: 'completed' }
      ],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: [],
      integrity: { score: 0, completedCount: 1, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.some(v => v.invariant === 'INV-006')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="invariants" -t "INV-006"
```

Expected: FAIL - no violations found

**Step 3: Add invariant implementation**

Add to `checkInvariants` function in `src/core/validation/invariants.js`:

```javascript
  // INV-006: No Duplicate IDs
  const taskIds = tasks.map(t => t.id).filter(Boolean);
  const seenTaskIds = new Set();
  for (const id of taskIds) {
    if (seenTaskIds.has(id)) {
      violations.push({
        invariant: 'INV-006',
        message: `Duplicate task ID: "${id}"`,
        context: { id }
      });
    }
    seenTaskIds.add(id);
  }
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="invariants" -t "INV-006"
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/core/validation/invariants.js tests/core/validation/invariants.test.js
git commit -m "feat(validation): add INV-006 no duplicate IDs invariant"
```

---

## Task 8: Integrate Validation into Storage - safeReadState

**Files:**
- Modify: `src/data/storage.js`
- Create: `tests/data/storage-validation.test.js`

**Step 1: Write failing test for validated state read**

Create `tests/data/storage-validation.test.js`:

```javascript
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
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="storage-validation"
```

Expected: FAIL - validation property undefined

**Step 3: Modify storage.js to support validation**

Add import at top of `src/data/storage.js`:

```javascript
import { checkInvariants } from '../core/validation/invariants.js';
```

Modify `safeReadState` function:

```javascript
export async function safeReadState(options = {}) {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    const state = buildState(JSON.parse(raw));

    if (options.validate) {
      const validation = checkInvariants(state);
      return { ok: true, state, validation };
    }

    return { ok: true, state };
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeState(defaultState);
      const validation = options.validate ? checkInvariants(defaultState) : undefined;
      return { ok: true, state: defaultState, validation };
    }
    if (err instanceof SyntaxError) {
      return { ok: false, errorCode: 'BAD_STATE', reason: 'State file is not valid JSON.' };
    }
    return { ok: false, errorCode: 'BAD_STATE', reason: err.message || 'State read failed.' };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="storage-validation"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/data/storage.js tests/data/storage-validation.test.js
git commit -m "feat(validation): integrate invariant checking into safeReadState"
```

---

## Task 9: Create Health Check Module

**Files:**
- Create: `src/core/validation/health.js`
- Create: `tests/core/validation/health.test.js`

**Step 1: Write failing test for health check**

Create `tests/core/validation/health.test.js`:

```javascript
import { aggregateHealthCheck } from '../../../src/core/validation/health.js';

describe('aggregateHealthCheck', () => {
  it('returns healthy when all checks pass', () => {
    const state = {
      goals: ['Test goal'],
      tasks: [{ id: 'task-1', status: 'pending', goalLink: 'Test goal' }],
      history: [],
      integrity: { score: 0, completedCount: 0, pendingCount: 1 }
    };
    const result = aggregateHealthCheck(state);
    expect(result.status).toBe('healthy');
    expect(result.checks.stateSchema.valid).toBe(true);
    expect(result.checks.invariants.valid).toBe(true);
  });

  it('returns unhealthy when invariants fail', () => {
    const state = {
      goals: ['Test goal'],
      tasks: [{ id: 'task-1', status: 'completed' }], // No history entry
      history: [],
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    const result = aggregateHealthCheck(state);
    expect(result.status).toBe('unhealthy');
    expect(result.checks.invariants.valid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="health"
```

Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `src/core/validation/health.js`:

```javascript
import { validateState } from '../state-validator.js';
import { checkInvariants } from './invariants.js';

/**
 * Aggregate all validation checks into a health report.
 * @param {object} state - The full application state
 * @returns {{ status: 'healthy' | 'degraded' | 'unhealthy', timestamp: string, checks: object }}
 */
export function aggregateHealthCheck(state) {
  const timestamp = new Date().toISOString();

  const schemaResult = validateState(state);
  const invariantResult = checkInvariants(state);

  const checks = {
    stateSchema: {
      valid: schemaResult.ok,
      errors: schemaResult.errors || []
    },
    invariants: {
      valid: invariantResult.valid,
      violations: invariantResult.violations || []
    }
  };

  const allValid = checks.stateSchema.valid && checks.invariants.valid;
  const status = allValid ? 'healthy' : 'unhealthy';

  return { status, timestamp, checks };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="health"
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/core/validation/health.js tests/core/validation/health.test.js
git commit -m "feat(validation): add aggregateHealthCheck for health reporting"
```

---

## Task 10: Create Health API Endpoint

**Files:**
- Modify: `src/api/server.js`
- Create: `tests/api/health.test.js`

**Step 1: Write failing test for health endpoint**

Create `tests/api/health.test.js`:

```javascript
import { createServer } from '../../src/api/server.js';

describe('GET /api/health', () => {
  let server;

  beforeAll(() => {
    server = createServer();
  });

  afterAll(() => {
    server?.close?.();
  });

  it('returns health status', async () => {
    const response = await fetch('http://localhost:3000/api/health');
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('checks');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="tests/api/health"
```

Expected: FAIL - 404 or endpoint not found

**Step 3: Read current server.js structure first**

Read `src/api/server.js` to understand existing patterns before modifying.

**Step 4: Add health endpoint (implementation depends on server structure)**

Add import:
```javascript
import { aggregateHealthCheck } from '../core/validation/health.js';
import { safeReadState } from '../data/storage.js';
```

Add route handler (adjust based on existing server pattern):
```javascript
// Health check endpoint
app.get('/api/health', async (req, res) => {
  const { state } = await safeReadState();
  const health = aggregateHealthCheck(state);
  res.json(health);
});
```

**Step 5: Run test to verify it passes**

```bash
npm test -- --testPathPattern="tests/api/health"
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/api/server.js tests/api/health.test.js
git commit -m "feat(validation): add /api/health endpoint for health reporting"
```

---

## Task 11: Create CLI Validation Command

**Files:**
- Create: `scripts/validate.js`
- Modify: `package.json`

**Step 1: Create validation script**

Create `scripts/validate.js`:

```javascript
#!/usr/bin/env node
import { safeReadState } from '../src/data/storage.js';
import { aggregateHealthCheck } from '../src/core/validation/health.js';

async function main() {
  console.log('Running validation checks...\n');

  const { ok, state, errorCode, reason } = await safeReadState();

  if (!ok) {
    console.error(`\u2717 State read failed: ${reason}`);
    process.exit(1);
  }

  const health = aggregateHealthCheck(state);

  console.log(`Status: ${health.status.toUpperCase()}`);
  console.log(`Timestamp: ${health.timestamp}\n`);

  // Schema check
  const schema = health.checks.stateSchema;
  console.log(`Schema Validation: ${schema.valid ? '\u2713 PASS' : '\u2717 FAIL'}`);
  if (!schema.valid) {
    schema.errors.forEach(e => console.log(`  - ${e}`));
  }

  // Invariants check
  const inv = health.checks.invariants;
  console.log(`Invariant Checks: ${inv.valid ? '\u2713 PASS' : '\u2717 FAIL'}`);
  if (!inv.valid) {
    inv.violations.forEach(v => console.log(`  - [${v.invariant}] ${v.message}`));
  }

  console.log('');
  process.exit(health.status === 'healthy' ? 0 : 1);
}

main().catch(err => {
  console.error('Validation failed:', err.message);
  process.exit(1);
});
```

**Step 2: Add npm script to package.json**

Add to `scripts` section in `package.json`:
```json
"validate": "node scripts/validate.js"
```

**Step 3: Test the command manually**

```bash
npm run validate
```

Expected: Output showing validation status, exit code 0 if healthy

**Step 4: Commit**

```bash
git add scripts/validate.js package.json
git commit -m "feat(validation): add npm run validate CLI command"
```

---

## Task 12: Run Full Test Suite and Verify

**Files:** None (verification only)

**Step 1: Run full test suite**

```bash
npm test -- --testPathIgnorePatterns="JERICHO"
```

Expected: All tests pass, including new validation tests

**Step 2: Run validation on state_good.json**

```bash
STATE_PATH=src/data/state_good.json npm run validate
```

Expected: Status HEALTHY, exit code 0

**Step 3: Run validation on state_broken.json**

```bash
STATE_PATH=src/data/state_broken.json npm run validate
```

Expected: Status UNHEALTHY or error (broken state detected)

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(validation): address test failures from full suite"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | validateTask schema | state-validator.js |
| 2 | validateHistoryEntry schema | state-validator.js |
| 3 | INV-001 task-history consistency | validation/invariants.js |
| 4 | INV-002 integrity count coherence | validation/invariants.js |
| 5 | INV-003 no orphaned references | validation/invariants.js |
| 6 | INV-004 identity level bounds | validation/invariants.js |
| 7 | INV-006 no duplicate IDs | validation/invariants.js |
| 8 | Storage integration | storage.js |
| 9 | Health check module | validation/health.js |
| 10 | Health API endpoint | api/server.js |
| 11 | CLI validate command | scripts/validate.js |
| 12 | Full verification | (all) |
