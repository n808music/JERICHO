# Development Setup

This guide will help you set up your development environment for JERICHO.

## Prerequisites

- Node.js 18+
- npm or yarn
- Git
- VS Code (recommended)

## Quick Setup

```bash
# Clone the repository
git clone <repository-url>
cd JERICHO

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests to verify setup
npm test
```

## Development Workflow

### 1. Start Development

```bash
# Start frontend dev server (http://localhost:5173)
npm run dev

# Start backend server (if using local backend)
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Testing

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/core/__tests__/mechanismClass.test.ts

# Run tests with coverage
npm test -- --coverage
```

### 3. Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
JERICHO/
├── src/                          # Frontend source code
│   ├── core/                     # Core logic and utilities
│   │   ├── mechanismClass.ts     # Goal classification system
│   │   ├── autoDeliverables.ts   # Template-based deliverable generation
│   │   └── __tests__/            # Core logic tests
│   ├── components/               # React components
│   │   └── zion/                 # Main UI components
│   ├── state/                    # State management
│   │   ├── identityStore.js      # Main state store
│   │   └── identityCompute.js    # State computation logic
│   └── domain/                   # Domain models and logic
├── backend/                      # Backend API (FastAPI)
├── docs/                         # Documentation
│   ├── development/              # Development docs
│   ├── architecture/             # System architecture
│   ├── phases/                   # Implementation history
│   └── api/                      # API documentation
└── public/                       # Static assets
```

## Key Development Concepts

### Mechanism Classes

Goals are automatically classified into 6 mechanism types:

- **CREATE**: Building new things
- **PUBLISH**: Releasing content/software
- **MARKET**: Marketing and growth initiatives
- **LEARN**: Learning and skill development
- **OPS**: Operations and infrastructure
- **REVIEW**: Analysis, audit, and optimization

### Deterministic Design

All core logic must be deterministic - same input produces same output:

- No random number generation in critical paths
- No API calls in plan generation (use keyword matching)
- All randomness must be isolated to UI layer

### Testing Philosophy

- Comprehensive test coverage (374 tests, 89 files)
- Determinism testing: same input → identical output
- Performance testing: validate speed requirements
- Integration testing: end-to-end flows

## Development Tools

### VS Code Extensions (Recommended)

- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- Vitest (for test runner integration)
- TypeScript Importer

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Write tests for all new functionality
- Maintain deterministic design principles

## Common Development Tasks

### Adding a New Mechanism Class

1. Update `src/core/mechanismClass.ts` with new type
2. Add keyword patterns for detection
3. Update `src/core/autoDeliverables.ts` with templates
4. Write tests in `__tests__` directory
5. Update integration tests

### Modifying Deliverable Templates

1. Edit `TEMPLATES` object in `src/core/autoDeliverables.ts`
2. Update test expectations in `autoDeliverables.test.ts`
3. Run integration tests to verify flows

### Adding New Tests

1. Create test file in appropriate `__tests__` directory
2. Follow existing test patterns
3. Include determinism validation where applicable
4. Verify all tests pass (`npm test`)

## Troubleshooting

### Common Issues

- **Tests failing**: Check for deterministic violations
- **Build errors**: Verify TypeScript types and imports
- **Dev server issues**: Clear cache with `rm -rf node_modules && npm install`

### Getting Help

- Check existing documentation in `/docs/`
- Review test files for usage examples
- Check phase implementation documents for context
- Review authority maps for architectural guidance

## Environment Variables

Create `.env.local` for development:

```bash
# API Configuration
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=5000

# Feature Flags
VITE_ENABLE_DEBUG=true
VITE_ENABLE_CONSOLE_LOGS=true
```

## Next Steps

1. Read the [Contributing Guidelines](CONTRIBUTING.md)
2. Review the [Testing Guide](TESTING.md)
3. Explore [Architecture Documentation](../architecture/)
4. Check [Implementation History](../phases/) for context
