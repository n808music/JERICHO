# Development Documentation

This section contains all documentation for developers working on JERICHO.

## 🚀 Getting Started

- **[Setup Guide](SETUP.md)** - Install and configure development environment
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute effectively
- **[Testing Guide](TESTING.md)** - Testing practices and requirements
- **[CI/CD Configuration](CI-CD.md)** - Continuous integration and deployment
  workflows

## 📋 Quick Reference

### Essential Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm test             # Run all tests (374 tests passing)
npm run build        # Build for production
```

### Project Structure

- `src/core/` - Core business logic (mechanism classes, auto-deliverables)
- `src/components/` - UI components (React)
- `src/state/` - State management and computation
- `src/domain/` - Domain models and business rules

### Key Files

- `src/core/mechanismClass.ts` - Goal classification system
- `src/core/autoDeliverables.ts` - Template-based deliverable generation
- `src/state/identityCompute.js` - State computation and plan generation

## 🧪 Testing

- **374 tests, 89 test files** - All passing
- **96 tests for auto-generation system** (Phase 2)
- **Determinism validation** - Same input → identical output
- **Performance testing** - <1ms mechanism detection, <5ms deliverable
  generation

## 🏗️ Development Principles

### 1. Deterministic Design

All core logic must be deterministic:

- No random numbers in critical paths
- No API calls during plan generation
- Pure functions wherever possible
- Validate with deterministic tests

### 2. Testing First

- Write tests before implementing features
- 100% test coverage required
- Include determinism validation
- Performance test time-sensitive operations

### 3. Incremental Development

- Small, focused pull requests
- Each PR must pass all tests
- Preserve existing functionality
- Use feature branches

## 🔧 Development Workflow

1. **Create feature branch**

   ```bash
   git checkout -b feature/your-feature
   ```

2. **Write tests first**

   ```bash
   npm test -- --watch
   ```

3. **Implement functionality**
   - Follow deterministic design principles
   - Ensure performance requirements met
   - Keep code clean and documented

4. **Validate before PR**
   ```bash
   npm test              # All tests pass
   npm run build         # Build succeeds
   ```

## 📚 Additional Resources

- [Architecture Documentation](../architecture/) - System design and technical
  specs
- [Phase Documentation](../phases/) - Implementation history and progress
- [API Documentation](../api/) - Backend API reference (when available)

## 🤝 Getting Help

- Check existing documentation first
- Review test files for usage examples
- Create GitHub issues for bugs
- Use discussions for questions

## 📊 Current Status

- **Frontend**: React 19.2.1, Vite 7.2.6
- **Tests**: 374 passing, 89 test files
- **Coverage**: 100% (statements, branches, functions, lines)
- **Performance**: All benchmarks met

Happy coding! 🎯
