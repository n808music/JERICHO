/**
 * intakeDraftAssistant.ts
 * Role A — Intake Drafting Assistant (Phase F)
 *
 * Pure async helper. Given an unanswered GoalIntakeContract, produces a
 * non-authoritative IntakeDraftPayload with candidate answers for user review.
 *
 * Invariants:
 * - Returns IntakeDraftPayload | null. Never throws to caller.
 * - callClaude is injected; no LLM client is imported directly here.
 * - All output carries source: 'agent_draft' and requiresUserConfirmation: true.
 * - Parser/validator enforce both fields — not just by type annotation.
 * - No store dispatch. No canonical state mutation. No planning artifacts.
 * - Only invoked when requiredContextQuestions exist and are unanswered.
 */

import type { GoalIntakeContract, IntakeQuestion } from '../domain/goal/GoalIntakeContract';
import { LLM_CALL_PROFILES } from './llmActionGraph';
import type { LLMCallProfile } from './llmActionGraph';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * A single candidate answer for one required intake context question.
 * requiresUserConfirmation must be exactly true — enforced by validateIntakeDraft.
 */
export type IntakeDraftAnswer = {
  /** Matches IntakeQuestion.id */
  questionId: string;
  /** Matches IntakeQuestion.field */
  field: string;
  /** Suggested value. If question has options, must be one of them. */
  suggestedValue: string | number | boolean | string[];
  /** Plain-English rationale for the suggestion */
  rationale: string;
  /** Always true — never auto-applied without user action */
  requiresUserConfirmation: true;
};

/**
 * The complete non-authoritative output of one intake draft assistant session.
 * source must be 'agent_draft' — enforced by validateIntakeDraft.
 */
export type IntakeDraftPayload = {
  /** Always 'agent_draft' — enforced by validateIntakeDraft */
  source: 'agent_draft';
  /** Must match INTAKE_CLARIFICATION profile schemaVersion */
  schemaVersion: 'jericho_intake_draft_v1';
  /** Optional plain-English summary of what was clarified */
  agentNote: string | null;
  /** One entry per unanswered required context question */
  draftedAnswers: IntakeDraftAnswer[];
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * validateIntakeDraft
 *
 * Type guard enforcing IntakeDraftPayload schema.
 * Gate A requirements: source === 'agent_draft' and requiresUserConfirmation === true
 * are checked on the outer payload AND on every individual answer entry.
 *
 * Rejects any payload that is missing, malformed, or attempts to bypass provenance.
 */
export function validateIntakeDraft(payload: unknown): payload is IntakeDraftPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;

  // Gate A: source must be exactly 'agent_draft'
  if (p['source'] !== 'agent_draft') return false;

  // Gate A: schema version must match the INTAKE_CLARIFICATION profile
  if (p['schemaVersion'] !== 'jericho_intake_draft_v1') return false;

  // draftedAnswers must be an array (may be empty, but must exist)
  if (!Array.isArray(p['draftedAnswers'])) return false;

  // Validate each drafted answer
  for (const answer of p['draftedAnswers']) {
    if (!answer || typeof answer !== 'object') return false;
    const a = answer as Record<string, unknown>;

    if (typeof a['questionId'] !== 'string' || !a['questionId']) return false;
    if (typeof a['field'] !== 'string' || !a['field']) return false;
    if (a['suggestedValue'] === undefined || a['suggestedValue'] === null) return false;
    if (typeof a['rationale'] !== 'string') return false;

    // Gate A: requiresUserConfirmation must be exactly true on every answer
    if (a['requiresUserConfirmation'] !== true) return false;
  }

  return true;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * parseIntakeDraft
 *
 * Parses a raw JSON string from the API into IntakeDraftPayload.
 * Returns null on any parse or validation failure. Never throws.
 *
 * Also enforces requiresUserConfirmation: true on every answer even if the
 * raw response omitted it — defence-in-depth against provider non-compliance.
 */
export function parseIntakeDraft(rawText: string): IntakeDraftPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }

  if (!validateIntakeDraft(parsed)) return null;

  // Defence-in-depth: force requiresUserConfirmation: true on every answer
  // even if validateIntakeDraft passed due to a logic edge case.
  const safe: IntakeDraftPayload = {
    ...parsed,
    draftedAnswers: parsed.draftedAnswers.map((a) => ({
      ...a,
      requiresUserConfirmation: true as const,
    })),
  };
  return safe;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildIntakeDraftPrompt(intakeContract: GoalIntakeContract, rawGoalText: string): string {
  const unanswered = intakeContract.requiredContextQuestions.filter(
    (q: IntakeQuestion) => intakeContract.answeredContext[q.field] === undefined
  );

  const questionLines = unanswered.map((q: IntakeQuestion, i: number) => {
    const optionNote = q.options?.length ? ` (options: ${q.options.join(', ')})` : '';
    return `  ${i + 1}. questionId="${q.id}" field="${q.field}": ${q.prompt}${optionNote}`;
  });

  const schema = JSON.stringify(
    {
      source: 'agent_draft',
      schemaVersion: 'jericho_intake_draft_v1',
      agentNote: 'string or null',
      draftedAnswers: [
        {
          questionId: 'string — must match a questionId above',
          field: 'string — must match a field above',
          suggestedValue: 'string | number | boolean | string[] — if options given, use one of them',
          rationale: 'string — brief plain-English reason',
          requiresUserConfirmation: true,
        },
      ],
    },
    null,
    2
  );

  return [
    'You are helping a user clarify their goal before a planning system generates their schedule.',
    'The planning system needs specific answers to proceed.',
    'You are NOT deciding the plan — you are suggesting candidate answers for the user to review.',
    '',
    `Goal: "${rawGoalText}"`,
    '',
    'Unanswered required questions:',
    ...questionLines,
    '',
    'Suggest one concrete answer per question based on the goal text.',
    'If options are listed, you MUST choose exactly one of the provided options.',
    'Return ONLY valid JSON exactly matching this schema — no prose outside the JSON:',
    schema,
  ].join('\n');
}

// ─── Injected caller type ─────────────────────────────────────────────────────

/**
 * IntakeDraftCaller — the injected Claude call function.
 * Must be provided by the caller; never imported inside this module.
 * Use a mock in tests. Use the real API adapter in production.
 */
export type IntakeDraftCaller = (prompt: string, profile: LLMCallProfile) => Promise<string>;

// ─── Main helper ──────────────────────────────────────────────────────────────

/**
 * callIntakeDraftAssistant
 *
 * Produces a non-authoritative IntakeDraftPayload for the unanswered required
 * context questions in the given GoalIntakeContract.
 *
 * - Returns IntakeDraftPayload on success.
 * - Returns null if: no unanswered questions, callClaude throws, response is
 *   invalid, or any other failure. Never throws.
 * - Does NOT dispatch to store. Does NOT mutate canonical state.
 * - Only enters when IntakeGateCode !== 'INTAKE_OK' and questions are unanswered.
 *
 * @param intakeContract - Current GoalIntakeContract (with requiredContextQuestions)
 * @param rawGoalText    - User's raw goal text (for prompt context)
 * @param _goalId        - Goal ID (reserved for future tracing; not stored)
 * @param callClaude     - Injected async caller — never imported here
 */
export async function callIntakeDraftAssistant(
  intakeContract: GoalIntakeContract,
  rawGoalText: string,
  _goalId: string,
  callClaude: IntakeDraftCaller
): Promise<IntakeDraftPayload | null> {
  // Guard: only run when there are unanswered required questions
  const hasUnanswered = intakeContract.requiredContextQuestions.some(
    (q: IntakeQuestion) => intakeContract.answeredContext[q.field] === undefined
  );
  if (!hasUnanswered) return null;

  const profile = LLM_CALL_PROFILES.INTAKE_CLARIFICATION;
  const prompt = buildIntakeDraftPrompt(intakeContract, rawGoalText);

  try {
    const rawResponse = await callClaude(prompt, profile);
    return parseIntakeDraft(rawResponse);
  } catch {
    // Fail-safe: any failure collapses to null; caller falls back to manual flow
    return null;
  }
}
