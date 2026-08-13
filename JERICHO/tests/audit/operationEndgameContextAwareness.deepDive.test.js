import { describe, it, expect } from 'vitest';
import { buildOperationEndgameFixtureState } from '../../src/dev/operationEndgameRestore.js';
import { ENTERPRISE_IDENTITY_MAP } from '../../src/domain/enterprise/enterpriseIdentityMap';
import { projectEnterpriseDisplay } from '../../src/domain/enterprise/enterpriseDisplayProjection';

describe('Operation Endgame Context — Deep Dive', () => {
  const state = buildOperationEndgameFixtureState({});
  const lanes = Object.values(state.masterPlanLanesById || {});
  const milestones = Object.values(state.masterPlanMilestonesById || {});
  const fullHorizon = state.fullHorizonScheduleBlocks || [];

  it('DD-1: Each fixture lane mapped to canonical entity (live projection)', () => {
    console.log('\n========== DD-1 — Lane → Entity projection (live) ==========\n');
    console.log(`Canonical entity map has ${ENTERPRISE_IDENTITY_MAP.length} entities.\n`);
    console.log('Mapping every fixture lane through projectEnterpriseDisplay:\n');
    const entityCounts = new Map();
    lanes.forEach((lane, idx) => {
      const proj = projectEnterpriseDisplay({
        laneId: lane?.id || '',
        laneLabel: lane?.title || lane?.label || '',
        intakeSignals: {
          goalText: state.masterPlanIntake?.answers?.step_1 || '',
          declaredLaneIds: lanes.map((l) => l?.id).filter(Boolean),
        },
      });
      const e = proj?.displayName || '(Unknown)';
      entityCounts.set(e, (entityCounts.get(e) || 0) + 1);
      console.log(`[Lane ${idx + 1}] domain=${lane?.domain}, title="${(lane?.title || '').slice(0, 60)}"`);
      console.log(`    → displayName:     ${proj?.displayName}`);
      console.log(`    → companyCategory: ${proj?.companyCategory}`);
      console.log(`    → phaseScope:      ${proj?.phaseScope}`);
      console.log(`    → priorityStatus:  ${proj?.priorityStatus}`);
      console.log(`    → provenance:      ${proj?.provenanceStatus}`);
      console.log(`    → entityId (derived): ${proj?.entityId}`);
      console.log('');
    });
    console.log('Distinct entities hit by mapping fixture lanes:');
    [...entityCounts.entries()].forEach(([e, n]) => console.log(`  ${e}: ${n} lane(s)`));
    console.log('\nCanonical entities NOT hit by ANY fixture lane:');
    const hit = new Set(entityCounts.keys());
    ENTERPRISE_IDENTITY_MAP.forEach((e) => {
      if (!hit.has(e.displayName)) {console.log(`  - ${e.displayName.padEnd(32)} (category: ${e.companyCategory})`);}
    });
    expect(true).toBe(true);
  });

  it('DD-2: Audit the 39 milestones', () => {
    console.log('\n========== DD-2 — Milestone audit ==========\n');
    console.log(`Total milestones: ${milestones.length}\n`);
    const byLane = new Map();
    const byType = new Map();
    const byDomain = new Map();
    milestones.forEach((m) => {
      const lid = m?.lane?.id || m?.laneId || '(no lane)';
      byLane.set(lid, (byLane.get(lid) || 0) + 1);
      const t = m?.milestoneType || '(no type)';
      byType.set(t, (byType.get(t) || 0) + 1);
      const d = m?.lane?.domain || m?.domain || '(no domain)';
      byDomain.set(d, (byDomain.get(d) || 0) + 1);
    });

    console.log('Milestones by type:');
    [...byType.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${t.padEnd(20)} ${n}`));

    console.log('\nMilestones by lane domain:');
    [...byDomain.entries()].sort((a, b) => b[1] - a[1]).forEach(([d, n]) => console.log(`  ${d.padEnd(20)} ${n}`));

    console.log('\nFirst 39 milestone titles + dates + types + cross-lane flag:');
    const sortedMs = milestones.slice().sort((a, b) => String(a?.targetDate || '').localeCompare(String(b?.targetDate || '')));
    sortedMs.forEach((m, i) => {
      const isCross = /cross-lane|terminal|launch convergence/i.test(String(m?.title || ''));
      const flag = isCross ? '★ CROSS' : '       ';
      console.log(`  [${String(i + 1).padStart(2)}] ${m?.targetDate || '(no date)'}  ${(m?.milestoneType || '?').padEnd(12)} ${flag}  ${(m?.title || '').slice(0, 80)}`);
    });

    console.log('\nMilestone field presence audit:');
    const fields = ['id', 'title', 'targetDate', 'milestoneType', 'missConsequence', 'derivedFrom', 'lane', 'consumedBy', 'consumedByRef', 'producesArtifact', 'phaseId'];
    fields.forEach((f) => {
      const present = milestones.filter((m) => m?.[f] != null && m?.[f] !== '').length;
      console.log(`  ${f.padEnd(20)} ${present}/${milestones.length}`);
    });

    expect(true).toBe(true);
  });

  it('DD-3: consumedBy patterns across all 1072 blocks (cross-system?)', () => {
    console.log('\n========== DD-3 — consumedBy pattern audit ==========\n');
    const allConsumedBy = new Map();
    const allConsumedByRefTypes = new Map();
    fullHorizon.forEach((b) => {
      (b?.consumedBy || []).forEach((c) => {
        const key = String(c).replace(/lane:[^:]+/, 'lane:<id>').replace(/phase:[^:]+/, 'phase:<P>');
        allConsumedBy.set(key, (allConsumedBy.get(key) || 0) + 1);
      });
      const t = b?.consumedByRef?.type || '(none)';
      allConsumedByRefTypes.set(t, (allConsumedByRefTypes.get(t) || 0) + 1);
    });

    console.log('consumedBy patterns (normalized):');
    [...allConsumedBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, n]) =>
      console.log(`  ${String(n).padStart(5)}  ${k}`));

    console.log('\nconsumedByRef.type distribution:');
    [...allConsumedByRefTypes.entries()].sort((a, b) => b[1] - a[1]).forEach(([t, n]) =>
      console.log(`  ${String(n).padStart(5)}  ${t}`));

    console.log('\nDistinct consumedBy targets containing "lane:" (sample, raw):');
    const laneTargets = new Set();
    fullHorizon.forEach((b) => {
      (b?.consumedBy || []).forEach((c) => {
        if (String(c).startsWith('lane:')) {laneTargets.add(c);}
      });
    });
    [...laneTargets].slice(0, 15).forEach((t) => console.log(`  ${t}`));
    console.log(`Total distinct lane: consumers: ${laneTargets.size}`);

    console.log('\nCross-lane convergence check:');
    let crossLaneCount = 0;
    fullHorizon.forEach((b) => {
      const consumers = b?.consumedBy || [];
      const consumerLaneIds = new Set();
      consumers.forEach((c) => {
        const m = /^lane:([^:]+)/.exec(String(c));
        if (m) {consumerLaneIds.add(m[1]);}
      });
      if (consumerLaneIds.size > 0 && b?.laneId && !consumerLaneIds.has(b.laneId)) {
        crossLaneCount += 1;
      }
    });
    console.log(`  Blocks whose consumedBy points at a DIFFERENT lane than block's own laneId: ${crossLaneCount} / ${fullHorizon.length}`);
    console.log('  (a non-zero number would indicate cross-lane convergence; zero confirms lane-internal only)');

    expect(true).toBe(true);
  });

  it('DD-4: Latent entity awareness in the codebase', () => {
    console.log('\n========== DD-4 — Latent entity awareness ==========\n');
    console.log('ENTERPRISE_IDENTITY_MAP entries (canonical entities):');
    ENTERPRISE_IDENTITY_MAP.forEach((e) => {
      console.log(`  - ${e.displayName.padEnd(32)} category=${e.companyCategory.padEnd(20)} scope=${e.phaseScope}`);
      console.log(`    products: ${e.products.join(', ')}`);
    });

    console.log('\nUsage check:');
    console.log('  state.entitiesById exists:        ', Boolean(state.entitiesById));
    console.log('  state.enterprisesById exists:     ', Boolean(state.enterprisesById));
    console.log('  state.companies* exists:          ',
      Boolean(state.companiesById || state.companies));
    console.log('  Profile has entity registry:      ',
      Boolean(state.profilesById?.['profile-local-default']?.entitiesById));
    console.log('  MasterPlan has entity registry:   ',
      Boolean(Object.values(state.masterPlansById || {})[0]?.entitiesById));

    console.log('\nintake.answers keys mentioning entity/initiative/system:');
    const intakeKeys = Object.keys(state.masterPlanIntake?.answers || {});
    const relevant = intakeKeys.filter((k) =>
      /entity|initiative|system|company|enterprise|organization|holdings|corp|productions|solutions/i.test(k));
    if (relevant.length === 0) {
      console.log('  (NONE — intake never asks about entity / initiative / system / company)');
    } else {
      relevant.forEach((k) => console.log(`  ${k}`));
    }

    console.log('\nintake.answers VALUES mentioning entity-style names:');
    const valueMatches = Object.entries(state.masterPlanIntake?.answers || {}).filter(([, v]) => {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return /Global State|F8|Energy Co|Holdings|Productions|Solutions|Systems|Academy|Corp\./i.test(s);
    });
    if (valueMatches.length === 0) {
      console.log('  (NONE — no intake answer mentions any canonical entity name verbatim)');
    } else {
      valueMatches.forEach(([k, v]) => console.log(`  ${k}: ${typeof v === 'string' ? v.slice(0, 100) : JSON.stringify(v).slice(0, 100)}`));
    }

    expect(true).toBe(true);
  });
});
