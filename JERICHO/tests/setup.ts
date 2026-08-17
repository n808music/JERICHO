import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, vi } from 'vitest';
import { getRealInitiativeRegistry } from './fixtures/initiativeRegistryTestHelper.js';

expect.extend(matchers);

/**
 * Global test setup: mock the Initiative registry loader to use real fixture data.
 * This ensures all tests that call resolveInitiativeDisplay() or similar functions
 * use the real Operation Morning Sun matrix data (30 initiatives) instead of requiring
 * live API access or disk cache.
 *
 * Note: deriveAliasesFromName is NOT mocked — it's imported from the shared utility
 * module (initiativeAliasDerivation.js), which both production loader and test fixtures
 * import from. Single source of truth, no duplication.
 */
vi.mock('../src/domain/product/initiativeRegistryLoader.js', () => ({
  getInitiativeRegistrySyncOrEmpty: () => getRealInitiativeRegistry(),
  loadInitiativeRegistry: async () => getRealInitiativeRegistry(),
  default: async () => getRealInitiativeRegistry(),
}));
