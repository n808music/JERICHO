# Contributing to JERICHO

Thank you for your interest in contributing to JERICHO! This guide will help you understand how to contribute effectively.

## Development Principles

### 1. Deterministic Design

All core logic must be deterministic - same input must produce identical output:

- No random numbers in critical paths
- No API calls during plan generation
- Use pure functions wherever possible
- Validate determinism with tests

### 2. Testing First

- Write tests before implementing features
- Ensure 100% test coverage for new code
- Include determinism validation tests
- Performance test time-sensitive operations

### 3. Incremental Development

- Small, focused pull requests
- Each PR should pass all tests
- Use feature branches for development
- Preserve existing functionality

## Getting Started

1. **Fork and Clone**

   ```bash
   git clone <your-fork>
   cd JERICHO
   ```

2. **Setup Development Environment**

   ```bash
   npm install
   npm test  # Verify all tests pass
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Strict type checking enabled
- Prefer explicit types over implicit `any`
- Use interfaces for object shapes

### Naming Conventions

- **Components**: PascalCase (`StructurePageConsolidated`)
- **Functions**: camelCase (`generateAutoDeliverables`)
- **Constants**: UPPER_SNAKE_CASE (`TEMPLATES`)
- **Files**: kebab-case for mixed content, camelCase for modules

### File Organization

```
src/
├── core/           # Core business logic
├── components/     # UI components
├── state/          # State management
└── domain/         # Domain models
```

## Testing Guidelines

### Test Structure

```typescript
// Example test structure
describe('generateAutoDeliverables', () => {
  it('should produce identical results for same input', () => {
    const goal = { goalText: 'Learn TypeScript' };

    const result1 = generateAutoDeliverables(goal);
    const result2 = generateAutoDeliverables(goal);

    expect(JSON.stringify(result1)).toEqual(JSON.stringify(result2));
  });

  it('should handle edge cases gracefully', () => {
    // Test null, empty, special cases
  });
});
```

### Required Test Types

1. **Unit Tests**: Individual function behavior
2. **Integration Tests**: End-to-end flows
3. **Determinism Tests**: Same input → same output
4. **Performance Tests**: Time-sensitive operations

### Test Commands

```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- filename.test  # Run specific file
npm test -- --coverage     # With coverage report
```

## Pull Request Process

### 1. Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] Code follows project conventions
- [ ] Tests cover new functionality
- [ ] Documentation updated if needed
- [ ] No console noise in production code

### 2. PR Template

```markdown
## Description

Brief description of changes and motivation.

## Changes

- What was changed
- Why it was changed
- How it was tested

## Testing

- New tests added: [number]
- All existing tests pass: ✓
- Determinism validated: ✓

## Impact

- Breaking changes: Yes/No
- Performance impact: None/Improved/Regressed
```

### 3. Review Process

- Automated tests must pass
- Code review by maintainers
- Determinism validation
- Performance impact assessment

## Types of Contributions

### 🐛 Bug Fixes

1. Reproduce the issue with a test
2. Fix the underlying cause
3. Ensure no regressions
4. Update documentation if needed

### ✨ New Features

1. Design with determinism in mind
2. Implement core functionality
3. Add comprehensive tests
4. Update relevant documentation

### 📝 Documentation

1. Fix typos and clarify explanations
2. Add missing information
3. Improve code examples
4. Update architectural diagrams

### 🧪 Testing

1. Improve test coverage
2. Add integration tests
3. Performance optimization
4. Test framework improvements

## Development Workflow

### 1. Start Task

```bash
# Create branch
git checkout -b feature/your-feature

# Start with tests
npm test -- --watch
```

### 2. Implement

- Write failing tests first
- Implement minimal solution
- Refactor while keeping tests green
- Validate determinism

### 3. Finalize

```bash
# Run full test suite
npm test

# Check formatting (if configured)
npm run lint  # if available

# Stage and commit
git add .
git commit -m "feat: add mechanism class for XYZ"
```

### 4. Submit

```bash
# Push to fork
git push origin feature/your-feature

# Create pull request
# Fill out PR template
```

## Code Review Guidelines

### For Reviewers

- Check deterministic design principles
- Verify test coverage
- Assess performance impact
- Validate naming conventions
- Check documentation updates

### For Authors

- Respond to all feedback
- Update based on suggestions
- Keep PRs focused and small
- Explain complex decisions

## Common Pitfalls

### ❌ Don't Do This

- Add random numbers to core logic
- Skip tests for "simple" changes
- Use `any` type in TypeScript
- Make large, unrelated changes
- Commit console.log statements

### ✅ Do This Instead

- Use deterministic algorithms
- Test all code paths
- Use explicit type definitions
- Keep PRs focused
- Remove debug code before commit

## Performance Guidelines

### Requirements

- Mechanism class detection: <1ms
- Deliverable generation: <5ms
- Total plan generation: <100ms
- UI interactions: <16ms (60fps)

### Testing Performance

```typescript
it('should generate deliverables within performance threshold', () => {
  const start = performance.now();
  generateAutoDeliverables(goal);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(5); // 5ms threshold
});
```

## Getting Help

### Resources

- [Development Setup](SETUP.md)
- [Testing Guide](TESTING.md)
- [Architecture Documentation](../architecture/)
- [Implementation History](../phases/)

### Communication

- Create GitHub issues for bugs
- Use discussions for questions
- Tag maintainers for urgent issues

## Recognition

Contributors are recognized in:

- README.md contributors section
- Release notes
- Commit attribution

Thank you for contributing to JERICHO! 🎯
