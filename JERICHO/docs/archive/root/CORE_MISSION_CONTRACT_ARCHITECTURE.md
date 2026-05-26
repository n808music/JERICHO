# CORE MISSION CONTRACT ARCHITECTURE

## Overview

The Core Mission Contract establishes **mission continuity above changing plans**.

This is JERICHO's fifth-year architectural layer that enables one critical insight:

```
Plan changes ≠ goal changed
Plan changes = route correction toward the same objective
```

This separates JERICHO from ordinary productivity software. The system no longer assumes that tactical shifts mean strategic failure. Instead, it preserves the durable objective while adapting the execution route under entropy.

## Problem Statement

A five-year company-building plan is not a static schedule. It is the current execution phase of a longer durable mission (potentially 10+ years).

Over that time:
- The core objective should remain stable
- The route changes repeatedly (entropy: job loss, money pressure, platform shifts, relocation, unexpected costs)
- Campaigns may be added, paused, merged, or killed
- Cycles and blocks are constantly rewritten
- Income security, crisis response, and tactical pivots can occur without abandoning the mission

**Without CoreMissionContract**, the system cannot distinguish:
- A missed task (local problem)
- A failed campaign (strategic problem)
- A broken mission trajectory (existential problem)

With it, JERICHO can answer: **"Despite entropy, is the user still moving toward the durable objective?"**

## The Hierarchy: What Changes and What Doesn't

```
Core Objective          ← Most durable (rarely changes)
    ↓
Strategic Thesis        ← Evolves but not weekly
    ↓
Active Campaigns        ← Can be added/paused/merged/killed
    ↓
Execution Cycles        ← Time-bounded, rewritable
    ↓
Blocks (tasks/weeks)    ← Individual work units, disposable
```

**Doctrine**: Protect the core. Question the thesis. Adjust the campaign. Rewrite the cycle. Move the block.

## Core Components

### 1. Durable Objective

The thing that does not change easily.

Example:
```
"Scale the company into a major cultural/business force through talent, 
creative output, software infrastructure, brand-building, and execution discipline."
```

**Immutability**: Should only change if the fundamental mission changes (rare).

**Magnitude Target**: A long-horizon numerical aspiration (e.g., "3.5B outcome").

**Horizon**: The time span of the mission (e.g., 10 years).

### 2. Strategic Thesis

The theory for *how* the durable objective becomes real.

Example:
```
"Use talent, creative output, software, media, brand-building, project-management capability, 
and execution infrastructure to compound legitimacy, audience, revenue, and ownership."
```

**Durability**: Medium. Can evolve as understanding improves, but should not change every week.

**Triggers for revision**: 
- New market evidence (e.g., "streaming model doesn't work, pivot to direct sales")
- Capability discovery (e.g., "AI leverage enables faster iteration")
- Partner outcomes (e.g., "key collaborator no longer available")

### 3. Active Campaigns

Current routes being pursued toward the objective.

Examples:
- Album / label campaign
- Jericho app campaign (software proof-of-concept)
- Podcast campaign (attention engine)
- PM brand campaign (legitimacy and audience)
- Income / runway campaign (financial support)
- Job search / security campaign (short-term stability)

**Properties**:
- Can be added without changing the mission
- Can be paused or merged without killing the mission
- Can be killed without abandoning the objective
- Each contributes to the durable objective in a specific way

**Tracking**: Each campaign has:
- Unique ID
- Name and contribution description
- Status (active|paused|merged|killed)
- Start/end dates
- Lifecycle history

### 4. Execution Cycles

Time-bounded attacks on the current campaigns.

Examples:
- "Oct 17 album launch cycle"
- "Q4 app beta readiness cycle"
- "Month 2 job search pipeline cycle"

**Durability**: Low. Cycles are disposable compared to the core goal. They exist to serve the mission.

### 5. Entropy Events

Challenges that test mission continuity.

Categories:
```
job loss            → income pressure spike
money pressure      → must reduce scope or find income
moving cities       → logistics disruption
technical delay     → platform constraint
bad partners        → collaboration failure
fatigue             → capacity limitation
missed timing       → market window closed
platform friction   → tools/infrastructure issue
unexpected cost     → financial shock
confidence loss     → psychological crisis
attention fragmentation → context switching
wrong order of operations → sequencing error
```

**Key question**: When entropy hits, does the system abandon the mission or correct the route?

**Tracking**: Each entropy event records:
- What happened (category, description)
- Which campaigns were affected
- What correction was applied
- Whether continuity was preserved (boolean)

Over time, the revision history shows: *"We stayed on mission through 7 entropy events by adjusting the route."*

## Non-Negotiables vs. Allowed vs. Forbidden Tradeoffs

### Non-Negotiables

Values/commitments that cannot be traded away.

Examples:
- Ownership (cannot give away majority ownership)
- Creative control (cannot surrender creative direction)
- Execution discipline (cannot accept mediocre execution)
- Company-building mentality (cannot treat as side project)
- Long-term compounding (cannot sacrifice future for present)

These are the boundaries of what it means to pursue this mission.

### Allowed Tradeoffs

What can flex when entropy hits.

Examples:
- Route changes (change which campaigns are active)
- Campaign changes (merge, pause, or pivot campaigns)
- Timing adjustments (slip deadlines with new plan)
- Scope reduction (do less now, more later)
- Tactical pivots (change how a campaign executes)
- Temporary income security (take a job if needed)
- Resource reallocation (shift people/money between campaigns)

These are the safety valves. When entropy hits, tradeoffs protect continuity.

### Forbidden Tradeoffs

Lines that must never be crossed.

Examples:
- Abandoning the company vision (cannot give up on company-building)
- Confusing income security with mission (a job is support, not the goal)
- Delegating core decisions (cannot outsource judgment)
- Sacrificing execution quality forever (can delay, not permanently reduce)
- Losing ownership entirely (can dilute, not surrender)

These are the non-negotiables' enforcement. Crossing them means mission change.

## Continuity Signals

Metrics that indicate the user is still moving toward the durable objective.

**Why**: "Did we finish every task?" is not the right question. "Is the user still aligned with the durable objective?" is.

Examples:

| Signal | Measurement | Target | Current |
|--------|-------------|--------|---------|
| Revenue growth | Monthly tracked | 15% QoQ | 8% |
| Ownership increase | % ownership maintained | >50% | 52% |
| Brand legitimacy | Awards/press/reach | +2 major signals/quarter | +1 |
| Company momentum | Campaign maturity | 2-3 campaigns scaling | 1 mature, 2 scaling |
| Execution discipline | Plan completion rate | >70% | 65% |

These are the heartbeat of the mission. If continuity signals are green, the mission is healthy even if individual cycles slip.

## Derailment Signals

Warnings that the core mission may be endangered.

Examples:

| Signal | Trigger | Current Severity | Action |
|--------|---------|------------------|--------|
| Mission abandonment | User states intent to abandon company | Critical | Review mission thesis immediately |
| Founder fatigue | >6 weeks no progress + low morale | High | Reduce scope, rebuild momentum |
| Core contradiction | Active tradeoff contradicts non-negotiables | Critical | Resolve immediately |
| Ownership dilution | <25% ownership after round | High | Reconsider cap table strategy |
| Attention fragmentation | >5 active campaigns, <20% time on top priority | Medium | Pause non-essential campaigns |
| Financial collapse | <2 weeks runway, no income plan | Critical | Activate income campaign immediately |

**Severity levels**:
- None: No concern
- Low: Monitor, may require future adjustment
- Medium: Requires attention within weeks
- High: Requires significant action within days
- Critical: Immediate intervention required

## Core Continuity Status

The system assesses mission health: **aligned | strained | drifting | endangered**

### Aligned
- On course toward the durable objective
- Continuity signals are green
- Derailment signals are none/low
- Recent entropy has been corrected
- Plan is tracking to thesis

**Action**: Continue execution. Review annually.

### Strained
- Facing entropy but still pursuing mission
- Recent disruptions but corrected
- Some continuity signals yellow
- One or two medium derailment signals
- Campaigns are adapting

**Action**: Monitor closely. Increase review frequency. Prepare contingency plans.

### Drifting
- Significant deviation from strategic thesis
- Multiple campaigns stalled or off-track
- High derailment signals active
- Continuity signals degrading
- Risk of mission entropy accumulation

**Action**: Strategic review required. Consider thesis refinement or campaign restructuring.

### Endangered
- Risk of mission abandonment
- Critical derailment signals (ownership loss, core contradiction, financial collapse)
- Non-negotiable being breached
- Continuity signals failing
- Allowed tradeoffs being exhausted

**Action**: Immediate mission reset or explicit decision to change mission.

## Revision History

The system maintains an immutable audit trail of mission evolution.

Each revision records:
1. **When**: Timestamp
2. **What**: Description of the change
3. **Why**: Rationale (what entropy forced this?)
4. **Type**: objective-update | thesis-refinement | campaign-adjustment | tradeoff-decision
5. **What stayed constant**: Which elements remained unchanged
6. **Previous state**: Snapshot before change

This creates the historical narrative: 

*"The company goal did not change. The route changed because of income pressure, relocation, tooling changes, partner failure, and new AI leverage. The active strategy shifted from BAN to Global State/Jericho, but the core objective remained intact."*

## Implementation Rules

### Rule 1: Multi-Year Plans Reference a CoreMissionContract

Any MasterPlan with horizon >2 years or empire-scale scope must reference a CoreMissionContract.

**Validation**: 
```
if (masterPlan.horizonYears >= 2 && masterPlan.scale === 'empire-scale') {
  require(masterPlan.coreMissionContractId != null)
}
```

### Rule 2: Tactical Route Changes Create Revision History

When a campaign changes, cycle moves, or timing adjusts:
- Do NOT erase the durable objective
- DO create a revision event explaining why
- DO record what stayed constant
- DO track entropy that forced the change

### Rule 3: Income/Security Can Be Support Without Replacing Mission

A job search or income campaign can be necessary for financial support without becoming the mission.

**Tracking**:
```ts
{
  id: "job-search-campaign",
  name: "Job search / security campaign",
  contributionDescription: "Provides runway for company focus and reduces financial pressure",
  status: "active",
  purpose: "support" // explicit: this is support, not mission
}
```

When the job ends or income is stable, the campaign can be paused without losing mission continuity.

### Rule 4: Friction Forces Cycle/Campaign Adjustment, Not Mission Drift

When a campaign fails or cycle slips:
- Assess whether it was a local problem (cycle) or strategic problem (campaign)
- Adjust accordingly
- Record entropy event
- Track continuity preservation

**Example**:
```
Entropy: Q3 product launch delayed 6 weeks
Adjustment: Cycle moves from Q3 to Q4
Continuity: Preserved (mission unchanged, route adjusted)
```

vs.

```
Entropy: Product market fit not found after 18 months
Adjustment: Kill product campaign, redirect to different market
Continuity: Preserved (mission unchanged, campaign pivoted)
```

vs.

```
Entropy: Lost all capital and co-founder left
Adjustment: Mission must fundamentally shift
Continuity: Broken (requires new CoreMissionContract or explicit mission reset)
```

### Rule 5: Stability Distinguishes Problem Levels

The system must understand:

| Problem | Scope | Action | Mission Impact |
|---------|-------|--------|----------------|
| Schedule delay | One block/cycle | Reschedule | None |
| Tactical pivot | One campaign | Adjust campaign | None if non-negotiables preserved |
| Campaign failure | One campaign | Kill/merge campaign | Strategic, but not existential if thesis intact |
| Mission drift | Core thesis broken | Review/reset mission | Existential |

## Database Schema

### CoreMissionContract

```sql
CREATE TABLE core_mission_contracts (
  id INT PRIMARY KEY,
  user_id INT NOT NULL,
  mission_id VARCHAR UNIQUE,
  profile_id VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  -- Core objective
  durable_objective TEXT,
  magnitude_target VARCHAR,
  horizon_years INT,
  current_phase VARCHAR,
  
  -- Strategic thesis
  strategic_thesis TEXT,
  
  -- Commitments
  non_negotiables_json TEXT (JSON array),
  allowed_tradeoffs_json TEXT (JSON array),
  forbidden_tradeoffs_json TEXT (JSON array),
  
  -- Campaigns & signals
  active_campaign_ids_json TEXT (JSON array),
  campaign_registry_json TEXT (JSON),
  continuity_signals_json TEXT (JSON),
  derailment_signals_json TEXT (JSON),
  
  -- History
  entropy_events_json TEXT (JSON array),
  revision_history_json TEXT (JSON array),
  
  -- Status
  continuity_status VARCHAR,
  continuity_status_rationale TEXT,
  
  -- Relationships
  master_plan_ids_json TEXT (JSON array),
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### CoreMissionRevisionLog

Immutable audit trail of mission changes.

### EntropyEventLog

Immutable log of chaos events and adaptations.

## API Endpoints

### Create Mission Contract

```
POST /api/missions/
{
  profileId: string
  durableObjective: string
  magnitudeTarget?: string
  horizonYears: number
  currentPhase: string
  strategicThesis: string
  nonNegotiables: string[]
  allowedTradeoffs: string[]
  forbiddenTradeoffs: string[]
}
```

### Get Mission Contract

```
GET /api/missions/{missionId}
```

### Update Thesis (Strategic Refinement)

```
PATCH /api/missions/{missionId}/thesis
{
  newThesis: string
  rationale: string
}
```

### Add Campaign

```
POST /api/missions/{missionId}/campaigns
{
  name: string
  contributionDescription: string
  status: 'active' | 'paused'
}
```

### Record Entropy Event

```
POST /api/missions/{missionId}/entropy
{
  category: string
  description: string
  impactedCampaignIds: string[]
  correctionApplied: string
  continuityPreserved: boolean
}
```

### Update Continuity Status

```
PATCH /api/missions/{missionId}/continuity-status
{
  status: 'aligned' | 'strained' | 'drifting' | 'endangered'
  rationale: string
}
```

## Frontend Integration

### Mission Dashboard

Shows:
- Durable objective (immutable display)
- Strategic thesis (editable with revision tracking)
- Continuity status (with visual indicator: green/yellow/orange/red)
- Active campaigns (add/pause/kill)
- Recent entropy events (with corrections applied)
- Continuity signals (showing progress toward objective)
- Derailment signals (showing risks)
- Revision history (showing mission evolution)

### Master Plan Integration

Each master plan shows:
- Which CoreMissionContract it serves
- How its campaigns map to mission campaigns
- Whether it's still aligned with the durable objective
- Continuity status

### Block/Cycle View

When executing:
- Show which campaign/mission this block serves
- Show continuity signals it contributes to
- If a block is delayed, explain whether it's a local delay or campaign impact

## User Experience

### For the User

The system no longer asks: *"Did you finish your plan?"*

It asks: *"Are you still moving toward your durable objective, despite entropy?"*

When a job search becomes necessary:
- It's recorded as an income campaign
- It's tracked separately from the mission
- It can be paused without losing mission continuity

When a campaign fails:
- It's recorded in the revision history
- The reason (entropy event) is preserved
- The mission itself is questioned only if non-negotiables are breached

When entropy hits:
- The system records the event
- Tracks whether continuity was preserved
- Shows the user: *"You adapted the route but stayed on mission"*

Five years later:
- The system can show: *"The core objective never changed. Here are the 12 entropy events, 4 campaign shifts, 27 route corrections, and why you're still building the same company."*

That is continuity infrastructure.

## Next Steps

1. **Create CoreMissionContract TypeScript model** ✓
2. **Create backend SQLAlchemy model** ✓
3. **Create API endpoints** (FastAPI)
4. **Create mission dashboard UI** (React)
5. **Integrate with existing MasterPlan** (update schema to reference mission)
6. **Create mission guidance flow** (onboarding)
7. **Add continuity status assessment** (automated + user-driven)
8. **Create entropy event recording UI** (when plans change)
9. **Build revision history viewer** (narrative of mission evolution)
10. **Test with user's actual missions** (album campaign, app campaign, income security)

---

**Summary**: 

CoreMissionContract protects the durable objective while adapting the route. It is JERICHO's fifth-year layer that enables mission continuity under entropy.

The key sentence: *"Jericho should protect mission continuity while adapting the route under entropy."*
