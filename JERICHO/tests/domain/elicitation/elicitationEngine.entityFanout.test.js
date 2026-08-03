import { describe, it, expect } from 'vitest';
import {
  createElicitationEngine,
  ENTITY_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import {
  ENTITY_ROLE_TAGS,
  FORMATION_STATES,
} from '../../../src/domain/elicitation/entitySlot.ts';

// End-to-end multi-entity fan-out.
//
// This is the case Gap 2 exists to fix: the operator declares MORE THAN ONE
// entity, and each must get its own referent-bound follow-ups and its own
// keyed record in state. The prior referentBinding suite only covered a single
// entity per engine; this drives the exact MatrixIntake.jsx loop — a fresh
// single-slot engine per entity against a GROWING matrix — for N entities.
//
// Keying mirrors declareEntity() in identityCompute.js (verified: line ~15534,
//   state.matrix.entitiesById[payload.id] = entry). The reducer is a straight
// keyed insert; the id is produced by buildEntityDeclarePayload, which is the
// mechanism under test. We assert on the real engine dispatch payloads AND on
// the resulting keyed map.

const ROLE = [...ENTITY_ROLE_TAGS][0];
const FORMATION = [...FORMATION_STATES][0];

function answerFor(fieldName, entity) {
  switch (fieldName) {
    case 'name': return entity.name;
    case 'roleTags': return [ROLE];
    case 'purpose': return entity.purpose;
    case 'formationState': return FORMATION;
    case 'statusEvidence': return entity.statusEvidence;
    case 'legallyFormed': return false;
    default: return null;
  }
}

// Faithful mirror of declareEntity's keyed insert (identityCompute.js:15534).
function applyDeclareEntity(matrix, payload) {
  matrix.entitiesById = matrix.entitiesById || {};
  matrix.entitiesById[payload.id] = { ...payload };
}

// Drives `entities` sequentially, exactly as MatrixIntake.jsx does: each entity
// gets a fresh makeSlotEngine(currentMatrix, ENTITY_SLOT_ID); on gate-pass the
// DECLARE_ENTITY dispatch is applied to the growing matrix.
function driveEntities(entities) {
  const matrix = { entitiesById: {} };
  const dispatches = [];
  // boundFollowups[i] = # of follow-up probes for entity i whose spine was
  // referent-bound to THAT entity's own name.
  const boundFollowups = [];

  for (const entity of entities) {
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: matrix,
      scope: [ENTITY_SLOT_ID],
    });
    let step = engine.nextStep();
    let guard = 0;
    let boundCount = 0;

    while (!step.done && guard++ < 40) {
      const probe = step.probe;
      if (!probe) break;
      // A follow-up (any probe after the name is captured) that references THIS
      // entity's own name in bold is a correctly-bound referent.
      if (probe.fieldName !== 'name' && probe.spine.includes(entity.name)) {
        boundCount += 1;
      }
      const res = engine.consumeAnswer({ [probe.fieldName]: answerFor(probe.fieldName, entity) });
      engine = res.engine;
      for (const d of res.dispatches) {
        dispatches.push(d);
        if (d.type === 'DECLARE_ENTITY') applyDeclareEntity(matrix, d.payload);
      }
      step = engine.nextStep();
    }
    boundFollowups.push(boundCount);
  }

  return { matrix, dispatches, boundFollowups };
}

const THREE = [
  { name: 'Acme Robotics', purpose: 'Designs warehouse automation robots for regional distributors', statusEvidence: 'Series A closed; 40 employees; shipping to three paying customers' },
  { name: 'Northwind Logistics', purpose: 'Operates last-mile delivery fleets across four corridors', statusEvidence: 'Profitable since Q2; 120 drivers; two depots active' },
  { name: 'Beacon Health Partners', purpose: 'Provides outpatient diagnostics to rural clinics under contract', statusEvidence: 'Accredited last year; nine clinics; ~2000 monthly patients' },
];

describe('entity fan-out (N > 1) — end-to-end referent binding + keyed capture', () => {
  it('N=3: each entity fires its own referent-bound follow-ups and is keyed separately in state', () => {
    const { matrix, dispatches, boundFollowups } = driveEntities(THREE);

    // Three DECLARE_ENTITY dispatches — one per entity, in order.
    const declares = dispatches.filter((d) => d.type === 'DECLARE_ENTITY');
    expect(declares).toHaveLength(3);

    // Each entity produced at least one referent-bound follow-up naming ITSELF.
    expect(boundFollowups).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
    boundFollowups.forEach((n) => expect(n).toBeGreaterThanOrEqual(1));

    // Keys are distinct and derived per-entity from the name slug.
    const keys = Object.keys(matrix.entitiesById);
    expect(keys).toEqual([
      'entity-acme-robotics',
      'entity-northwind-logistics',
      'entity-beacon-health-partners',
    ]);
    expect(new Set(keys).size).toBe(3);

    // Keyed capture: each stored record carries its own entity's fields.
    expect(matrix.entitiesById['entity-acme-robotics'].name).toBe('Acme Robotics');
    expect(matrix.entitiesById['entity-northwind-logistics'].name).toBe('Northwind Logistics');
    expect(matrix.entitiesById['entity-beacon-health-partners'].name).toBe('Beacon Health Partners');
    // Answers keyed per entity — no cross-contamination of names.
    expect(matrix.entitiesById['entity-acme-robotics'].purpose).toContain('warehouse automation');
    expect(matrix.entitiesById['entity-beacon-health-partners'].purpose).toContain('outpatient diagnostics');
  });

  it('N=1: a single entity still binds its follow-ups and keys one record', () => {
    const { matrix, dispatches, boundFollowups } = driveEntities([THREE[0]]);
    const declares = dispatches.filter((d) => d.type === 'DECLARE_ENTITY');
    expect(declares).toHaveLength(1);
    expect(boundFollowups[0]).toBeGreaterThanOrEqual(1);
    expect(Object.keys(matrix.entitiesById)).toEqual(['entity-acme-robotics']);
  });

  it('empty list: no entities declared → no dispatches, no keys', () => {
    const { matrix, dispatches } = driveEntities([]);
    expect(dispatches).toHaveLength(0);
    expect(Object.keys(matrix.entitiesById)).toHaveLength(0);
  });

  it('later entities do not inherit an earlier entity\'s referent binding (fresh engine per entity)', () => {
    // Drive entity 1 and entity 2; capture the roleTags probe spine for each.
    const spines = [];
    const matrix = { entitiesById: {} };
    for (const entity of THREE.slice(0, 2)) {
      let engine = createElicitationEngine({ goalType: 'generic', matrixSnapshot: matrix, scope: [ENTITY_SLOT_ID] });
      engine = engine.consumeAnswer({ name: entity.name }).engine;
      const step = engine.nextStep();
      spines.push(step.probe.spine);
    }
    expect(spines[0]).toContain('Acme Robotics');
    expect(spines[1]).toContain('Northwind Logistics');
    expect(spines[0]).not.toContain('**'); // plain text, no markdown markers
    // Entity 2's probe must NOT carry entity 1's name.
    expect(spines[1]).not.toContain('Acme Robotics');
  });
});
