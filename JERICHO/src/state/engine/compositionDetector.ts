import type { MigratedArchetype } from './archetypeLiveTraceEvaluation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompositionPairId = 'CP-001' | 'CP-002' | 'CP-003' | 'CP-004';

export type SupportedCompositionPair = {
  primary: MigratedArchetype;
  secondary: MigratedArchetype;
  pairId: CompositionPairId;
  detectionSignals: string[];
  injectionPoint: string; // primary action ID, or 'PARALLEL' for concurrent secondary work
};

// Stored on cycle.goalContract as compositeGrammar (optional, additive).
// executionType remains the primary archetype string — this field is overlay metadata.
export type CompositeGrammarMetadata = {
  secondary: MigratedArchetype;
  pairId: CompositionPairId;
  detectionSignals: string[];
  injectionPoint: string;
};

// ─── Bridge deliverable spec ──────────────────────────────────────────────────

// A spec for each deliverable to inject from the secondary grammar.
// dependsOnInjectionPoint: if true, links to the primary injection point deliverable.
// dependsOnPrevBridge: if true, links to the immediately preceding bridge deliverable.
// If neither, the deliverable is parallel (no dependency).
export type BridgeDeliverableSpec = {
  id: string;
  title: string;
  definitionOfDone: string;
  acceptanceCriteria: string[];
  estimatedMinutes: number;
  dependsOnInjectionPoint: boolean;
  dependsOnPrevBridge: boolean;
};

// Maximum bridge deliverables per pair. Enforced at injection time.
export const MAX_BRIDGE_DELIVERABLES = 3;

// ─── Bridge deliverable catalog ───────────────────────────────────────────────

export const BRIDGE_DELIVERABLES_BY_PAIR: Record<CompositionPairId, BridgeDeliverableSpec[]> = {
  // CP-001: VentureLaunch (primary) + BrandLaunch (secondary)
  // Brand identity work starts after venture narrative (deck) is established.
  'CP-001': [
    {
      id: 'bridge:cp001:brand-positioning',
      title: 'Brand positioning brief complete',
      definitionOfDone: 'Positioning brief approved with single-sentence core promise and audience definition.',
      acceptanceCriteria: [
        'Core brand promise documented in one sentence',
        'Target audience defined with differentiation rationale',
      ],
      estimatedMinutes: 60,
      dependsOnInjectionPoint: true,
      dependsOnPrevBridge: false,
    },
    {
      id: 'bridge:cp001:visual-identity',
      title: 'Visual identity direction complete',
      definitionOfDone: 'Identity direction board approved with typography, palette, and usage rules.',
      acceptanceCriteria: [
        'Visual style direction approved',
        'Typography and palette documented as reusable standards',
      ],
      estimatedMinutes: 90,
      dependsOnInjectionPoint: false,
      dependsOnPrevBridge: true,
    },
  ],

  // CP-002: VentureLaunch (primary) + Fundraising (secondary)
  // Investor materials parallel the venture build after the deck narrative exists.
  'CP-002': [
    {
      id: 'bridge:cp002:investor-narrative',
      title: 'Investor narrative materials complete',
      definitionOfDone: 'Core raise narrative, deck, and supporting memo are completed and reviewed.',
      acceptanceCriteria: [
        'Target amount and use-of-funds documented',
        'Investor narrative reviewed against venture pitch materials',
      ],
      estimatedMinutes: 120,
      dependsOnInjectionPoint: true,
      dependsOnPrevBridge: false,
    },
    {
      id: 'bridge:cp002:investor-target-list',
      title: 'Target investor fit list complete',
      definitionOfDone: 'Prioritized list with fit rationale and outreach paths is complete.',
      acceptanceCriteria: [
        'Investor list prioritized with fit notes',
        'Contact paths and outreach status fields populated',
      ],
      estimatedMinutes: 90,
      dependsOnInjectionPoint: false,
      dependsOnPrevBridge: true,
    },
  ],

  // CP-003: BrandLaunch (primary) + CreativeProduction (secondary)
  // Content production starts after brand kit exists — brand is the prerequisite.
  'CP-003': [
    {
      id: 'bridge:cp003:content-batch',
      title: 'First content production batch complete',
      definitionOfDone: 'Initial content batch produced on-brand and reviewed against quality criteria.',
      acceptanceCriteria: [
        'Content produced using approved brand kit assets',
        'Initial batch reviewed against brand voice guidelines',
      ],
      estimatedMinutes: 180,
      dependsOnInjectionPoint: true,
      dependsOnPrevBridge: false,
    },
    {
      id: 'bridge:cp003:content-release',
      title: 'Content release package complete',
      definitionOfDone: 'Release package includes final assets, metadata, and publish checklist.',
      acceptanceCriteria: ['Final assets assembled with brand-consistent metadata', 'Publish checklist completed'],
      estimatedMinutes: 60,
      dependsOnInjectionPoint: false,
      dependsOnPrevBridge: true,
    },
  ],

  // CP-004: JobSearchPipeline (primary) + ProfessionalQualification (secondary)
  // Cert work is parallel to the job search — no dependency on primary actions.
  'CP-004': [
    {
      id: 'bridge:cp004:cert-study',
      title: 'Certification study milestones complete',
      definitionOfDone: 'Study sessions and domain reviews completed; practice exam passed at threshold.',
      acceptanceCriteria: ['All study domains reviewed with notes', 'Practice exam completed at 80%+ score'],
      estimatedMinutes: 240,
      dependsOnInjectionPoint: false, // PARALLEL — no primary dependency
      dependsOnPrevBridge: false,
    },
    {
      id: 'bridge:cp004:cert-exam',
      title: 'Certification exam completed',
      definitionOfDone: 'Exam taken, result documented, pass/fail recorded.',
      acceptanceCriteria: [
        'Exam taken under official conditions',
        'Result documented and linked to job search profile',
      ],
      estimatedMinutes: 180,
      dependsOnInjectionPoint: false,
      dependsOnPrevBridge: true,
    },
  ],
};

// ─── Detection rules ──────────────────────────────────────────────────────────

// Injection points per pair. Maps the primary action ID at which secondary work begins.
// 'PARALLEL' means secondary work starts independently with no primary dependency.
const INJECTION_POINTS: Record<CompositionPairId, string> = {
  'CP-001': 'define:001:deck', // Brand work after venture narrative is established
  'CP-002': 'define:001:deck', // Investor materials after venture deck exists
  'CP-003': 'asset:002:brand-kit', // Content production after brand kit is complete
  'CP-004': 'PARALLEL', // Cert work is concurrent with job search from start
};

function lowerText(goalText: string): string {
  return String(goalText || '').toLowerCase();
}

// CP-001 secondary signal: BrandLaunch within a VentureLaunch goal
// Threshold: 2+ brand tokens (same as standalone BrandLaunch primary threshold)
// Anti-neighbor: brand alone is insufficient; requires co-signal from {identity, positioning, visual}
function detectBrandLaunchSecondary(text: string): string[] {
  const brandTokens = ['brand', 'identity', 'positioning', 'visual'];
  return brandTokens.filter((t) => text.includes(t));
}

// CP-002 secondary signal: Fundraising within a VentureLaunch goal
// Threshold: 2+ fundraising tokens (same as standalone Fundraising primary threshold)
// Anti-neighbor: raise alone is insufficient; requires a co-signal
function detectFundraisingSecondary(text: string): string[] {
  const fundraisingTokens = [
    'angel',
    'seed round',
    'friends and family',
    'grant',
    'non-dilutive',
    'sponsor',
    'sponsorship',
    'partnership',
    'diligence',
    'data room',
    'raise',
    'fundraising',
  ];
  return fundraisingTokens.filter((t) => text.includes(t));
}

// CP-003 secondary signal: CreativeProduction within a BrandLaunch goal
// Threshold: 1+ creative token (lower threshold — tokens are highly specific)
function detectCreativeProductionSecondary(text: string): string[] {
  const creativeTokens = [
    'podcast',
    'music',
    'video',
    'manuscript',
    'longform',
    'book',
    'recording',
    'editing',
    'publish',
  ];
  return creativeTokens.filter((t) => text.includes(t));
}

// CP-004 secondary signal: ProfessionalQualification within a JobSearchPipeline goal
// Threshold: 2+ PQ tokens (same as standalone PQ primary threshold)
// Anti-neighbor: cert alone is insufficient; requires exam or certification co-signal
function detectProfessionalQualificationSecondary(text: string): string[] {
  const pqTokens = ['cert', 'certification', 'exam', 'ccp', 'aws'];
  return pqTokens.filter((t) => text.includes(t));
}

// ─── detectSecondaryArchetype ─────────────────────────────────────────────────

/**
 * Given the goal text and the already-classified primary archetype,
 * checks whether a supported Tier A composition pair applies.
 *
 * Returns null if:
 * - no supported pair exists for this primary
 * - secondary signals do not meet the threshold
 * - the pairing is not in the Tier A supported set
 *
 * Does NOT modify classification. Primary remains the output of classifyLiveInputToArchetype().
 */
export function detectSecondaryArchetype(
  goalText: string,
  primary: MigratedArchetype
): SupportedCompositionPair | null {
  const text = lowerText(goalText);

  if (primary === 'VentureLaunch') {
    // CP-001: VentureLaunch + BrandLaunch
    const brandSignals = detectBrandLaunchSecondary(text);
    if (brandSignals.length >= 2) {
      return {
        primary: 'VentureLaunch',
        secondary: 'BrandLaunch',
        pairId: 'CP-001',
        detectionSignals: brandSignals,
        injectionPoint: INJECTION_POINTS['CP-001'],
      };
    }

    // CP-002: VentureLaunch + Fundraising
    const fundraisingSignals = detectFundraisingSecondary(text);
    if (fundraisingSignals.length >= 2) {
      return {
        primary: 'VentureLaunch',
        secondary: 'Fundraising',
        pairId: 'CP-002',
        detectionSignals: fundraisingSignals,
        injectionPoint: INJECTION_POINTS['CP-002'],
      };
    }
  }

  if (primary === 'BrandLaunch') {
    // CP-003: BrandLaunch + CreativeProduction
    const creativeSignals = detectCreativeProductionSecondary(text);
    if (creativeSignals.length >= 1) {
      return {
        primary: 'BrandLaunch',
        secondary: 'CreativeProduction',
        pairId: 'CP-003',
        detectionSignals: creativeSignals,
        injectionPoint: INJECTION_POINTS['CP-003'],
      };
    }
  }

  if (primary === 'JobSearchPipeline') {
    // CP-004: JobSearchPipeline + ProfessionalQualification
    const pqSignals = detectProfessionalQualificationSecondary(text);
    if (pqSignals.length >= 2) {
      return {
        primary: 'JobSearchPipeline',
        secondary: 'ProfessionalQualification',
        pairId: 'CP-004',
        detectionSignals: pqSignals,
        injectionPoint: INJECTION_POINTS['CP-004'],
      };
    }
  }

  // Primary is not in a supported pairing, or secondary signals are below threshold.
  return null;
}
