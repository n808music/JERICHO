/**
 * Jericho 2.0 Diagnostic System
 *
 * Provides observability for all major system handoffs and transformations.
 * Enables inspection, verification, and explanation of every critical pipeline step.
 */

import fs from 'fs';
import path from 'path';

// Trace event schema
export const TRACE_EVENT_SCHEMA = {
  traceId: 'string', // Unique identifier for the entire run
  cycleId: 'string', // Goal cycle identifier
  goalId: 'string', // Specific goal identifier
  moduleName: 'string', // Which module executed
  stepName: 'string', // Specific step within module
  status: 'string', // 'success', 'failure', 'stalled'
  inputSummary: 'object', // Summary of inputs received
  outputSummary: 'object', // Summary of outputs produced
  errorCode: 'string', // Stable error code if failed
  reasonCodes: 'array', // Array of reason codes
  timestamp: 'string', // ISO timestamp
  sourceReadPath: 'string', // Canonical source read from
  sourceWritePath: 'string', // Canonical source written to
  executionTimeMs: 'number' // Time taken for this step
};

// Global trace store
let currentTrace = [];
let currentTraceId = null;
let traceHistory = []; // Store completed traces

// Export for API access
export { traceHistory };

/**
 * Start a new diagnostic trace for a goal execution
 */
export function startTrace(cycleId, goalId) {
  currentTraceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  currentTrace = [];
  addTraceEvent('system', 'trace_start', 'success', {
    cycleId,
    goalId
  }, {
    traceId: currentTraceId
  });
  return currentTraceId;
}

/**
 * End the current trace
 */
export function endTrace(finalStatus = 'completed') {
  if (currentTrace.length > 0) {
    addTraceEvent('system', 'trace_end', finalStatus, {
      totalEvents: currentTrace.length
    }, {});
    // Store the completed trace
    traceHistory.push({
      traceId: currentTraceId,
      status: finalStatus,
      events: [...currentTrace],
      completedAt: new Date().toISOString()
    });
  }
  currentTrace = [];
  currentTraceId = null;
  return traceHistory[traceHistory.length - 1];
}

/**
 * Add a trace event
 */
export function addTraceEvent(moduleName, stepName, status, inputSummary = {}, outputSummary = {}, errorCode = null, reasonCodes = [], sourceReadPath = null, sourceWritePath = null) {
  const event = {
    traceId: currentTraceId,
    moduleName,
    stepName,
    status,
    inputSummary,
    outputSummary,
    errorCode,
    reasonCodes: Array.isArray(reasonCodes) ? reasonCodes : [],
    timestamp: new Date().toISOString(),
    sourceReadPath,
    sourceWritePath,
    executionTimeMs: 0 // Would be calculated with start/end timing
  };

  currentTrace.push(event);

  // Log to console for immediate visibility
  console.log(`[TRACE] ${moduleName}.${stepName} -> ${status}${errorCode ? ` (${errorCode})` : ''}`);

  return event;
}

/**
 * Get current trace
 */
export function getCurrentTrace() {
  return currentTrace;
}

/**
 * Get trace by ID (from history)
 */
export function getTraceById(traceId) {
  // Check current trace first
  if (currentTraceId === traceId) {
    return {
      traceId: currentTraceId,
      status: 'in_progress',
      events: currentTrace,
      completedAt: null
    };
  }
  // Check history
  return traceHistory.find(t => t.traceId === traceId) || null;
}

/**
 * Record a completed verification trace when a route returns a traceId directly.
 */
export function recordTraceSummary(summary) {
  if (!summary?.traceId) return null;

  const record = {
    traceId: summary.traceId,
    status: summary.status || 'success',
    events: Array.isArray(summary.events) ? summary.events : [],
    completedAt: summary.completedAt || new Date().toISOString(),
    integrationStatus: summary.integrationStatus || 'PASS',
    criticalFailures: summary.criticalFailures ?? 0,
    goalId: summary.goalId || null,
    cycleId: summary.cycleId || null
  };

  traceHistory.push(record);
  return record;
}

/**
 * Stable error codes for the system
 */
export const ERROR_CODES = {
  // Goal intake errors
  NO_GOAL_INPUT: 'NO_GOAL_INPUT',
  INVALID_GOAL_TYPE: 'INVALID_GOAL_TYPE',
  INVALID_SUBTYPE: 'INVALID_SUBTYPE',

  // Graph errors
  EMPTY_ACTION_GRAPH: 'EMPTY_ACTION_GRAPH',
  INVALID_DEPENDENCY_GRAPH: 'INVALID_DEPENDENCY_GRAPH',
  GRAPH_VALIDATION_FAILED: 'GRAPH_VALIDATION_FAILED',
  SUBTYPE_ACTION_SET_MISSING: 'SUBTYPE_ACTION_SET_MISSING',
  NO_WORK_WINDOWS: 'NO_WORK_WINDOWS',

  // Feasibility errors
  CAPACITY_VECTOR_MISSING: 'CAPACITY_VECTOR_MISSING',
  BASELINE_FEASIBILITY_INPUT_MISSING: 'BASELINE_FEASIBILITY_INPUT_MISSING',

  // Scheduling errors
  NO_PROPOSED_BLOCKS: 'NO_PROPOSED_BLOCKS',
  COMMIT_BLOCKED: 'COMMIT_BLOCKED',

  // Rendering errors
  CANONICAL_SOURCE_MISMATCH: 'CANONICAL_SOURCE_MISMATCH',
  RENDER_SOURCE_EMPTY: 'RENDER_SOURCE_EMPTY',

  // Recovery errors
  RECOVERY_NOT_ELIGIBLE: 'RECOVERY_NOT_ELIGIBLE',
  RECOVERY_TAXONOMY_EXCEEDED: 'RECOVERY_TAXONOMY_EXCEEDED',
  CONFIRMATION_GATE_BYPASSED: 'CONFIRMATION_GATE_BYPASSED',
  REPLANNING_ENTRY_POINT_MISSING: 'REPLANNING_ENTRY_POINT_MISSING',
  GOAL_ALREADY_CLOSED: 'GOAL_ALREADY_CLOSED',

  // Stability and Drift errors
  EXECUTION_SIGNAL_INCOMPLETE: 'EXECUTION_SIGNAL_INCOMPLETE',
  DRIFT_CLASSIFICATION_INSUFFICIENT_DATA: 'DRIFT_CLASSIFICATION_INSUFFICIENT_DATA',
  STABILITY_TRACKING_NO_COMMITTED_SCHEDULE: 'STABILITY_TRACKING_NO_COMMITTED_SCHEDULE'
};

/**
 * Diagnostic summary for a module
 */
export function createModuleDiagnostic(moduleName, inputs, rules, outputs, failures, logging) {
  return {
    moduleName,
    inputs,
    rules,
    outputs,
    failures,
    logging
  };
}

// Canonical diagnostic map - to be populated for each module
export const DIAGNOSTIC_MAP = {
  // Will be populated as we audit each module
};
