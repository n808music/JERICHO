#!/usr/bin/env node
import { safeReadState } from '../src/data/storage.js';
import { aggregateHealthCheck } from '../src/core/validation/health.js';

/**
 * Runs validation checks against the persisted application state and prints a health report.
 *
 * Reads the stored state, computes aggregate health, logs overall status, timestamp,
 * schema validation results, and invariant violations, then exits the process:
 * exit code 0 when health.status === 'healthy', otherwise exit code 1.
 */
async function main() {
  console.log('Running validation checks...\n');

  const { ok, state, errorCode, reason } = await safeReadState();

  if (!ok) {
    console.error(`✗ State read failed: ${reason}`);
    process.exit(1);
  }

  const health = aggregateHealthCheck(state);

  console.log(`Status: ${health.status.toUpperCase()}`);
  console.log(`Timestamp: ${health.timestamp}\n`);

  // Schema check
  const schema = health.checks.stateSchema;
  console.log(`Schema Validation: ${schema.valid ? '✓ PASS' : '✗ FAIL'}`);
  if (!schema.valid) {
    schema.errors.forEach(e => console.log(`  - ${e}`));
  }

  // Invariants check
  const inv = health.checks.invariants;
  console.log(`Invariant Checks: ${inv.valid ? '✓ PASS' : '✗ FAIL'}`);
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