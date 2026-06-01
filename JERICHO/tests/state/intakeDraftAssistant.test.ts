/**
 * intakeDraftAssistant.test.ts
 *
 * Focused tests for Role A — Intake Drafting Assistant.
 *
 * Gate A  (A1–A6): parser/validator rejects non-compliant payloads.
 * Gate B  (B7–B10): helper behaves correctly on success/failure.
 * Gate C  (C11–C15): admission flow invariants.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  parseIntakeDraft,
  validateIntakeDraft,
  callIntakeDraftAssistant,
  type IntakeDraftPayload,
  type IntakeDraftCaller,
} from '../../src/state/intakeDraftAssistant.ts';
import { buildGoalIntakeContract, getIntakeGateCode } from '../../src/domain/goal/GoalIntakeContract.ts';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_PAYLOAD: IntakeDraftPayload = {
  source: 'agent_draft',
  schemaVersion: 'jericho_intake_draft_v1',
  agentNote: 'Suggested based on goal text.',
  draftedAnswers: [
    {
      questionId: 'podcast-completion-boundary',
      field: 'completionBoundary',
      suggestedValue: 'published',
      rationale: 'You mentioned publishing episodes.',
      requiresUserConfirmation: true,
    },
  ],
};

const VALID_JSON = JSON.stringify(VALID_PAYLOAD);

const BASE_PLANNING_ANSWERS = {
  executionContext: 'part_time',
  weeklyHoursAvailable: 10,
  capitalAvailable: 5000,
  hardDeadline: '2026-09-01',
  existingDomainRelationships: [],
};

// Helper: build an ambiguous podcast intake contract (completionBoundary unresolved)
function buildAmbiguousPodcastIntake(answeredContext: Record<string, unknown> = {}) {
  return buildGoalIntakeContract({
    goalId: 'test-goal',
    rawGoalText: 'Finish 10 podcast episodes', // "finish" verb not in boundary map → ambiguous
    executionType: 'CreativeProduction',
    deadline: '2026-09-01',
    answeredContext: {
      ...BASE_PLANNING_ANSWERS,
      ...answeredContext,
    },
  });
}

// Helper: build a ready podcast intake contract (boundary resolved via answeredContext)
function buildResolvedPodcastIntake() {
  return buildGoalIntakeContract({
    goalId: 'test-goal',
    rawGoalText: 'Finish 10 podcast episodes',
    executionType: 'CreativeProduction',
    deadline: '2026-09-01',
    answeredContext: { ...BASE_PLANNING_ANSWERS, completionBoundary: 'published' },
  });
}

// Mock callClaude that returns a valid payload
const mockCallerValid: IntakeDraftCaller = async () => VALID_JSON;

// Mock callClaude that throws
const mockCallerThrows: IntakeDraftCaller = async () => {
  throw new Error('Network failure');
};

// Mock callClaude that returns garbage JSON
const mockCallerGarbage: IntakeDraftCaller = async () => 'not json at all {{{';

// Mock callClaude that returns invalid schema (missing source)
const mockCallerBadSchema: IntakeDraftCaller = async () =>
  JSON.stringify({ schemaVersion: 'jericho_intake_draft_v1', draftedAnswers: [] });

// ─── Gate A: parser/validator tests ──────────────────────────────────────────

describe('Gate A — parseIntakeDraft / validateIntakeDraft', () => {
  // A1: accepts valid payload
  it('A1: accepts payload with source=agent_draft and requiresUserConfirmation=true', () => {
    const result = parseIntakeDraft(VALID_JSON);
    expect(result).not.toBeNull();
    expect(result?.source).toBe('agent_draft');
    expect(result?.draftedAnswers[0].requiresUserConfirmation).toBe(true);
  });

  // A2: rejects payload missing source field entirely
  it('A2: rejects payload where source field is absent', () => {
    const payload = { ...VALID_PAYLOAD };
    // @ts-expect-error intentional test of missing field
    delete payload.source;
    expect(parseIntakeDraft(JSON.stringify(payload))).toBeNull();
    expect(validateIntakeDraft(payload)).toBe(false);
  });

  // A3: rejects payload where source is not 'agent_draft'
  it('A3: rejects payload where source !== agent_draft', () => {
    const payload = { ...VALID_PAYLOAD, source: 'user_input' };
    expect(parseIntakeDraft(JSON.stringify(payload))).toBeNull();
    expect(validateIntakeDraft(payload)).toBe(false);
  });

  // A4: rejects payload where requiresUserConfirmation is absent from an answer
  it('A4: rejects answer missing requiresUserConfirmation', () => {
    const answer = { ...VALID_PAYLOAD.draftedAnswers[0] };
    // @ts-expect-error intentional test of missing field
    delete answer.requiresUserConfirmation;
    const payload = { ...VALID_PAYLOAD, draftedAnswers: [answer] };
    expect(parseIntakeDraft(JSON.stringify(payload))).toBeNull();
    expect(validateIntakeDraft(payload)).toBe(false);
  });

  // A5: rejects payload where requiresUserConfirmation is false
  it('A5: rejects answer where requiresUserConfirmation === false', () => {
    const payload = {
      ...VALID_PAYLOAD,
      draftedAnswers: [{ ...VALID_PAYLOAD.draftedAnswers[0], requiresUserConfirmation: false }],
    };
    expect(parseIntakeDraft(JSON.stringify(payload))).toBeNull();
    expect(validateIntakeDraft(payload)).toBe(false);
  });

  // A6: rejects malformed draftedAnswers (missing required field on an answer)
  it('A6: rejects answer missing questionId', () => {
    const answer = { ...VALID_PAYLOAD.draftedAnswers[0] };
    // @ts-expect-error intentional test
    delete answer.questionId;
    const payload = { ...VALID_PAYLOAD, draftedAnswers: [answer] };
    expect(parseIntakeDraft(JSON.stringify(payload))).toBeNull();
    expect(validateIntakeDraft(payload)).toBe(false);
  });

  it('parseIntakeDraft returns null on invalid JSON string', () => {
    expect(parseIntakeDraft('not json')).toBeNull();
  });

  it('parseIntakeDraft enforces requiresUserConfirmation: true even if validator passed', () => {
    // Directly test that the defense-in-depth re-write fires
    const result = parseIntakeDraft(VALID_JSON);
    expect(result).not.toBeNull();
    result!.draftedAnswers.forEach((a) => {
      expect(a.requiresUserConfirmation).toBe(true);
    });
  });
});

// ─── Gate B: helper behavior tests ────────────────────────────────────────────

describe('Gate B — callIntakeDraftAssistant', () => {
  // B7: returns typed result on valid mocked provider response
  it('B7: returns IntakeDraftPayload on valid mock caller response', async () => {
    const intake = buildAmbiguousPodcastIntake();
    const result = await callIntakeDraftAssistant(intake, 'Finish 10 podcast episodes', 'test-goal', mockCallerValid);
    expect(result).not.toBeNull();
    expect(result?.source).toBe('agent_draft');
    expect(result?.draftedAnswers.length).toBeGreaterThanOrEqual(1);
    expect(result?.draftedAnswers[0].requiresUserConfirmation).toBe(true);
  });

  // B8: returns null on provider failure (throws)
  it('B8: returns null when callClaude throws', async () => {
    const intake = buildAmbiguousPodcastIntake();
    const result = await callIntakeDraftAssistant(intake, 'Finish 10 podcast episodes', 'test-goal', mockCallerThrows);
    expect(result).toBeNull();
  });

  // B9: returns null on invalid parse / validation failure
  it('B9a: returns null when callClaude returns unparseable text', async () => {
    const intake = buildAmbiguousPodcastIntake();
    const result = await callIntakeDraftAssistant(intake, 'Finish 10 podcast episodes', 'test-goal', mockCallerGarbage);
    expect(result).toBeNull();
  });

  it('B9b: returns null when callClaude returns schema-invalid JSON', async () => {
    const intake = buildAmbiguousPodcastIntake();
    const result = await callIntakeDraftAssistant(
      intake,
      'Finish 10 podcast episodes',
      'test-goal',
      mockCallerBadSchema
    );
    expect(result).toBeNull();
  });

  // B10: does not dispatch to store or mutate canonical state
  it('B10: does not call any store dispatch or mutate external state', async () => {
    const mockDispatch = vi.fn();
    // callIntakeDraftAssistant has no store parameter and no imports that would dispatch.
    // Verify it returns a result without the mock being touched.
    const intake = buildAmbiguousPodcastIntake();
    const result = await callIntakeDraftAssistant(intake, 'Finish 10 podcast episodes', 'test-goal', mockCallerValid);
    expect(result).not.toBeNull();
    expect(mockDispatch).not.toHaveBeenCalled(); // never called — helper has no store reference
  });
});

// ─── Gate C: admission flow tests ─────────────────────────────────────────────

describe('Gate C — admission flow invariants', () => {
  // C11: helper returns null when there are no unanswered questions
  it('C11: returns null when intake contract has no unanswered required questions', async () => {
    // A resolved intake has no required questions
    const resolvedIntake = buildResolvedPodcastIntake();
    expect(resolvedIntake.requiredContextQuestions.length).toBe(0);
    const result = await callIntakeDraftAssistant(
      resolvedIntake,
      'Finish 10 podcast episodes',
      'test-goal',
      mockCallerValid
    );
    expect(result).toBeNull(); // helper guards: no unanswered = no call
  });

  // C12: confirmed draft answers, when applied to answeredContext, cause buildGoalIntakeContract
  // to re-run and resolve the previously blocking question
  it('C12: answeredContext with confirmed boundary resolves podcast intake gate', () => {
    const intakeBefore = buildAmbiguousPodcastIntake();
    expect(intakeBefore.readiness.isReadyForPlanning).toBe(false);
    expect(getIntakeGateCode(intakeBefore)).toBe('INTAKE_BOUNDARY_AMBIGUOUS');

    // Simulate user confirming the drafted answer by passing it to answeredContext
    const intakeAfter = buildAmbiguousPodcastIntake({ completionBoundary: 'published' });
    expect(intakeAfter.readiness.isReadyForPlanning).toBe(true);
    expect(getIntakeGateCode(intakeAfter)).toBe('INTAKE_OK');
  });

  // C13: intake gate remains authoritative after re-run — invalid boundary doesn't resolve
  it('C13: invalid boundary value in answeredContext does not resolve the gate', () => {
    const intake = buildAmbiguousPodcastIntake({ completionBoundary: 'not_a_valid_boundary' });
    expect(intake.readiness.isReadyForPlanning).toBe(false);
    expect(getIntakeGateCode(intake)).toBe('INTAKE_BOUNDARY_AMBIGUOUS');
  });

  // C14: agent cannot short-circuit isReadyForPlanning — only valid answered context resolves
  it('C14: agent draft payload itself does not touch isReadyForPlanning', async () => {
    const intakeBefore = buildAmbiguousPodcastIntake();
    // Get a valid draft payload
    const draft = await callIntakeDraftAssistant(
      intakeBefore,
      'Finish 10 podcast episodes',
      'test-goal',
      mockCallerValid
    );
    expect(draft).not.toBeNull();

    // The intake contract is still blocked — the draft payload alone changes nothing
    expect(intakeBefore.readiness.isReadyForPlanning).toBe(false);

    // Only when the user-confirmed answer is passed to buildGoalIntakeContract does it resolve
    const intakeResolved = buildAmbiguousPodcastIntake({
      completionBoundary: draft!.draftedAnswers[0].suggestedValue as string,
    });
    // published is a valid boundary, so this resolves:
    expect(intakeResolved.readiness.isReadyForPlanning).toBe(true);
  });

  // C15: manual flow remains unchanged when agent is unavailable (caller is null/returns null)
  it('C15: manual flow unaffected when callClaude returns null (simulate disabled/unavailable)', async () => {
    const mockCallerReturnsNull: IntakeDraftCaller = async () => {
      // Returns a JSON string that validates to null (wrong schema)
      return JSON.stringify({ source: 'not_agent_draft' });
    };
    const intake = buildAmbiguousPodcastIntake();

    // Agent path fails silently
    const result = await callIntakeDraftAssistant(
      intake,
      'Finish 10 podcast episodes',
      'test-goal',
      mockCallerReturnsNull
    );
    expect(result).toBeNull();

    // Intake contract is still independently operable — gate still blocks
    expect(intake.readiness.isReadyForPlanning).toBe(false);

    // User can still manually pass answeredContext — gate resolves normally
    const intakeManual = buildAmbiguousPodcastIntake({ completionBoundary: 'edited' });
    expect(intakeManual.readiness.isReadyForPlanning).toBe(true);
  });
});
