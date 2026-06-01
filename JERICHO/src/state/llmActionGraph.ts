/**
 * llmActionGraph.ts
 * LLM-powered action graph generation for all typed execution types.
 *
 * Pipeline:
 *   goalDraftV2 + contract
 *     → buildActionGraphPrompt(executionType, contract, goalDraftV2)
 *     → Claude API (direct, client-side)
 *     → parseLLMActionGraph(responseText, executionType)
 *     → validateParsedActionGraph(actions)
 *     → NormalizedActionGraph (same shape as normalizePodcastDraft return)
 */

export type GoalDraftV2 = Record<string, unknown>;

export type LLMCallProfile = {
  name: 'PLAN_ACTION_GRAPH' | 'PLAN_SESSIONS' | 'PLAN_SINGLE_BLOCK' | 'INTAKE_CLARIFICATION';
  model: string;
  maxTokens: number;
  maxRetries: number;
  schemaVersion: string;
};

export const LLM_CALL_PROFILES: Record<LLMCallProfile['name'], LLMCallProfile> = {
  PLAN_ACTION_GRAPH: {
    name: 'PLAN_ACTION_GRAPH',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2000,
    maxRetries: 2,
    schemaVersion: 'jericho_action_graph_v1',
  },
  PLAN_SESSIONS: {
    name: 'PLAN_SESSIONS',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2000,
    maxRetries: 2,
    schemaVersion: 'jericho_session_plan_v1',
  },
  PLAN_SINGLE_BLOCK: {
    name: 'PLAN_SINGLE_BLOCK',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 500,
    maxRetries: 2,
    schemaVersion: 'jericho_single_block_v1',
  },
  // Role A — Intake Drafting Assistant (Phase F)
  // Advisory only. Output is non-authoritative draft; user must confirm before any re-run.
  INTAKE_CLARIFICATION: {
    name: 'INTAKE_CLARIFICATION',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 800,
    maxRetries: 2,
    schemaVersion: 'jericho_intake_draft_v1',
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LLMAction = {
  id: string;
  title: string;
  label: string;
  deliverable: string;
  definitionOfDone: string;
  actionType?: 'preparation' | 'execution';
  estimateMin: number;
  sessionTitles?: string[];
  category:
    | 'CREATIVE_PRODUCTION'
    | 'VENTURE_LAUNCH'
    | 'SKILL_ACQUISITION'
    | 'PHYSICAL_TRAINING'
    | 'PROFESSIONAL_QUALIFICATION';
  dependencies: string[];
};

export type LLMTemplate = {
  title: string;
  domain: 'Body' | 'Resources' | 'Creation' | 'Focus';
  durationMinutes: number;
  frequency: string;
  reason: string;
};

export type LLMActionGraphResponse = {
  version: 'jericho_action_graph_v1';
  executionType: string;
  actions: LLMAction[];
  templates: LLMTemplate[];
  diagnostics: {
    actionCount: number;
    totalEstimateMin: number;
    requiredWeeklyMinutes: number;
    weeklyCapMinutes: number;
    weeklyGapMinutes: number;
    reasonCodes: string[];
    notes?: string[];
  };
};

export type NormalizedActionGraph = {
  actions: LLMAction[];
  templates: LLMTemplate[];
  diagnostics: {
    actionCount: number;
    totalEstimateMin: number;
    requiredWeeklyMinutes: number;
    weeklyCapMinutes: number;
    weeklyGapMinutes: number;
    calibrationResolved: null;
    calibrationApplied: false;
    estimateMinBeforeCalibrationTotal: number;
    estimateMinAfterCalibrationTotal: number;
    reasonCodes: string[];
    notes: string[];
  };
};

export type ActionGraphResult =
  | { ok: true; graph: NormalizedActionGraph }
  | { ok: false; error: { code: string; reason: string; reasonCodes?: string[] } };

export type SessionPlanEntry = {
  date: string;
  startTime: string;
  durationMinutes: number;
  actionSteps: string[];
  completionCondition: string;
  deliverableId: string;
  actionId: string;
};

export type SessionPlanResult =
  | { ok: true; sessions: SessionPlanEntry[] }
  | { ok: false; error: { code: string; reason: string; reasonCodes?: string[] } };

// ---------------------------------------------------------------------------
// Generic label guard — matches Phase 1 suppression list
// ---------------------------------------------------------------------------

const GENERIC_LABELS = new Set([
  'Focus primer',
  'Execution block',
  'Performance review',
  'Foundation reps',
  'Production sprint',
  'Scope review',
  'Recovery base',
  'Stability block',
  'Reflection review',
  'Pipeline touch',
  'Acquisition sprint',
  'Revenue review',
]);

// ---------------------------------------------------------------------------
// Execution-type metadata
// ---------------------------------------------------------------------------

const EXECUTION_TYPE_META: Record<
  string,
  {
    category: LLMAction['category'];
    domain: LLMTemplate['domain'];
    phaseGuide: string;
    depPattern: string;
    minActions: number;
    maxActions: number;
    typicalEstimateMin: { min: number; max: number };
  }
> = {
  VentureLaunch: {
    category: 'VENTURE_LAUNCH',
    domain: 'Resources',
    minActions: 10,
    maxActions: 20,
    typicalEstimateMin: { min: 30, max: 180 },
    phaseGuide: `
PHASES (must appear in this order, each phase depends on the prior):
1. Validate (2–4 actions): customer discovery, problem interviews, assumption mapping
2. Define (2–4 actions): positioning, value prop, copy, naming
3. Build (3–5 actions): landing page, email capture, integrations
4. Launch (2–4 actions): distribution, outreach, waitlist activation
5. Learn (1–2 actions): analyze signups, document learnings

Dependency rule: each phase's first action depends on the last action of the prior phase.
Within a phase, actions may be parallel (empty dependencies) or sequential.`,
    depPattern: 'Sequential phases, parallel within phase',
  },
  SkillAcquisition: {
    category: 'SKILL_ACQUISITION',
    domain: 'Focus',
    minActions: 10,
    maxActions: 20,
    typicalEstimateMin: { min: 20, max: 120 },
    phaseGuide: `
PHASES (must appear in this order, each phase depends on the prior):
1. Foundation (2–4 actions): core concepts, vocabulary, mental models, setup
2. Comprehension (2–4 actions): consuming examples, reading, watching, listening
3. Production (3–5 actions): active practice, exercises, projects, drills
4. Integration (2–4 actions): real-world application, feedback loops, refinement
5. Mastery check (1–2 actions): self-assessment, milestone test, portfolio piece

Dependency rule: each phase's first action depends on the last action of the prior phase.
Skills build sequentially — never make integration depend on nothing.`,
    depPattern: 'Strictly sequential phases',
  },
  ProfessionalQualification: {
    category: 'PROFESSIONAL_QUALIFICATION',
    domain: 'Focus',
    minActions: 10,
    maxActions: 18,
    typicalEstimateMin: { min: 30, max: 180 },
    phaseGuide: `
PHASES (must appear in this order):
1. Domain study (4–8 actions, one per major subject area): sequential or parallel depending on prerequisites
2. Practice (2–4 actions): practice tests, question banks, timed simulations
3. Review (1–3 actions): weak area review, gap filling
4. Final prep (1–2 actions): final review, logistics, exam booking confirmation

Dependency rule: all domain study must complete before practice phase begins.
Practice must complete before review. Review before final prep.
Within domain study, actions may be parallel unless the subject builds on prior.`,
    depPattern: 'Phase gates with parallel study tracks',
  },
  PhysicalTraining: {
    category: 'PHYSICAL_TRAINING',
    domain: 'Body',
    minActions: 12,
    maxActions: 24,
    typicalEstimateMin: { min: 20, max: 120 },
    phaseGuide: `
PHASES (must appear in this order — training periodization):
1. Base building (3–5 actions): aerobic base, movement patterns, form, low intensity
2. Build phase (3–5 actions): increasing volume, progressive overload, sport-specific work
3. Peak phase (2–4 actions): race-pace / max-effort work, sharpening
4. Taper (1–3 actions): reduce volume, rest, final prep
5. Event / test (1 action): the target performance event

Dependency rule: each phase's first action depends on the last of the prior phase.
Taper must come after peak. Event must be last.
Do NOT make all actions sequential — within phases, parallel training days are valid.`,
    depPattern: 'Sequential periodization phases',
  },
  SalesPipeline: {
    category: 'VENTURE_LAUNCH',
    domain: 'Resources',
    minActions: 8,
    maxActions: 20,
    typicalEstimateMin: { min: 20, max: 180 },
    phaseGuide: `
PHASES (must appear in this order):
1. Offer definition (1–3 actions): offer clarity, pricing, qualification rules
2. Pipeline setup (2–4 actions): ICP, target accounts, outreach assets, CRM stages
3. Pipeline execution (2–6 actions): outreach waves, discovery calls, proposals
4. Conversion and handoff (1–3 actions): negotiation, close, onboarding handoff
5. Pipeline review (1–2 actions): conversion review, next-cycle optimization

Dependency rule: offer definition must complete before pipeline setup.
Pipeline setup must complete before execution.
Conversion and handoff must come after active opportunities exist.`,
    depPattern: 'Sequential pipeline phases with execution throughput',
  },
  Fundraising: {
    category: 'VENTURE_LAUNCH',
    domain: 'Resources',
    minActions: 8,
    maxActions: 20,
    typicalEstimateMin: { min: 20, max: 180 },
    phaseGuide: `
PHASES (must appear in this order):
1. Raise definition (1–3 actions): objective, use-of-funds, investor thesis
2. Raise assets (2–4 actions): deck, diligence checklist, data room structure
3. Investor pipeline (2–5 actions): target investors, outreach, first meetings
4. Diligence and terms (1–4 actions): follow-up materials, diligence handling, commitment tracking
5. Close process (1–2 actions): legal close, signature workflow, funding readiness

Dependency rule: raise definition must complete before assets.
Assets must complete before live investor pipeline execution.
Diligence and terms must come after active investor responses exist.`,
    depPattern: 'Sequential fundraising phases with investor pipeline progression',
  },
  JobSearchPipeline: {
    category: 'VENTURE_LAUNCH',
    domain: 'Resources',
    minActions: 8,
    maxActions: 20,
    typicalEstimateMin: { min: 20, max: 120 },
    phaseGuide: `
PHASES (must appear in this order):
1. Preparation (2–4 actions): role targeting, resume/portfolio alignment, positioning
2. Pipeline build (2–4 actions): target companies, sourcing, outreach setup
3. Application throughput (2–4 actions): tailored application batches and tracking
4. Interview readiness (1–3 actions): story bank, mock rounds, technical prep
5. Conversion optimization (1–2 actions): conversion review and weekly target adjustment

Dependency rule: preparation must finish before pipeline build.
Pipeline build must finish before first application batch.
Interview readiness must not start before initial applications are submitted.`,
    depPattern: 'Pipeline phases with throughput checkpoints',
  },
  CreativeProduction: {
    category: 'CREATIVE_PRODUCTION',
    domain: 'Creation',
    minActions: 9,
    maxActions: 30,
    typicalEstimateMin: { min: 20, max: 180 },
    phaseGuide: `
PHASES (must appear in this order):
1. Concept and setup (2–4 actions): positioning, format, workflow, equipment
2. Production loop (3–18 actions): concrete episode/content creation, edit, publish iterations
3. Release and review (2–4 actions): release packaging, distribution, retro

Dependency rule: setup must come before production. Release comes after production.
Within production, actions may be sequential or partially parallel when the medium allows.`,
    depPattern: 'Setup -> production loop -> release',
  },
  BrandLaunch: {
    category: 'CREATIVE_PRODUCTION',
    domain: 'Creation',
    minActions: 8,
    // 120 rather than 50: a regulated_physical_consumable plan requires five mandatory work
    // families (regulatory review, merchant underwriting, capital gate checkpoints, hero imagery,
    // parallel packaging track) plus three pathway-specific formula corridors, commercial sales
    // cycles, and the standard brand launch stack. That structure legitimately exceeds 50 actions.
    // Do not reduce this limit without verifying that regulated consumable graphs still pass.
    maxActions: 120,
    typicalEstimateMin: { min: 30, max: 720 },
    phaseGuide: `
PHASES (must appear in this order while allowing launch-family overlap):
1. Product readiness: formula/sample, packaging, sourcing, sellable unit readiness
2. Commercial readiness: offer, pricing, product page, checkout, ordering, fulfillment path
3. Launch communications: positioning, messaging, campaign assets, sales CTA
4. First-sales execution: buyer list, outreach waves, order attempts, conversion tracking
5. Terminal review: sales evidence, conversion results, next-step decision

Dependency rule: product readiness, commercial readiness, and communications may overlap after initial scoping.
First-sales execution depends on enough offer and CTA readiness to sell.
Terminal review must follow active sales attempts.`,
    depPattern: 'Overlapping commercial launch workstreams with terminal sales review',
  },
  GenericStructured: {
    category: 'CREATIVE_PRODUCTION', // closest generic fallback
    domain: 'Focus',
    minActions: 6,
    maxActions: 16,
    typicalEstimateMin: { min: 15, max: 120 },
    phaseGuide: `
Decompose the goal into logical phases or work areas.
Each phase should have 2–4 actions.
Identify natural dependencies — what must happen before what.
At least one action must have no dependencies (the starting point).
All actions must eventually connect to a terminal action (the completion).`,
    depPattern: 'Goal-specific decomposition',
  },
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildActionGraphPrompt(
  executionType: string,
  contract: Record<string, unknown>,
  goalDraftV2: GoalDraftV2
): string {
  const meta = EXECUTION_TYPE_META[executionType] ?? EXECUTION_TYPE_META.GenericStructured;
  const goalText = ((goalDraftV2 as Record<string, unknown>).goalText as string) ?? '';
  const deadline = (contract.deadline as Record<string, unknown>)?.dayKey ?? contract.deadlineISO ?? 'not specified';
  const weeklyCapMinutes = extractWeeklyCapMinutes(goalDraftV2);
  const totalDays = estimateDaysToDeadline(contract);
  const totalWeeks = Math.max(1, Math.round(totalDays / 7));

  return `You are a deterministic goal execution planner. Your job is to decompose a user's goal into a precise, sequenced action graph.

You MUST respond with ONLY valid JSON. No explanation, no markdown, no preamble, no postamble.
The JSON must exactly match the schema below. Any deviation will cause a parse failure.

=== GOAL ===
Goal: ${goalText}
Execution type: ${executionType}
Deadline: ${deadline} (approximately ${totalWeeks} weeks from today)
Weekly capacity: ${weeklyCapMinutes} minutes/week

=== SCHEMA CONTRACT ===
{
  "version": "jericho_action_graph_v1",
  "executionType": "${executionType}",
  "actions": [ /* array of action objects — see rules below */ ],
  "templates": [ /* 2–3 supporting habit blocks — see rules below */ ],
  "diagnostics": {
    "actionCount": <integer — must equal actions.length>,
    "totalEstimateMin": <integer — must equal sum of all estimateMin>,
    "requiredWeeklyMinutes": <integer — totalEstimateMin / totalWeeks>,
    "weeklyCapMinutes": ${weeklyCapMinutes},
    "weeklyGapMinutes": <integer — weeklyCapMinutes minus requiredWeeklyMinutes, can be negative>,
    "reasonCodes": [ /* strings describing scheduling constraints or risks */ ],
    "notes": [ /* optional strings */ ]
  }
}

=== ACTION RULES ===
Each action object must have ALL of these fields:
- "id": lowercase, letters/digits/colons/hyphens only, 3–128 chars. Use pattern: "phase:sequence:task" e.g. "validate:001:customer-interviews"
- "title": specific and goal-relevant, 3–180 chars. NEVER use generic titles like "Focus primer", "Execution block", "Foundation reps", "Production sprint", "Scope review", "Recovery base", "Stability block", "Pipeline touch", "Acquisition sprint", "Revenue review", "Performance review", "Reflection review"
- "label": same as title (duplicate the value)
- "deliverable": tangible output of this action, 3–220 chars
- "definitionOfDone": specific completion condition, 8–260 chars
- "estimateMin": integer minutes, 5–1440
- "category": must be exactly "${meta.category}"
- "dependencies": array of action id strings. Must only reference ids that exist in the actions array. No self-references. No cycles.

=== GRAPH INVARIANTS (ENFORCED — violation causes rejection) ===
1. At least one action must have empty dependencies [] (the graph must have a root)
2. All dependency ids must exist in the actions array
3. No action may depend on itself
4. No cycles (A→B→A is rejected)
5. diagnostics.actionCount must exactly equal actions.length
6. diagnostics.totalEstimateMin must exactly equal the sum of all actions[].estimateMin
7. Action count must be between ${meta.minActions} and ${meta.maxActions}

=== PHASE STRUCTURE FOR ${executionType.toUpperCase()} ===
${meta.phaseGuide}

=== TEMPLATE RULES ===
Templates are 2–3 supporting habit blocks (recurring work, not one-time deliverables).
Each template must have:
- "title": specific habit name
- "domain": one of "Body", "Resources", "Creation", "Focus"
- "durationMinutes": integer 5–720
- "frequency": e.g. "daily", "3x/week", "weekly"
- "reason": why this habit supports the goal

=== ESTIMATE GUIDANCE ===
Typical action estimate for ${executionType}: ${meta.typicalEstimateMin.min}–${meta.typicalEstimateMin.max} minutes.
Total estimate should fit within ${totalWeeks} weeks × ${weeklyCapMinutes} min/week = ${totalWeeks * weeklyCapMinutes} total minutes.
If the goal cannot fit, set weeklyGapMinutes to a negative number and add a reasonCode "OVER_CAPACITY".

=== RESPOND WITH JSON ONLY ===`;
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = LLM_CALL_PROFILES.PLAN_ACTION_GRAPH.model;
const MAX_TOKENS = LLM_CALL_PROFILES.PLAN_ACTION_GRAPH.maxTokens;
const MAX_RETRIES = LLM_CALL_PROFILES.PLAN_ACTION_GRAPH.maxRetries;

export async function callClaudeForActionGraph(
  goalDraftV2: GoalDraftV2,
  contract: Record<string, unknown>,
  executionType: string,
  apiKey: string
): Promise<ActionGraphResult> {
  const prompt = buildActionGraphPrompt(executionType, contract, goalDraftV2);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let responseText: string;
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return {
          ok: false,
          error: {
            code: 'LLM_API_ERROR',
            reason: `Claude API returned ${response.status}: ${body.slice(0, 200)}`,
            reasonCodes: ['LLM_API_ERROR'],
          },
        };
      }

      const data = await response.json();
      responseText =
        data?.content
          ?.filter((c: { type: string }) => c.type === 'text')
          ?.map((c: { text: string }) => c.text)
          ?.join('') ?? '';
    } catch (err) {
      if (attempt < MAX_RETRIES) continue;
      return {
        ok: false,
        error: {
          code: 'LLM_NETWORK_ERROR',
          reason: `Network error calling Claude: ${String(err)}`,
          reasonCodes: ['LLM_NETWORK_ERROR'],
        },
      };
    }

    const parsed = parseLLMActionGraph(responseText, executionType);
    if (parsed.ok) return parsed;

    // On parse failure, retry unless last attempt
    if (attempt === MAX_RETRIES) return parsed;
  }

  return {
    ok: false,
    error: { code: 'LLM_MAX_RETRIES', reason: 'Max retries exceeded.', reasonCodes: ['LLM_MAX_RETRIES'] },
  };
}

export function buildSessionPlanPrompt({
  executionType,
  actions,
  contract,
}: {
  executionType: string;
  actions: LLMAction[];
  contract: Record<string, unknown>;
}): string {
  const start =
    String((contract?.startDayKey as string) || (contract?.startDateISO as string) || '').slice(0, 10) || 'today';
  const deadline =
    String(
      (contract?.deadline as Record<string, unknown>)?.dayKey || contract?.endDayKey || contract?.deadlineISO || ''
    ).slice(0, 10) || 'unknown';
  const compactActions = actions.map((action) => ({
    id: action.id,
    title: action.title,
    estimateMin: action.estimateMin,
    dependencies: action.dependencies || [],
  }));
  return `You are generating session-level plan output for Jericho.
Respond with JSON only and conform strictly to schema version "jericho_session_plan_v1".

Execution type: ${executionType}
Window start: ${start}
Window end: ${deadline}

ACTION INPUT:
${JSON.stringify(compactActions)}

SCHEMA:
{
  "version": "jericho_session_plan_v1",
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "durationMinutes": 15-240,
      "actionSteps": ["step 1", "step 2", "step 3"],
      "completionCondition": "specific verifiable completion condition",
      "deliverableId": "string",
      "actionId": "must match an action id from input"
    }
  ]
}

RULES:
- Each session must include 3 to 5 actionSteps.
- actionId must exist in ACTION INPUT.
- date must be within [${start}, ${deadline}] when both bounds are provided.
- Do not return prose, markdown, or explanations.`;
}

export function validateSessionPlan(
  sessions: unknown,
  options: { actionIds: string[]; startDayKey?: string | null; endDayKey?: string | null }
): SessionPlanResult {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      ok: false,
      error: {
        code: 'SESSION_PLAN_EMPTY',
        reason: 'Session plan must include at least one session.',
        reasonCodes: ['SESSION_PLAN_EMPTY'],
      },
    };
  }

  const actionIdSet = new Set((options.actionIds || []).map((id) => String(id || '').trim()).filter(Boolean));
  for (let i = 0; i < sessions.length; i += 1) {
    const session = sessions[i] as Record<string, unknown>;
    const date = String(session?.date || '').trim();
    const startTime = String(session?.startTime || '').trim();
    const duration = Number(session?.durationMinutes);
    const actionId = String(session?.actionId || '').trim();
    const deliverableId = String(session?.deliverableId || '').trim();
    const completionCondition = String(session?.completionCondition || '').trim();
    const actionSteps = Array.isArray(session?.actionSteps)
      ? session.actionSteps.map((s) => String(s || '').trim()).filter(Boolean)
      : [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: { code: 'SESSION_PLAN_INVALID_DATE', reason: `Session[${i}] date is invalid.` } };
    }
    if (!/^\d{2}:\d{2}$/.test(startTime)) {
      return { ok: false, error: { code: 'SESSION_PLAN_INVALID_TIME', reason: `Session[${i}] startTime is invalid.` } };
    }
    if (!Number.isFinite(duration) || duration < 15 || duration > 240) {
      return {
        ok: false,
        error: { code: 'SESSION_PLAN_INVALID_DURATION', reason: `Session[${i}] durationMinutes must be 15-240.` },
      };
    }
    if (actionSteps.length < 3 || actionSteps.length > 5) {
      return {
        ok: false,
        error: { code: 'SESSION_PLAN_INVALID_STEPS', reason: `Session[${i}] actionSteps must have 3-5 items.` },
      };
    }
    if (!completionCondition) {
      return {
        ok: false,
        error: { code: 'SESSION_PLAN_MISSING_COMPLETION', reason: `Session[${i}] completionCondition is required.` },
      };
    }
    if (!actionId || !actionIdSet.has(actionId)) {
      return {
        ok: false,
        error: { code: 'SESSION_PLAN_UNKNOWN_ACTION', reason: `Session[${i}] actionId does not map to action graph.` },
      };
    }
    if (!deliverableId) {
      return {
        ok: false,
        error: { code: 'SESSION_PLAN_MISSING_DELIVERABLE', reason: `Session[${i}] deliverableId is required.` },
      };
    }
    if (options.startDayKey && date < options.startDayKey) {
      return { ok: false, error: { code: 'SESSION_PLAN_OUT_OF_RANGE', reason: `Session[${i}] date is before start.` } };
    }
    if (options.endDayKey && date > options.endDayKey) {
      return {
        ok: false,
        error: { code: 'SESSION_PLAN_OUT_OF_RANGE', reason: `Session[${i}] date is after deadline.` },
      };
    }
  }

  return { ok: true, sessions: sessions as SessionPlanEntry[] };
}

export function parseLLMSessionPlan(
  responseText: string,
  options: { actionIds: string[]; startDayKey?: string | null; endDayKey?: string | null }
): SessionPlanResult {
  let cleaned = String(responseText || '').trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      error: {
        code: 'SESSION_PLAN_PARSE_ERROR',
        reason: `Session response is not valid JSON. First 300 chars: ${cleaned.slice(0, 300)}`,
        reasonCodes: ['SESSION_PLAN_PARSE_ERROR'],
      },
    };
  }
  const payload = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.sessions;
  return validateSessionPlan(payload, options);
}

export async function callClaudeForSessionPlan({
  executionType,
  contract,
  actions,
  apiKey,
}: {
  executionType: string;
  contract: Record<string, unknown>;
  actions: LLMAction[];
  apiKey: string;
}): Promise<SessionPlanResult> {
  const profile = LLM_CALL_PROFILES.PLAN_SESSIONS;
  const prompt = buildSessionPlanPrompt({ executionType, actions, contract });
  const startDayKey =
    String((contract?.startDayKey as string) || (contract?.startDateISO as string) || '').slice(0, 10) || null;
  const endDayKey =
    String(
      (contract?.deadline as Record<string, unknown>)?.dayKey || contract?.endDayKey || contract?.deadlineISO || ''
    ).slice(0, 10) || null;
  const actionIds = (actions || []).map((action) => String(action?.id || '').trim()).filter(Boolean);
  for (let attempt = 0; attempt <= profile.maxRetries; attempt += 1) {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: profile.model,
          max_tokens: profile.maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return {
          ok: false,
          error: {
            code: 'SESSION_PLAN_API_ERROR',
            reason: `Session plan API returned ${response.status}: ${body.slice(0, 200)}`,
          },
        };
      }
      const data = await response.json();
      const responseText =
        data?.content
          ?.filter((c: { type: string }) => c.type === 'text')
          ?.map((c: { text: string }) => c.text)
          ?.join('') ?? '';
      const parsed = parseLLMSessionPlan(responseText, { actionIds, startDayKey, endDayKey });
      if (parsed.ok) return parsed;
      if (attempt === profile.maxRetries) return parsed;
    } catch (error) {
      if (attempt === profile.maxRetries) {
        return {
          ok: false,
          error: {
            code: 'SESSION_PLAN_NETWORK_ERROR',
            reason: `Network error while generating session plan: ${String(error)}`,
          },
        };
      }
    }
  }
  return {
    ok: false,
    error: {
      code: 'SESSION_PLAN_MAX_RETRIES',
      reason: 'Session plan retries exhausted.',
    },
  };
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseLLMActionGraph(responseText: string, executionType: string): ActionGraphResult {
  // Strip markdown fences if present
  let cleaned = responseText.trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let raw: LLMActionGraphResponse;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      error: {
        code: 'LLM_PARSE_ERROR',
        reason: `Response is not valid JSON. First 300 chars: ${cleaned.slice(0, 300)}`,
        reasonCodes: ['LLM_PARSE_ERROR'],
      },
    };
  }

  const validation = validateParsedActionGraph(raw, executionType);
  if (!validation.ok) return validation;

  const meta = EXECUTION_TYPE_META[executionType] ?? EXECUTION_TYPE_META.GenericStructured;
  const totalEstimateMin = raw.actions.reduce((sum, a) => sum + a.estimateMin, 0);

  const graph: NormalizedActionGraph = {
    actions: raw.actions,
    templates: raw.templates ?? [],
    diagnostics: {
      actionCount: raw.actions.length,
      totalEstimateMin,
      requiredWeeklyMinutes: raw.diagnostics.requiredWeeklyMinutes,
      weeklyCapMinutes: raw.diagnostics.weeklyCapMinutes,
      weeklyGapMinutes: raw.diagnostics.weeklyGapMinutes,
      calibrationResolved: null,
      calibrationApplied: false,
      estimateMinBeforeCalibrationTotal: totalEstimateMin,
      estimateMinAfterCalibrationTotal: totalEstimateMin,
      reasonCodes: raw.diagnostics.reasonCodes ?? [],
      notes: raw.diagnostics.notes ?? [],
    },
  };

  return { ok: true, graph };
}

// ---------------------------------------------------------------------------
// Validator — enforces all schema + graph invariants
// ---------------------------------------------------------------------------

export function validateParsedActionGraph(raw: unknown, executionType: string): ActionGraphResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: { code: 'LLM_INVALID_SHAPE', reason: 'Response is not an object.' } };
  }

  const r = raw as Record<string, unknown>;

  // Version check
  if (r.version !== 'jericho_action_graph_v1') {
    return {
      ok: false,
      error: {
        code: 'LLM_VERSION_MISMATCH',
        reason: `Expected version "jericho_action_graph_v1", got "${r.version}".`,
      },
    };
  }

  // executionType match
  if (r.executionType !== executionType) {
    return {
      ok: false,
      error: {
        code: 'LLM_EXECUTION_TYPE_MISMATCH',
        reason: `Expected executionType "${executionType}", got "${r.executionType}".`,
      },
    };
  }

  // Actions array
  if (!Array.isArray(r.actions) || r.actions.length === 0) {
    return { ok: false, error: { code: 'LLM_NO_ACTIONS', reason: 'actions array is missing or empty.' } };
  }

  const meta = EXECUTION_TYPE_META[executionType] ?? EXECUTION_TYPE_META.GenericStructured;

  if (r.actions.length < meta.minActions || r.actions.length > meta.maxActions) {
    return {
      ok: false,
      error: {
        code: 'LLM_ACTION_COUNT_OUT_OF_RANGE',
        reason: `Expected ${meta.minActions}–${meta.maxActions} actions for ${executionType}, got ${r.actions.length}.`,
      },
    };
  }

  const actions = r.actions as Record<string, unknown>[];
  const actionIds = new Set<string>();

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    const prefix = `Action[${i}] (id="${a.id}")`;

    // Required string fields
    for (const field of ['id', 'title', 'label', 'deliverable', 'definitionOfDone', 'category']) {
      if (typeof a[field] !== 'string' || (a[field] as string).length === 0) {
        return {
          ok: false,
          error: { code: 'LLM_ACTION_MISSING_FIELD', reason: `${prefix} missing required field "${field}".` },
        };
      }
    }

    // ID format
    if (!/^[a-z0-9:_-]{3,128}$/.test(a.id as string)) {
      return {
        ok: false,
        error: { code: 'LLM_ACTION_INVALID_ID', reason: `${prefix} id "${a.id}" has invalid format.` },
      };
    }

    // Duplicate ID check
    if (actionIds.has(a.id as string)) {
      return { ok: false, error: { code: 'LLM_DUPLICATE_ACTION_ID', reason: `${prefix} duplicate id "${a.id}".` } };
    }
    actionIds.add(a.id as string);

    // Category check
    if (a.category !== meta.category) {
      return {
        ok: false,
        error: {
          code: 'LLM_WRONG_CATEGORY',
          reason: `${prefix} category must be "${meta.category}", got "${a.category}".`,
        },
      };
    }

    // estimateMin
    if (!Number.isInteger(a.estimateMin) || (a.estimateMin as number) < 5 || (a.estimateMin as number) > 1440) {
      return {
        ok: false,
        error: {
          code: 'LLM_INVALID_ESTIMATE',
          reason: `${prefix} estimateMin must be integer 5–1440, got ${a.estimateMin}.`,
        },
      };
    }

    // Generic label guard
    if (GENERIC_LABELS.has(a.title as string) || GENERIC_LABELS.has(a.label as string)) {
      return {
        ok: false,
        error: { code: 'LLM_GENERIC_LABEL', reason: `${prefix} title "${a.title}" is a forbidden generic label.` },
      };
    }

    // dependencies type
    if (!Array.isArray(a.dependencies)) {
      return { ok: false, error: { code: 'LLM_INVALID_DEPS', reason: `${prefix} dependencies must be an array.` } };
    }
  }

  // Graph invariant 1: at least one root (no dependencies)
  const roots = actions.filter((a) => (a.dependencies as string[]).length === 0);
  if (roots.length === 0) {
    return {
      ok: false,
      error: {
        code: 'LLM_NO_ROOT_ACTION',
        reason: 'No action has empty dependencies. Graph must have at least one root.',
      },
    };
  }

  // Graph invariant 2 & 3: deps exist + no self-deps
  for (const a of actions) {
    for (const depId of a.dependencies as string[]) {
      if (depId === a.id) {
        return { ok: false, error: { code: 'LLM_SELF_DEPENDENCY', reason: `Action "${a.id}" depends on itself.` } };
      }
      if (!actionIds.has(depId)) {
        return {
          ok: false,
          error: { code: 'LLM_MISSING_DEP_ID', reason: `Action "${a.id}" depends on "${depId}" which does not exist.` },
        };
      }
    }
  }

  // Graph invariant 4: no cycles (Kahn's algorithm)
  const cycleCheck = detectCycle(actions as LLMAction[]);
  if (cycleCheck) {
    return {
      ok: false,
      error: { code: 'LLM_CYCLE_DETECTED', reason: `Dependency cycle detected involving: ${cycleCheck}` },
    };
  }

  // Diagnostics checks
  const diag = r.diagnostics as Record<string, unknown>;
  if (!diag || typeof diag !== 'object') {
    return { ok: false, error: { code: 'LLM_MISSING_DIAGNOSTICS', reason: 'diagnostics object is missing.' } };
  }

  // actionCount must match
  if (diag.actionCount !== actions.length) {
    return {
      ok: false,
      error: {
        code: 'LLM_DIAGNOSTICS_COUNT_MISMATCH',
        reason: `diagnostics.actionCount (${diag.actionCount}) !== actions.length (${actions.length}).`,
      },
    };
  }

  // totalEstimateMin must match
  const computedTotal = actions.reduce((sum, a) => sum + (a.estimateMin as number), 0);
  if (diag.totalEstimateMin !== computedTotal) {
    return {
      ok: false,
      error: {
        code: 'LLM_DIAGNOSTICS_ESTIMATE_MISMATCH',
        reason: `diagnostics.totalEstimateMin (${diag.totalEstimateMin}) !== computed sum (${computedTotal}).`,
      },
    };
  }

  return { ok: true, graph: null as unknown as NormalizedActionGraph }; // graph built in parseLLMActionGraph
}

// ---------------------------------------------------------------------------
// Cycle detection — Kahn's topological sort
// ---------------------------------------------------------------------------

function detectCycle(actions: LLMAction[]): string | null {
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const a of actions) {
    if (!inDegree.has(a.id)) inDegree.set(a.id, 0);
    if (!dependents.has(a.id)) dependents.set(a.id, []);
  }

  for (const a of actions) {
    for (const dep of a.dependencies) {
      inDegree.set(a.id, (inDegree.get(a.id) ?? 0) + 1);
      dependents.get(dep)?.push(a.id);
    }
  }

  const queue = [...inDegree.entries()].filter(([, deg]) => deg === 0).map(([id]) => id);
  let processed = 0;

  while (queue.length > 0) {
    const id = queue.shift()!;
    processed++;
    for (const dependent of dependents.get(id) ?? []) {
      const newDeg = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, newDeg);
      if (newDeg === 0) queue.push(dependent);
    }
  }

  if (processed < actions.length) {
    const cycleNodes = [...inDegree.entries()]
      .filter(([, deg]) => deg > 0)
      .map(([id]) => id)
      .join(', ');
    return cycleNodes;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractWeeklyCapMinutes(goalDraftV2: GoalDraftV2): number {
  const cap = (goalDraftV2 as Record<string, unknown>).capacity as Record<string, unknown> | undefined;
  if (!cap) return 300;
  const weekly = cap.weeklyMinutes ?? cap.weeklyCapMinutes ?? cap.minutesPerWeek;
  return typeof weekly === 'number' && weekly > 0 ? weekly : 300;
}

function estimateDaysToDeadline(contract: Record<string, unknown>): number {
  const deadlineStr =
    ((contract.deadline as Record<string, unknown>)?.dayKey as string) ?? (contract.deadlineISO as string) ?? null;
  if (!deadlineStr) return 42;
  const deadlineMs = Date.parse(deadlineStr);
  if (!Number.isFinite(deadlineMs)) return 42;
  const days = Math.round((deadlineMs - Date.now()) / 86400000);
  return Math.max(7, days);
}
