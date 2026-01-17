/**
 * Jericho API server (single backend entrypoint).
 * - Listens on port 3000.
 * - Frontend calls: /health, /state, /goals, /identity, /tasks, /task-status, /cycle/next, /pipeline, /ai/*.
 * - ESM only; no CommonJS entrypoints.
 * - Always returns JSON; mutating routes return structured errors instead of crashing.
 */
import http from 'http';
import { runPipeline } from '../core/pipeline.js';
import { mockGoals, mockIdentity } from '../data/mock-data.js';
import { writeState, safeReadState } from '../data/storage.js';
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
import commandsSpec from '../ai/commands-spec.json' with { type: 'json' };

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

    if (req.method === 'GET' && req.url === '/pipeline') {
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
      const snapshot = buildIdentitySnapshot({
        capabilities: buildCapabilitiesFromRequirements(result.requirements || [], identity),
        integrity: result.integrity,
        history: normalizedState.history || []
      });
      appendIdentitySnapshot('default', snapshot);
      logAdvisoryDiagnostics('default', state, result, normalizedState);
      respondOk(res, { ...result, state });
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

      console.log('Incoming goal payload:', payload);

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

      const currentState = await getStateOrError(res);
      if (!currentState) return;
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
      const nextState = {
        ...currentState,
        goals: dedupedGoals
      };
      try {
        await writeState(nextState);
        respondOk(res, { goals: dedupedGoals });
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
