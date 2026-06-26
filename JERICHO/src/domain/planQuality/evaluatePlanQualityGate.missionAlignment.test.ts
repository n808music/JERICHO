import { describe, it, expect } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Research/academic goal — avoids commercial product launch gates entirely
const RESEARCH_GOAL = 'Complete chemistry dissertation research and publish three peer-reviewed papers';
const RESEARCH_VERIFY = 'Three papers accepted in peer-reviewed journals with committee approval';

// SaaS goal — used for the outcomeTarget alignment test
const SAAS_GOAL = 'Build and launch SaaS product to $10k MRR with paying customers';
const SAAS_VERIFY = '$10,000 monthly recurring revenue sustained for 3 consecutive months';

const TEMPORAL_SHORT = {
  contractStartDayKey: '2026-01-01',
  contractEndDayKey: '2026-11-30',
};

function makePhase(label: string, phaseObjective: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `phase-${label.toLowerCase()}`,
    label,
    phaseObjective,
    unlockCriteria: [
      'Research milestone validated with documented evidence and peer review outcome confirmed.',
    ],
    ...overrides,
  };
}

function makeExecBlock(phaseLabel: string) {
  const downstream =
    phaseLabel === 'P1'
      ? { consumedBy: ['phase:P2'], consumedByRef: { type: 'phaseObjective', id: 'P2' } }
      : phaseLabel === 'P2'
        ? { consumedBy: ['phase:P3'], consumedByRef: { type: 'phaseObjective', id: 'P3' } }
        : { consumedBy: ['terminal-review:cross-lane'], consumedByRef: { type: 'terminalOutcome', id: 'cross-lane' } };
  return {
    id: `exec-${phaseLabel}-1`,
    title: `Build research module for ${phaseLabel} deliverable scope`,
    deliverableId: 'deliv-1',
    blockType: 'action',
    owner: 'executor',
    durationMinutes: 60,
    producesArtifact: `${phaseLabel} research module with validated findings and documented evidence`,
    passEvidence: `${phaseLabel} research validated with documented evidence and acceptance criteria met`,
    phaseLabel,
    dayKey: phaseLabel === 'P1' ? '2026-03-01' : phaseLabel === 'P2' ? '2026-06-01' : '2026-09-01',
    ...downstream,
  };
}

function runGate(
  phases: unknown[],
  blocks: unknown[],
  missionContext: unknown,
  goalText = RESEARCH_GOAL,
  verifyText = RESEARCH_VERIFY,
) {
  return evaluatePlanQualityGate({
    goalText,
    verificationText: verifyText,
    proposedBlocks: blocks as any,
    committedBlocks: [],
    phases: phases as any,
    missionContext: missionContext as any,
    temporalContext: TEMPORAL_SHORT,
  });
}

// ---------------------------------------------------------------------------
// No mission context — not penalized
// ---------------------------------------------------------------------------

describe('Mission Alignment: no mission context is not penalized', () => {
  it('does not fire when missionContext is not provided', () => {
    const result = evaluatePlanQualityGate({
      goalText: RESEARCH_GOAL,
      verificationText: RESEARCH_VERIFY,
      proposedBlocks: [makeExecBlock('P1')] as any,
      phases: [makePhase('P1', 'Deploy advertising campaigns and hire a social media marketing team')] as any,
      temporalContext: TEMPORAL_SHORT,
    });
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
    expect(result.failureCodes).not.toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });

  it('does not fire when all missionContext fields are empty strings', () => {
    const result = runGate(
      [makePhase('P1', 'Deploy advertising campaigns and hire a social media marketing team')],
      [makeExecBlock('P1')],
      { coreMission: '', outcomeTarget: '', successStandard: '', terminalOutcome: '' },
    );
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
  });

  it('does not fire when phases are not provided alongside missionContext', () => {
    const result = evaluatePlanQualityGate({
      goalText: RESEARCH_GOAL,
      verificationText: RESEARCH_VERIFY,
      proposedBlocks: [makeExecBlock('P1')] as any,
      missionContext: { coreMission: RESEARCH_GOAL } as any,
      temporalContext: TEMPORAL_SHORT,
    });
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
    expect(result.failureCodes).not.toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });
});

// ---------------------------------------------------------------------------
// PHASE_OBJECTIVE_NOT_MISSION_ALIGNED
// ---------------------------------------------------------------------------

describe('Mission Alignment: PHASE_OBJECTIVE_NOT_MISSION_ALIGNED', () => {
  it('fails when phase objective has zero token overlap with chemistry research mission', () => {
    const result = runGate(
      [makePhase('P1', 'Deploy advertising campaigns, hire sales team, and launch social media marketing infrastructure')],
      [makeExecBlock('P1')],
      { coreMission: RESEARCH_GOAL },
    );
    expect(result.failureCodes).toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
  });

  it('fails when P2 objective is advertising-focused while mission is chemistry research', () => {
    const result = runGate(
      [
        makePhase('P1', 'Conduct chemistry literature review and produce preliminary research findings'),
        makePhase('P2', 'Deploy social media campaigns and hire marketing team for advertising revenue'),
      ],
      [makeExecBlock('P1'), makeExecBlock('P2')],
      { coreMission: RESEARCH_GOAL },
    );
    expect(result.failureCodes).toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
  });

  it('does not fire when phase objective shares meaningful tokens with mission coreMission', () => {
    const result = runGate(
      [makePhase('P1', 'Conduct chemistry research trials and produce first peer-reviewed paper draft with committee feedback')],
      [makeExecBlock('P1')],
      { coreMission: RESEARCH_GOAL },
    );
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
  });

  it('does not fire when alignment is via outcomeTarget (SaaS goal)', () => {
    const result = runGate(
      [makePhase('P1', 'Build SaaS MVP and validate first monthly recurring revenue conversion with paying customers')],
      [makeExecBlock('P1')],
      { outcomeTarget: SAAS_GOAL },
      SAAS_GOAL,
      SAAS_VERIFY,
    );
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
  });

  it('does not fire when alignment is via successStandard', () => {
    const result = runGate(
      [makePhase('P1', 'Complete first paper draft and submit to peer-reviewed journal for committee review')],
      [makeExecBlock('P1')],
      { successStandard: 'Three peer-reviewed papers published in chemistry journals' },
    );
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
  });
});

// ---------------------------------------------------------------------------
// TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT
// ---------------------------------------------------------------------------

describe('Mission Alignment: TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT', () => {
  it('fails when terminalOutcome provided but no P3 phase exists (only P1)', () => {
    const result = runGate(
      [makePhase('P1', 'Conduct initial chemistry research and validate hypothesis with committee review')],
      [makeExecBlock('P1')],
      { terminalOutcome: 'Three published papers accepted in peer-reviewed journals with committee approval' },
    );
    expect(result.failureCodes).toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });

  it('fails when only P1 and P2 exist for a declared terminal outcome', () => {
    const result = runGate(
      [
        makePhase('P1', 'Conduct initial chemistry research and produce first paper draft'),
        makePhase('P2', 'Refine research methodology and submit second peer-reviewed paper'),
      ],
      [makeExecBlock('P1'), makeExecBlock('P2')],
      { terminalOutcome: 'Three published papers with committee approval and dissertation defense' },
    );
    expect(result.failureCodes).toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });

  it('passes when P3 phase is present to support the terminal outcome', () => {
    const result = runGate(
      [
        makePhase('P1', 'Conduct initial chemistry research and produce first peer-reviewed paper'),
        makePhase('P2', 'Extend research findings and submit second journal paper with validated data'),
        makePhase('P3', 'Complete dissertation, submit third peer-reviewed paper, and prepare committee evidence'),
      ],
      [makeExecBlock('P1'), makeExecBlock('P2'), makeExecBlock('P3')],
      { terminalOutcome: 'Three published papers accepted with committee approval' },
    );
    expect(result.failureCodes).not.toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });

  it('does not fire when terminalOutcome is absent from missionContext', () => {
    const result = runGate(
      [makePhase('P1', 'Conduct chemistry research and publish first paper findings with committee feedback')],
      [makeExecBlock('P1')],
      { coreMission: RESEARCH_GOAL }, // no terminalOutcome
    );
    expect(result.failureCodes).not.toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });

  it('does not fire when terminalOutcome is empty string', () => {
    const result = runGate(
      [makePhase('P1', 'Conduct chemistry research and publish first paper findings')],
      [makeExecBlock('P1')],
      { coreMission: RESEARCH_GOAL, terminalOutcome: '' },
    );
    expect(result.failureCodes).not.toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });
});

// ---------------------------------------------------------------------------
// Full valid alignment — all checks pass
// ---------------------------------------------------------------------------

describe('Mission Alignment: valid aligned plan passes all checks', () => {
  it('passes when all phases are aligned with the mission and P3 supports terminal outcome', () => {
    const result = runGate(
      [
        makePhase('P1', 'Conduct initial chemistry research and produce first peer-reviewed paper'),
        makePhase('P2', 'Extend research findings and submit second journal paper with validated data'),
        makePhase('P3', 'Complete dissertation, submit third peer-reviewed paper, and prepare committee evidence'),
      ],
      [makeExecBlock('P1'), makeExecBlock('P2'), makeExecBlock('P3')],
      {
        coreMission: RESEARCH_GOAL,
        terminalOutcome: 'Three published papers accepted in peer-reviewed journals with committee approval',
      },
    );
    expect(result.failureCodes).not.toContain('PHASE_OBJECTIVE_NOT_MISSION_ALIGNED');
    expect(result.failureCodes).not.toContain('TERMINAL_OUTCOME_WITHOUT_PHASE_SUPPORT');
  });
});
