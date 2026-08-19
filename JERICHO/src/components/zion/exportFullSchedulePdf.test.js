import { describe, expect, it } from 'vitest';
import { buildFullSchedulePdfDocDefinition } from './exportFullSchedulePdf.js';

function flatten(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
    return out;
  }
  if (typeof node === 'object') {
    if (node.text != null) flatten(node.text, out);
    if (node.columns) flatten(node.columns, out);
    if (node.stack) flatten(node.stack, out);
    if (node.ul) flatten(node.ul, out);
    if (node.ol) flatten(node.ol, out);
    if (node.table?.body) flatten(node.table.body, out);
  }
  return out;
}

function fixtureBundle() {
  return {
    meta: {
      extractedAtISO: '2026-06-06T12:00:00.000Z',
      activeGoalId: 'goal-1',
      activeCycleId: 'cycle-1',
      range: { startDayKey: '2026-06-08', endDayKey: '2031-10-17' },
    },
    masterPlan: {
      id: 'masterplan-1',
      title: 'Operation Endgame',
      coreMission: 'Build the operating system to ship the album.',
      horizonStart: '2026-06-08',
      horizonEnd: '2031-10-17',
      northStarOutcome: 'Album released; OS in operation.',
    },
    lanes: {
      'lane-album': { title: 'Album', domain: 'creative', role: 'primary' },
      'lane-os': { title: 'Operating System', domain: 'ops', role: 'supporting' },
    },
    milestones: [
      {
        id: 'm-1',
        laneId: 'lane-album',
        laneTitle: 'Album',
        title: 'Operation Endgame Public Launch Convergence',
        targetDate: '2026-10-17',
      },
      {
        id: 'm-2',
        laneId: 'lane-os',
        laneTitle: 'Operating System',
        title: 'Establish operating cadence dashboard',
        targetDate: '2027-09-15',
      },
      {
        id: 'm-3',
        laneId: 'lane-os',
        laneTitle: 'Operating System',
        title: 'Terminal scale-readiness review',
        targetDate: '2030-06-15',
      },
    ],
    integrityReport: {
      dependencyAudit: {
        status: 'PASS',
        blocksChecked: 3,
        artifactsChecked: 2,
        failureCounts: {},
      },
    },
    fullHorizonBlocks: [
      {
        id: 'block-A',
        dayKey: '2026-06-08',
        startISO: '2026-06-08T09:00:00Z',
        endISO: '2026-06-08T11:00:00Z',
        durationMinutes: 120,
        phaseLabel: 'Foundation',
        laneId: 'lane-os',
        laneTitle: 'Operating System',
        blockType: 'planning',
        owner: 'Operations Lead',
        title: 'Draft P2 review charter',
        displayTitle: 'Draft P2 review charter',
        expectedOutput: 'First-draft charter with scope and owners',
        producesArtifact: true,
        outputArtifact: 'artifact-charter-v1',
        outputArtifactId: 'artifact-charter-v1',
        outputArtifactJustification: 'Required for P2 gate review.',
        consumedArtifactIds: [],
        dependsOnBlockIds: [],
        gateCriteria: null,
        riskFlag: false,
      },
      {
        id: 'block-B',
        dayKey: '2026-06-08',
        startISO: '2026-06-08T11:15:00Z',
        endISO: '2026-06-08T12:30:00Z',
        durationMinutes: 75,
        phaseLabel: 'Production',
        laneId: 'lane-album',
        laneTitle: 'Album',
        blockType: 'studio',
        owner: 'Creative Lead',
        title: 'Album mix pass 1',
        displayTitle: 'Album mix pass 1',
        expectedOutput: 'Mix v1 with vocal/instrumental balance',
        producesArtifact: true,
        outputArtifactId: 'artifact-mix-v1',
        outputArtifactJustification: 'Feeds mix pass 2.',
        consumedArtifactIds: ['artifact-tracking-v3'],
        dependsOnBlockIds: ['block-A'],
        gateCriteria: {
          gateName: 'Product Launch Readiness Gate',
          metricName: 'Determine whether launch can proceed',
          acceptanceCriteria: 'QA checklist complete and first-user feedback captured',
          threshold: 'critical blockers = 0',
          evidenceRequired: 'QA report, feedback summary, deployment checklist',
          passBranch: 'advance:launch-readiness',
          failBranch: 'hold:remediate-blockers',
        },
        passCriteria: 'QA checklist complete and first-user feedback captured',
        failCriteria: 'Any critical blocker remains open',
        riskFlag: true,
      },
      {
        id: 'block-C',
        dayKey: '2026-06-09',
        startISO: '2026-06-09T09:00:00Z',
        endISO: '2026-06-09T10:30:00Z',
        durationMinutes: 90,
        phaseLabel: 'Foundation',
        laneId: 'lane-os',
        laneTitle: 'Operating System',
        blockType: 'planning',
        owner: 'Operations Lead',
        title: 'P2 stakeholder map',
        displayTitle: 'P2 stakeholder map',
        expectedOutput: 'Stakeholder list with influence ratings',
        producesArtifact: false,
        consumedArtifactIds: [],
        dependsOnBlockIds: ['block-A'],
        gateCriteria: null,
        riskFlag: false,
      },
    ],
  };
}

describe('buildFullSchedulePdfDocDefinition', () => {
  it('returns a pdfmake-shaped doc definition with content + page metadata', () => {
    const doc = buildFullSchedulePdfDocDefinition(fixtureBundle());
    expect(doc).toBeTypeOf('object');
    expect(Array.isArray(doc.content)).toBe(true);
    expect(doc.content.length).toBeGreaterThan(0);
    expect(doc.pageSize).toBeDefined();
    // styles registry should be present (or defined as inline styles per node — accept either)
    expect(doc.defaultStyle || doc.styles).toBeTruthy();
  });

  it('opens with the plan title and mission', () => {
    const doc = buildFullSchedulePdfDocDefinition(fixtureBundle());
    const text = flatten(doc.content).join('\n');
    expect(text).toMatch(/Operation Endgame/);
    expect(text).toMatch(/Build the operating system to ship the album\./);
    expect(text).toMatch(/2026-06-08/); // horizon start in header
  });

  it('groups blocks under day headings in chronological order', () => {
    const doc = buildFullSchedulePdfDocDefinition(fixtureBundle());
    const text = flatten(doc.content).join('\n');
    const idxDay1 = text.indexOf('2026-06-08');
    const idxDay2 = text.indexOf('2026-06-09');
    expect(idxDay1).toBeGreaterThan(-1);
    expect(idxDay2).toBeGreaterThan(idxDay1);
  });

  it('renders full detail for each block: title, lane, phase, expected output, artifact, depends-on, gate, risk', () => {
    const doc = buildFullSchedulePdfDocDefinition(fixtureBundle());
    const text = flatten(doc.content).join('\n');

    // block-A
    expect(text).toMatch(/Draft P2 review charter/);
    expect(text).toMatch(/Operating System/);
    expect(text).toMatch(/Operations Lead/);
    expect(text).toMatch(/Foundation/);
    expect(text).toMatch(/First-draft charter with scope and owners/);
    expect(text).toMatch(/artifact-charter-v1/);

    // block-B — has dependency, gate, risk
    expect(text).toMatch(/Album mix pass 1/);
    expect(text).toMatch(/Creative Lead/);
    expect(text).toMatch(/block-A/); // depends-on rendered
    expect(text).toMatch(/Product Launch Readiness Gate/);
    expect(text).toMatch(/QA checklist complete and first-user feedback captured/);
    expect(text).toMatch(/risk/i); // risk flag indicator
  });

  it('includes milestone and dependency audit summaries near the top of the document', () => {
    const doc = buildFullSchedulePdfDocDefinition(fixtureBundle());
    const text = flatten(doc.content).join('\n');
    expect(text).toMatch(/Dependency audit: PASS/);
    expect(text).toMatch(/Key milestones/);
    expect(text).toMatch(/Operation Endgame Public Launch Convergence/);
    expect(text).toMatch(/P1 launch\/proof milestones: 2026–2027/);
    expect(text).toMatch(/P2 conversion\/operating-system milestones: 2027–2029/);
    expect(text).toMatch(/P3 scale\/terminal-readiness milestones: 2029–2031/);
  });

  it('falls back gracefully when bundle is empty', () => {
    const empty = {
      meta: {},
      masterPlan: { title: 'Empty Plan' },
      lanes: {},
      milestones: [],
      fullHorizonBlocks: [],
    };
    const doc = buildFullSchedulePdfDocDefinition(empty);
    expect(doc).toBeTypeOf('object');
    expect(Array.isArray(doc.content)).toBe(true);
    const text = flatten(doc.content).join('\n');
    expect(text).toMatch(/Empty Plan/);
    expect(text).toMatch(/No blocks|0 blocks|no scheduled blocks/i);
  });

  it('throws (or returns null) for a null/undefined bundle rather than crashing on access', () => {
    expect(() => buildFullSchedulePdfDocDefinition(null)).not.toThrow();
    expect(buildFullSchedulePdfDocDefinition(null)).toBeNull();
  });
});
