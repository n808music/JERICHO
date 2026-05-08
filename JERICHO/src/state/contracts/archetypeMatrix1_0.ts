export type LaneExecutionGrammar = {
  typicalDeliverables: string[];
  typicalMilestones: string[];
  dependencyPattern: string;
  actionClasses: string[];
  schedulePattern: string;
  correctionPattern: string;
};

export type ArchetypeLane = {
  subtype: string;
  definition: string;
  grammar: LaneExecutionGrammar;
};

export type ArchetypeDefinition = {
  archetype: string;
  definition: string;
  lanes: ArchetypeLane[];
};

export const ARCHETYPE_MATRIX_1_0: ArchetypeDefinition[] = [
  {
    archetype: 'VentureLaunch',
    definition:
      'Turn a venture concept into a launch-ready operating entity with defined offer, assets, readiness, and initial go-to-market execution.',
    lanes: [
      {
        subtype: 'SaaS Product Launch',
        definition:
          'Build, validate, package, and launch a software product with core feature readiness and initial acquisition path.',
        grammar: {
          typicalDeliverables: ['MVP feature set complete', 'Onboarding flow complete', 'Launch page live'],
          typicalMilestones: ['First beta users onboarded', 'First production release deployed'],
          dependencyPattern: 'validate -> build -> package -> launch',
          actionClasses: ['customer validation', 'build tasks', 'QA', 'launch ops'],
          schedulePattern: 'front-load build blocks, reserve launch sprint near deadline',
          correctionPattern: 'reduce scope to core release and shift non-critical features post-launch',
        },
      },
      {
        subtype: 'Consumer Product Launch',
        definition:
          'Develop, package, and release a physical or consumer-facing product with product and brand readiness.',
        grammar: {
          typicalDeliverables: ['Product spec finalized', 'Packaging ready', 'Launch assets complete'],
          typicalMilestones: ['Prototype approved', 'First inventory batch secured'],
          dependencyPattern: 'spec -> prototype -> packaging -> launch assets',
          actionClasses: ['product refinement', 'vendor coordination', 'brand assets', 'launch prep'],
          schedulePattern: 'cadence around production lead times with launch lock window',
          correctionPattern: 'defer variants/SKUs and protect single launch configuration',
        },
      },
      {
        subtype: 'Service Business Launch',
        definition:
          'Define, package, and launch a service offer with delivery process, pricing, and acquisition motion.',
        grammar: {
          typicalDeliverables: [
            'Offer package finalized',
            'Pricing sheet complete',
            'Client onboarding workflow complete',
          ],
          typicalMilestones: ['First discovery call completed', 'First paid client closed'],
          dependencyPattern: 'offer -> pricing -> process -> outreach -> close',
          actionClasses: ['offer design', 'process design', 'sales outreach', 'closing follow-up'],
          schedulePattern: 'early offer/process blocks then recurring outreach cadence',
          correctionPattern: 'narrow target segment and simplify offer tiers',
        },
      },
      {
        subtype: 'Marketplace Launch',
        definition: 'Stand up a two-sided offer with supply/demand readiness and initial liquidity strategy.',
        grammar: {
          typicalDeliverables: [
            'Supply-side onboarding kit complete',
            'Demand-side funnel complete',
            'Matching flow ready',
          ],
          typicalMilestones: ['First supply cohort live', 'First matched transactions'],
          dependencyPattern: 'supply setup + demand setup -> matching -> activation',
          actionClasses: ['supplier outreach', 'demand acquisition', 'platform config', 'liquidity ops'],
          schedulePattern: 'alternating supply and demand work blocks with liquidity checkpoints',
          correctionPattern: 'constrain geography/category to improve initial liquidity',
        },
      },
      {
        subtype: 'Local Business Launch',
        definition: 'Launch a location-based business with operational readiness and local market execution.',
        grammar: {
          typicalDeliverables: [
            'Local offer menu finalized',
            'Operations checklist complete',
            'Local launch campaign complete',
          ],
          typicalMilestones: ['Opening readiness verified', 'First week customer volume target met'],
          dependencyPattern: 'ops readiness -> local assets -> launch -> stabilization',
          actionClasses: ['ops setup', 'local marketing', 'opening prep', 'customer follow-up'],
          schedulePattern: 'deadline-tied opening sprint with recurring local promo blocks',
          correctionPattern: 'tighten service radius/hours to stabilize delivery capacity',
        },
      },
    ],
  },
  {
    archetype: 'SkillAcquisition',
    definition:
      'Acquire capability in a domain through structured learning, practice, demonstration, and proof of usable proficiency.',
    lanes: [
      {
        subtype: 'Software Skill Acquisition',
        definition: 'Learn a technical toolset to produce usable projects or implementation competence.',
        grammar: {
          typicalDeliverables: [
            'Core concepts notes complete',
            'Practice project complete',
            'Portfolio sample complete',
          ],
          typicalMilestones: ['First end-to-end build shipped'],
          dependencyPattern: 'learn -> practice -> build -> demonstrate',
          actionClasses: ['study', 'drills', 'project implementation', 'review'],
          schedulePattern: 'daily study/practice with weekly project integration blocks',
          correctionPattern: 'reduce topic breadth and reinforce weak fundamentals',
        },
      },
      {
        subtype: 'Design Skill Acquisition',
        definition: 'Build design ability through practice, critique, and portfolio-quality outputs.',
        grammar: {
          typicalDeliverables: [
            'Design system exercises complete',
            'Critique-refined mockups complete',
            'Portfolio case study complete',
          ],
          typicalMilestones: ['First externally reviewed artifact'],
          dependencyPattern: 'fundamentals -> applied work -> critique -> portfolio packaging',
          actionClasses: ['skill drills', 'artifact creation', 'critique iteration', 'documentation'],
          schedulePattern: 'alternating drill and artifact sessions with critique checkpoints',
          correctionPattern: 'focus on fewer artifacts with deeper iteration quality',
        },
      },
      {
        subtype: 'Communication Skill Acquisition',
        definition: 'Improve speaking, writing, persuasion, or presentation through drills and performance outputs.',
        grammar: {
          typicalDeliverables: [
            'Speech/writing sample set complete',
            'Feedback log complete',
            'Refined final presentation complete',
          ],
          typicalMilestones: ['Live presentation delivered'],
          dependencyPattern: 'draft -> rehearse -> feedback -> refine -> perform',
          actionClasses: ['drafting', 'rehearsal', 'record/review', 'delivery'],
          schedulePattern: 'short frequent rehearsal blocks and weekly performance review',
          correctionPattern: 'increase feedback cadence and shorten iteration cycles',
        },
      },
      {
        subtype: 'Technical Trade Skill Acquisition',
        definition: 'Gain hands-on trade capability through procedural learning and verified task execution.',
        grammar: {
          typicalDeliverables: [
            'Procedure checklist complete',
            'Task execution log complete',
            'Competency demonstration complete',
          ],
          typicalMilestones: ['Safety/quality benchmark passed'],
          dependencyPattern: 'procedure learning -> supervised execution -> independent execution',
          actionClasses: ['procedure study', 'guided reps', 'independent reps', 'validation'],
          schedulePattern: 'high-frequency repetition blocks with periodic competency checks',
          correctionPattern: 'increase reps on failed procedures before new tasks',
        },
      },
      {
        subtype: 'Creative Skill Acquisition',
        definition:
          'Develop expressive capability through technique practice, iterative creation, and completed works.',
        grammar: {
          typicalDeliverables: [
            'Technique drills complete',
            'Iteration set complete',
            'Final sample collection complete',
          ],
          typicalMilestones: ['First publishable piece completed'],
          dependencyPattern: 'technique -> experimentation -> refinement -> finished output',
          actionClasses: ['drills', 'creative sessions', 'revision passes', 'presentation prep'],
          schedulePattern: 'recurring creation blocks plus periodic critique/revision windows',
          correctionPattern: 'reduce concurrent pieces and finish one complete artifact first',
        },
      },
    ],
  },
  {
    archetype: 'ProfessionalQualification',
    definition:
      'Satisfy a formal external standard through targeted preparation, readiness validation, and successful qualifying completion.',
    lanes: [
      {
        subtype: 'Certification Exam',
        definition:
          'Prepare for and pass a standardized certification via coverage, practice, readiness checks, and exam completion.',
        grammar: {
          typicalDeliverables: [
            'Domain coverage notes complete',
            'Practice exam set complete',
            'Exam readiness packet complete',
          ],
          typicalMilestones: ['First passing mock score', 'Exam completed with result'],
          dependencyPattern: 'coverage -> practice -> weakness remediation -> final readiness -> exam',
          actionClasses: ['domain study', 'practice tests', 'review weak domains', 'final review'],
          schedulePattern: 'weekly domain blocks plus recurring timed practice exams',
          correctionPattern: 'shift time toward weakest domains and increase timed mocks',
        },
      },
      {
        subtype: 'Licensure Exam',
        definition: 'Satisfy regulated exam-based entry requirements with compliance readiness and exam completion.',
        grammar: {
          typicalDeliverables: [
            'Licensure domain prep complete',
            'Compliance documentation complete',
            'Exam attempt complete',
          ],
          typicalMilestones: ['Application accepted by regulator'],
          dependencyPattern: 'requirements -> study -> compliance docs -> exam scheduling -> exam',
          actionClasses: ['requirements review', 'targeted prep', 'documentation', 'exam execution'],
          schedulePattern: 'front-load requirements/documentation, then repeated exam prep cadence',
          correctionPattern: 'close compliance gaps first before additional study depth',
        },
      },
      {
        subtype: 'Compliance Training Completion',
        definition: 'Complete required training and verification steps for approved standing in a regulated context.',
        grammar: {
          typicalDeliverables: [
            'Required modules complete',
            'Verification forms complete',
            'Completion certificate package complete',
          ],
          typicalMilestones: ['Mandatory verification passed'],
          dependencyPattern: 'module completion -> assessment -> verification submission',
          actionClasses: ['module sessions', 'assessment prep', 'submission tasks'],
          schedulePattern: 'deadline-driven module sequence with verification buffer',
          correctionPattern: 'prioritize blocked mandatory modules and required attestations',
        },
      },
      {
        subtype: 'Portfolio-Based Qualification',
        definition: 'Assemble/refine required work samples and documentation to meet qualification standards.',
        grammar: {
          typicalDeliverables: [
            'Portfolio artifact set complete',
            'Qualification narrative complete',
            'Submission package complete',
          ],
          typicalMilestones: ['Portfolio review passed'],
          dependencyPattern: 'artifact creation -> curation -> narrative alignment -> submission',
          actionClasses: ['artifact production', 'quality review', 'packaging', 'submission'],
          schedulePattern: 'artifact sprints followed by consolidation/review windows',
          correctionPattern: 'remove weak samples and focus on criteria-aligned artifacts',
        },
      },
      {
        subtype: 'Interview-Based Qualification',
        definition: 'Prepare materials and performance readiness for evaluative interview acceptance.',
        grammar: {
          typicalDeliverables: [
            'Interview prep packet complete',
            'Mock interview feedback set complete',
            'Final interview readiness checklist complete',
          ],
          typicalMilestones: ['Mock readiness threshold met'],
          dependencyPattern: 'materials prep -> rehearsal -> feedback iteration -> interview execution',
          actionClasses: ['prep', 'mock interviews', 'feedback integration', 'final readiness'],
          schedulePattern: 'recurring rehearsal with increasing realism near interview date',
          correctionPattern: 'focus on weak question classes and tighten response structure',
        },
      },
    ],
  },
  {
    archetype: 'PhysicalTraining',
    definition:
      'Improve physical capability/performance/recovery/body-state through structured training blocks, benchmarks, and validated progress.',
    lanes: [
      {
        subtype: 'Strength Program',
        definition: 'Build strength via progressive training, benchmark lifts, and recovery reassessment.',
        grammar: {
          typicalDeliverables: [
            'Training block one completion log',
            'Progressive load plan complete',
            'Final strength review complete',
          ],
          typicalMilestones: ['Baseline lift benchmark recorded', 'Week-6 benchmark achieved'],
          dependencyPattern: 'baseline -> block progression -> benchmark -> adjustment -> final test',
          actionClasses: ['training sessions', 'recovery sessions', 'benchmark tests', 'review'],
          schedulePattern: 'recurring weekly training cadence with benchmark checkpoints',
          correctionPattern: 'reduce load progression and add recovery when adaptation stalls',
        },
      },
      {
        subtype: 'Endurance Performance',
        definition: 'Increase endurance toward an event/benchmark through progressive conditioning and pacing work.',
        grammar: {
          typicalDeliverables: [
            'Endurance block log complete',
            'Pacing protocol complete',
            'Race/test prep checklist complete',
          ],
          typicalMilestones: ['Mid-cycle time trial complete', 'Target event completed'],
          dependencyPattern: 'base conditioning -> build intensity -> simulation -> taper -> event',
          actionClasses: ['conditioning sessions', 'pace work', 'test efforts', 'recovery'],
          schedulePattern: 'periodized weekly sessions with deload and taper windows',
          correctionPattern: 'trim intensity spikes and restore progression consistency',
        },
      },
      {
        subtype: 'Weight Loss / Body Composition',
        definition:
          'Change body composition through training adherence, measurement checkpoints, and target-state review.',
        grammar: {
          typicalDeliverables: [
            'Adherence log complete',
            'Weekly measurement report set complete',
            'Program adjustment review complete',
          ],
          typicalMilestones: ['First composition checkpoint hit', 'Target composition threshold reached'],
          dependencyPattern: 'baseline metrics -> adherence cycles -> periodic checkpoints -> adjustment',
          actionClasses: ['training blocks', 'tracking/review', 'protocol adjustment'],
          schedulePattern: 'recurring training + weekly measurement and review cadence',
          correctionPattern: 'tighten adherence/consistency before increasing intensity',
        },
      },
      {
        subtype: 'Rehab Return to Training',
        definition:
          'Restore function and return to training safely through recovery protocol and progressive re-entry.',
        grammar: {
          typicalDeliverables: [
            'Rehab protocol completion log',
            'Return-to-training plan complete',
            'Safety review complete',
          ],
          typicalMilestones: ['Clearance milestone achieved', 'Pain-free benchmark achieved'],
          dependencyPattern: 'rehab baseline -> protocol adherence -> clearance -> graded return',
          actionClasses: ['rehab sessions', 'mobility work', 'readiness checks', 're-entry sessions'],
          schedulePattern: 'high-frequency low-load sessions with staged progression checkpoints',
          correctionPattern: 'pause progression and return to prior stage on symptom flare',
        },
      },
      {
        subtype: 'General Conditioning',
        definition: 'Improve baseline fitness and preparedness through balanced routine adherence and benchmarks.',
        grammar: {
          typicalDeliverables: [
            'Conditioning routine plan complete',
            'Weekly adherence logs complete',
            'End-cycle conditioning review complete',
          ],
          typicalMilestones: ['Baseline conditioning test complete', 'Final capacity benchmark complete'],
          dependencyPattern: 'baseline -> routine adherence -> periodic tests -> final review',
          actionClasses: ['conditioning sessions', 'mobility/recovery', 'benchmark tests'],
          schedulePattern: 'steady recurring cadence with monthly benchmark blocks',
          correctionPattern: 'rebalance session mix to recover consistency and capacity growth',
        },
      },
    ],
  },
  {
    archetype: 'JobSearchPipeline',
    definition:
      'Move from role targeting to materials, outreach, interviews, and decision through a staged employment acquisition pipeline.',
    lanes: [
      {
        subtype: 'Corporate Role Search',
        definition:
          'Pursue structured corporate employment through tailored materials, applications, interviews, and follow-up.',
        grammar: {
          typicalDeliverables: [
            'Role targeting profile complete',
            'Resume/portfolio packet complete',
            'Application tracker initialized',
          ],
          typicalMilestones: ['First 10 applications submitted', 'First interview round completed'],
          dependencyPattern: 'targeting -> materials -> application batches -> interviews -> decision',
          actionClasses: ['target research', 'asset tailoring', 'applications', 'interview prep', 'follow-up'],
          schedulePattern: 'weekly application throughput blocks plus recurring interview prep',
          correctionPattern: 'tighten role scope and increase tailoring quality over volume',
        },
      },
      {
        subtype: 'Remote Knowledge Work Search',
        definition:
          'Run a search pipeline for remote work through positioning, applications, and remote interview readiness.',
        grammar: {
          typicalDeliverables: [
            'Remote role positioning pack complete',
            'Remote-ready resume/profile complete',
            'Application/outreach tracker complete',
          ],
          typicalMilestones: ['First remote interview invite received'],
          dependencyPattern: 'positioning -> materials -> outreach/apps -> interview readiness',
          actionClasses: ['positioning edits', 'application batches', 'outreach follow-ups', 'mock interviews'],
          schedulePattern: 'daily outreach/application cadence with weekly conversion review',
          correctionPattern: 'adjust positioning keywords and target channels based on response rate',
        },
      },
      {
        subtype: 'Creative Role Search',
        definition: 'Pursue creative employment through portfolio positioning, outreach, and presentation readiness.',
        grammar: {
          typicalDeliverables: [
            'Portfolio showcase complete',
            'Role-specific resume complete',
            'Outreach message set complete',
          ],
          typicalMilestones: ['Portfolio review interview completed'],
          dependencyPattern: 'portfolio curation -> materials -> outreach -> interviews',
          actionClasses: ['portfolio curation', 'application tailoring', 'network outreach', 'presentation prep'],
          schedulePattern: 'artifact polish sessions combined with application/outreach blocks',
          correctionPattern: 'replace weak portfolio pieces and narrow target role family',
        },
      },
      {
        subtype: 'Skilled Trade Role Search',
        definition: 'Secure trade employment through qualification proof, local targeting, and employer outreach.',
        grammar: {
          typicalDeliverables: [
            'Qualification proof packet complete',
            'Local employer target list complete',
            'Application/contact log complete',
          ],
          typicalMilestones: ['First skills test/interview completed'],
          dependencyPattern: 'credential proof -> employer targeting -> contact/apply -> interview',
          actionClasses: ['credential packaging', 'targeting', 'direct outreach', 'interview readiness'],
          schedulePattern: 'front-load qualification proof then recurring outreach cadence',
          correctionPattern: 'expand local target radius and improve employer-specific targeting',
        },
      },
      {
        subtype: 'Career Transition Search',
        definition:
          'Land a role in a new domain via transferable-skill framing and transition-ready pipeline execution.',
        grammar: {
          typicalDeliverables: [
            'Transition narrative packet complete',
            'Transferable-skill resume complete',
            'Target transition company list complete',
          ],
          typicalMilestones: ['First transition interview completed'],
          dependencyPattern: 'repositioning -> materials -> targeted applications -> interview loops',
          actionClasses: ['narrative framing', 'materials tailoring', 'applications', 'interview prep'],
          schedulePattern: 'early repositioning sprints then sustained pipeline throughput',
          correctionPattern: 'tighten transition story and prioritize closer-fit bridge roles',
        },
      },
    ],
  },
  {
    archetype: 'CreativeProduction',
    definition:
      'Take a creative concept through structure, creation, revision, completion, and release-ready finalization.',
    lanes: [
      {
        subtype: 'TV / Series Writing',
        definition:
          'Develop a scripted series through concept, story structure, draft writing, and continuity refinement.',
        grammar: {
          typicalDeliverables: [
            'Season premise package complete',
            'Episode outline set complete',
            'Draft script set complete',
          ],
          typicalMilestones: ['Continuity pass completed'],
          dependencyPattern: 'premise -> arc -> outlines -> drafts -> continuity revision',
          actionClasses: ['story design', 'outline writing', 'draft writing', 'revision'],
          schedulePattern: 'deep work writing blocks with weekly revision checkpoints',
          correctionPattern: 'reduce episode scope and prioritize core arc consistency',
        },
      },
      {
        subtype: 'Podcast Production',
        definition: 'Create a podcast through concept, format, planning, recording assets, and launch-ready episodes.',
        grammar: {
          typicalDeliverables: [
            'Show concept package complete',
            'Episode plan set complete',
            'Launch-ready episode batch complete',
          ],
          typicalMilestones: ['Pilot episode published'],
          dependencyPattern: 'show concept -> episode planning -> production -> launch prep',
          actionClasses: ['concept design', 'script/outline prep', 'record/edit', 'publish prep'],
          schedulePattern: 'episode production cadence with batch editing windows',
          correctionPattern: 'reduce episode complexity and batch similar production tasks',
        },
      },
      {
        subtype: 'Music Project Production',
        definition: 'Produce a music release through concept, recording, refinement, packaging, and release prep.',
        grammar: {
          typicalDeliverables: [
            'Track development set complete',
            'Mix/master package complete',
            'Release asset package complete',
          ],
          typicalMilestones: ['Final master approval'],
          dependencyPattern: 'concept -> recording -> mix/master -> packaging -> release',
          actionClasses: ['writing/production', 'recording', 'mix revisions', 'release ops'],
          schedulePattern: 'creative blocks early, technical polish and release blocks near deadline',
          correctionPattern: 'lock tracklist earlier and defer non-core tracks',
        },
      },
      {
        subtype: 'Video Production',
        definition:
          'Execute video project through concept, pre-production, asset creation, editing, and final delivery.',
        grammar: {
          typicalDeliverables: [
            'Pre-production package complete',
            'Raw footage set complete',
            'Final edit delivery package complete',
          ],
          typicalMilestones: ['Rough cut approved'],
          dependencyPattern: 'concept -> pre-production -> production -> edit -> final delivery',
          actionClasses: ['planning', 'shooting', 'editing', 'review cycles'],
          schedulePattern: 'pre-production blocks then production cluster then edit iterations',
          correctionPattern: 'trim shot list and prioritize story-critical scenes',
        },
      },
      {
        subtype: 'Book / Longform Writing',
        definition:
          'Write longform work through outline architecture, draft progression, revision, and manuscript prep.',
        grammar: {
          typicalDeliverables: [
            'Outline architecture complete',
            'Draft chapters complete',
            'Revision manuscript complete',
          ],
          typicalMilestones: ['First complete draft finished'],
          dependencyPattern: 'outline -> draft -> revise -> finalize manuscript',
          actionClasses: ['outline sessions', 'drafting sessions', 'revision passes'],
          schedulePattern: 'recurring deep writing blocks with periodic synthesis/revision days',
          correctionPattern: 'tighten chapter scope and stabilize weekly writing cadence',
        },
      },
    ],
  },
  {
    archetype: 'BrandLaunch',
    definition: 'Define, build, package, and release a coherent identity system and launch-facing expression.',
    lanes: [
      {
        subtype: 'Personal Brand Launch',
        definition: 'Build identity-driven public presence with positioning, messaging, visuals, and rollout assets.',
        grammar: {
          typicalDeliverables: [
            'Positioning statement package complete',
            'Visual identity set complete',
            'Launch content set complete',
          ],
          typicalMilestones: ['Brand profile launch completed'],
          dependencyPattern: 'positioning -> identity system -> launch assets -> rollout',
          actionClasses: ['positioning work', 'identity design', 'content creation', 'publishing'],
          schedulePattern: 'identity build sprint then recurring content launch blocks',
          correctionPattern: 'simplify identity scope and focus on one channel launch first',
        },
      },
      {
        subtype: 'Business Brand Launch',
        definition: 'Establish a business identity with strategy, messaging, and launch-ready touchpoints.',
        grammar: {
          typicalDeliverables: [
            'Brand strategy brief complete',
            'Messaging framework complete',
            'Business touchpoint assets complete',
          ],
          typicalMilestones: ['Public brand launch completed'],
          dependencyPattern: 'strategy -> messaging -> asset system -> deployment',
          actionClasses: ['strategy', 'message crafting', 'asset design', 'deployment'],
          schedulePattern: 'front-load strategy/messaging then execute asset deployment cadence',
          correctionPattern: 'reduce touchpoint scope and prioritize conversion-critical assets',
        },
      },
      {
        subtype: 'Product Brand Launch',
        definition: 'Create/release distinct identity around a product with packaging and launch execution.',
        grammar: {
          typicalDeliverables: [
            'Product brand narrative complete',
            'Packaging/visual assets complete',
            'Launch campaign assets complete',
          ],
          typicalMilestones: ['Packaging approval milestone reached'],
          dependencyPattern: 'narrative -> identity assets -> packaging -> launch campaign',
          actionClasses: ['narrative work', 'design work', 'asset production', 'launch tasks'],
          schedulePattern: 'asset production clusters with synchronized launch deadline',
          correctionPattern: 'drop optional campaign variants and protect core launch kit',
        },
      },
      {
        subtype: 'Artist / Creator Brand Launch',
        definition: 'Define a creator identity with narrative, aesthetic system, and audience-facing media assets.',
        grammar: {
          typicalDeliverables: [
            'Creator identity brief complete',
            'Aesthetic asset library complete',
            'Audience launch media pack complete',
          ],
          typicalMilestones: ['First branded release published'],
          dependencyPattern: 'identity narrative -> aesthetic system -> media assets -> release',
          actionClasses: ['narrative', 'design', 'media creation', 'release ops'],
          schedulePattern: 'identity locking first, then iterative media production blocks',
          correctionPattern: 'consolidate style directions and finish one cohesive launch set',
        },
      },
      {
        subtype: 'Campaign Brand Launch',
        definition: 'Build campaign-specific identity system with thematic messaging and timed activation.',
        grammar: {
          typicalDeliverables: [
            'Campaign narrative complete',
            'Campaign visual system complete',
            'Activation collateral set complete',
          ],
          typicalMilestones: ['Campaign activation launch completed'],
          dependencyPattern: 'theme strategy -> identity system -> collateral production -> activation',
          actionClasses: ['campaign strategy', 'message drafting', 'asset production', 'activation'],
          schedulePattern: 'deadline-bound activation plan with collateral production waves',
          correctionPattern: 'narrow campaign scope and remove low-impact collateral',
        },
      },
    ],
  },
  {
    archetype: 'SalesPipeline',
    definition:
      'Move leads through targeting, outreach, qualification, follow-up, and conversion via managed sales process.',
    lanes: [
      {
        subtype: 'B2B Service Sales',
        definition: 'Sell services to businesses through targeting, outreach, qualification, and close process.',
        grammar: {
          typicalDeliverables: [
            'Offer sales deck complete',
            'Target account list complete',
            'Sales tracker with stages complete',
          ],
          typicalMilestones: ['First qualified pipeline stage reached', 'First closed deal'],
          dependencyPattern: 'offer packaging -> targeting -> outreach -> qualification -> close',
          actionClasses: ['prospecting', 'outreach', 'qualification calls', 'proposal/follow-up'],
          schedulePattern: 'recurring outreach/qualification cadence with weekly pipeline review',
          correctionPattern: 'tighten ICP targeting and improve qualification gating',
        },
      },
      {
        subtype: 'B2C Product Sales',
        definition: 'Sell directly to consumers through conversion flow and follow-up optimization.',
        grammar: {
          typicalDeliverables: [
            'Consumer offer page complete',
            'Lead/customer funnel tracker complete',
            'Follow-up sequence complete',
          ],
          typicalMilestones: ['First conversion target milestone reached'],
          dependencyPattern: 'offer presentation -> lead flow -> conversion -> follow-up optimization',
          actionClasses: ['offer optimization', 'lead handling', 'conversion tasks', 'follow-up'],
          schedulePattern: 'daily conversion operations with weekly funnel optimization block',
          correctionPattern: 'focus on highest-converting channel and simplify funnel steps',
        },
      },
      {
        subtype: 'High-Ticket Consultative Sales',
        definition:
          'Convert high-value opportunities through qualification, trust-building, and tailored follow-through.',
        grammar: {
          typicalDeliverables: [
            'Consultative sales narrative complete',
            'Qualified opportunity list complete',
            'Decision-stage proposal set complete',
          ],
          typicalMilestones: ['First high-ticket proposal delivered'],
          dependencyPattern: 'qualification depth -> discovery trust -> tailored proposal -> decision support',
          actionClasses: ['deep discovery', 'stakeholder mapping', 'proposal tailoring', 'follow-through'],
          schedulePattern: 'fewer deeper sessions per lead with structured follow-up cadence',
          correctionPattern: 'reduce pipeline breadth and improve qualification depth',
        },
      },
      {
        subtype: 'Retail / Local Offer Sales',
        definition:
          'Drive local demand through offer clarity, inquiry flow, conversion process, and repeatable follow-up.',
        grammar: {
          typicalDeliverables: [
            'Local offer package complete',
            'Inquiry-to-sale process map complete',
            'Repeat follow-up playbook complete',
          ],
          typicalMilestones: ['Weekly local conversion benchmark hit'],
          dependencyPattern: 'offer clarity -> demand generation -> conversion ops -> repeat follow-up',
          actionClasses: ['local promotion', 'inquiry handling', 'sales conversion', 'retention follow-up'],
          schedulePattern: 'daily local sales ops with weekly demand/capacity rebalance',
          correctionPattern: 'narrow offer bundle and tighten conversion handoff',
        },
      },
      {
        subtype: 'Subscription / Recurring Revenue Sales',
        definition: 'Acquire recurring customers through pipeline management, conversion, and retention-aware closing.',
        grammar: {
          typicalDeliverables: [
            'Subscription offer package complete',
            'Recurring conversion funnel complete',
            'Retention-aware follow-up sequence complete',
          ],
          typicalMilestones: ['First recurring cohort acquired'],
          dependencyPattern: 'offer/value clarity -> acquisition -> conversion -> retention-aware close',
          actionClasses: ['acquisition outreach', 'conversion work', 'onboarding handoff', 'retention follow-up'],
          schedulePattern: 'steady acquisition cadence plus cohort-based onboarding windows',
          correctionPattern: 'prioritize quality cohorts and reduce churn-prone acquisition channels',
        },
      },
    ],
  },
  {
    archetype: 'Fundraising',
    definition:
      'Prepare narrative, materials, targets, outreach, and follow-through required to secure external financial support.',
    lanes: [
      {
        subtype: 'Friends and Family Raise',
        definition:
          'Raise early support from personal relationships through trust-based messaging and commitment tracking.',
        grammar: {
          typicalDeliverables: [
            'Raise narrative memo complete',
            'Supporter target list complete',
            'Commitment tracker complete',
          ],
          typicalMilestones: ['First commitments secured'],
          dependencyPattern: 'narrative -> target list -> outreach -> commitments -> follow-through',
          actionClasses: ['message prep', 'outreach', 'conversations', 'commitment tracking'],
          schedulePattern: 'conversation clusters with regular commitment follow-up blocks',
          correctionPattern: 'clarify use-of-funds story and focus highest-trust targets first',
        },
      },
      {
        subtype: 'Angel Raise',
        definition:
          'Secure angel funding through investor narrative, target list, meetings, and follow-up progression.',
        grammar: {
          typicalDeliverables: [
            'Investor narrative package complete',
            'Angel target list complete',
            'Meeting/follow-up tracker complete',
          ],
          typicalMilestones: ['First angel meeting completed', 'First verbal interest recorded'],
          dependencyPattern: 'narrative/deck -> target list -> outreach -> meetings -> follow-up',
          actionClasses: [
            'deck refinement',
            'target research',
            'outreach',
            'meeting prep',
            'diligence follow-up',
            'commitment follow-up',
          ],
          schedulePattern: 'weekly outreach batches with scheduled meeting prep windows',
          correctionPattern: 'tighten investor-fit targeting and improve narrative clarity',
        },
      },
      {
        subtype: 'Seed Round Raise',
        definition:
          'Execute formal early-stage raise through deck readiness, pipeline management, and diligence support.',
        grammar: {
          typicalDeliverables: [
            'Seed deck complete',
            'Investor pipeline tracker complete',
            'Diligence data room package complete',
          ],
          typicalMilestones: ['Diligence request milestone reached'],
          dependencyPattern: 'deck/data readiness -> pipeline build -> outreach -> diligence progression',
          actionClasses: ['deck/data prep', 'investor targeting', 'outreach', 'diligence follow-up'],
          schedulePattern: 'pipeline cadence with dedicated diligence-response blocks',
          correctionPattern: 'focus highest-probability investors and reduce low-fit outreach',
        },
      },
      {
        subtype: 'Grant / Non-Dilutive Funding',
        definition:
          'Pursue non-equity funding through eligibility matching, applications, and compliance documentation.',
        grammar: {
          typicalDeliverables: [
            'Eligibility matrix complete',
            'Grant application packet complete',
            'Compliance document set complete',
          ],
          typicalMilestones: ['Submission deadlines met'],
          dependencyPattern: 'eligibility match -> application assembly -> submission -> compliance follow-up',
          actionClasses: ['opportunity screening', 'application writing', 'document prep', 'submission tasks'],
          schedulePattern: 'deadline-led writing/documentation blocks with submission buffers',
          correctionPattern: 'reduce grant target set and improve fit quality per application',
        },
      },
      {
        subtype: 'Sponsorship / Partnership Raise',
        definition:
          'Obtain financial/in-kind support through partner targeting, value packaging, outreach, and agreements.',
        grammar: {
          typicalDeliverables: [
            'Partner value proposition pack complete',
            'Target sponsor list complete',
            'Proposal/agreement package complete',
          ],
          typicalMilestones: ['First sponsorship agreement signed'],
          dependencyPattern: 'value packaging -> partner targeting -> outreach -> proposal -> agreement',
          actionClasses: ['value proposition work', 'target research', 'outreach', 'negotiation follow-up'],
          schedulePattern: 'recurring outreach with periodic proposal/negotiation windows',
          correctionPattern: 'tighten partner-fit criteria and simplify sponsorship tiers',
        },
      },
    ],
  },
];

export function getArchetypeLaneCount() {
  return ARCHETYPE_MATRIX_1_0.reduce((sum, archetype) => sum + archetype.lanes.length, 0);
}
