# CORE MISSION CONTRACT INTEGRATION GUIDE

## Quick Start: Adding CoreMissionContract to Existing Code

### For Your Current Case (5-Year Company-Building Plan)

#### Step 1: Define Your Durable Objective

```ts
const durableObjective = `
  Scale the company into a major cultural/business force through talent, creative 
  output, software, media, brand-building, and execution discipline.
`;
```

This is the *one thing* that does not change. Not the albums, not the app, not the job—the *company*.

#### Step 2: Define Strategic Thesis

```ts
const strategicThesis = `
  Use talent, creative output, software, media, brand-building, project-management 
  capability, and execution infrastructure to compound legitimacy, audience, revenue, 
  and ownership. Each campaign builds proof and leverage for the next phase.
`;
```

This is HOW you believe the objective becomes real. If evidence contradicts it, this can change.

#### Step 3: List Your Current Campaigns

```ts
const activeCampaigns = [
  {
    id: 'album-campaign',
    name: 'Album / label campaign',
    contributionDescription: 'Establishes creative legitimacy and brand proof-of-concept',
    status: 'active',
  },
  {
    id: 'jericho-app-campaign',
    name: 'Jericho app campaign',
    contributionDescription: 'Software proof-of-concept, SaaS revenue foundation, PM brand',
    status: 'active',
  },
  {
    id: 'podcast-campaign',
    name: 'Podcast campaign',
    contributionDescription: 'Attention engine, audience building, distribution channel',
    status: 'active',
  },
  {
    id: 'pm-brand-campaign',
    name: 'PM brand campaign',
    contributionDescription: 'Legitimacy, credibility, audience, leverage for hiring',
    status: 'active',
  },
  {
    id: 'income-campaign',
    name: 'Income / runway campaign',
    contributionDescription: 'Financial support to enable focus on company-building',
    status: 'active',
    purpose: 'support', // This is support, not the mission
  },
  {
    id: 'job-search-campaign',
    name: 'Job search / security campaign',
    contributionDescription: 'Short-term income security if runway depletes',
    status: 'paused', // Only activate if needed
    purpose: 'support',
  },
];
```

#### Step 4: Define Non-Negotiables

```ts
const nonNegotiables = [
  'Ownership: maintain >50% of company',
  'Creative control: direct all major product/brand decisions',
  'Execution discipline: deliver what we commit to',
  'Company-building mentality: treat this as the long-term goal, not side project',
  'Long-term compounding: never sacrifice future leverage for present ease',
];
```

These are the boundaries. If you cross one, the mission changes.

#### Step 5: Define Allowed Tradeoffs

```ts
const allowedTradeoffs = [
  'Route changes: pause or shift between campaigns',
  'Campaign pivots: change how a campaign executes',
  'Timing adjustments: slip deadlines with new plan',
  'Scope reduction: do less now, more later',
  'Temporary income security: take a job if needed',
  'Resource reallocation: shift focus between campaigns',
  'Partner changes: pivot collaborators',
  'Market repositioning: adjust positioning based on evidence',
];
```

When entropy hits, you can do these things without abandoning the mission.

#### Step 6: Define Forbidden Tradeoffs

```ts
const forbiddenTradeoffs = [
  'Abandoning the company vision: cannot give up on company-building',
  'Permanent income focus: cannot treat a job as the mission',
  'Delegating core decisions: cannot outsource judgment on major strategy',
  'Sacrificing execution quality: cannot accept permanent mediocrity',
  'Losing ownership entirely: cannot surrender majority ownership',
  'Abandoning creative control: cannot let others drive product strategy',
];
```

These are your red lines. Crossing one is a mission change.

#### Step 7: Create the Contract

```ts
import { createCoreMissionContract } from './domain/core/CoreMissionContractFactory';

const missionContract = createCoreMissionContract({
  profileId: userProfile.id,
  durableObjective,
  magnitudeTarget: '3.5B long-horizon outcome',
  horizonYears: 10,
  currentPhase: 'Second half of original 10-year arc / next five-year execution phase',
  strategicThesis,
  nonNegotiables,
  allowedTradeoffs,
  forbiddenTradeoffs,
  activeCampaignIds: activeCampaigns.map(c => c.id),
  campaignRegistry: activeCampaigns,
  continuitySignals: [],
  derailmentSignals: [],
  masterPlanIds: [masterPlan.id], // Reference to your 5-year plan
});
```

### Step 8: Define Continuity Signals

These answer: "Is the user still moving toward the objective?"

```ts
const continuitySignals = [
  {
    name: 'Revenue growth',
    measurementApproach: 'Monthly tracked revenue across campaigns',
    target: '15% QoQ growth',
    currentState: '8% QoQ (tracking)',
  },
  {
    name: 'Ownership maintained',
    measurementApproach: 'Equity % in company',
    target: '>50% ownership',
    currentState: '52% (secure)',
  },
  {
    name: 'Brand legitimacy',
    measurementApproach: 'Major publications, awards, industry recognition',
    target: '+2 major legitimacy signals per quarter',
    currentState: '+1 this quarter (below target)',
  },
  {
    name: 'Campaign maturity',
    measurementApproach: 'Number of campaigns reaching product-market fit',
    target: '2-3 campaigns scaling',
    currentState: '1 mature (album), 2 early-stage (app, podcast)',
  },
  {
    name: 'Execution discipline',
    measurementApproach: 'Plan completion rate',
    target: '>70% block completion',
    currentState: '65% (slightly below)',
  },
];

missionContract.continuitySignals = continuitySignals;
```

### Step 9: Define Derailment Signals

These warn: "The mission might be endangered."

```ts
const derailmentSignals = [
  {
    name: 'Mission abandonment',
    triggerCondition: 'User explicitly states intent to abandon company-building',
    currentSeverity: 'none',
    mitigationAction: 'Immediate mission review conversation',
  },
  {
    name: 'Founder fatigue',
    triggerCondition: '>6 weeks with no progress on primary campaign + low morale',
    currentSeverity: 'low',
    mitigationAction: 'Reduce scope, rebuild momentum, take break',
  },
  {
    name: 'Ownership dilution',
    triggerCondition: '<45% ownership after fundraising round',
    currentSeverity: 'medium',
    mitigationAction: 'Re-evaluate cap table strategy or fundraising approach',
  },
  {
    name: 'Campaign confusion',
    triggerCondition: '>5 campaigns active, <20% time on top priority',
    currentSeverity: 'medium',
    mitigationAction: 'Focus strategy: pause 2-3 campaigns, concentrate effort',
  },
  {
    name: 'Financial collapse',
    triggerCondition: '<2 weeks runway, no income plan',
    currentSeverity: 'high',
    mitigationAction: 'Activate income/job search campaign immediately',
  },
];

missionContract.derailmentSignals = derailmentSignals;
```

### Step 10: Store in Backend

```ts
// POST /api/missions/
const response = await fetch('/api/missions/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(missionContract),
});

const saved = await response.json();
const missionId = saved.missionId; // mission-<uuid>
```

## Integration with MasterPlan

Your existing 5-year MasterPlan should now reference this CoreMissionContract:

```ts
const masterPlan = {
  id: 'masterplan-<uuid>',
  title: 'Five-Year Company Build (2026-2031)',
  coreMissionContractId: missionId, // NEW: Link to mission
  
  // Existing fields...
  horizonYears: 5,
  northStarOutcome: 'Build and scale Jericho into a major company',
  
  // The campaigns in this plan map to mission campaigns:
  lanes: [
    {
      title: 'Album campaign',
      domain: 'creative',
      linkedMissionCampaignId: 'album-campaign', // NEW: Map to mission
    },
    {
      title: 'Jericho app campaign',
      domain: 'product',
      linkedMissionCampaignId: 'jericho-app-campaign',
    },
    // ... etc
  ],
};
```

When you view the MasterPlan:
- It shows which mission it serves
- It explains how each lane contributes to mission campaigns
- It can assess whether it's still aligned with the durable objective

## When Entropy Hits

### Example: Income Pressure Forces Job Search

```ts
import { recordEntropyEvent, pauseCampaign, validateTradeoff } from './domain/core/CoreMissionContractFactory';

// Entropy event: Income depleted after 3 months
const updated = recordEntropyEvent(missionContract, {
  category: 'money-pressure',
  description: 'Runway depleted to 4 weeks. Income campaign is insufficient.',
  impactedCampaignIds: ['jericho-app-campaign'], // Will pause app work
  correctionApplied: 'Activate job search campaign for 6-12 months. Reduce app scope.',
  continuityPreserved: true, // Mission unchanged: we're still building company
});

// Check if job search violates tradeoff rules
const tradeoffCheck = validateTradeoff(updated, 'Temporary income security: take a job if needed');
if (tradeoffCheck.valid) {
  console.log('✓ Job search is allowed. Mission continuity preserved.');
  
  // Resume job search campaign
  updated = pauseCampaign(updated, 'jericho-app-campaign');
  updated.campaignRegistry.find(c => c.id === 'job-search-campaign').status = 'active';
}

// Save updated contract
// PATCH /api/missions/{missionId}
```

The system now knows:
- Why the route changed (entropy event)
- What correction was made (pause app, activate job search)
- Whether the mission survived (yes, continuity preserved)

### Example: App Campaign Fails

```ts
import { recordRevision, killCampaign } from './domain/core/CoreMissionContractFactory';

// After 12 months, app market fit not found
const updated = killCampaign(
  missionContract,
  'jericho-app-campaign',
  `Market fit not found after 12 months. Insufficient demand. 
   Pivoting capital and attention to podcast + album campaigns.`
);

// This creates a revision event showing:
// - What changed: app campaign killed
// - Why: market fit failed
// - What stayed constant: durable objective, strategic thesis, ownership
// - Is mission still valid? Yes—we're pursuing company via different route
```

Five years later, the revision history shows:
```
2026: Started app campaign
2027: Killed app campaign (market fit failed)
2027: Focused on podcast + album instead
2028: Podcast grew audience, album generated revenue
2029: Revenue enabled new capital
2030: Company reached $5M ARR

What stayed constant: "Build a major company through talent, creativity, and systems."
```

## Detection Rules

### When a Schedule Slip Triggers Mission Review

**Not automatic**. The system should prompt:

```ts
// Block delayed by 2 weeks
if (block.delayDays > 14 && block.delayDays % 7 === 0) {
  // Check if it's affecting core metrics
  const contributingToMissionSignal = missionContract.continuitySignals
    .some(s => s.name === block.linkedSignalName);
  
  if (contributingToMissionSignal) {
    // Prompt user: "This delay affects continuity signal X. 
    // Consider route adjustment or updating timeline."
  }
}
```

### When a Campaign Stalls

```ts
// Campaign has been in progress for >50% of planned duration 
// with <25% completion
if (campaignProgress < 25 && elapsedDaysRatio > 0.5) {
  const assessment = {
    issue: 'Campaign stall detected',
    campaign: campaign.name,
    suggestion: 'Review: Is this campaign still viable? Can it be pivoted, paused, or killed?',
  };
  
  // Prompt user to make explicit decision
  // This creates revision history for future reference
}
```

### When Derailment Signals Hit Medium+

```ts
if (signal.currentSeverity === 'medium' || signal.currentSeverity === 'high') {
  // Require explicit user decision within the week
  // Options: acknowledge, mitigate, escalate, ignore
  // Whatever choice is recorded in revision history
}
```

## API Schema (Backend Updates)

### MasterPlan Schema Addition

```sql
ALTER TABLE master_plans ADD COLUMN core_mission_contract_id VARCHAR;
ALTER TABLE master_plans ADD FOREIGN KEY (core_mission_contract_id) 
  REFERENCES core_mission_contracts(mission_id);
```

### MasterPlanLane Schema Addition

```sql
ALTER TABLE master_plan_lanes ADD COLUMN linked_mission_campaign_id VARCHAR;
-- This maps a lane to a mission campaign
-- Enables showing how execution serves the durable objective
```

### User Schema Addition

```sql
ALTER TABLE users ADD COLUMN active_core_mission_id VARCHAR;
-- Reference to the user's primary active mission
```

## UI Components Needed

### 1. Mission Dashboard

```ts
interface MissionDashboard {
  // The immutable core
  durableObjective: string; // Display, not editable
  magnitudeTarget: string;
  horizonYears: number;

  // The current state
  continuityStatus: CoreContinuityStatus; // Visual indicator: 🟢 aligned, 🟡 strained, 🟠 drifting, 🔴 endangered
  continuityStatusRationale: string;

  // The thesis (editable with versioning)
  strategicThesis: string;
  editThesisButton: boolean;

  // The current execution
  activeCampaigns: CampaignReference[]; // Editable: pause/kill
  campaignsViewAllButton: boolean;

  // The recent history
  recentEntropyEvents: EntropyEvent[]; // Last 5
  recentRevisions: RevisionEvent[]; // Last 3

  // The signals
  continuitySignalsSection: {
    signals: ContinuitySignal[];
    overallHealth: 'green' | 'yellow' | 'orange' | 'red';
  };

  derailmentSignalsSection: {
    signals: DerailmentSignal[];
    criticalAlerts: DerailmentSignal[];
  };
}
```

### 2. Campaign Manager

```ts
interface CampaignManager {
  list: CampaignReference[];
  activeCount: number;
  pausedCount: number;

  actions: {
    addCampaign(): void; // Add new campaign
    editCampaign(id: string): void; // Edit name/description
    pauseCampaign(id: string): void; // Pause, record entropy if needed
    resumeCampaign(id: string): void;
    killCampaign(id: string): void; // Requires rationale
  };
}
```

### 3. Entropy Event Recorder

When a plan change happens, prompt:

```ts
interface EntropyPrompt {
  title: 'Plan Change Detected';
  description: 'What changed?';

  fields: {
    category: 'job-loss' | 'money-pressure' | ... ;
    description: string;
    impactedCampaigns: string[]; // Multi-select
    correctionApplied: string;
    continuitySurvived: boolean; // "Did the mission survive?"
  };

  actions: {
    save: () => void;
    skip: () => void; // Only if not affecting core signals
  };
}
```

### 4. Revision History Viewer

```ts
interface RevisionHistoryViewer {
  timeline: RevisionEvent[]; // Chronological
  filters: {
    byType: 'objective-update' | 'thesis-refinement' | ...;
    byDateRange: [Date, Date];
  };

  display: {
    timestamp: string;
    revisionType: string;
    description: string;
    rationale: string;
    continuousElements: string[];
    diffViewer: boolean; // Show before/after
  };
}
```

## Summary: The Integration

1. **Create** a CoreMissionContract for your 10-year mission
2. **Link** your 5-year MasterPlan to that contract
3. **Map** each lane in the plan to a mission campaign
4. **Preserve** the mission across entropy events (income pressure, delays, pivots)
5. **Track** continuity signals (revenue, ownership, brand, execution)
6. **Alert** on derailment signals (fatigue, confusion, focus loss)
7. **Record** revision history (why routes changed, what stayed constant)
8. **Review** annually: Is the mission still achievable? Is the thesis still valid?

**Result**: Five years later, you can show: *"The company goal never changed. Here's how we adapted the route 15 times through entropy and stayed on mission."*

That is continuity infrastructure.
