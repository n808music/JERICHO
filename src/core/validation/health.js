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
