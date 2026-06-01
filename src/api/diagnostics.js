/**
 * Diagnostic Dashboard API
 *
 * Provides endpoints for inspecting system diagnostics and traces.
 */

import { getCurrentTrace, getTraceById, DIAGNOSTIC_MAP, ERROR_CODES, traceHistory } from '../core/diagnostics.js';

/**
 * Get diagnostic dashboard data
 */
export function getDiagnosticDashboard() {
  const latestTrace = traceHistory[traceHistory.length - 1] || null;
  return {
    currentTrace: getCurrentTrace(),
    diagnosticMap: DIAGNOSTIC_MAP,
    errorCodes: ERROR_CODES,
    latestTrace,
    integrationStatus: latestTrace?.integrationStatus || null,
    criticalFailures: latestTrace?.criticalFailures ?? null,
    systemStatus: {
      timestamp: new Date().toISOString(),
      traceActive: getCurrentTrace().length > 0,
      totalModules: Object.keys(DIAGNOSTIC_MAP).length
    }
  };
}

/**
 * Get specific trace by ID
 */
export function getTraceEndpoint(traceId) {
  const trace = getTraceById(traceId);
  if (!trace) {
    return { error: 'Trace not found', traceId };
  }
  return { trace };
}

/**
 * Get recent traces (from history)
 */
export function getRecentTracesEndpoint(limit = 10) {
  return {
    traces: traceHistory.slice(-limit).map(t => ({
      traceId: t.traceId,
      status: t.status,
      integrationStatus: t.integrationStatus || null,
      criticalFailures: t.criticalFailures ?? null,
      eventCount: t.events.length,
      completedAt: t.completedAt
    })),
    limit
  };
}
