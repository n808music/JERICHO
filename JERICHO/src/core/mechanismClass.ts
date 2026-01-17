/**
 * mechanismClass.ts
 *
 * Two independent enum systems:
 * 
 * 1. MechanismClass (Phase 1/2): Derives work classification from goal text for template selection
 *    Used by: autoDeliverables template matching
 *    Purely deterministic: no LLM, no API calls.
 *    
 * 2. PlanGenerationMechanismClass (Phase 3): Specifies plan generation algorithm
 *    Used by: deterministic plan generator (guarantees reproducible blocks + dates)
 *    v1 = GENERIC_DETERMINISTIC (only algorithm in Phase 3)
 *    Future = TEMPLATE_PIPELINE, HABIT_LOOP, PROJECT_MILESTONE, etc. (placeholders)
 */

// Phase 1/2: Goal-text-derived mechanism class
export type MechanismClass = 'CREATE' | 'PUBLISH' | 'MARKET' | 'LEARN' | 'OPS' | 'REVIEW';

// Phase 3: Plan generation mechanism (v1 required)
export type PlanGenerationMechanismClass =
  | 'GENERIC_DETERMINISTIC' // v1: deterministic 3-tier delivery model (20% setup, 60% core, 20% verify)
  | 'TEMPLATE_PIPELINE' // future: pipeline-based phases with gates
  | 'HABIT_LOOP' // future: daily habit accumulation model
  | 'PROJECT_MILESTONE' // future: milestone-driven decomposition
  | 'DELIVERABLE_DRIVEN' // future: explicit deliverable scheduling
  | 'CUSTOM'; // future: user-provided algorithm

/**
 * Derives mechanism class from goal contract
 *
 * Text sources checked in order:
 * 1. goalContract.mechanism (explicit override field)
 * 2. goalContract.terminalOutcome?.text
 * 3. goalContract.goalText (fallback)
 *
 * Keyword matching is case-insensitive.
 */
export function deriveMechanismClass(goalContract: any): MechanismClass {
  const textToAnalyze = [
    goalContract?.mechanism,
    goalContract?.terminalOutcome?.text,
    goalContract?.goalText,
    goalContract?.aim?.text
  ]
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => (t as string).toLowerCase());

  if (textToAnalyze.length === 0) {
    return 'CREATE'; // default
  }

  const combined = textToAnalyze.join(' ');

  // Check in priority order (more specific patterns first)

  // LEARN: Learn, study, research, explore, understand, course, training, education, skill
  // (High priority to avoid mismatches with PUBLISH/REVIEW)
  if (/learn|study|research|explore|understand|course|training|education|skill|certif|master|grasp/.test(combined)) {
    return 'LEARN';
  }

  // MARKET: Marketing, promote, campaign, acquisition, sales, growth, viral, brand, reach
  // (Checked before general patterns to catch "sales", "pitch", etc.)
  if (/\bmarket\b|promot|campaign|acqui|sales|growth|viral|brand|reach|audience|engagement|conversion|pitch/.test(combined)) {
    return 'MARKET';
  }

  // OPS: Operations, infra, setup, admin, process, workflow, system, configure, deploy infra, ci\/cd
  // (Checked before PUBLISH to catch deploy infrastructure, CI/CD, etc.)
  if (/ops\b|infra|setup|admin|process|workflow|system|configur|devops|monitoring|scaling|ci\s*\/\s*cd|kubernetes|cluster/.test(combined)) {
    return 'OPS';
  }

  // PUBLISH: Release, launch, publish, ship, go live, spotify, app store, distribution
  // (Narrower than before to avoid catching "deploy infra")
  if (/publish|launch|release|ship|go\s*live|spotify|app\s*store|distribution|make\s*public|announce|unveil|release/.test(combined)) {
    return 'PUBLISH';
  }

  // REVIEW: Review, refactor, audit, optimize, improve, fix, polish, rewrite, clean
  if (/review|refactor|audit|optimi|improv|fix|polish|rewrite|clean|maintain|upgrade|debug/.test(combined)) {
    return 'REVIEW';
  }

  // CREATE: Build, create, develop, design, write, code, implement, develop
  // (catch-all for active creation work)
  if (/create|build|develop|design|write|code|implement|construct|architect|engineer/.test(combined)) {
    return 'CREATE';
  }

  // Default
  return 'CREATE';
}

/**
 * Human-readable description of mechanism class
 */
export function describeMechanismClass(mechanism: MechanismClass): string {
  const descriptions: Record<MechanismClass, string> = {
    CREATE: 'Building/creating new work',
    PUBLISH: 'Publishing/launching to audience',
    MARKET: 'Marketing/growth work',
    LEARN: 'Learning/skill development',
    OPS: 'Operations/infrastructure',
    REVIEW: 'Review/refinement/maintenance'
  };
  return descriptions[mechanism];
}

/**
 * Validates plan generation mechanism class
 * Phase 3 v1: only GENERIC_DETERMINISTIC is supported
 */
export function isValidPlanGenerationMechanism(value: any): value is PlanGenerationMechanismClass {
  const validMechanisms: PlanGenerationMechanismClass[] = [
    'GENERIC_DETERMINISTIC',
    'TEMPLATE_PIPELINE',
    'HABIT_LOOP',
    'PROJECT_MILESTONE',
    'DELIVERABLE_DRIVEN',
    'CUSTOM'
  ];
  return validMechanisms.includes(value);
}

/**
 * Validates that mechanism class is supported in Phase 3 v1
 * Currently only GENERIC_DETERMINISTIC is implemented
 */
export function isPhase3SupportedMechanism(mechanism: PlanGenerationMechanismClass): boolean {
  return mechanism === 'GENERIC_DETERMINISTIC';
}

/**
 * Human-readable description of plan generation mechanism
 */
export function describePlanGenerationMechanism(mechanism: PlanGenerationMechanismClass): string {
  const descriptions: Record<PlanGenerationMechanismClass, string> = {
    GENERIC_DETERMINISTIC: 'Deterministic 3-tier model (20% setup, 60% core, 20% verify)',
    TEMPLATE_PIPELINE: 'Pipeline-based phases with gates (future)',
    HABIT_LOOP: 'Daily habit accumulation (future)',
    PROJECT_MILESTONE: 'Milestone-driven decomposition (future)',
    DELIVERABLE_DRIVEN: 'Explicit deliverable scheduling (future)',
    CUSTOM: 'Custom user-provided algorithm (future)'
  };
  return descriptions[mechanism] || 'Unknown mechanism';
}
