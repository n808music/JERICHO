#!/usr/bin/env node

/**
 * Jericho 2.0 End-to-End Verification Harness
 *
 * Runs a deterministic goal through the complete pipeline and captures:
 * - Stages reached
 * - State transitions
 * - Emitted artifacts
 * - Postcondition status
 * - Failure codes
 *
 * Usage: node scripts/e2e-verification.js
 */

import { runPipeline } from '../src/core/pipeline.js';
import { mockGoals, mockIdentity } from '../src/data/mock-data.js';
import { normalizeStateForPipeline } from '../src/core/state-normalization.js';
import { startTrace, endTrace, addTraceEvent } from '../src/core/diagnostics.js';

async function runVerification() {
  console.log('🚀 Starting Jericho 2.0 E2E Verification\n');

  // Start diagnostic trace
  const traceId = startTrace('verification_cycle', 'test_goal_1');
  console.log(`📊 Trace started: ${traceId}\n`);

  try {
    // Test goal input
    const goalInput = {
      goals: [
        'I will complete project milestone by 2026-03-15'
      ]
    };

    const identity = mockIdentity;
    const history = [];
    const tasks = [];
    const team = {};

    console.log('📝 Input Goal:', JSON.stringify(goalInput, null, 2));
    console.log('👤 Identity:', Object.keys(identity));
    console.log('');

    // Normalize state
    const normalizedState = normalizeStateForPipeline({
      goals: goalInput.goals,
      identity,
      history,
      tasks,
      team
    });

    addTraceEvent('harness', 'state_normalization', 'success', {
      goalCount: goalInput.goals.length,
      identityKeys: Object.keys(identity).length
    }, {
      normalizedGoals: normalizedState.goals?.length || 0,
      normalizedTasks: normalizedState.tasks?.length || 0
    });

    // Run pipeline
    console.log('⚙️  Running pipeline...');
    const result = runPipeline(goalInput, identity, history, tasks, team);

    addTraceEvent('harness', 'pipeline_execution', 'success', {
      goalInput: goalInput.goals.length
    }, {
      requirementsCount: result.requirements?.length || 0,
      tasksCount: result.tasks?.length || 0,
      integrityScore: result.integrity?.score
    });

    console.log('✅ Pipeline completed');
    console.log('');

    // Analyze results
    const analysis = {
      stagesReached: [],
      artifacts: {},
      postconditions: {},
      failureCodes: []
    };

    // Check goal normalization
    if (result.requirements && result.requirements.length > 0) {
      analysis.stagesReached.push('goal_normalization');
      analysis.artifacts.requirements = result.requirements.length;
    }

    // Check gap analysis
    if (result.gaps && result.gaps.length >= 0) {
      analysis.stagesReached.push('gap_analysis');
      analysis.artifacts.gaps = result.gaps.length;
    }

    // Check task generation
    if (result.tasks && result.tasks.length > 0) {
      analysis.stagesReached.push('task_generation');
      analysis.artifacts.tasks = result.tasks.length;
    }

    // Check integrity scoring
    if (result.integrity && typeof result.integrity.score === 'number') {
      analysis.stagesReached.push('integrity_scoring');
      analysis.artifacts.integrityScore = result.integrity.score;
    }

    // Check forecasting
    if (result.forecast) {
      analysis.stagesReached.push('forecasting');
      analysis.artifacts.forecastAvailable = true;
    }

    // Postconditions
    analysis.postconditions = {
      hasRequirements: !!(result.requirements && result.requirements.length > 0),
      hasTasks: !!(result.tasks && result.tasks.length > 0),
      hasIntegrity: !!(result.integrity && typeof result.integrity.score === 'number'),
      hasGaps: Array.isArray(result.gaps),
      hasForecast: !!result.forecast
    };

    // Check for failures
    if (result.error) {
      analysis.failureCodes.push(result.error);
    }

    addTraceEvent('harness', 'result_analysis', 'success', {}, analysis);

    // Output results
    console.log('📊 VERIFICATION RESULTS');
    console.log('======================');
    console.log(`Stages Reached: ${analysis.stagesReached.join(' → ')}`);
    console.log(`Artifacts Generated: ${Object.entries(analysis.artifacts).map(([k,v]) => `${k}=${v}`).join(', ')}`);
    console.log(`Postconditions Met: ${Object.entries(analysis.postconditions).filter(([k,v]) => v).map(([k]) => k).join(', ')}`);
    if (analysis.failureCodes.length > 0) {
      console.log(`Failure Codes: ${analysis.failureCodes.join(', ')}`);
    }
    console.log('');

    // Success criteria
    const criticalStages = ['goal_normalization', 'gap_analysis', 'task_generation', 'integrity_scoring'];
    const stagesMet = criticalStages.filter(s => analysis.stagesReached.includes(s));
    const success = stagesMet.length === criticalStages.length && analysis.failureCodes.length === 0;

    console.log(success ? '✅ VERIFICATION PASSED' : '❌ VERIFICATION FAILED');
    console.log(`Critical stages met: ${stagesMet.length}/${criticalStages.length}`);
    console.log('');

    // End trace
    const trace = endTrace(success ? 'success' : 'failure');
    console.log(`📊 Trace completed with ${trace.length} events`);

    return { success, analysis, traceId };

  } catch (error) {
    console.error('💥 Verification failed with exception:', error.message);
    addTraceEvent('harness', 'exception', 'failure', {}, {}, 'VERIFICATION_EXCEPTION', [error.message]);
    endTrace('failure');
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runVerification().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Harness execution failed:', error);
    process.exit(1);
  });
}

export { runVerification };