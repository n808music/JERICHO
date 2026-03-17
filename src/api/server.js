/**
 * Jericho API server (single backend entrypoint).
 * - Listens on port 3000.
 * - Frontend calls: /health, /state, /goals, /identity, /tasks, /task-status, /cycle/next, /pipeline, /ai/*.
 * - ESM only; no CommonJS entrypoints.
 * - Always returns JSON; mutating routes return structured errors instead of crashing.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { runPipeline } from '../core/pipeline.js';
import { mockGoals, mockIdentity } from '../data/mock-data.js';
import { readState, writeState, safeReadState } from '../data/storage.js';
import { compileSceneGraph } from '../core/scene-compiler.js';
import { interpretCommand } from '../core/ai-interpreter.js';
import { planDirectives } from '../core/directive-planner.js';
import { compileNarrative } from '../core/narrative-compiler.js';
import { buildReasoningStrip } from '../core/reasoning-strip.js';
import { buildReasoningChain } from '../core/reasoning-chain.js';
import { evaluateMultiGoalPortfolio } from '../core/multi-goal-evaluator.js';
import { analyzeIntegrityDeviations } from '../core/integrity-deviation-engine.js';
import { buildSessionSnapshot } from '../core/ai-session.js';
import { buildTeamHud, buildTeamExport } from '../core/team-hud.js';
import { filterSessionForViewer } from '../core/team-roles.js';
import { getLLMContract } from '../ai/llm-contract.js';
import { runSuggestions } from '../llm/suggestion-runner.js';
import { normalizeStateForPipeline } from '../core/state-normalization.js';
import { buildIdentitySnapshot, appendIdentitySnapshot, getCurrentIdentity, getIdentityHistory } from '../core/identity-engine.js';
import { forecastIdentityTrajectory, classifyRiskFromForecast } from '../core/identity-forecast.js';
import { interpretIdentityNarrative } from '../core/narrative-interpreter.js';
import { planCapabilityArcs } from '../core/capability-arc-planner.js';
import { auditCoherence } from '../core/coherence-auditor.js';
import { computeAdvisoryDiagnostics } from '../advisory/diagnosticsAggregator.js';
import { setLatestDiagnostics, getLatestDiagnostics } from '../services/diagnosticsStore.js';
import { aggregateHealthCheck } from '../core/validation/health.js';
import { resolveTimeframe } from '../utils/timeframe-resolver.js';
import { assessFeasibility, getFeasibilityInterpretation } from '../core/feasibility-agent.js';
import { generateActionGraph } from '../core/graph-construction-agent.js';
import { computeEffortEstimate } from '../core/effort-estimation.js';
import { buildSchedulingPolicy, generateScheduleProposal } from '../core/scheduling-agent.js';
import { commitScheduleBlocks } from '../core/schedule-commit.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsSpec = JSON.parse(fs.readFileSync(path.join(__dirname, '../ai/commands-spec.json'), 'utf8'));
import { getDiagnosticDashboard, getTraceEndpoint, getRecentTracesEndpoint } from './diagnostics.js';
import { startTrace, endTrace, recordTraceSummary } from '../core/diagnostics.js';

const port = 3000;

const server = http.createServer(async (req, res) => {
  enableCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  /** Core route handling */
  try {
    if (req.method === 'GET' && req.url === '/health') {
      respondOk(res, {
        status: 'alive',
        routes: [
          '/pipeline',
          '/state',
          '/goals',
          '/identity',
          '/tasks',
          '/internal/diagnostics',
          '/api/health'
        ]
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/api/health') {
      const state = await getStateOrError(res);
      if (!state) return;
      const health = aggregateHealthCheck(state);
      respondOk(res, health);
      return;
    }

    if (req.method === 'GET' && req.url === '/diagnostics') {
      const dashboard = getDiagnosticDashboard();
      respondOk(res, dashboard);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/diagnostics/trace/')) {
      const traceId = req.url.split('/diagnostics/trace/')[1];
      const result = getTraceEndpoint(traceId);
      respondOk(res, result);
      return;
    }

    if (req.method === 'GET' && req.url === '/diagnostics/traces') {
      const result = getRecentTracesEndpoint();
      respondOk(res, result);
      return;
    }

    if (req.method === 'GET' && req.url === '/pipeline') {
      const state = await getStateOrError(res);
      if (!state) {
        endTrace('error');
        return;
      }

      // Start diagnostics trace
      const traceId = startTrace('api_pipeline', state.goals?.[0]?.id || 'api_call');

      try {
        const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
        const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
        const normalizedState = normalizeStateForPipeline(state);
        const result = runPipeline(
          goalInput,
          identity,
          normalizedState.history || [],
          normalizedState.tasks || [],
          normalizedState.team
        );

        // End trace on success
        endTrace('success');

        const snapshot = buildIdentitySnapshot({
          capabilities: buildCapabilitiesFromRequirements(result.requirements || [], identity),
          integrity: result.integrity,
          history: normalizedState.history || []
        });
        appendIdentitySnapshot('default', snapshot);
        logAdvisoryDiagnostics('default', state, result, normalizedState);
        respondOk(res, { ...result, state });
        return;
      } catch (error) {
        endTrace('error');
        respondError(res, 'pipeline_error', error.message);
        return;
      }
    }

    if (req.method === 'POST' && req.url === '/api/agent/goal-structure') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      const { rawGoalStatement, timeframe, priorityLevel, currentStatus, clarificationLog, forceResolution } = payload;
      const response = resolveGoalStructureResponse({
        rawGoalStatement,
        timeframe,
        priorityLevel,
        currentStatus,
        clarificationLog,
        forceResolution
      });

      respondJson(res, response, 200);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/agent/feasibility') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      const {
        goalId,
        goalFamily,
        goalSubtype,
        targetDeadline,
        deadlineType,
        capacityInputs,
        familySpecificInputs
      } = payload;

      if (!goalFamily || !goalSubtype || !targetDeadline || !capacityInputs) {
        respondJson(
          res,
          {
            ok: false,
            feasibilityScore: null,
            feasibilityBand: null,
            factorBreakdown: [],
            limitingFactors: [],
            recommendedAdjustments: [],
            plainLanguageSummary: null,
            errorCode: 'BASELINE_FEASIBILITY_INPUT_MISSING'
          },
          200
        );
        return;
      }

      try {
        const rawInputs = buildFeasibilityRawInputs({
          targetDeadline,
          capacityInputs,
          familySpecificInputs,
          deadlineType
        });
        const result = assessFeasibility(rawInputs, goalFamily, goalSubtype);

        if (!result.success || !result.feasibility) {
          respondJson(
            res,
            {
              ok: false,
              feasibilityScore: null,
              feasibilityBand: null,
              factorBreakdown: [],
              limitingFactors: result.feasibility?.limitingFactors || [result.error || 'Feasibility assessment failed'],
              recommendedAdjustments: result.feasibility?.recommendedAdjustments || [],
              plainLanguageSummary: null,
              errorCode: result.feasibility?.errorCode || 'SERVER_ERROR'
            },
            200
          );
          return;
        }

        const mappedFeasibility = mapFeasibilityResult(result.feasibility);
        const timestamp = Date.now();
        const feasibilityTraceId = `trace-feasibility-${timestamp}`;

        recordTraceSummary({
          traceId: feasibilityTraceId,
          goalId: goalId || `goal-${timestamp}`,
          cycleId: null,
          status: 'success',
          integrationStatus: 'PASS',
          criticalFailures: 0,
          events: [
            {
              traceId: feasibilityTraceId,
              moduleName: 'feasibility_assessment',
              stepName: 'capacity_to_feasibility_score',
              status: 'success',
              inputSummary: {
                goalFamily,
                goalSubtype,
                deadlineType: deadlineType || 'TARGET',
                hoursPerWeek: capacityInputs?.hoursPerWeek ?? null
              },
              outputSummary: {
                feasibilityScore: mappedFeasibility.feasibilityScore,
                feasibilityBand: mappedFeasibility.feasibilityBand,
                limitingFactorCount: Array.isArray(result.feasibility.limitingFactors)
                  ? result.feasibility.limitingFactors.length
                  : 0
              },
              errorCode: null,
              reasonCodes: [],
              timestamp: new Date().toISOString(),
              sourceReadPath: '/api/agent/feasibility',
              sourceWritePath: '/api/agent/feasibility',
              executionTimeMs: 0
            }
          ]
        });

        respondJson(
          res,
          {
            ok: true,
            feasibilityScore: mappedFeasibility.feasibilityScore,
            feasibilityBand: mappedFeasibility.feasibilityBand,
            factorBreakdown: mappedFeasibility.factorBreakdown,
            limitingFactors: result.feasibility.limitingFactors || [],
            recommendedAdjustments: result.feasibility.recommendedAdjustments || [],
            plainLanguageSummary: buildFeasibilitySummary(result.feasibility, mappedFeasibility.feasibilityBand),
            errorCode: null
          },
          200
        );
      } catch (error) {
        console.error('Feasibility endpoint error:', error);
        respondJson(
          res,
          {
            ok: false,
            feasibilityScore: null,
            feasibilityBand: null,
            factorBreakdown: [],
            limitingFactors: [],
            recommendedAdjustments: [],
            plainLanguageSummary: null,
            errorCode: 'SERVER_ERROR'
          },
          200
        );
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/api/agent/schedule/propose') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      try {
        const {
          goalId,
          goalFamily,
          goalSubtype,
          targetDeadline,
          deadlineType,
          capacityInputs,
          schedulingPreferences
        } = payload;

        if (!goalId || !goalFamily || !goalSubtype || !targetDeadline || !capacityInputs || !schedulingPreferences) {
          respondJson(res, emptyScheduleProposalResponse('SERVER_ERROR'), 200);
          return;
        }

        const graphResult = generateActionGraph({
          goalId,
          goalSubtype,
          currentStatus: 'NOT_STARTED'
        });

        if (graphResult.errorCode) {
          respondJson(res, emptyScheduleProposalResponse(graphResult.errorCode), 200);
          return;
        }

        const blockedPeriods = schedulingPreferences.blockedPeriods || [];
        const capacityVector = {
          availableHoursPerWeek: Number(capacityInputs.hoursPerWeek) || 0,
          availableDays: capacityInputs.availableDays || [],
          preferredSessionLengthMinutes: Number(capacityInputs.sessionLengthMinutes) || 60,
          blackoutPeriods: blockedPeriods,
          startDate: new Date().toISOString(),
          deadline: targetDeadline,
          totalAvailableHours: null,
          currentLoadModifier: 1,
          experienceModifier: 1,
          externalDependencyRisk: 'LOW',
          goalFamily,
          goalSubtype,
          familySpecificInputs: {}
        };

        const effortEstimate = computeEffortEstimate(capacityVector);
        if (effortEstimate.errorCode) {
          respondJson(res, emptyScheduleProposalResponse(effortEstimate.errorCode), 200);
          return;
        }

        const schedulingPolicy = buildSchedulingPolicy(
          {
            preferredWorkDays: (capacityInputs.availableDays || []).map((day) => day.toLowerCase()),
            preferredTimeOfDay: mapTimeOfDayPreference(schedulingPreferences.timeOfDay),
            earliestStartTime: null,
            latestEndTime: null,
            minimumSessionLength: Number(capacityInputs.sessionLengthMinutes) || 60,
            maximumSessionLength: Number(capacityInputs.sessionLengthMinutes) || 60,
            bufferBetweenSessions: 0,
            hardBlockedDates: expandBlockedPeriodsToDates(blockedPeriods),
            recurringBlockedWindows: [],
            deadlineFlexibility: deadlineType === 'HARD' ? 'hard' : 'target',
            frontLoadOrBackLoadPreference: mapPacingPreference(schedulingPreferences.pacingPolicy),
            dependencySequencingAwareness: 'enforced',
            familySchedulingInputs: {},
            startDate: new Date().toISOString(),
            deadline: targetDeadline
          },
          goalFamily,
          goalSubtype
        );

        const proposal = generateScheduleProposal(
          schedulingPolicy,
          effortEstimate,
          graphResult.actionGraph,
          goalId
        );

        if (!proposal.errorCode) {
          const traceId = `trace-schedule-propose-${Date.now()}`;
          recordTraceSummary({
            traceId,
            goalId,
            cycleId: proposal.proposedBlocks?.[0]?.cycleId || null,
            status: 'success',
            integrationStatus: 'PASS',
            criticalFailures: 0,
            events: [
              {
                traceId,
                moduleName: 'schedule_proposal',
                stepName: 'preferences_to_schedule_blocks',
                status: 'success',
                inputSummary: {
                  goalFamily,
                  goalSubtype,
                  timeOfDay: schedulingPreferences.timeOfDay || null,
                  pacingPolicy: schedulingPreferences.pacingPolicy || null
                },
                outputSummary: {
                  blockCount: proposal.proposedBlocks?.length || 0,
                  schedulingStatus: proposal.schedulingStatus || 'FAILED',
                  coveragePercent: proposal.coveragePercent ?? 0
                },
                errorCode: null,
                reasonCodes: [],
                timestamp: new Date().toISOString(),
                sourceReadPath: '/api/agent/schedule/propose',
                sourceWritePath: '/api/agent/schedule/propose',
                executionTimeMs: 0
              }
            ]
          });
        }

        respondJson(
          res,
          {
            ok: !proposal.errorCode,
            proposedBlocks: proposal.proposedBlocks || [],
            unscheduledItems: (proposal.unscheduledItems || []).map((item) => ({
              actionId: item.actionId || item.id || null,
              actionName: item.title || item.name || item.label || item.actionId || 'Unscheduled action',
              reason: item.reason || 'No available window before deadline'
            })),
            coveragePercent: proposal.coveragePercent ?? 0,
            proposalSummary: {
              totalBlocks: proposal.proposalSummary?.totalBlocks ?? 0,
              totalHours: proposal.proposalSummary?.totalHours ?? 0,
              firstBlockDate: proposal.proposalSummary?.firstBlockDate ?? null,
              lastBlockDate: proposal.proposalSummary?.lastBlockDate ?? null,
              pacingActual: proposal.proposalSummary?.pacingActual ?? null
            },
            schedulingStatus: proposal.schedulingStatus || 'FAILED',
            errorCode: proposal.errorCode || null
          },
          200
        );
        return;
      } catch (error) {
        respondJson(res, emptyScheduleProposalResponse('SERVER_ERROR'), 200);
        return;
      }
    }

    if (req.method === 'POST' && req.url === '/api/agent/schedule/commit') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      try {
        const result = await commitScheduleBlocks(
          payload.proposedBlocks || [],
          { goalId: payload.goalId, cycleId: payload.cycleId },
          null
        );

        if (result.success) {
          const traceId = `trace-schedule-commit-${Date.now()}`;
          recordTraceSummary({
            traceId,
            goalId: payload.goalId || null,
            cycleId: payload.cycleId || null,
            status: 'success',
            integrationStatus: 'PASS',
            criticalFailures: 0,
            events: [
              {
                traceId,
                moduleName: 'schedule_commit',
                stepName: 'proposal_to_committed_schedule',
                status: 'success',
                inputSummary: {
                  proposedBlockCount: payload.proposedBlocks?.length || 0
                },
                outputSummary: {
                  committedBlocks: result.totalCommitted ?? result.committedBlocks?.length ?? 0,
                  scheduleId: result.scheduleId || null
                },
                errorCode: null,
                reasonCodes: [],
                timestamp: new Date().toISOString(),
                sourceReadPath: '/api/agent/schedule/commit',
                sourceWritePath: '/api/agent/schedule/commit',
                executionTimeMs: 0
              }
            ]
          });
        }

        respondJson(
          res,
          {
            ok: result.success,
            committedBlocks: result.totalCommitted ?? result.committedBlocks?.length ?? 0,
            scheduleId: result.scheduleId || null,
            errorCode: result.errorCode || null
          },
          200
        );
        return;
      } catch (error) {
        respondJson(
          res,
          {
            ok: false,
            committedBlocks: 0,
            scheduleId: null,
            errorCode: 'SERVER_ERROR'
          },
          200
        );
        return;
      }
    }

    if (req.method === 'GET' && req.url.startsWith('/api/schedule/blocks')) {
      const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const goalId = requestUrl.searchParams.get('goalId');
      const cycleId = requestUrl.searchParams.get('cycleId');

      if (!goalId || !cycleId) {
        respondJson(
          res,
          {
            ok: false,
            blocks: [],
            totalBlocks: 0,
            completedBlocks: 0,
            missedBlocks: 0,
            errorCode: 'SCHEDULE_QUERY_MISSING'
          },
          200
        );
        return;
      }

      try {
        const state = await readState();
        const committedBlocks = Array.isArray(state.schedule?.committedBlocks) ? state.schedule.committedBlocks : [];
        const goalBlocks = committedBlocks.filter((block) => block.goalId === goalId);
        const cycleMatchedBlocks = goalBlocks.filter((block) => block.cycleId === cycleId);
        const blocks = cycleMatchedBlocks.length > 0 ? cycleMatchedBlocks : goalBlocks;

        respondJson(
          res,
          {
            ok: true,
            blocks: blocks.map((block) => ({
              blockId: block.blockId,
              actionId: block.actionId,
              actionName: block.actionName,
              date: block.date,
              startTime: block.startTime,
              durationMinutes: block.durationMinutes,
              status: block.status
            })),
            totalBlocks: blocks.length,
            completedBlocks: blocks.filter((block) => block.status === 'completed').length,
            missedBlocks: blocks.filter((block) => block.status === 'missed').length,
            errorCode: null
          },
          200
        );
        return;
      } catch (error) {
        respondJson(
          res,
          {
            ok: false,
            blocks: [],
            totalBlocks: 0,
            completedBlocks: 0,
            missedBlocks: 0,
            errorCode: 'SERVER_ERROR'
          },
          200
        );
        return;
      }
    }

    if (req.method === 'POST' && req.url.match(/^\/api\/schedule\/blocks\/[^/]+\/complete$/)) {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      const blockId = req.url.split('/api/schedule/blocks/')[1]?.replace('/complete', '');
      if (!blockId) {
        respondError(res, 'INVALID_BLOCK', 'blockId is required.', 400);
        return;
      }

      try {
        const state = await readState();
        const result = updateScheduleBlockStatus(state, blockId, 'completed', {
          completedAt: payload.completedAt || new Date().toISOString()
        });

        if (!result.ok) {
          respondJson(res, result, 200);
          return;
        }

        await writeState(result.state);
        const updatedBlock = result.state.schedule?.committedBlocks?.find((block) => block.blockId === blockId);
        const goalId = updatedBlock?.goalId || 'unknown';
        const cycleId = updatedBlock?.cycleId || 'unknown';
        const traceId = `trace-block-complete-${Date.now()}`;
        recordTraceSummary({
          traceId,
          goalId,
          cycleId,
          status: 'success',
          integrationStatus: 'PASS',
          criticalFailures: 0,
          events: [
            {
              traceId,
              moduleName: 'CalendarView',
              stepName: 'block_completed',
              status: 'success',
              inputSummary: {
                blockId
              },
              outputSummary: {
                blockId,
                status: 'completed'
              },
              errorCode: null,
              reasonCodes: [],
              timestamp: new Date().toISOString(),
              sourceReadPath: `/api/schedule/blocks/${blockId}/complete`,
              sourceWritePath: `/api/schedule/blocks/${blockId}/complete`,
              executionTimeMs: 0
            }
          ]
        });
        respondJson(
          res,
          {
            ok: true,
            blockId,
            status: 'completed',
            errorCode: null
          },
          200
        );
        return;
      } catch (error) {
        respondJson(
          res,
          {
            ok: false,
            blockId,
            status: null,
            errorCode: 'SERVER_ERROR'
          },
          200
        );
        return;
      }
    }

    if (req.method === 'POST' && req.url.match(/^\/api\/schedule\/blocks\/[^/]+\/missed$/)) {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      const blockId = req.url.split('/api/schedule/blocks/')[1]?.replace('/missed', '');
      if (!blockId) {
        respondError(res, 'INVALID_BLOCK', 'blockId is required.', 400);
        return;
      }

      try {
        const state = await readState();
        const result = updateScheduleBlockStatus(state, blockId, 'missed', {
          missedAt: payload.missedAt || new Date().toISOString(),
          missReason: payload.reason || null
        });

        if (!result.ok) {
          respondJson(res, result, 200);
          return;
        }

        await writeState(result.state);
        const updatedBlock = result.state.schedule?.committedBlocks?.find((block) => block.blockId === blockId);
        const goalId = updatedBlock?.goalId || 'unknown';
        const cycleId = updatedBlock?.cycleId || 'unknown';
        const traceId = `trace-block-missed-${Date.now()}`;
        recordTraceSummary({
          traceId,
          goalId,
          cycleId,
          status: 'success',
          integrationStatus: 'PASS',
          criticalFailures: 0,
          events: [
            {
              traceId,
              moduleName: 'CalendarView',
              stepName: 'block_missed',
              status: 'success',
              inputSummary: {
                blockId,
                reason: payload.reason || null
              },
              outputSummary: {
                blockId,
                status: 'missed'
              },
              errorCode: null,
              reasonCodes: [],
              timestamp: new Date().toISOString(),
              sourceReadPath: `/api/schedule/blocks/${blockId}/missed`,
              sourceWritePath: `/api/schedule/blocks/${blockId}/missed`,
              executionTimeMs: 0
            }
          ]
        });
        respondJson(
          res,
          {
            ok: true,
            blockId,
            status: 'missed',
            errorCode: null
          },
          200
        );
        return;
      } catch (error) {
        respondJson(
          res,
          {
            ok: false,
            blockId,
            status: null,
            errorCode: 'SERVER_ERROR'
          },
          200
        );
        return;
      }
    }

    if (req.method === 'POST' && req.url === '/api/pipeline/start') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      const timestamp = Date.now();
      const stubResponse = {
        ok: true,
        goalId: payload.goalId || `goal-${timestamp}`,
        cycleId: `cycle-${timestamp}`,
        traceId: `trace-${timestamp}`,
        errorCode: null
      };

      recordTraceSummary({
        traceId: stubResponse.traceId,
        goalId: stubResponse.goalId,
        cycleId: stubResponse.cycleId,
        status: 'success',
        integrationStatus: 'PASS',
        criticalFailures: 0,
        events: [
          {
            traceId: stubResponse.traceId,
            moduleName: 'pipeline_start',
            stepName: 'confirmation_to_pipeline',
            status: 'success',
            inputSummary: {
              goalFamily: payload.goalFamily || null,
              goalSubtype: payload.goalSubtype || null
            },
            outputSummary: {
              goalId: stubResponse.goalId,
              cycleId: stubResponse.cycleId
            },
            errorCode: null,
            reasonCodes: [],
            timestamp: new Date().toISOString(),
            sourceReadPath: '/goals',
            sourceWritePath: '/api/pipeline/start',
            executionTimeMs: 0
          }
        ]
      });

      respondOk(res, stubResponse);
      return;
    }

    if (req.method === 'GET' && req.url === '/ai/view') {
      const state = await getStateOrError(res);
      if (!state) return;
      const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
      const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
      const normalizedState = normalizeStateForPipeline(state);
      const result = runPipeline(
        goalInput,
        identity,
        normalizedState.history || [],
        normalizedState.tasks || [],
        normalizedState.team
      );
      const scene = compileSceneGraph(result);
      respondOk(res, { scene, raw: result });
      return;
    }

    if (req.method === 'GET' && req.url === '/internal/diagnostics') {
      const state = await getStateOrError(res);
      if (!state) return;
      const diagnostics = buildDiagnostics(state);
      respondOk(res, diagnostics);
      return;
    }
    if (req.method === 'GET' && req.url === '/ai/llm-contract') {
      const contract = getLLMContract();
      respondOk(res, { version: contract.version, updatedAt: contract.updatedAt, contract });
      return;
    }
    if (req.method === 'GET' && req.url.startsWith('/ai/session/view')) {
      const url = new URL(req.url, 'http://localhost');
      const viewerId = url.searchParams.get('viewerId');
      const state = await getStateOrError(res);
      if (!state) return;
      const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
      const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
      const normalizedState = normalizeStateForPipeline(state);
      const result = runPipeline(
        goalInput,
        identity,
        normalizedState.history || [],
        normalizedState.tasks || [],
        normalizedState.team
      );
      const scene = compileSceneGraph(result);
      const directivesResult = planDirectives(state, result);
      const narrative = compileNarrative(state, result);
      const reasoning = buildReasoningStrip({
        pipeline: result,
        narrative,
        directives: directivesResult,
        scene,
        state
      });
      const chain = buildReasoningChain({
        reasoning,
        pipeline: result,
        directives: directivesResult
      });
      const multiGoal = evaluateMultiGoalPortfolio({
        state,
        analysis: { pipeline: result },
        meta: { commands: commandsSpec }
      });
      const integrityDeviations = analyzeIntegrityDeviations(
        result.history || [],
        result.integrity || {},
        result.analysis?.teamGovernance || null
      );
      const session = buildSessionSnapshot({
        state,
        pipelineOutput: result,
        scene,
        narrative,
        directives: directivesResult,
        commandSpec: commandsSpec,
        reasoning,
        chain,
        multiGoal,
        integrityDeviations
      });
      const filtered = filterSessionForViewer(session, viewerId, session.teamRoles, 'team');
      respondOk(res, { ...filtered });
      return;
    }
    if (req.method === 'GET' && req.url === '/ai/llm-suggestions') {
      const state = await getStateOrError(res);
      if (!state) return;
      const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
      const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
      const normalizedState = normalizeStateForPipeline(state);
      const result = runPipeline(
        goalInput,
        identity,
        normalizedState.history || [],
        normalizedState.tasks || [],
        normalizedState.team
      );
      const scene = compileSceneGraph(result);
      const directivesResult = planDirectives(state, result);
      const narrative = compileNarrative(state, result);
      const reasoning = buildReasoningStrip({
        pipeline: result,
        narrative,
        directives: directivesResult,
        scene,
        state
      });
      const chain = buildReasoningChain({
        reasoning,
        pipeline: result,
        directives: directivesResult
      });
      const multiGoal = evaluateMultiGoalPortfolio({
        state,
        analysis: { pipeline: result },
        meta: { commands: commandsSpec }
      });
      const integrityDeviations = analyzeIntegrityDeviations(
        result.history || [],
        result.integrity || {},
        result.analysis?.teamGovernance || null
      );
      const session = buildSessionSnapshot({
        state,
        pipelineOutput: result,
        scene,
        narrative,
        directives: directivesResult,
        commandSpec: commandsSpec,
        reasoning,
        chain,
        multiGoal,
        integrityDeviations
      });
      const suggestions = await runSuggestions({ session });
      respondOk(res, { ...suggestions });
      return;
    }

    if (req.method === 'POST' && req.url === '/ai/command') {
      try {
        const command = await readJsonBody(req);
        const state = await getStateOrError(res);
        if (!state) return;
        const { nextState, effects } = interpretCommand(command, commandsSpec, state);
        await writeState(nextState);
        const goalInput = nextState.goals?.length ? { goals: nextState.goals } : mockGoals;
        const identity = Object.keys(nextState.identity || {}).length ? nextState.identity : mockIdentity;
        const normalizedNext = normalizeStateForPipeline(nextState);
        const result = runPipeline(
          goalInput,
          identity,
          normalizedNext.history || [],
          normalizedNext.tasks || [],
          normalizedNext.team
        );
        const scene = compileSceneGraph(result);
        respondOk(res, { effects, scene, raw: result });
      } catch (err) {
        const status = err?.code === 'INVALID_COMMAND' ? 400 : 500;
        respondError(res, err?.code || 'INVALID_COMMAND', err.message || 'Internal error', status);
      }
      return;
    }

    if (req.method === 'GET' && req.url === '/ai/narrative') {
      const state = await getStateOrError(res);
      if (!state) return;
      const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
      const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
      const normalizedState = normalizeStateForPipeline(state);
      const result = runPipeline(
        goalInput,
        identity,
        normalizedState.history || [],
        normalizedState.tasks || [],
        normalizedState.team
      );
      const scene = compileSceneGraph(result);
      const narrative = compileNarrative(state, result);
      respondOk(res, { narrative, scene, state });
      return;
    }

    if (req.method === 'GET' && req.url === '/ai/directives') {
      const state = await getStateOrError(res);
      if (!state) return;
      const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
      const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
      const normalizedState = normalizeStateForPipeline(state);
      const result = runPipeline(
        goalInput,
        identity,
        normalizedState.history || [],
        normalizedState.tasks || [],
        normalizedState.team
      );
      const directivesResult = planDirectives(state, result);
      const scene = compileSceneGraph(result);
      respondOk(res, {
        directives: directivesResult.directives,
        summary: directivesResult.summary,
        scene,
        raw: result
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/ai/session') {
      const state = await getStateOrError(res);
      if (!state) return;
      const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
      const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
      const normalizedState = normalizeStateForPipeline(state);
      const result = runPipeline(
        goalInput,
        identity,
        normalizedState.history || [],
        normalizedState.tasks || [],
        normalizedState.team
      );
      const scene = compileSceneGraph(result);
      const narrative = compileNarrative(state, result);
      const directivesResult = planDirectives(state, result);
      const reasoning = buildReasoningStrip({
        pipeline: result,
        narrative,
        directives: directivesResult,
        scene,
        state
      });
      const chain = buildReasoningChain({
        reasoning,
        pipeline: result,
        directives: directivesResult
      });
      const multiGoal = evaluateMultiGoalPortfolio({
        state,
        analysis: { pipeline: result },
        meta: { commands: commandsSpec }
      });
      const integrityDeviations = analyzeIntegrityDeviations(
        result.history || [],
        result.integrity || {},
        result.analysis?.teamGovernance || null
      );
      const timestamp = new Date().toISOString();
      const session = buildSessionSnapshot({
        state,
        pipelineOutput: result,
        scene,
        narrative,
        directives: directivesResult,
        commandSpec: commandsSpec,
        reasoning,
        chain,
        multiGoal,
        integrityDeviations
      });
      const teamHud = buildTeamHud(session);
      respondOk(res, { timestamp, session, teamHud });
      return;
    }

    if (req.method === 'GET' && req.url === '/team/export') {
      const state = await getStateOrError(res);
      if (!state) return;
      const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
      const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
      const normalizedState = normalizeStateForPipeline(state);
      const result = runPipeline(
        goalInput,
        identity,
        normalizedState.history || [],
        normalizedState.tasks || [],
        normalizedState.team
      );
      const scene = compileSceneGraph(result);
      const directivesResult = planDirectives(state, result);
      const narrative = compileNarrative(state, result);
      const reasoning = buildReasoningStrip({
        pipeline: result,
        narrative,
        directives: directivesResult,
        scene,
        state
      });
      const chain = buildReasoningChain({
        reasoning,
        pipeline: result,
        directives: directivesResult
      });
      const multiGoal = evaluateMultiGoalPortfolio({
        state,
        analysis: { pipeline: result },
        meta: { commands: commandsSpec }
      });
      const integrityDeviations = analyzeIntegrityDeviations(
        result.history || [],
        result.integrity || {},
        result.analysis?.teamGovernance || null
      );
      const session = buildSessionSnapshot({
        state,
        pipelineOutput: result,
        scene,
        narrative,
        directives: directivesResult,
        commandSpec: commandsSpec,
        reasoning,
        chain,
        multiGoal,
        integrityDeviations
      });
      const exportPayload = buildTeamExport(session);
      respondOk(res, { export: exportPayload });
      return;
    }

    if (req.method === 'GET' && req.url === '/state') {
      const state = await getStateOrError(res);
      if (!state) return;
      respondOk(res, { ...state });
      return;
    }

    if (req.method === 'POST' && req.url === '/goals') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });

      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }

      const currentState = await getStateOrError(res);
      if (!currentState) return;

      const isStructuredGoalPayload =
        typeof payload.rawGoalStatement === 'string' &&
        typeof payload.normalizedGoalStatement === 'string' &&
        typeof payload.goalFamily === 'string' &&
        typeof payload.goalSubtype === 'string';

      let goalId = payload.goalId || `goal-${Date.now()}`;
      let nextState = null;

      if (isStructuredGoalPayload) {
        const goalText = payload.normalizedGoalStatement.trim() || payload.rawGoalStatement.trim();
        if (!goalText) {
          respondError(res, 'INVALID_GOAL', 'Goal text is required.', 400);
          return;
        }

        const existingGoals = Array.isArray(currentState.goals) ? currentState.goals : [];
        const dedupedGoals = Array.from(new Set([...existingGoals, goalText]));
        const goalRecord = {
          ...payload,
          goalId,
          createdAt: new Date().toISOString()
        };
        const existingGoalRecords = Array.isArray(currentState.goalRecords) ? currentState.goalRecords : [];
        nextState = {
          ...currentState,
          goals: dedupedGoals,
          goalRecords: [...existingGoalRecords, goalRecord]
        };
      } else {
        let text =
          (typeof payload.text === 'string' && payload.text) ||
          (typeof payload.goal === 'string' && payload.goal) ||
          (typeof payload.goalText === 'string' && payload.goalText) ||
          Object.values(payload).find((v) => typeof v === 'string');

        if (!text || !text.trim()) {
          respondError(res, 'INVALID_GOAL', 'Goal text is required.', 400);
          return;
        }

        text = text.trim();
        const definite = validateDefiniteGoal(text);
        if (!definite.ok) {
          respondError(
            res,
            'INVALID_DEFINITE_GOAL',
            'Goal must be specific, measurable, and time-bound.',
            400,
            { details: definite.errors }
          );
          return;
        }

        const existingGoals = currentState.goals || [];
        const withNew = [...existingGoals, text];
        const seen = new Set();
        const dedupedGoals = [];
        for (let i = withNew.length - 1; i >= 0; i--) {
          const g = withNew[i];
          if (!seen.has(g)) {
            seen.add(g);
            dedupedGoals.unshift(g);
          }
        }
        nextState = {
          ...currentState,
          goals: dedupedGoals
        };
      }

      try {
        await writeState(nextState);
        respondOk(res, isStructuredGoalPayload ? { goalId } : { goals: nextState.goals });
      } catch (err) {
        respondError(res, 'WRITE_FAILED', 'Failed to save goal.', 500);
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/identity') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });
      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }
      if (!payload?.domain || !payload?.capability || payload.level === undefined) {
        respondError(res, 'INVALID_IDENTITY', 'domain, capability, and level required', 400);
        return;
      }
      if (typeof payload.domain !== 'string' || typeof payload.capability !== 'string') {
        respondError(res, 'INVALID_IDENTITY', 'domain and capability must be strings', 400);
        return;
      }
      const levelNum = clampLevel(payload.level);
      if (levelNum === null) {
        respondError(res, 'INVALID_IDENTITY_LEVEL', 'level must be numeric between 0 and 10', 400);
        return;
      }
      const currentState = await getStateOrError(res);
      if (!currentState) return;
      const identity = { ...(currentState.identity || {}) };
      const domainKey = payload.domain;
      const capabilityKey = payload.capability;
      identity[domainKey] = identity[domainKey] || {};
      identity[domainKey][capabilityKey] = { level: levelNum };
      const nextState = { ...currentState, identity };
      try {
        await writeState(nextState);
        respondOk(res, { status: 'ok' });
      } catch (err) {
        respondError(res, 'WRITE_FAILED', 'Failed to update identity.', 500);
      }
      return;
    }

    if (req.method === 'PATCH' && req.url === '/identity') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });
      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }
      const updates = payload?.updates;
      if (!updates || typeof updates !== 'object') {
        respondError(res, 'INVALID_IDENTITY', 'Identity updates are required.', 400);
        return;
      }
      for (const [capId, value] of Object.entries(updates)) {
        if (typeof capId !== 'string' || !capId.includes('.')) {
          respondError(res, 'INVALID_IDENTITY', 'capability ids must be domain.capability', 400);
          return;
        }
        const level = clampLevel(value);
        if (level === null) {
          respondError(res, 'INVALID_IDENTITY_LEVEL', 'levels must be numeric between 0 and 10', 400);
          return;
        }
      }

      const currentState = await getStateOrError(res);
      if (!currentState) return;
      const identity = { ...(currentState.identity || {}) };
      Object.entries(updates).forEach(([capId, value]) => {
        const level = clampLevel(value);
        if (level === null) return;
        const [domain, capability] = capId.split('.');
        identity[domain] = identity[domain] || {};
        identity[domain][capability] = { level };
      });
      const nextState = { ...currentState, identity };
      try {
        const written = await writeState(nextState);
        respondOk(res, { identity: written.identity || {} });
      } catch (err) {
        respondError(res, 'WRITE_FAILED', 'Failed to update identity.', 500);
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/tasks') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });
      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }
      if (!payload?.id || typeof payload.id !== 'string' || !payload?.status) {
        respondError(res, 'INVALID_TASK', 'id and status required', 400);
        return;
      }
      if (!['completed', 'missed', 'pending'].includes(payload.status)) {
        respondError(res, 'INVALID_TASK_STATUS', 'Invalid status.', 400);
        return;
      }
      const currentState = await getStateOrError(res);
      if (!currentState) return;
      const updatedState = applyTaskStatusToState(currentState, payload.id, payload.status);
      try {
        await writeState(updatedState);
        respondOk(res, { status: 'ok' });
      } catch (err) {
        respondError(res, 'WRITE_FAILED', 'Failed to update task.', 500);
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/task-status') {
      let badJson = false;
      const payload = await readJsonBody(req).catch(() => {
        badJson = true;
        return {};
      });
      if (badJson) {
        respondError(res, 'BAD_JSON', 'Request body must be valid JSON.', 400);
        return;
      }
      const { taskId, status } = payload || {};
      if (!taskId || typeof taskId !== 'string') {
        respondError(res, 'INVALID_TASK', 'taskId is required.', 400);
        return;
      }
      if (!['completed', 'missed'].includes(status)) {
        respondError(res, 'INVALID_TASK_STATUS', 'Invalid status.', 400);
        return;
      }
      const currentState = await getStateOrError(res);
      if (!currentState) return;
      const updatedState = applyTaskStatusToState(currentState, taskId, status);
      try {
        const written = await writeState(updatedState);
        const snapshot = buildIdentitySnapshot({
          capabilities: buildCapabilitiesFromState(written.identity),
          integrity: written.integrity,
          history: written.history || []
        });
        appendIdentitySnapshot('default', snapshot);
        respondOk(res, { state: written });
      } catch (err) {
        respondError(res, 'WRITE_FAILED', 'Failed to update task.', 500);
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/cycle/next') {
      try {
        const state = await getStateOrError(res);
        if (!state) return;
        const normalizedState = normalizeStateForPipeline({
          goals: state.goals || [],
          identity: state.identity || {},
          history: state.history || [],
          tasks: state.tasks || [],
          team: state.team || []
        });
        const goalInput = normalizedState.goals?.length ? { goals: normalizedState.goals } : mockGoals;
        const identity = Object.keys(normalizedState.identity || {}).length ? normalizedState.identity : mockIdentity;
        const result = runPipeline(
          goalInput,
          identity,
          normalizedState.history || [],
          normalizedState.tasks || [],
          normalizedState.team
        );
        const nextState = {
          ...state,
          goals: state.goals || [],
          identity: result.identity || state.identity || {},
          history: result.history || state.history || [],
          tasks: result.tasks || [],
          team: result.team || state.team || [],
          integrity: result.integrity || state.integrity || {}
        };
        await writeState(nextState);
        const snapshot = buildIdentitySnapshot({
          capabilities: buildCapabilitiesFromRequirements(result.requirements || [], nextState.identity),
          integrity: result.integrity,
          history: nextState.history || []
        });
        appendIdentitySnapshot('default', snapshot);
        logAdvisoryDiagnostics('default', nextState, result, normalizedState);
        console.log(
          `[cycle/next] integrity=${result?.integrity?.score ?? 'n/a'} tasks=${result?.tasks?.length ?? 0} history=${result?.history?.length ?? 0}`
        );
        respondOk(res, { pipeline: result, state: nextState });
      } catch (err) {
        respondError(res, 'PIPELINE_ERROR', err.message || 'Pipeline execution failed.', 500);
      }
      return;
    }

    if (req.method === 'POST' && req.url === '/reset') {
      await writeState({ goals: [], identity: {}, history: [] });
      respondOk(res, { status: 'reset' });
      return;
    }

    respondError(res, 'NOT_FOUND', 'Not found', 404);
  } catch (err) {
    respondError(res, 'SERVER_ERROR', err.message || 'server error', 500);
  }
});

server.listen(port, () => {
  process.stdout.write(`Jericho API listening on http://localhost:${port}\n`);
});

function enableCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function respondJson(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

function respondOk(res, payload = {}) {
  respondJson(res, { ok: true, ...payload }, 200);
}

function respondError(res, errorCode, reason, status = 500, extra = {}) {
  respondJson(res, { ok: false, errorCode, reason, ...extra }, status);
}

function resolveGoalStructureResponse({
  rawGoalStatement,
  timeframe,
  priorityLevel,
  currentStatus,
  clarificationLog = [],
  forceResolution = false
}) {
  const normalizedStatement = String(rawGoalStatement || '').trim();
  const normalizedTimeframe = String(timeframe || '').trim();
  const normalizedClarificationLog = Array.isArray(clarificationLog) ? clarificationLog : [];
  const clarificationText = normalizedClarificationLog
    .map((entry) => entry?.userResponse || '')
    .join(' ')
    .toLowerCase();

  if (normalizedStatement.length < 10) {
    return {
      resolved: false,
      needsClarification: false,
      goalFamily: null,
      goalSubtype: null,
      normalizedGoalStatement: normalizedStatement,
      targetDeadline: null,
      deadlineConfidence: 'LOW',
      errorCode: 'INVALID_GOAL_INPUT'
    };
  }

  const family = resolveGoalFamily(normalizedStatement, clarificationText, forceResolution);
  if (!family) {
    return {
      resolved: false,
      needsClarification: true,
      clarificationQuestion: 'Is this about launching something new or improving an existing skill?',
      clarificationOptions: ['Launching something new', 'Building a skill'],
      goalFamily: null,
      goalSubtype: null,
      normalizedGoalStatement: normalizedStatement,
      targetDeadline: null,
      deadlineConfidence: 'LOW',
      errorCode: null
    };
  }

  const subtype = resolveGoalSubtype(normalizedStatement, clarificationText, family, forceResolution);
  if (!subtype) {
    return {
      resolved: false,
      needsClarification: false,
      clarificationQuestion: null,
      clarificationOptions: null,
      goalFamily: family,
      goalSubtype: null,
      normalizedGoalStatement: normalizedStatement,
      targetDeadline: null,
      deadlineConfidence: 'LOW',
      errorCode: 'SUBTYPE_UNRESOLVABLE'
    };
  }

  const timeframeResolution = resolveTimeframe(normalizedTimeframe);
  const targetDeadline =
    timeframeResolution.targetDeadline ||
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  return {
    resolved: true,
    needsClarification: false,
    clarificationQuestion: null,
    clarificationOptions: null,
    goalFamily: family,
    goalSubtype: subtype,
    normalizedGoalStatement: normalizedStatement,
    targetDeadline,
    deadlineConfidence: timeframeResolution.deadlineConfidence,
    deadlineType: 'TARGET',
    priorityLevel,
    currentStatus,
    errorCode: null
  };
}

function buildFeasibilityRawInputs({ targetDeadline, capacityInputs, familySpecificInputs = {}, deadlineType }) {
  return {
    availableHoursPerWeek: Number(capacityInputs?.hoursPerWeek) || 0,
    availableDays: Array.isArray(capacityInputs?.availableDays) ? capacityInputs.availableDays : [],
    sessionLengthPreference: mapSessionLengthPreference(capacityInputs?.sessionLengthMinutes),
    hardBlackoutPeriods: [],
    goalStartDate: new Date().toISOString(),
    goalDeadline: targetDeadline,
    deadlineType: deadlineType || 'TARGET',
    currentLoadLevel: mapCurrentLoadLevel(capacityInputs?.currentLoad),
    priorExperience: mapPriorExperience(capacityInputs?.experienceLevel),
    externalDependencyCount: mapExternalDependencies(capacityInputs?.externalDependencies),
    familySpecificInputs: mapFamilySpecificInputs(familySpecificInputs)
  };
}

function mapFeasibilityResult(feasibility) {
  const feasibilityScore = Number(feasibility?.baselineFeasibilityScore) || 0;
  return {
    feasibilityScore,
    feasibilityBand: mapFeasibilityBand(feasibilityScore),
    factorBreakdown: mapFactorBreakdown(feasibility?.factorBreakdown || [])
  };
}

function mapSessionLengthPreference(minutes) {
  switch (Number(minutes)) {
    case 30:
      return '30_min';
    case 120:
      return '2_hours';
    case 60:
    default:
      return '1_hour';
  }
}

function mapCurrentLoadLevel(load) {
  switch (load) {
    case 'LIGHT':
      return 'light';
    case 'HEAVY':
      return 'heavy';
    case 'OVERLOADED':
      return 'overloaded';
    case 'MODERATE':
    default:
      return 'moderate';
  }
}

function mapPriorExperience(experienceLevel) {
  switch (experienceLevel) {
    case 'NOVICE':
      return 'novice';
    case 'DONE_BEFORE':
      return 'done_this_before';
    case 'SOME':
    default:
      return 'some_experience';
  }
}

function mapExternalDependencies(externalDependencies) {
  switch (externalDependencies) {
    case 'NONE':
      return 0;
    case 'THREE_FOUR':
      return 4;
    case 'FIVE_PLUS':
      return 5;
    case 'ONE_TWO':
    default:
      return 2;
  }
}

function mapFamilySpecificInputs(familySpecificInputs = {}) {
  return {
    teamSize: familySpecificInputs.teamSize || 'solo',
    budgetAvailable: familySpecificInputs.budgetAllocated ? 10000 : 0,
    currentSkillLevel: mapSkillBaseline(familySpecificInputs.skillBaseline),
    priorAttemptHistory: familySpecificInputs.examDateFixed ? 'scheduled_attempt' : 'none',
    anyInjuryConstraints: Boolean(familySpecificInputs.hasConstraints),
    currentEmploymentStatus: familySpecificInputs.currentlyEmployed ? 'employed' : 'unemployed',
    draftExists: Boolean(familySpecificInputs.hasExistingWork),
    existingAudienceSize: familySpecificInputs.hasExistingAudience ? 1000 : 0,
    existingPipeline: familySpecificInputs.hasExistingPipeline ? 'active' : 'zero',
    priorRaiseHistory: familySpecificInputs.hasInvestorRelationships ? 'existing_relationships' : 'none'
  };
}

function mapSkillBaseline(skillBaseline) {
  switch (skillBaseline) {
    case 'ZERO':
      return 'novice';
    case 'INTERMEDIATE':
      return 'intermediate';
    case 'BEGINNER':
    default:
      return 'beginner';
  }
}

function mapFeasibilityBand(score) {
  if (score >= 75) return 'GREEN';
  if (score >= 45) return 'YELLOW';
  if (score >= 20) return 'ORANGE';
  return 'RED';
}

function mapFactorBreakdown(factorBreakdown = []) {
  return factorBreakdown.map((factor) => {
    const weight = getFactorWeight(factor.factor);
    const contribution = Number(factor.contribution) || 0;
    const score = weight > 0 ? Math.max(0, Math.min(100, Math.round((contribution / weight) * 100))) : 0;
    return {
      factor: factor.factor,
      score,
      weight
    };
  });
}

function getFactorWeight(factorName) {
  switch (factorName) {
    case 'available hours':
      return 25;
    case 'load modifier':
      return 20;
    case 'experience modifier':
      return 15;
    case 'external dependency risk':
      return 15;
    case 'timeline compression':
      return 25;
    default:
      return 0;
  }
}

function buildFeasibilitySummary(feasibility, feasibilityBand) {
  if (feasibilityBand === 'ORANGE') {
    const score = Number(feasibility?.baselineFeasibilityScore) || 0;
    const limitingFactors = Array.isArray(feasibility?.limitingFactors) ? feasibility.limitingFactors : [];
    let summary =
      `This goal is at risk with your current capacity. The score of ${score} suggests meaningful adjustments are needed before scheduling.`;
    if (limitingFactors.length > 0) {
      summary += ` Key factors: ${limitingFactors.join(', ')}.`;
    }
    return summary;
  }

  return getFeasibilityInterpretation({
    ...feasibility,
    feasibilityBand
  });
}

function resolveGoalFamily(rawGoalStatement, clarificationText, forceResolution) {
  const input = `${rawGoalStatement} ${clarificationText}`.toLowerCase();

  if (/(raise|fund|investor|seed|angel|grant|sponsor)/i.test(input)) return 'Fundraising';
  if (/(launch|startup|start company|saas|app|product|business)/i.test(input)) return 'VentureLaunch';
  if (/(learn|skill|practice|improve|study)/i.test(input)) return 'SkillAcquisition';
  if (/(certification|license|exam|credential)/i.test(input)) return 'ProfessionalQualification';
  if (/(fitness|training|weight|marathon|strength|conditioning)/i.test(input)) return 'PhysicalTraining';
  if (/(job|career|employment|interview|hire)/i.test(input)) return 'JobSearchPipeline';
  if (/(write|book|podcast|music|video|series|publish)/i.test(input)) return 'CreativeProduction';
  if (/(brand|audience|following|campaign)/i.test(input)) return 'BrandLaunch';
  if (/(sales|revenue|close deals|pipeline)/i.test(input)) return 'SalesPipeline';

  if (/launching something new/i.test(clarificationText)) return 'VentureLaunch';
  if (/building a skill/i.test(clarificationText)) return 'SkillAcquisition';

  return forceResolution ? 'VentureLaunch' : null;
}

function resolveGoalSubtype(rawGoalStatement, clarificationText, family, forceResolution) {
  const input = `${rawGoalStatement} ${clarificationText}`.toLowerCase();
  const subtypeRules = {
    VentureLaunch: [
      [/saas|software|app|subscription|platform/i, 'SaaS Product Launch'],
      [/consumer|physical|ecommerce|product/i, 'Consumer Product Launch'],
      [/service|agency|consulting|freelance/i, 'Service Business Launch'],
      [/marketplace|two-sided/i, 'Marketplace Launch'],
      [/local|storefront|restaurant|gym/i, 'Local Business Launch']
    ],
    SkillAcquisition: [
      [/coding|programming|software|engineering|technical/i, 'Software Skill Acquisition'],
      [/design|ux|ui|visual|graphic/i, 'Design Skill Acquisition'],
      [/speaking|communication|writing|presenting/i, 'Communication Skill Acquisition'],
      [/trade|welding|plumbing|electrical|mechanical/i, 'Technical Trade Skill Acquisition'],
      [/music|art|drawing|creative|photography/i, 'Creative Skill Acquisition']
    ],
    ProfessionalQualification: [
      [/certification|exam/i, 'Certification Exam'],
      [/license|licensure/i, 'Licensure Exam'],
      [/compliance|mandatory training/i, 'Compliance Training Completion'],
      [/portfolio/i, 'Portfolio-Based Qualification'],
      [/interview|panel/i, 'Interview-Based Qualification']
    ],
    PhysicalTraining: [
      [/strength|lifting|muscle/i, 'Strength Program'],
      [/running|cycling|swimming|race|endurance/i, 'Endurance Performance'],
      [/weight loss|body composition|fat loss/i, 'Weight Loss / Body Composition'],
      [/rehab|injury|recovery/i, 'Rehab Return to Training'],
      [/fitness|conditioning|general/i, 'General Conditioning']
    ],
    JobSearchPipeline: [
      [/corporate|enterprise/i, 'Corporate Role Search'],
      [/remote|distributed/i, 'Remote Knowledge Work Search'],
      [/creative|design|writer|artist/i, 'Creative Role Search'],
      [/trade|apprenticeship|union/i, 'Skilled Trade Role Search'],
      [/transition|pivot|career change/i, 'Career Transition Search']
    ],
    CreativeProduction: [
      [/tv|series|screenplay/i, 'TV / Series Writing'],
      [/podcast|audio|episode/i, 'Podcast Production'],
      [/album|\bep\b|song|music/i, 'Music Project Production'],
      [/video|film|youtube|documentary/i, 'Video Production'],
      [/book|novel|manuscript|memoir/i, 'Book / Longform Writing']
    ],
    BrandLaunch: [
      [/personal brand|thought leadership/i, 'Personal Brand Launch'],
      [/business brand|company brand/i, 'Business Brand Launch'],
      [/product brand/i, 'Product Brand Launch'],
      [/artist|creator/i, 'Artist / Creator Brand Launch'],
      [/campaign/i, 'Campaign Brand Launch']
    ],
    SalesPipeline: [
      [/b2b|enterprise/i, 'B2B Service Sales'],
      [/b2c|consumer|retail/i, 'B2C Product Sales'],
      [/high-ticket|consultative/i, 'High-Ticket Consultative Sales'],
      [/local|in-person/i, 'Retail / Local Offer Sales'],
      [/subscription|recurring|membership/i, 'Subscription / Recurring Revenue Sales']
    ],
    Fundraising: [
      [/friends and family|friends|family/i, 'Friends and Family Raise'],
      [/angel/i, 'Angel Raise'],
      [/seed/i, 'Seed Round Raise'],
      [/grant|non-dilutive/i, 'Grant / Non-Dilutive Funding'],
      [/sponsor|partnership/i, 'Sponsorship / Partnership Raise']
    ]
  };

  for (const [pattern, subtype] of subtypeRules[family] || []) {
    if (pattern.test(input)) return subtype;
  }

  if (forceResolution) {
    const fallbackSubtype = {
      VentureLaunch: 'SaaS Product Launch',
      SkillAcquisition: 'Software Skill Acquisition',
      ProfessionalQualification: 'Certification Exam',
      PhysicalTraining: 'Strength Program',
      JobSearchPipeline: 'Corporate Role Search',
      CreativeProduction: 'TV / Series Writing',
      BrandLaunch: 'Personal Brand Launch',
      SalesPipeline: 'B2B Service Sales',
      Fundraising: 'Seed Round Raise'
    };
    return fallbackSubtype[family] || null;
  }

  return null;
}

async function getStateOrError(res) {
  const result = await safeReadState();
  if (!result.ok) {
    respondError(res, 'BAD_STATE', result.reason, 500);
    return null;
  }
  return normalizeStateForPipeline(result.state);
}

function buildDiagnostics(state) {
  const goalInput = state.goals?.length ? { goals: state.goals } : mockGoals;
  const identity = Object.keys(state.identity || {}).length ? state.identity : mockIdentity;
  const pipelineResult = runPipeline(
    goalInput,
    identity,
    state.history || [],
    state.tasks || [],
    state.team
  );

  const identityState = [];
  const requirements = pipelineResult.requirements || [];
  const identityObj = pipelineResult.identityAfter || {};
  requirements.forEach((req) => {
    const current = identityObj?.[req.domain]?.[req.capability]?.level ?? 0;
    const target = req.targetLevel ?? 0;
    const driftRatio = target > 0 ? current / target : 0;
    identityState.push({
      capabilityName: `${req.domain}.${req.capability}`,
      currentLevel: current,
      targetLevel: target,
      gap: target - current,
      driftRatio
    });
  });

  const pressureMap = [...identityState]
    .map((row) => ({
      ...row,
      pressureScore: 1 - (row.driftRatio || 0)
    }))
    .sort((a, b) => b.pressureScore - a.pressureScore);

  const history = state.history || [];
  const tasksById = new Map((state.tasks || []).map((t) => [t.id, t]));
  const reinforcementFeed = history
    .slice(-10)
    .reverse()
    .map((entry) => {
      const task = tasksById.get(entry.taskId) || {};
      return {
        taskName: task.title || task.name || entry.taskId || 'task',
        result: entry.status || 'unknown',
        reinforcementDelta: 0,
        identityUpdateDelta: entry?.integrity?.breakdown || {},
        integrityDelta: entry?.integrity?.scoreDelta ?? null
      };
    });

  const integrityCurve = history.map((h, idx) => ({
    cycle: idx + 1,
    score: h?.integrity?.score ?? 0
  }));

  const integrityScore = pipelineResult.integrity?.score ?? 0;
  const selectedTier =
    integrityScore < 30 ? 'T1' : integrityScore < 70 ? 'T2' : 'T3';
  const tierReason =
    integrityScore < 30
      ? 'Low integrity → foundation tasks'
      : integrityScore < 70
        ? 'Moderate integrity → production tasks'
        : 'High integrity → scaling tasks';
  const taskLadder = {
    currentIntegrity: integrityScore,
    selectedTier,
    reason: tierReason,
    generatedTasks: pipelineResult.tasks || []
  };

  const cycleReport = history.slice(-10).map((h, idx) => {
    const completed = (h?.integrity?.breakdown?.completedOnTime || 0) + (h?.integrity?.breakdown?.completedLate || 0);
    return {
      cycleNumber: history.length - 10 + idx + 1,
      tasksGenerated: (state.tasks || []).length,
      tasksCompleted: completed,
      driftChanges: h?.changes || [],
      identityUpdates: h?.changes || [],
      integrityBefore: null,
      integrityAfter: h?.integrity?.score ?? 0
    };
  });

  const identitySnapshot = buildIdentitySnapshot({
    capabilities: buildCapabilitiesFromRequirements(pipelineResult.requirements || [], identity),
    integrity: pipelineResult.integrity,
    history
  });
  const identityHistory = getIdentityHistory('default', 10);
  const pacingMode = pipelineResult ? null : null;
  const forecast = forecastIdentityTrajectory({ history: identityHistory, horizonCycles: 5 });
  const riskLabel = classifyRiskFromForecast(forecast);
  const narrative = interpretIdentityNarrative({ goalText: goalInput.goals?.[0] || '', identityHistory });
  const capabilityArcs = planCapabilityArcs({
    capabilities: identitySnapshot.capabilities || []
  });
  const coherence = auditCoherence({
    integritySlope: identitySnapshot.integrity?.slope || 0,
    pressureVariance: variance(identitySnapshot.capabilities?.map((c) => c.pressureScore) || []),
    pacingMode: 'build'
  });

  return {
    identityState,
    pressureMap,
    reinforcementFeed,
    integrityCurve,
    taskLadder,
    cycleReport,
    identitySnapshot,
    identityHistory,
    jericho6: {
      pacingMode,
      forecast,
      riskLabel,
      narrative,
      capabilityArcs,
      coherence
    },
    advisoryDiagnostics: getLatestDiagnostics('default')?.diagnostics || null
  };
}

function buildCapabilitiesFromRequirements(requirements = [], identityObj = {}) {
  if (!requirements.length) return Object.entries(identityObj || {}).flatMap(([domain, caps]) =>
    Object.entries(caps || {}).map(([capKey, val]) => ({
      id: `${domain}.${capKey}`,
      domain,
      capability: capKey,
      currentLevel: val?.level || 0,
      targetLevel: val?.targetLevel || val?.level || 0
    }))
  );
  return requirements.map((req) => {
    const current = identityObj?.[req.domain]?.[req.capability]?.level || 0;
    return {
      id: req.requirementId || `${req.domain}.${req.capability}`,
      domain: req.domain,
      capability: req.capability,
      currentLevel: current,
      targetLevel: req.targetLevel ?? current
    };
  });
}

function buildCapabilitiesFromState(identityObj = {}) {
  return Object.entries(identityObj || {}).flatMap(([domain, caps]) =>
    Object.entries(caps || {}).map(([capKey, val]) => ({
      id: `${domain}.${capKey}`,
      domain,
      capability: capKey,
      currentLevel: val?.level || 0,
      targetLevel: val?.targetLevel || val?.level || 0
    }))
  );
}

function variance(arr = []) {
  if (!arr.length) return 0;
  const avg = arr.reduce((a, b) => a + (Number(b) || 0), 0) / arr.length;
  return (
    arr.reduce((acc, n) => {
      const d = (Number(n) || 0) - avg;
      return acc + d * d;
    }, 0) / arr.length
  );
}

function integrityToBand(score) {
  if (score == null) return 'medium';
  if (score < 20) return 'very_low';
  if (score < 40) return 'low';
  if (score < 70) return 'medium';
  if (score < 90) return 'high';
  return 'very_high';
}

function logAdvisoryDiagnostics(userId, nextState, pipelineResult, normalizedState) {
  const unified = {
    userId: userId || 'default',
    identity: nextState.identity || {},
    capabilities: buildCapabilitiesFromRequirements(pipelineResult.requirements || [], nextState.identity),
    driftPressure: { value: 0 },
    integrityScore: pipelineResult.integrity?.score ?? 0,
    integrityBand: integrityToBand(pipelineResult.integrity?.score ?? 0),
    history: normalizedState.history || [],
    permissions: nextState.permissions || [],
    socialProfile: nextState.socialProfile,
    teamModel: nextState.team,
    snapshots: nextState.snapshots || [],
    orbContext: nextState.orbContext || {}
  };
  const advisory = computeAdvisoryDiagnostics(unified);
  setLatestDiagnostics(userId || 'default', advisory);
}

function clampLevel(level) {
  const num = Number(level);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(10, num));
}

function makeHistoryEntry(task, status) {
  const domain = task?.domain || task?.capabilityDomain || 'unknown';
  const capability = task?.capability || task?.capabilityId || 'unknown';
  return {
    id: task?.id || 'unknown',
    taskId: task?.id || 'unknown',
    domain,
    capability,
    tier: task?.tier || 'foundation',
    effortMinutes: task?.effortMinutes ?? 60,
    goalLink: task?.goalLink || 'goal',
    status,
    timestamp: new Date().toISOString(),
    integrity: {
      score: 0,
      breakdown: {}
    }
  };
}

function applyTaskStatusToState(state, taskId, status) {
  const tasks = Array.isArray(state.tasks) ? [...state.tasks] : [];
  let found = false;
  let matchedTask = null;
  const updatedTasks = tasks.map((task) => {
    if (task.id === taskId) {
      found = true;
      matchedTask = task;
      return { ...task, status };
    }
    return task;
  });
  if (!found) {
    matchedTask = {
      id: taskId,
      status,
      domain: 'unknown',
      capability: 'unknown',
      tier: 'foundation',
      effortMinutes: 60,
      goalLink: 'goal'
    };
    updatedTasks.push(matchedTask);
  }
  const history = Array.isArray(state.history) ? [...state.history] : [];
  history.push(makeHistoryEntry(matchedTask, status));
  return { ...state, tasks: updatedTasks, history };
}

function updateScheduleBlockStatus(state, blockId, status, meta = {}) {
  const committedBlocks = Array.isArray(state.schedule?.committedBlocks) ? state.schedule.committedBlocks : [];
  const existingBlock = committedBlocks.find((block) => block.blockId === blockId);

  if (!existingBlock) {
    return {
      ok: false,
      blockId,
      status: null,
      errorCode: 'BLOCK_NOT_FOUND'
    };
  }

  const nextBlocks = committedBlocks.map((block) => {
    if (block.blockId !== blockId) {
      return block;
    }

    if (status === 'completed') {
      return {
        ...block,
        status: 'completed',
        completedAt: meta.completedAt || new Date().toISOString(),
        actualDate: meta.completedAt || new Date().toISOString(),
        missedAt: null,
        missReason: null
      };
    }

    return {
      ...block,
      status: 'missed',
      missedAt: meta.missedAt || new Date().toISOString(),
      missReason: meta.missReason || null,
      actualDate: null,
      completedAt: null
    };
  });

  return {
    ok: true,
    state: {
      ...state,
      schedule: {
        ...state.schedule,
        committedBlocks: nextBlocks
      }
    }
  };
}

function validateDefiniteGoal(text) {
  const trimmed = (text || '').trim();
  const errors = [];

  if (trimmed.length < 20) errors.push('Goal must be at least 20 characters long.');
  if (trimmed.length > 280) errors.push('Goal must be at most 280 characters long.');

  if (!/\d/.test(trimmed)) errors.push('Goal must include at least one number for measurability.');

  const hasDate =
    /\b\d{4}-\d{2}-\d{2}\b/.test(trimmed) || // YYYY-MM-DD
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(trimmed); // MM/DD/YYYY or similar
  const hasMonthYear = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}\b/i.test(
    trimmed
  );
  const hasRelative =
    /\bby\b\s+(next\s+\w+|the\s+end\s+of\s+q[1-4]|q[1-4]|\d+\s+\w+)/i.test(trimmed) ||
    /\bwithin\s+\d+\s+(days?|weeks?|months?|years?)\b/i.test(trimmed);

  if (!hasDate && !hasMonthYear && !hasRelative) {
    errors.push('Goal must include a clear time limit (date, month+year, or relative timeframe).');
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 3) errors.push('Goal must contain at least 3 words.');

  if (trimmed && trimmed === trimmed.toUpperCase()) {
    errors.push('Goal should not be all uppercase.');
  }

  return { ok: errors.length === 0, errors };
}

function mapTimeOfDayPreference(value) {
  if (value === 'MORNING') return 'morning';
  if (value === 'AFTERNOON') return 'afternoon';
  if (value === 'EVENING') return 'evening';
  return 'flexible';
}

function mapPacingPreference(value) {
  if (value === 'FRONT_LOADED') return 'front-load';
  if (value === 'BACK_LOADED') return 'back-load';
  return 'steady';
}

function expandBlockedPeriodsToDates(blockedPeriods = []) {
  const dates = [];

  blockedPeriods.forEach((period) => {
    if (!period?.start || !period?.end) {
      return;
    }

    const current = new Date(period.start);
    const end = new Date(period.end);
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
  });

  return dates;
}

function emptyScheduleProposalResponse(errorCode = 'SERVER_ERROR') {
  return {
    ok: false,
    proposedBlocks: [],
    unscheduledItems: [],
    coveragePercent: 0,
    proposalSummary: {
      totalBlocks: 0,
      totalHours: 0,
      firstBlockDate: null,
      lastBlockDate: null,
      pacingActual: null
    },
    schedulingStatus: 'FAILED',
    errorCode
  };
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
