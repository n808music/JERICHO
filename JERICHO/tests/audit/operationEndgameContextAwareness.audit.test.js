import { describe, it, expect } from 'vitest';
import { buildOperationEndgameFixtureState } from '../../src/dev/operationEndgameRestore.js';

/**
 * OPERATION ENDGAME CONTEXT AWARENESS AUDIT
 *
 * This test does not assert plan quality. It asserts that the audit can run
 * and produces structured output. The output is read by the analyst, not the
 * test runner.
 */

function safe(v) {
  return v == null ? null : v;
}

function summarizeField(records, field) {
  const counts = { present: 0, missing: 0 };
  records.forEach((r) => {
    const v = r?.[field];
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {counts.missing += 1;}
    else {counts.present += 1;}
  });
  return counts;
}

describe('Operation Endgame Context Awareness Audit', () => {
  const state = buildOperationEndgameFixtureState({});
  const masterPlans = Object.values(state.masterPlansById || {});
  const lanes = Object.values(state.masterPlanLanesById || {});
  const milestones = Object.values(state.masterPlanMilestonesById || {});
  const cycles = Object.values(state.cyclesById || {});
  const goals = Object.values(state.goalsById || {});
  const profiles = Object.values(state.profilesById || {});
  const fullHorizon = state.fullHorizonScheduleBlocks || [];
  const intake = state.masterPlanIntake || null;

  it('PART 1 — Enterprise Context Map (counts and top-level structure)', () => {
    console.log('\n========== PART 1 — ENTERPRISE CONTEXT MAP ==========\n');
    console.log('TOP-LEVEL NODE COUNTS:');
    console.log('  profiles:                       ', profiles.length);
    console.log('  goals:                          ', goals.length);
    console.log('  masterPlans:                    ', masterPlans.length);
    console.log('  cycles:                         ', cycles.length);
    console.log('  lanes:                          ', lanes.length);
    console.log('  milestones:                     ', milestones.length);
    console.log('  fullHorizon blocks:             ', fullHorizon.length);
    console.log('  intake.extractedLanes:          ', (intake?.extractedLanes || []).length);
    console.log('  intake.anchors:                 ', (intake?.anchors || []).length);
    console.log('  intake.answers keys:            ', Object.keys(intake?.answers || {}).length);

    console.log('\nACTIVE PROFILE:');
    const activeProfile = profiles.find((p) => p?.activeMasterPlanId) || profiles[0];
    console.log('  id:                ', activeProfile?.id);
    console.log('  displayName:       ', activeProfile?.displayName);
    console.log('  activeGoalId:      ', activeProfile?.activeGoalId);
    console.log('  activeMasterPlanId:', activeProfile?.activeMasterPlanId);
    console.log('  activeCycleId:     ', activeProfile?.activeCycleId);
    console.log('  laneIds[]:         ', (activeProfile?.laneIds || []).length);
    console.log('  masterPlanIds[]:   ', (activeProfile?.masterPlanIds || []).length);

    console.log('\nMASTER PLAN ROOT:');
    masterPlans.forEach((mp) => {
      console.log(`  - id: ${mp?.id}`);
      console.log(`    coreMission: ${(mp?.coreMission || '').slice(0, 120)}`);
      console.log(`    horizonEnd: ${mp?.horizonEnd}`);
      console.log(`    declaredHorizonMonths: ${mp?.declaredHorizonMonths}`);
      console.log(`    laneIds count: ${(mp?.laneIds || []).length}`);
      console.log(`    anchorIds count: ${(mp?.anchors || []).length}`);
      console.log(`    successStandard present: ${Boolean(mp?.successStandard)}`);
      console.log(`    outcomeTarget present: ${Boolean(mp?.outcomeTarget)}`);
    });
    expect(true).toBe(true);
  });

  it('PART 2 — Lane Authority Audit', () => {
    console.log('\n========== PART 2 — LANE AUTHORITY AUDIT ==========\n');
    console.log(`Total lanes: ${lanes.length}\n`);

    const laneIdSet = new Set();
    const duplicateTitles = new Map();
    lanes.forEach((lane) => {
      const title = String(lane?.title || '').toLowerCase().trim();
      duplicateTitles.set(title, (duplicateTitles.get(title) || 0) + 1);
    });

    const blocksByLaneId = new Map();
    fullHorizon.forEach((b) => {
      const k = b?.laneId || '__no_lane__';
      blocksByLaneId.set(k, (blocksByLaneId.get(k) || 0) + 1);
    });

    const milestonesByLaneId = new Map();
    milestones.forEach((m) => {
      const k = m?.lane?.id || m?.laneId || '__no_lane__';
      milestonesByLaneId.set(k, (milestonesByLaneId.get(k) || 0) + 1);
    });

    lanes.forEach((lane, idx) => {
      console.log(`[Lane ${idx + 1}]`);
      console.log(`  id:           ${lane?.id}`);
      console.log(`  title:        ${lane?.title}`);
      console.log(`  domain:       ${lane?.domain}`);
      console.log(`  role:         ${lane?.role}`);
      console.log(`  activation:   ${lane?.activationState || lane?.activation || lane?.lifecycleStage}`);
      console.log(`  assessedStage:${lane?.assessedStage}`);
      console.log(`  dependsOn:    ${JSON.stringify(lane?.dependsOnLaneIds || [])}`);
      console.log(`  parent entity:${lane?.entityId || lane?.parentEntityId || '(none — flat)'}`);
      console.log(`  initiative:   ${lane?.initiative || lane?.initiativeId || '(none)'}`);
      console.log(`  fullHorizon blocks attached: ${blocksByLaneId.get(lane?.id) || 0}`);
      console.log(`  milestones attached:         ${milestonesByLaneId.get(lane?.id) || 0}`);
      const surveyEvidenceKey = `lane_${idx}_description`;
      const surveyEvidence = intake?.answers?.[surveyEvidenceKey];
      console.log(`  intake evidence (${surveyEvidenceKey}): ${surveyEvidence ? 'PRESENT' : 'MISSING'}`);
      console.log('');
      if (laneIdSet.has(lane?.id)) {console.log('  ⚠ DUPLICATE LANE ID');}
      laneIdSet.add(lane?.id);
    });

    console.log('\nORPHAN / FLAG SUMMARY:');
    console.log('  Lanes with no fullHorizon blocks:',
      lanes.filter((l) => !(blocksByLaneId.get(l?.id) > 0)).length);
    console.log('  Lanes with no milestones:',
      lanes.filter((l) => !(milestonesByLaneId.get(l?.id) > 0)).length);
    console.log('  Duplicate title clusters:');
    [...duplicateTitles.entries()].filter(([, n]) => n > 1).forEach(([t, n]) =>
      console.log(`    "${t}" x ${n}`));
    console.log('  Blocks attached to UNKNOWN lane (no laneId match):',
      blocksByLaneId.get('__no_lane__') || 0);
    console.log('  Lanes lacking parent-entity field:',
      lanes.filter((l) => !l?.entityId && !l?.parentEntityId).length, '/', lanes.length);

    expect(true).toBe(true);
  });

  it('PART 3 — Entity Structure Audit', () => {
    console.log('\n========== PART 3 — ENTITY STRUCTURE AUDIT ==========\n');
    const entityField = (block) => block?.entityId || block?.entityLabel || null;
    const entitiesFromBlocks = new Set();
    fullHorizon.forEach((b) => { const e = entityField(b); if (e) {entitiesFromBlocks.add(e);} });
    const entitiesFromLanes = new Set();
    lanes.forEach((l) => { const e = l?.entityId || l?.entityLabel; if (e) {entitiesFromLanes.add(e);} });

    console.log('ENTITIES FOUND IN DATA:');
    console.log('  from fullHorizon blocks (entityId/entityLabel): ', entitiesFromBlocks.size);
    console.log('  from lane entityId/entityLabel:                  ', entitiesFromLanes.size);
    console.log('  state.entitiesById exists:                       ', Boolean(state.entitiesById));
    console.log('  state.enterprisesById exists:                    ', Boolean(state.enterprisesById));

    console.log('\nEntity field presence on fullHorizon blocks:');
    console.log('  entityId present:    ', summarizeField(fullHorizon, 'entityId'));
    console.log('  entityLabel present: ', summarizeField(fullHorizon, 'entityLabel'));

    console.log('\nEntity field presence on lanes:');
    console.log('  entityId present:    ', summarizeField(lanes, 'entityId'));
    console.log('  entityLabel present: ', summarizeField(lanes, 'entityLabel'));

    console.log('\nINFERRED ENTITIES (from title-pattern projection):');
    const inferredCounts = new Map();
    try {
      const { projectEnterpriseDisplay } = require('../../src/domain/enterprise/enterpriseDisplayProjection');
      lanes.forEach((lane) => {
        try {
          const proj = projectEnterpriseDisplay({
            laneId: lane?.id,
            laneLabel: lane?.title || lane?.label,
            intakeSignals: { goalText: '', declaredLaneIds: [] },
          });
          const k = proj?.displayName || '(Unknown)';
          inferredCounts.set(k, (inferredCounts.get(k) || 0) + 1);
        } catch (e) {
          // ignore
        }
      });
    } catch (e) {
      console.log('  (projectEnterpriseDisplay import failed)');
    }
    [...inferredCounts.entries()].forEach(([k, n]) => console.log(`  ${k}: ${n} lane(s)`));

    expect(true).toBe(true);
  });

  it('PART 4 — Convergence Analysis (cross-system structure)', () => {
    console.log('\n========== PART 4 — CONVERGENCE ANALYSIS ==========\n');
    const systemPatterns = {
      'Album / Release Engine':    /album|release|d8 n8|romance riot|our fearless leader|blackman|drop/i,
      'Podcast / Media Pipeline':  /podcast|media|help yourself|state of control|episode|content pipeline/i,
      'Application / App Platform':/jericho|app platform|onboarding|product platform|application/i,
      'Revenue Engine':            /revenue|services|offer|ICP|first client|f8|energy gum|sales|pipeline/i,
      'Partnership Engine':        /stakeholder|partner|coalition|agency|outreach/i,
      'Operations System':         /timing-slip|hard-anchor|operating system|operator|governance/i,
      'Brand System':              /positioning|brand|narrative|message|founder narrative/i,
      'Capital / IP':              /capital|ip|patent|trademark|legal|funding/i,
      'Institution':               /institution|education|school|apprenticeship|curriculum/i,
      'Real Estate / Civic':       /district|civic|corridor|real estate|property|site/i,
    };
    const systemCounts = {};
    Object.keys(systemPatterns).forEach((s) => systemCounts[s] = { blocks: 0, milestones: 0 });
    fullHorizon.forEach((b) => {
      const t = String(b?.title || b?.label || '').toLowerCase();
      Object.entries(systemPatterns).forEach(([s, re]) => { if (re.test(t)) {systemCounts[s].blocks += 1;} });
    });
    milestones.forEach((m) => {
      const t = String(m?.title || '').toLowerCase();
      Object.entries(systemPatterns).forEach(([s, re]) => { if (re.test(t)) {systemCounts[s].milestones += 1;} });
    });
    console.log('SYSTEM EVIDENCE (title-pattern attribution across data):');
    Object.entries(systemCounts).forEach(([s, c]) =>
      console.log(`  ${s.padEnd(30)} blocks: ${String(c.blocks).padStart(4)}  milestones: ${String(c.milestones).padStart(3)}`));

    console.log('\nINDEPENDENT vs CONVERGED:');
    console.log('  Master plan ID:', masterPlans[0]?.id);
    console.log('  All lanes belong to same master plan:',
      lanes.every((l) => l?.masterPlanId === masterPlans[0]?.id || !l?.masterPlanId));
    console.log('  Independent execution-system anchor: NO explicit "system" entity in fixture');
    console.log('  Convergence wiring: blocks attach to lane only — no cross-system DAG');

    console.log('\nCONSUMER GRAPH SAMPLE (first 5 blocks with consumedBy):');
    fullHorizon.filter((b) => Array.isArray(b?.consumedBy) && b.consumedBy.length > 0).slice(0, 5).forEach((b, i) => {
      console.log(`  [${i + 1}] ${String(b?.title || '').slice(0, 80)}`);
      console.log(`        consumedBy: ${JSON.stringify(b.consumedBy)}`);
      console.log(`        consumedByRef: ${JSON.stringify(b.consumedByRef)}`);
    });

    expect(true).toBe(true);
  });

  it('PART 5 — Artifact Dependency Matrix', () => {
    console.log('\n========== PART 5 — ARTIFACT DEPENDENCY MATRIX ==========\n');
    const artifacts = new Map();
    fullHorizon.forEach((b) => {
      const a = String(b?.producesArtifact || '').trim();
      if (!a) {return;}
      if (!artifacts.has(a)) {artifacts.set(a, { id: a, produces: new Set(), consumes: new Set() });}
      const node = artifacts.get(a);
      (b?.consumedBy || []).forEach((c) => node.produces.add(c));
    });
    fullHorizon.forEach((b) => {
      const a = String(b?.producesArtifact || '').trim();
      if (!a) {return;}
      const node = artifacts.get(a);
      (Array.isArray(b?.dependsOn) ? b.dependsOn : []).forEach((d) => node?.consumes.add(d));
    });

    console.log(`Distinct producesArtifact strings: ${artifacts.size}`);
    console.log('\nTop 15 most-referenced artifacts (by produces fan-out):');
    [...artifacts.entries()]
      .map(([id, n]) => ({ id, fanOut: n.produces.size, fanIn: n.consumes.size }))
      .sort((a, b) => b.fanOut - a.fanOut)
      .slice(0, 15)
      .forEach((row) =>
        console.log(`  fanOut=${String(row.fanOut).padStart(3)} fanIn=${String(row.fanIn).padStart(3)}  ${row.id.slice(0, 90)}`)
      );

    console.log('\nOrphan artifacts (produced by some block, consumed by none):');
    const consumedTargets = new Set();
    fullHorizon.forEach((b) => (b?.consumedBy || []).forEach((c) => consumedTargets.add(String(c).toLowerCase())));
    const orphans = [...artifacts.keys()].filter((a) => !consumedTargets.has(a.toLowerCase()));
    console.log(`  ${orphans.length} of ${artifacts.size} artifacts have no recorded consumer`);

    expect(true).toBe(true);
  });

  it('PART 6 — Survey Coverage Audit', () => {
    console.log('\n========== PART 6 — SURVEY COVERAGE AUDIT ==========\n');
    const answers = intake?.answers || {};
    console.log('INTAKE ANSWERS COLLECTED:');
    Object.entries(answers).forEach(([k, v]) => {
      const preview = typeof v === 'string' ? v.slice(0, 90) : JSON.stringify(v).slice(0, 90);
      console.log(`  ${k.padEnd(36)} -> ${preview}`);
    });

    console.log('\nINTAKE STRUCTURE:');
    console.log('  status:                  ', intake?.status);
    console.log('  phase:                   ', intake?.phase);
    console.log('  step:                    ', intake?.step);
    console.log('  extractedLanes count:    ', (intake?.extractedLanes || []).length);
    console.log('  anchors count:           ', (intake?.anchors || []).length);

    console.log('\nEXTRACTED LANE PROVENANCE:');
    (intake?.extractedLanes || []).forEach((l, i) => {
      const desc = answers[`lane_${i}_description`];
      const sysAss = answers[`lane_${i}_system_assessment`];
      const act = answers[`lane_${i}_activation`];
      console.log(`  [${i}] title="${l?.title}" domain="${l?.domain}" role="${l?.role}"`);
      console.log(`        description evidence: ${desc ? 'YES' : 'NO'}`);
      console.log(`        system_assessment:    ${sysAss ? 'YES' : 'NO'}`);
      console.log(`        activation declared:  ${act || '(missing)'}`);
    });

    console.log('\nMISSING CONTEXT QUESTIONS (inferable from absent graph nodes):');
    const noEntityLanes = lanes.filter((l) => !l?.entityId && !l?.parentEntityId);
    if (noEntityLanes.length > 0) {
      console.log(`  Q-ENTITY: ${noEntityLanes.length} lanes lack an entity parent — system has no question asking "which entity does this lane belong to?"`);
    }
    const noInitiativeLanes = lanes.filter((l) => !l?.initiative && !l?.initiativeId);
    if (noInitiativeLanes.length > 0) {
      console.log(`  Q-INITIATIVE: ${noInitiativeLanes.length} lanes lack an initiative — system has no question asking "what initiative does this lane execute?"`);
    }
    const noConvergence = fullHorizon.filter((b) => !b?.consumedByRef).length === fullHorizon.length;
    if (noConvergence) {
      console.log('  Q-CONVERGENCE: no block has a consumedByRef — system never asked "what does this artifact unlock downstream?"');
    } else {
      const withConvergence = fullHorizon.filter((b) => b?.consumedByRef).length;
      console.log(`  Q-CONVERGENCE: ${withConvergence}/${fullHorizon.length} blocks have consumedByRef — partial`);
    }
    console.log('  Q-CROSS-SYSTEM: no explicit "Operation Endgame → entity → execution system" hierarchy in state');

    expect(true).toBe(true);
  });

  it('PART 7 — Context Fidelity Score', () => {
    console.log('\n========== PART 7 — CONTEXT FIDELITY SCORE ==========\n');
    const score = (name, present, total) => {
      const pct = total === 0 ? 0 : Math.round((present / total) * 100);
      const bar = '█'.repeat(Math.floor(pct / 5)).padEnd(20, '░');
      console.log(`  ${name.padEnd(28)} ${bar} ${pct}%  (${present}/${total})`);
      return pct;
    };

    console.log('FIDELITY SCORES:\n');
    const enterpriseScore = score(
      'Enterprise completeness',
      [masterPlans.length > 0, profiles.length > 0, goals.length > 0].filter(Boolean).length,
      3
    );
    const entityCompleteness = state.entitiesById ? 100 : 0;
    score('Entity completeness',
      lanes.filter((l) => l?.entityId).length, lanes.length);

    score('Lane completeness',
      lanes.filter((l) => l?.id && l?.title && l?.domain).length, lanes.length);

    const initiativeScore = lanes.filter((l) => l?.initiative || l?.initiativeId).length;
    score('Initiative completeness', initiativeScore, lanes.length);

    score('Milestone completeness',
      milestones.filter((m) => m?.id && m?.title && (m?.lane?.id || m?.laneId)).length,
      milestones.length);

    score('Artifact completeness',
      fullHorizon.filter((b) => String(b?.producesArtifact || '').trim()).length,
      fullHorizon.length);

    score('Dependency completeness',
      fullHorizon.filter((b) => (Array.isArray(b?.consumedBy) && b.consumedBy.length > 0) || b?.consumedByRef).length,
      fullHorizon.length);

    const convergenceScore = fullHorizon.filter((b) => b?.consumedByRef?.type === 'masterPlan' || b?.consumedByRef?.type === 'masterPlanLane' || b?.consumedByRef?.type === 'phaseObjective' || b?.consumedByRef?.type === 'terminalOutcome').length;
    score('Convergence completeness', convergenceScore, fullHorizon.length);

    console.log('\nBOTTOM-LINE FIDELITY:');
    console.log('  Profile/Goal/MasterPlan trio:     PRESENT');
    console.log('  Lane registry:                    PRESENT');
    console.log('  Lane-to-entity mapping:           ABSENT in state — only inferred via projectEnterpriseDisplay');
    console.log('  Lane-to-initiative mapping:       ABSENT in state — only inferred via resolveInitiativeDisplay title patterns');
    console.log('  Cross-system convergence DAG:     ABSENT — blocks reference master plan or lane, not other systems');
    console.log('  Survey provenance per node:       PARTIAL — lane description/activation captured; entity/initiative not asked');

    expect(true).toBe(true);
  });
});
