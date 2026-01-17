import { validateState } from '../state-validator.js';
import { checkInvariants } from './invariants.js';

/**
 * Produce a health report by running schema validation and invariant checks against the provided state.
 * @param {object} state - The full application state to validate.
 * @returns {{status: 'healthy' | 'unhealthy', timestamp: string, checks: object}} An object containing the overall health `status` ('healthy' if both schema and invariant checks pass, 'unhealthy' otherwise), an ISO 8601 `timestamp` string of when the report was generated, and a `checks` object with:
 *  - `stateSchema`: { valid: boolean, errors: Array } — schema validation result and any errors.
 *  - `invariants`: { valid: boolean, violations: Array } — invariant check result and any violations.
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