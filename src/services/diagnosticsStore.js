/**
 * Diagnostics Store Service
 *
 * Stores and retrieves diagnostic information.
 */

let latestDiagnostics = null;

export function setLatestDiagnostics(diagnostics) {
  latestDiagnostics = diagnostics;
}

export function getLatestDiagnostics() {
  return latestDiagnostics;
}