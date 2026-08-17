/**
 * initiativeRegistryTestHelper.js
 *
 * Test helper for seeding tests with the real Operation Morning Sun Initiative registry.
 * Loads the fixture data (captured from live sheet) for use in unit tests without requiring
 * GOOGLE_APPLICATION_CREDENTIALS or network access.
 *
 * Generated: 2026-08-17
 * Source: Operation Morning Sun matrix (live API fallback → disk cache)
 * Initiatives: 30 real entries with id, name, owner, aliases
 *
 * Usage:
 *   import { getRealInitiativeRegistry } from '../fixtures/initiativeRegistryTestHelper.js';
 *   const registry = getRealInitiativeRegistry();
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Import the real alias derivation function (single source of truth, no duplication)
import { deriveAliasesFromName } from '../../src/domain/product/initiativeAliasDerivation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.join(__dirname, 'initiative-registry-real.json');

let cachedRegistry = null;

/**
 * Loads the real Initiative registry from the test fixture.
 * Caches in-memory after first load.
 * Derives aliases for each initiative (mirrors production loader behavior).
 *
 * @returns {Array} Array of initiative objects with id, name, owner, aliases
 */
export function getRealInitiativeRegistry() {
  if (cachedRegistry) {
    return cachedRegistry;
  }

  try {
    const rawData = fs.readFileSync(FIXTURE_PATH, 'utf8');
    const { initiatives } = JSON.parse(rawData);

    // Derive aliases for each initiative (production loader does this)
    const enrichedInitiatives = initiatives.map((init) => ({
      ...init,
      aliases: deriveAliasesFromName(init.name),
    }));

    cachedRegistry = enrichedInitiatives;
    return enrichedInitiatives;
  } catch (error) {
    throw new Error(`Failed to load test fixture: ${error.message}`);
  }
}

/**
 * Mock replacement for the production registry loader.
 * Returns the real registry from the test fixture.
 * Use in vi.mock() or via direct injection into test context.
 *
 * @returns {Promise<Array>}
 */
export async function mockLoadInitiativeRegistry() {
  return getRealInitiativeRegistry();
}

/**
 * Mock replacement for the sync registry accessor.
 * Returns the real registry from the test fixture (no disk fallback needed in tests).
 *
 * @returns {Array}
 */
export function mockGetInitiativeRegistrySyncOrEmpty() {
  return getRealInitiativeRegistry();
}

export default getRealInitiativeRegistry;
