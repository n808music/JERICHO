#!/usr/bin/env node
/**
 * Export the full master-plan schedule (all horizon blocks with payloads).
 *
 * Usage:
 *   node scripts/exportMasterPlanSchedule.mjs <identity-json-in> <extract-json-out>
 *
 * Reads a persisted identity-state snapshot, calls buildFullHorizonScheduleExport
 * to recompute the full-horizon block set (the engine produces these every
 * compute tick but doesn't persist payloads), and writes a structured extract
 * suitable for the docx generator.
 */
import fs from 'node:fs';
import path from 'node:path';

import { buildFullHorizonScheduleExport } from '../src/domain/masterPlan/exportFullHorizonSchedule.js';

function fail(msg) {
  process.stderr.write(`exportMasterPlanSchedule: ${msg}\n`);
  process.exit(1);
}

const [, , inPathArg, outPathArg] = process.argv;
if (!inPathArg || !outPathArg) {
  fail('usage: node scripts/exportMasterPlanSchedule.mjs <identity-json-in> <extract-json-out>');
}

const inPath = path.resolve(inPathArg);
const outPath = path.resolve(outPathArg);

if (!fs.existsSync(inPath)) fail(`input file not found: ${inPath}`);

const state = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
const result = buildFullHorizonScheduleExport(state);

if (!result) fail('no master plan with a derivable horizon in the input state');

const plan = result.plan;

const laneMap = {};
for (const lane of result.lanes) {
  laneMap[lane.id] = {
    title: lane.title,
    domain: lane.domain,
    role: lane.role,
    activationState: lane.activationState,
    assessedStage: lane.assessedStage,
    userDescription: lane.userDescription,
    priorityScore: lane.priorityScore,
    milestoneCount: (lane.milestoneIds || []).length,
  };
}

const milestones = result.milestones
  .map((m) => ({
    id: m.id,
    laneId: m.laneId,
    laneTitle: laneMap[m.laneId]?.title || '(unknown)',
    title: m.title,
    description: m.description,
    milestoneType: m.milestoneType,
    targetDate: m.targetDate,
    flex: m.flex,
    status: m.status,
    missConsequence: m.missConsequence,
    origin: m.origin,
  }))
  .sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));

const cycleBlocks = (state.proposedBlocks || []).map((b) => ({
  id: b.id,
  dayKey: b.dayKey,
  startISO: b.startISO,
  endISO: b.endISO,
  durationMinutes: b.durationMinutes,
  title: b.title || b.label,
  expectedOutput: b.expectedOutput,
  domain: b.domain,
  blockType: b.blockType,
  flex: b.flex,
  missConsequence: b.missConsequence,
  laneTitle: laneMap[b.masterPlanLaneId]?.title || null,
  source: b.source,
}));

const fullHorizonBlocks = result.blocks
  .map((b) => {
    const duration = b.durationMinutes ?? b.timeEstimateMinutes ?? null;
    return {
      id: b.id,
      dayKey: b.dayKey,
      phaseLabel: b.phaseLabel,
      laneId: b.laneId || b.masterPlanLaneId || null,
      laneTitle: b.laneLabel || laneMap[b.laneId]?.title || laneMap[b.masterPlanLaneId]?.title || null,
      blockType: b.blockType,
      title: b.title,
      expectedOutput: b.expectedOutput,
      durationMinutes: duration,
      producesArtifact: b.producesArtifact,
      consumedBy: b.consumedBy,
      owner: b.owner,
      passEvidence: b.passEvidence,
      dependsOn: b.dependsOn,
      unlocks: b.unlocks,
      commitmentState: b.commitmentState,
      executionEligibility: b.executionEligibility,
      source: b.source,
      titleFamily: b.titleFamily,
    };
  })
  .sort((a, b) => {
    const dayA = a.dayKey || '';
    const dayB = b.dayKey || '';
    if (dayA !== dayB) return dayA.localeCompare(dayB);
    return (a.title || '').localeCompare(b.title || '');
  });

const cycle = (state.cycle || []).map((d) => ({
  date: d.date,
  plannedMinutes: d.plannedMinutes,
  completedMinutes: d.completedMinutes,
  completionRate: d.completionRate,
  driftLabel: d.driftLabel,
  streakState: d.streakState,
}));

const bundle = {
  meta: {
    extractedAtISO: new Date().toISOString(),
    sourcePath: inPath,
    viewDate: state.viewDate,
    activeGoalId: state.activeGoalId,
    activeCycleId: state.activeCycleId,
    goalLifecycleState: state.goalLifecycleState,
    scheduleLifecycle: state.scheduleLifecycle,
    selectedHorizonMode: state.selectedHorizonMode,
    strategicHorizonEndDayKey: state.strategicHorizonEndDayKey,
    qualityPolicyIdApplied: state.qualityPolicyIdApplied,
    qualityScoreApplied: state.qualityScoreApplied,
    qualityScoreAppliedByComponent: state.qualityScoreAppliedByComponent,
    agendaVersionId: result.agendaVersionId,
    range: result.range,
  },
  masterPlan: {
    id: plan.id,
    title: plan.title,
    status: plan.status,
    horizonStart: plan.horizonStart,
    horizonEnd: plan.horizonEnd,
    fullHorizonEndDayKey: plan.fullHorizonEndDayKey,
    declaredHorizonMonths: plan.declaredHorizonMonths,
    northStarOutcome: plan.northStarOutcome,
    coreMission: plan.coreMission,
    outcomeTarget: plan.outcomeTarget,
    successStandard: plan.successStandard,
    masterPlanSummary: plan.masterPlanSummary,
    controllabilityClass: plan.controllabilityClass,
    terminalTargetClass: plan.terminalTargetClass,
    controllableSuccessSignals: plan.controllableSuccessSignals,
    externallyMediatedTargets: plan.externallyMediatedTargets,
    goalArchitecture: plan.goalArchitecture,
    executionModel: plan.executionModel,
    primaryLane: plan.primaryLane,
    supportingLanes: plan.supportingLanes,
    officialStartDate: plan.officialStartDate,
    scheduleAppliedDate: plan.scheduleAppliedDate,
    nonNegotiables: plan.nonNegotiables,
    anchors: plan.anchors,
  },
  summary: result.summary,
  lanes: laneMap,
  milestones,
  cycleBlocks,
  fullHorizonBlocks,
  cycleSummary: cycle,
};

fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2));

const totalDur = fullHorizonBlocks.reduce((s, b) => s + (b.durationMinutes || 0), 0);
process.stdout.write(
  [
    `wrote: ${outPath}`,
    `size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`,
    `plan: "${plan.title}"`,
    `horizon: ${result.range.startDayKey} → ${result.range.endDayKey}`,
    `lanes: ${Object.keys(laneMap).length}`,
    `milestones: ${milestones.length}`,
    `cycle blocks: ${cycleBlocks.length}`,
    `full-horizon blocks: ${fullHorizonBlocks.length}  (${(totalDur / 60).toFixed(0)} hr total)`,
    '',
  ].join('\n')
);
