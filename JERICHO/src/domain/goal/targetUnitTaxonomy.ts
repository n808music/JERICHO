export const CUSTOM_TARGET_UNIT_OPTION = '__custom_target_unit__';

type IntentConfig = {
  keywords: string[];
  units: string[];
};

type ExecutionTypeConfig = {
  defaultUnits: string[];
  intents?: Record<string, IntentConfig>;
};

export const TARGET_UNIT_INTENT_CONFIG_BY_EXECUTION_TYPE: Record<string, ExecutionTypeConfig> = {
  VentureLaunch: {
    defaultUnits: [
      'validated interviews completed',
      'mvp milestones completed',
      'beta users onboarded',
      'launch assets shipped',
    ],
    intents: {
      discovery: {
        keywords: ['validate', 'problem', 'interview', 'research', 'discovery'],
        units: [
          'customer interviews completed',
          'problems validated',
          'insight summaries completed',
          'solution hypotheses tested',
        ],
      },
      build: {
        keywords: ['mvp', 'prototype', 'build', 'product', 'ship core'],
        units: [
          'mvp milestones completed',
          'prototype iterations shipped',
          'core features delivered',
          'qa passes completed',
        ],
      },
      launch: {
        keywords: ['launch', 'go live', 'release', 'beta', 'rollout'],
        units: [
          'launch checklist items completed',
          'beta users onboarded',
          'launch assets shipped',
          'activation milestones completed',
        ],
      },
    },
  },
  SkillAcquisition: {
    defaultUnits: ['practice sessions completed', 'drills completed', 'projects completed', 'modules completed'],
    intents: {
      language: {
        keywords: ['language', 'spanish', 'french', 'german', 'conversation', 'fluency'],
        units: [
          'conversation sessions completed',
          'vocabulary sets mastered',
          'listening drills completed',
          'speaking checkpoints passed',
        ],
      },
      coding: {
        keywords: ['code', 'coding', 'programming', 'developer', 'software', 'algorithm'],
        units: [
          'coding exercises completed',
          'projects completed',
          'problem sets solved',
          'code review passes completed',
        ],
      },
      music: {
        keywords: ['guitar', 'piano', 'singing', 'music', 'instrument', 'voice'],
        units: [
          'practice sessions completed',
          'repertoire pieces mastered',
          'technique drills completed',
          'performance run-throughs completed',
        ],
      },
    },
  },
  ProfessionalQualification: {
    defaultUnits: [
      'study blocks completed',
      'practice exams completed',
      'question-bank sets completed',
      'certification milestones completed',
    ],
    intents: {
      exam: {
        keywords: ['exam', 'certification', 'license', 'board', 'pass'],
        units: [
          'study blocks completed',
          'practice exams completed',
          'question-bank sets completed',
          'mock exam checkpoints passed',
        ],
      },
      application: {
        keywords: ['application', 'admission', 'program', 'fellowship', 'portfolio'],
        units: [
          'application drafts completed',
          'requirements submitted',
          'portfolio items completed',
          'interview rounds completed',
        ],
      },
    },
  },
  PhysicalTraining: {
    defaultUnits: [
      'training sessions completed',
      'workout blocks completed',
      'benchmark checks completed',
      'conditioning blocks completed',
      'pounds lost',
      'pounds gained',
    ],
    intents: {
      strength: {
        keywords: ['strength', 'lift', 'squat', 'deadlift', 'bench', 'muscle'],
        units: [
          'strength workouts completed',
          'progressive overload sessions completed',
          'lift benchmarks achieved',
          'recovery sessions completed',
        ],
      },
      endurance: {
        keywords: ['run', 'marathon', 'cardio', 'endurance', 'cycling', 'swim'],
        units: [
          'endurance sessions completed',
          'distance milestones achieved',
          'pace benchmarks hit',
          'long-session blocks completed',
        ],
      },
      bodyComp: {
        keywords: ['fat loss', 'weight loss', 'lose weight', 'lose pounds', 'gain weight', 'body composition'],
        units: [
          'pounds lost',
          'pounds gained',
          'body-fat points reduced',
          'training sessions completed',
          'nutrition compliance days completed',
          'body-composition check-ins completed',
        ],
      },
    },
  },
  JobSearchPipeline: {
    defaultUnits: [
      'applications submitted',
      'outreach messages sent',
      'interviews completed',
      'pipeline follow-ups completed',
    ],
    intents: {
      outreach: {
        keywords: ['network', 'referral', 'outreach', 'connect', 'linkedin'],
        units: [
          'outreach messages sent',
          'referral conversations completed',
          'new contacts added',
          'follow-ups completed',
        ],
      },
      interview: {
        keywords: ['interview', 'onsite', 'screen', 'prepare', 'loop'],
        units: [
          'mock interviews completed',
          'interview rounds completed',
          'prep sessions completed',
          'debrief notes completed',
        ],
      },
      offer: {
        keywords: ['offer', 'negotiate', 'accept', 'role secured'],
        units: [
          'final-round interviews completed',
          'offers received',
          'negotiation rounds completed',
          'offer decisions completed',
        ],
      },
    },
  },
  CreativeProduction: {
    defaultUnits: [
      'drafts completed',
      'production sessions completed',
      'revision passes completed',
      'publishable artifacts completed',
    ],
    intents: {
      writing: {
        keywords: ['write', 'book', 'article', 'script', 'essay', 'newsletter'],
        units: [
          'draft pages completed',
          'chapters drafted',
          'revision passes completed',
          'publish-ready pieces completed',
        ],
      },
      music: {
        keywords: ['song', 'album', 'track', 'record', 'mix', 'music'],
        units: [
          'song drafts completed',
          'recording sessions completed',
          'mix revisions completed',
          'master-ready tracks completed',
        ],
      },
      video: {
        keywords: ['video', 'youtube', 'reel', 'edit', 'film'],
        units: [
          'video drafts completed',
          'shoot sessions completed',
          'editing passes completed',
          'published videos completed',
        ],
      },
    },
  },
  BrandLaunch: {
    defaultUnits: [
      'brand assets completed',
      'profile rollouts completed',
      'launch content pieces completed',
      'campaign checkpoints completed',
    ],
    intents: {
      identity: {
        keywords: ['brand identity', 'identity', 'logo', 'voice', 'positioning'],
        units: [
          'brand assets completed',
          'messaging pillars completed',
          'positioning iterations completed',
          'guideline sections completed',
        ],
      },
      audience: {
        keywords: ['audience', 'community', 'followers', 'awareness', 'reach'],
        units: [
          'audience outreach campaigns completed',
          'community touchpoints completed',
          'awareness content pieces completed',
          'engagement checkpoints achieved',
        ],
      },
      launch: {
        keywords: ['launch', 'announce', 'rollout', 'campaign'],
        units: [
          'launch content pieces completed',
          'profile rollouts completed',
          'campaign checkpoints completed',
          'launch-day milestones completed',
        ],
      },
    },
  },
  SalesPipeline: {
    defaultUnits: ['qualified leads contacted', 'discovery calls completed', 'proposals sent', 'deals closed'],
    intents: {
      outbound: {
        keywords: ['outbound', 'prospect', 'lead gen', 'cold', 'pipeline'],
        units: [
          'qualified leads contacted',
          'outbound sequences completed',
          'discovery calls booked',
          'pipeline follow-ups completed',
        ],
      },
      proposal: {
        keywords: ['proposal', 'pitch', 'quote', 'scope'],
        units: [
          'proposals sent',
          'scoping calls completed',
          'decision-maker meetings completed',
          'proposal revisions completed',
        ],
      },
      close: {
        keywords: ['close', 'revenue', 'deal', 'contract', 'win'],
        units: ['late-stage deals advanced', 'contracts sent', 'deals closed', 'booked-revenue milestones achieved'],
      },
    },
  },
  Fundraising: {
    defaultUnits: [
      'fundraising dollars committed',
      'commitments secured',
      'qualified meetings completed',
      'outreach messages sent',
      'fundraising packages prepared',
      'investor-ready packages completed',
      'investor materials packages completed',
    ],
    intents: {
      packagePrep: {
        keywords: [
          'fundraising package',
          'investor-ready package',
          'investor-ready materials',
          'friends-and-family',
          'friends and family',
          'pitch deck',
          'materials',
        ],
        units: [
          'fundraising packages prepared',
          'investor-ready packages completed',
          'investor materials packages completed',
          'pitch decks completed',
        ],
      },
      sponsorship: {
        keywords: ['sponsor', 'sponsorship', 'brand partner', 'partner'],
        units: [
          'sponsorship dollars committed',
          'sponsorship agreements signed',
          'qualified sponsors secured',
          'sponsor outreach messages sent',
        ],
      },
      investor: {
        keywords: ['investor', 'seed', 'angel', 'vc', 'venture'],
        units: [
          'investment dollars committed',
          'investor meetings completed',
          'diligence packets delivered',
          'lead investors secured',
        ],
      },
      donation: {
        keywords: ['donation', 'donor', 'donate', 'charity', 'nonprofit', 'non-profit'],
        units: ['donation dollars raised', 'donors converted', 'donation asks sent', 'recurring donors activated'],
      },
      grant: {
        keywords: ['grant', 'foundation', 'rfp', 'application'],
        units: [
          'grant dollars awarded',
          'grant applications submitted',
          'grant proposals completed',
          'grant interviews completed',
        ],
      },
    },
  },
  GenericStructured: {
    defaultUnits: ['deliverables completed', 'work sessions completed', 'milestones completed', 'tasks completed'],
    intents: {},
  },
};

export function inferExecutionIntent(goalLabel: string, executionType: string): string | null {
  const config = TARGET_UNIT_INTENT_CONFIG_BY_EXECUTION_TYPE[executionType];
  if (!config) {
    return null;
  }
  const text = (goalLabel || '').toLowerCase();
  if (!text) {
    return null;
  }
  for (const [intent, intentConfig] of Object.entries(config.intents || {})) {
    const keywords = intentConfig?.keywords || [];
    if (keywords.some((keyword) => text.includes(keyword))) {
      return intent;
    }
  }
  return null;
}

export function getTargetUnitOptions(goalLabel: string, executionType: string): string[] {
  const config = TARGET_UNIT_INTENT_CONFIG_BY_EXECUTION_TYPE[executionType];
  if (!config) {
    return TARGET_UNIT_INTENT_CONFIG_BY_EXECUTION_TYPE.GenericStructured.defaultUnits;
  }
  const intent = inferExecutionIntent(goalLabel, executionType);
  const base = !intent ? config.defaultUnits : config.intents?.[intent]?.units || config.defaultUnits;
  return [...new Set(base)];
}

function inferPhysicalTrainingMetric(text: string) {
  const lower = text.toLowerCase();
  const loseMatch = /\b(?:lose|drop|cut)\s+(\d+)\s*(?:lb|lbs|pounds?)\b/.exec(lower);
  if (loseMatch) {
    return { targetCount: Number(loseMatch[1]), targetUnit: 'pounds lost' };
  }
  const gainMatch = /\b(?:gain|add|put on)\s+(\d+)\s*(?:lb|lbs|pounds?)\b/.exec(lower);
  if (gainMatch) {
    return { targetCount: Number(gainMatch[1]), targetUnit: 'pounds gained' };
  }
  return { targetCount: null, targetUnit: null };
}

function inferFundraisingMetric(text: string) {
  const lower = text.toLowerCase();
  const explicitCount = /\b(\d+)\s+(?:fundraising|investor[-\s]ready|investor materials?)\s+packages?\b/.exec(lower);
  if (explicitCount) {
    return { targetCount: Number(explicitCount[1]), targetUnit: 'fundraising packages prepared' };
  }
  if (
    /\b(?:prepare|build|create)\b/.test(lower) &&
    /\b(?:fundraising package|investor-ready package|investor-ready materials|pitch deck|friends-and-family package)\b/.test(
      lower
    )
  ) {
    return { targetCount: 1, targetUnit: 'fundraising packages prepared' };
  }
  return { targetCount: null, targetUnit: null };
}

export function inferTargetMetric(goalLabel: string, executionType: string) {
  const text = String(goalLabel || '').trim();
  if (!text || !executionType) {
    return { targetCount: null, targetUnit: null };
  }
  if (executionType === 'PhysicalTraining') {
    return inferPhysicalTrainingMetric(text);
  }
  if (executionType === 'Fundraising') {
    return inferFundraisingMetric(text);
  }
  return { targetCount: null, targetUnit: null };
}
