# AGENTS.md

This file contains guidelines and commands for agentic coding agents working in the Jericho repository.

## Build/Lint/Test Commands

### Primary Commands (JERICHO directory)

- `npm run dev` - Start development server (API + client concurrently)
- `npm run build` - Build for production (runs lint → test → build)
- `npm run test` - Run all tests with Vitest
- `npm run test:watch` - Run tests in watch mode with Vitest
- `npm run lint` - Run ESLint on src and tests directories
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run check-all` - Run lint → format:check → test
- `npm run typecheck` - TypeScript type checking (currently returns success)

### Running Single Tests

Use Vitest's file filtering:

- `npm run test src/components/__tests__/reviewMode.gating.test.jsx` - Run specific test file
- `npm run test -- --reporter=verbose` - Run with detailed output
- `npm run test -- --ui` - Run with Vitest UI (if available)

### Development Server Variants

- `npm run dev:api` - Start only API server with state file
- `npm run dev:api:watch` - Start API server with nodemon for auto-restart
- `npm run dev:client` - Start only Vite client dev server

## Code Style Guidelines

### File Organization

- **React Components**: Use `.jsx` for components with JSX, `.js` for utility files
- **TypeScript Files**: Use `.ts` for type definitions and utilities, `.tsx` for React components with types
- **Test Files**: Place alongside source files with `.test.js/.test.jsx/.test.ts/.test.tsx` suffix
- **Directory Structure**:
  - `src/components/` - Reusable UI components
  - `src/core/` - Business logic and engines
  - `src/state/` - State management and normalization
  - `src/domain/` - Domain-specific logic (goals, auto-strategy)
  - `src/ui/` - Page-level UI components
  - `src/services/` - External service integrations

### Import Conventions

```javascript
// React imports first
import React, { useEffect, useState } from 'react';

// Internal imports (relative paths)
import AppShell from './components/AppShell.jsx';
import { fetchHealth } from './api-client.js';

// External libraries last
import { addDays } from 'date-fns';
```

### Naming Conventions

- **Components**: PascalCase (e.g., `TaskBoard`, `IdentityHeader`)
- **Functions/Variables**: camelCase (e.g., `selectPacingMode`, `integrityScore`)
- **Constants**: UPPER_SNAKE_CASE for exported constants (e.g., `APP_TIME_ZONE`)
- **Files**: kebab-case for utilities (e.g., `time-utils.js`), PascalCase for components
- **TypeScript Interfaces**: PascalCase with `I` prefix optional (e.g., `RolloverResult`)

### Code Patterns

- **Functional Components**: Prefer functional components with hooks over class components
- **Pure Functions**: Write pure functions for business logic, especially in `src/core/`
- **Error Handling**: Use try-catch blocks for async operations, return error objects or throw
- **State Management**: Use React hooks for local state, centralized state for app-wide data

### ESLint Rules (Key)

- `no-console`: Warn (allowed for debugging)
- `no-debugger`: Error (not allowed in production)
- `no-unused-vars`: Warn (off in test files)
- `eqeqeq`: Error (always use strict equality)
- `curly`: Error (always use braces for control structures)

### Prettier Configuration

- **Print Width**: 120 characters (80 for Markdown/JSON)
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Trailing Commas**: ES5 compatible
- **Indentation**: 2 spaces (no tabs)
- **Arrow Parentheses**: Always include parentheses around arrow function parameters

### TypeScript Guidelines

- **Type Safety**: Use TypeScript interfaces for complex data structures
- **Type Imports**: Use `import type` for type-only imports
- **Generics**: Prefer generics over `any` type
- **Strict Mode**: Follow strict TypeScript patterns (though project allows non-strict files)

### Testing Guidelines

- **Test Framework**: Vitest with jsdom environment
- **Test Libraries**: @testing-library/react for component testing
- **Test Structure**: Arrange-Act-Assert pattern
- **Mock Strategy**: Mock external dependencies and API calls
- **Coverage**: Write tests for critical business logic and component interactions

### React Specific Patterns

- **Hooks**: Use custom hooks for complex state logic
- **Props**: Destructure props in function signature
- **Conditional Rendering**: Use ternary operators or logical AND for simple conditions
- **Event Handlers**: Name event handlers clearly (e.g., `handleSubmit`, `onTaskClick`)
- **Component Size**: Keep components focused and reasonably sized

### Error Handling Patterns

```javascript
// API calls with error handling
try {
  const result = await fetchHealth();
  return result;
} catch (error) {
  console.error('Failed to fetch health:', error);
  return { error: error.message };
}

// Validation with early returns
function validateGoal(goal) {
  if (!goal.title) return { valid: false, error: 'Title required' };
  if (!goal.deadline) return { valid: false, error: 'Deadline required' };
  return { valid: true };
}
```

### Performance Considerations

- **React.memo**: Use for components that re-render unnecessarily
- **useCallback/useMemo**: Use for expensive computations or stable references
- **Code Splitting**: Use dynamic imports for large components
- **Bundle Analysis**: Monitor bundle size with build tools

### Development Workflow

1. **Before Committing**: Run `npm run check-all` to ensure code quality
2. **During Development**: Use `npm run dev:api:watch` and `npm run dev:client` for hot reloading
3. **Testing**: Run `npm run test:watch` while writing tests
4. **Code Review**: Ensure linting passes and tests cover new functionality

### Environment Variables

- `STATE_PATH`: Path to state JSON file for API server
- `NODE_OPTIONS`: Set to `--experimental-vm-modules` for Jest compatibility

### Git Hooks

- **Pre-commit**: Husky configured with lint-staged
- **Lint-staged**: Runs ESLint and Prettier on staged files automatically

### Browser Compatibility

- **Target**: Modern browsers with ES2020+ support
- **Node Version**: >=18.0.0
- **Build Tool**: Vite with React plugin

This configuration supports a modern React development workflow with emphasis on code quality, testing, and maintainability.
