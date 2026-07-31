import { describe, it, expect } from 'vitest';
import { selectMasterGridRows, countByClass } from './masterGridSelectors.js';

const matrix = {
  entitiesById: {
    e1: { id: 'e1', name: 'Acme Corp', roleTags: [], reviewStatus: 'CONFIRMED', phase: null },
  },
  initiativesById: {
    i1: { id: 'i1', name: 'Widget Project', owningEntityId: 'e1', roleTags: [], reviewStatus: 'CONFIRMED', phase: '1' },
  },
  projectsById: {
    p1: { id: 'p1', name: 'Design & Specification', owningEntityId: 'e1', owningInitiativeId: 'i1', reviewStatus: 'CONFIRMED', phase: '1', roleTags: [] },
  },
  deliverablesById: {
    d1: { id: 'd1', name: 'Architecture Document', owningProjectId: 'p1', owningInitiativeId: 'i1', reviewStatus: 'CONFIRMED', phase: '1' },
    d2: { id: 'd2', name: 'API Specification', owningProjectId: 'p1', owningInitiativeId: 'i1', reviewStatus: 'DRAFT', phase: '1' },
  },
  artifactsById: {
    a1: { id: 'a1', name: 'Architecture PDF', producingProjectId: 'p1', producedByEntityId: 'e1', reviewStatus: 'CONFIRMED', phase: '1', roleTags: [] },
  },
  systemsById: {},
};

describe('Deliverable tier (Section 5.5)', () => {
  it('renders Deliverables as distinct class', () => {
    const rows = selectMasterGridRows(matrix);
    const deliverables = rows.filter((r) => r.primaryClass === 'Deliverable');
    expect(deliverables).toHaveLength(2);
    // Sorted alphabetically: 'API Specification' before 'Architecture Document'
    expect(deliverables.map((d) => d.id)).toEqual(['d2', 'd1']);
  });

  it('renders Artifacts as separate distinct class', () => {
    const rows = selectMasterGridRows(matrix);
    const artifacts = rows.filter((r) => r.primaryClass === 'Artifact');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].id).toBe('a1');
  });

  it('Deliverable class sorts between Project and Artifact', () => {
    const rows = selectMasterGridRows(matrix);
    const classes = rows.map((r) => r.primaryClass);
    const projectIdx = classes.indexOf('Project');
    const deliverableIdx = classes.indexOf('Deliverable');
    const artifactIdx = classes.indexOf('Artifact');
    expect(projectIdx < deliverableIdx).toBe(true);
    expect(deliverableIdx < artifactIdx).toBe(true);
  });

  it('resolves Deliverable ownerParentLabel as owning-initiative / owning-project', () => {
    const rows = selectMasterGridRows(matrix);
    const d1 = rows.find((r) => r.id === 'd1');
    expect(d1.ownerParentLabel).toBe('Widget Project / Design & Specification');
  });

  it('preserves Deliverable phase and reviewStatus', () => {
    const rows = selectMasterGridRows(matrix);
    const d1 = rows.find((r) => r.id === 'd1');
    expect(d1.phase).toBe('1');
    expect(d1.reviewStatus).toBe('CONFIRMED');
    expect(d1.readyForIntake).toBe(true);
  });

  it('countByClass tracks Deliverable and Artifact separately', () => {
    const counts = countByClass(selectMasterGridRows(matrix));
    expect(counts.Deliverable).toBe(2);
    expect(counts.Artifact).toBe(1);
    expect(counts.Project).toBe(1);
  });

  it('Deliverables sort by phase then name within class', () => {
    const phaseMatrix = {
      entitiesById: {},
      initiativesById: {},
      projectsById: { p1: { id: 'p1', name: 'Project', owningEntityId: '', reviewStatus: 'DRAFT', phase: null } },
      deliverablesById: {
        d3: { id: 'd3', name: 'Third Item', owningProjectId: 'p1', reviewStatus: 'DRAFT', phase: '3' },
        d1: { id: 'd1', name: 'First Item', owningProjectId: 'p1', reviewStatus: 'DRAFT', phase: '1' },
        d2: { id: 'd2', name: 'Second Item', owningProjectId: 'p1', reviewStatus: 'DRAFT', phase: '2' },
      },
      artifactsById: {},
      systemsById: {},
    };
    const rows = selectMasterGridRows(phaseMatrix);
    const deliverables = rows.filter((r) => r.primaryClass === 'Deliverable');
    expect(deliverables.map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
  });
});
