import { describe, it, expect } from 'vitest';
import { selectMasterGridRows, countByClass } from './masterGridSelectors.js';

const matrix = {
  entitiesById: {
    e1: { id: 'e1', name: 'Global State Corp.', roleTags: ['corp'], reviewStatus: 'CONFIRMED', phase: null },
    e2: { id: 'e2', name: 'Global State Productions', roleTags: [], reviewStatus: 'DRAFT', phase: null },
  },
  initiativesById: {
    i1: { id: 'i1', name: 'Romance Riot', owningEntityId: 'e1', roleTags: [], reviewStatus: 'CONFIRMED', phase: '1' },
  },
  projectsById: {
    p1: { id: 'p1', name: 'OUR FEARLESS LEADER 3', owningEntityId: 'e1', owningInitiativeId: 'i1', reviewStatus: 'DRAFT', phase: '1', roleTags: [] },
  },
  artifactsById: {
    a1: { id: 'a1', name: 'OFL 3: Romance Riot — tape/album', producingProjectId: 'p1', producedByEntityId: 'e2', reviewStatus: 'CONFIRMED', phase: '1', roleTags: [] },
  },
  systemsById: {},
};

describe('selectMasterGridRows', () => {
  it('flattens all classes with verbatim names', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.map((r) => r.name)).toContain('OFL 3: Romance Riot — tape/album');
    expect(rows).toHaveLength(5);
  });

  it('labels artifact rows as Deliverable', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'a1').primaryClass).toBe('Deliverable');
  });

  it('resolves Deliverable ownerParentLabel as producer-entity / parent-project', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'a1').ownerParentLabel)
      .toBe('Global State Productions / OUR FEARLESS LEADER 3');
  });

  it('resolves Project ownerParentLabel as owner / parent-initiative', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'p1').ownerParentLabel)
      .toBe('Global State Corp. / Romance Riot');
  });

  it('Entity ownerParentLabel is em dash', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'e1').ownerParentLabel).toBe('—');
  });

  it('readyForIntake = reviewStatus CONFIRMED', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.find((r) => r.id === 'i1').readyForIntake).toBe(true);
    expect(rows.find((r) => r.id === 'p1').readyForIntake).toBe(false);
  });

  it('default sort: class order then name', () => {
    const rows = selectMasterGridRows(matrix);
    expect(rows.map((r) => r.primaryClass)).toEqual(['Entity', 'Entity', 'Initiative', 'Project', 'Deliverable']);
  });

  it('countByClass returns per-class totals', () => {
    expect(countByClass(selectMasterGridRows(matrix)))
      .toEqual({ total: 5, Entity: 2, Initiative: 1, Project: 1, Deliverable: 1, System: 0 });
  });
});
