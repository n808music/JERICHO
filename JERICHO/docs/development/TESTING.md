# Testing Guide

This guide covers testing practices, patterns, and requirements for JERICHO development.

## Testing Philosophy

JERICHO follows a comprehensive testing approach with three core principles:

1. **Determinism Validation**: Same input must produce identical output
2. **Performance Assurance**: Time-critical operations must meet speed requirements
3. **Complete Coverage**: Every code path must be tested

## Test Structure

### Test Organization

```
src/
├── core/
│   └── __tests__/                    # Core logic tests
│       ├── mechanismClass.test.ts    # Unit tests for goal classification
│       ├── autoDeliverables.test.ts # Unit tests for template generation
│       └── autoGeneration.integration.test.ts # End-to-end tests
├── components/
│   └── __tests__/                    # Component tests (when needed)
└── state/
    └── __tests__/                    # State management tests
```

### Test Categories

#### 1. Unit Tests

- Individual function behavior
- Edge cases and error handling
- Performance validation
- Determinism verification

#### 2. Integration Tests

- End-to-end workflows
- Cross-module interactions
- Real-world scenarios
- Full system behavior

#### 3. Performance Tests

- Time-critical operations
- Batch processing
- Memory usage validation
- Load testing scenarios

## Test Patterns

### Determinism Testing

Every core function must prove deterministic behavior:

```typescript
describe('generateAutoDeliverables', () => {
  it('should produce identical results for same input', () => {
    const goal = { goalText: 'Learn TypeScript' };

    const result1 = generateAutoDeliverables(goal);
    const result2 = generateAutoDeliverables(goal);
    const result3 = generateAutoDeliverables(goal);

    // Deep equality ensures identical structure and values
    expect(JSON.stringify(result1)).toEqual(JSON.stringify(result2));
    expect(JSON.stringify(result2)).toEqual(JSON.stringify(result3));
  });
});
```

### Performance Testing

Time-sensitive operations must meet performance thresholds:

```typescript
describe('Performance Tests', () => {
  it('should detect mechanism class within 1ms', () => {
    const goal = { goalText: 'Build a React app' };

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      deriveMechanismClass(goal);
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1); // <1ms for 1000 iterations
  });

  it('should generate deliverables within 5ms', () => {
    const goal = { goalText: 'Publish my music' };

    const start = performance.now();
    generateAutoDeliverables(goal);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5); // <5ms threshold
  });
});
```

### Edge Case Testing

Handle all possible input scenarios:

```typescript
describe('Edge Cases', () => {
  it('should handle null and undefined inputs', () => {
    expect(() => deriveMechanismClass(null)).not.toThrow();
    expect(() => deriveMechanismClass(undefined)).not.toThrow();
  });

  it('should handle empty and special character inputs', () => {
    expect(deriveMechanismClass({})).toBeDefined();
    expect(deriveMechanismClass({ goalText: '' })).toBeDefined();
    expect(deriveMechanismClass({ goalText: '!@#$%' })).toBeDefined();
  });

  it('should handle very long inputs', () => {
    const longText = 'a'.repeat(10000);
    expect(() => deriveMechanismClass({ goalText: longText })).not.toThrow();
  });
});
```

### Integration Testing

Test complete workflows:

```typescript
describe('Integration Tests', () => {
  it('should complete full auto-generation flow', () => {
    const goal = {
      goalId: 'test-goal-123',
      terminalOutcome: { text: 'Publish my music to Spotify' },
      deadlineISO: '2025-03-31T23:59:59Z'
    };

    // 1. Derive mechanism class
    const mechanism = deriveMechanismClass(goal);
    expect(mechanism).toBe('PUBLISH');

    // 2. Generate deliverables
    const deliverables = generateAutoDeliverables(goal);
    expect(deliverables).toHaveLength(4);
    expect(totalAutoBlocksRequired(goal)).toBe(14);

    // 3. Verify determinism
    const deliverables2 = generateAutoDeliverables(goal);
    expect(JSON.stringify(deliverables)).toEqual(JSON.stringify(deliverables2));

    // 4. Verify all deliverables have valid structure
    deliverables.forEach((d, i) => {
      expect(d.id).toBe(`auto-PUBLISH-${i}`);
      expect(d.title).toContain('music');
      expect(d.requiredBlocks).toBeGreaterThan(0);
    });
  });
});
```

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/core/__tests__/mechanismClass.test.ts

# Run tests matching pattern
npm test -- --grep "determinism"

# Run tests with coverage
npm test -- --coverage
```

### Advanced Usage

```bash
# Run tests for changed files only
npm test -- --changed

# Run tests with specific reporter
npm test -- --reporter=verbose

# Run tests with timeout override
npm test -- --timeout=10000

# Debug tests
node --inspect-brk node_modules/.bin/vitest run
```

## Test Requirements

### Coverage Requirements

- **Statements**: 100%
- **Branches**: 100%
- **Functions**: 100%
- **Lines**: 100%

### Test Categories by Module

#### Core Logic Tests (96 tests)

- **mechanismClass.test.ts** (35 tests)
  - All 6 mechanism types
  - Keyword detection
  - Case insensitivity
  - Pattern priority
  - Determinism validation
- **autoDeliverables.test.ts** (24 tests)
  - Deliverable generation per mechanism
  - Structure validation
  - ID uniqueness
  - Outcome substitution
  - Edge case handling
- **autoGeneration.integration.test.ts** (37 tests)
  - End-to-end flows
  - Performance validation
  - Acceptance criteria
  - Real-world scenarios

### Performance Benchmarks

- **Mechanism Detection**: <1ms
- **Deliverable Generation**: <5ms
- **Full Plan Generation**: <100ms
- **UI Interactions**: <16ms (60fps)

## Writing New Tests

### Test File Template

```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from '../yourModule';

describe('yourFunction', () => {
  // Basic functionality
  it('should handle normal inputs', () => {
    const result = yourFunction({ normalInput: 'value' });
    expect(result).toBeDefined();
  });

  // Determinism is required for all core functions
  it('should be deterministic', () => {
    const input = { test: 'input' };

    const result1 = yourFunction(input);
    const result2 = yourFunction(input);
    const result3 = yourFunction(input);

    expect(JSON.stringify(result1)).toEqual(JSON.stringify(result2));
    expect(JSON.stringify(result2)).toEqual(JSON.stringify(result3));
  });

  // Performance if time-sensitive
  it('should meet performance requirements', () => {
    const input = { test: 'input' };

    const start = performance.now();
    yourFunction(input);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // Adjust threshold as needed
  });

  // Edge cases
  it('should handle edge cases gracefully', () => {
    expect(() => yourFunction(null)).not.toThrow();
    expect(() => yourFunction(undefined)).not.toThrow();
    expect(() => yourFunction({})).not.toThrow();
  });
});
```

### Test Data Management

```typescript
// Test fixtures
const TEST_GOALS = {
  CREATE: { goalText: 'Build a React dashboard' },
  PUBLISH: { goalText: 'Publish my music to Spotify' },
  MARKET: { goalText: 'Grow user base by 20%' },
  LEARN: { goalText: 'Learn TypeScript fundamentals' },
  OPS: { goalText: 'Setup CI/CD pipeline' },
  REVIEW: { goalText: 'Review and optimize codebase' }
};

// Helper functions
function createTestGoal(overrides = {}) {
  return {
    goalId: 'test-goal-123',
    goalText: 'Test goal',
    deadlineISO: '2025-12-31T23:59:59Z',
    ...overrides
  };
}
```

## Debugging Tests

### Common Issues

1. **Non-deterministic behavior**: Check for random numbers, dates, or external calls
2. **Performance failures**: Profile with `console.time()` or browser dev tools
3. **Async issues**: Ensure proper await/async usage

### Debugging Techniques

```typescript
// Debug individual test
it.only('debugging this test', () => {
  console.log('Debug info:', someValue);
  // Test logic
});

// Performance debugging
it('performance debug', () => {
  console.time('function-name');
  const result = yourFunction(input);
  console.timeEnd('function-name');
  console.log('Result:', result);
});

// Determinism debugging
it('determinism debug', () => {
  const result1 = yourFunction(input);
  const result2 = yourFunction(input);

  console.log('Result 1:', JSON.stringify(result1, null, 2));
  console.log('Result 2:', JSON.stringify(result2, null, 2));
  console.log('Equal:', JSON.stringify(result1) === JSON.stringify(result2));
});
```

## Continuous Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test && npm run lint"
    }
  }
}
```

## Best Practices

### ✅ Do This

- Test every code path
- Validate determinism for core functions
- Include performance tests for time-sensitive code
- Use descriptive test names
- Keep tests focused and independent
- Use helpers for common test patterns

### ❌ Avoid This

- Skip tests for "simple" functions
- Use random data in deterministic functions
- Make tests depend on each other
- Ignore performance requirements
- Write tests that are too broad or unclear

Remember: Tests are not just about catching bugs - they're about ensuring deterministic, performant, and reliable behavior across all scenarios.
