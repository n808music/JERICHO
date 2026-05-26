# CORE MISSION CONTRACT: FILE INDEX & ARCHITECTURE MAP

## Quick Navigation

### 30-Second Version
→ Read: [CORE_MISSION_CONTRACT_DELIVERY.md](CORE_MISSION_CONTRACT_DELIVERY.md)

### 5-Minute Version
→ Read: [CORE_MISSION_CONTRACT_IMPLEMENTATION_SUMMARY.md](CORE_MISSION_CONTRACT_IMPLEMENTATION_SUMMARY.md)

### 30-Minute Version (Deep Dive)
→ Read: [CORE_MISSION_CONTRACT_ARCHITECTURE.md](CORE_MISSION_CONTRACT_ARCHITECTURE.md)

### Decision Framework
→ Read: [JERICHO_CONTINUITY_DOCTRINE.md](JERICHO_CONTINUITY_DOCTRINE.md)

### Step-by-Step Implementation
→ Read: [CORE_MISSION_CONTRACT_INTEGRATION_GUIDE.md](CORE_MISSION_CONTRACT_INTEGRATION_GUIDE.md)

---

## Architecture Map

```
┌─────────────────────────────────────────────────────────┐
│                   JERICHO SYSTEM                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │   CORE MISSION CONTRACT (New Layer)                │ │
│  │                                                    │ │
│  │  • Durable Objective (10-year)                   │ │
│  │  • Strategic Thesis                              │ │
│  │  • Active Campaigns                              │ │
│  │  • Non-Negotiables / Allowed / Forbidden         │ │
│  │  • Continuity Signals                            │ │
│  │  • Derailment Signals                            │ │
│  │  • Entropy Events (chaos log)                    │ │
│  │  • Revision History (mission evolution)          │ │
│  └────────────────────────────────────────────────────┘ │
│                         ▲                                 │
│                         │ references                      │
│                         │                                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │   MASTER PLAN (5-year)                            │ │
│  │                                                    │ │
│  │  • coreMissionContractId (new field)              │ │
│  │  • Lanes (map to mission campaigns)               │ │
│  │  • Milestones                                     │ │
│  │  • Requirements                                   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
JERICHO/
├── src/
│   ├── domain/
│   │   └── core/
│   │       ├── CoreMissionContract.ts                [Types & Validation]
│   │       ├── CoreMissionContractFactory.ts         [Operations]
│   │       └── CoreMissionContractFactory.test.ts    [Tests]
│   │
│   └── (existing domain structure)
│       ├── masterPlan/
│       ├── goal/
│       └── ...
│
├── backend/
│   └── app/
│       └── models/
│           ├── core_mission_contract.py    [Backend Models]
│           ├── master_plan.py              [Existing]
│           └── ...
│
├── CORE_MISSION_CONTRACT_DELIVERY.md           [This delivery summary]
├── CORE_MISSION_CONTRACT_ARCHITECTURE.md       [Technical spec]
├── CORE_MISSION_CONTRACT_INTEGRATION_GUIDE.md  [Step-by-step]
├── CORE_MISSION_CONTRACT_IMPLEMENTATION_SUMMARY.md [Quick ref]
├── JERICHO_CONTINUITY_DOCTRINE.md              [Philosophy]
└── (this file)
```

## Data Flow

### Creating a Mission

```
User input
    ↓
createCoreMissionContract()
    ↓
Validation (validateCoreMissionContract)
    ↓
Return CoreMissionContract object
    ↓
POST /api/missions/
    ↓
Backend stores in database
    ↓
Mission dashboard shows status
```

### Recording Entropy

```
Plan changes (delay, pivot, campaign shift)
    ↓
recordEntropyEvent()
    ↓
Track: what happened, what adjusted, continuity preserved?
    ↓
PATCH /api/missions/{id}/entropy
    ↓
Backend updates EntropyEventLog
    ↓
Continuity status auto-assessed
    ↓
Dashboard shows mission health: aligned|strained|drifting|endangered
```

### Recording Revision

```
Strategic change (thesis update, campaign adjustment)
    ↓
recordRevision()
    ↓
Track: what changed, why, what stayed constant
    ↓
PATCH /api/missions/{id}/
    ↓
Backend updates CoreMissionRevisionLog
    ↓
Revision history grows
    ↓
Dashboard shows mission evolution over time
```

## Core Concepts Hierarchy

```
                    DURABLE OBJECTIVE
                    (10-year mission)
                            │
                            │
                            ▼
                    STRATEGIC THESIS
                    (how we get there)
                            │
                            │
                            ▼
                    ACTIVE CAMPAIGNS
                    (current routes)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
    Album          Jericho App            Podcast
    Campaign       Campaign                Campaign
        │                   │                   │
        │                   │                   │
        ├───────────────────┼───────────────────┤
        │                   │                   │
        ▼                   ▼                   ▼
    Execution Cycles
    (Q3 launch)     (Beta readiness)    (Launch prep)
        │                   │                   │
        │                   │                   │
        ▼                   ▼                   ▼
    Weekly Blocks / Daily Tasks
```

## Type System Structure

```
CoreMissionContract
├── Core Fields
│   ├── missionId (string)
│   ├── profileId (string)
│   ├── createdAt / updatedAt (timestamps)
│   └── continuityStatus (aligned|strained|drifting|endangered)
│
├── Objective Layer
│   ├── durableObjective (string)
│   ├── magnitudeTarget (string)
│   ├── horizonYears (number)
│   └── currentPhase (string)
│
├── Thesis Layer
│   ├── strategicThesis (string)
│   └── revisionHistory: RevisionEvent[]
│
├── Campaign Layer
│   ├── activeCampaignIds: string[]
│   └── campaignRegistry: CampaignReference[]
│       └── CampaignReference
│           ├── id, name
│           ├── contributionDescription
│           ├── status (active|paused|merged|killed)
│           └── startedAt / endedAt
│
├── Signals Layer
│   ├── continuitySignals: ContinuitySignal[]
│   │   └── ContinuitySignal
│   │       ├── name, measurementApproach
│   │       ├── target
│   │       └── currentState
│   │
│   └── derailmentSignals: DerailmentSignal[]
│       └── DerailmentSignal
│           ├── name, triggerCondition
│           ├── currentSeverity (none|low|medium|high|critical)
│           └── mitigationAction
│
├── History Layers
│   ├── entropyEvents: EntropyEvent[]
│   │   └── EntropyEvent
│   │       ├── timestamp, category
│   │       ├── description, impactedCampaignIds
│   │       ├── correctionApplied
│   │       └── continuityPreserved (boolean)
│   │
│   └── revisionHistory: RevisionEvent[]
│       └── RevisionEvent
│           ├── timestamp, revisionType
│           ├── description, rationale
│           ├── continuousElements[]
│           └── previousState
│
└── Relationships
    └── masterPlanIds: string[]
```

## Factory Functions

```
CoreMissionContractFactory
│
├── createCoreMissionContract(inputs)
│   └── Returns: CoreMissionContract with validation
│
├── recordEntropyEvent(contract, event)
│   ├── Adds event to entropyEvents[]
│   ├── Updates continuityStatus
│   └── Returns: Updated contract
│
├── recordRevision(contract, revision)
│   ├── Adds event to revisionHistory[]
│   ├── Updates specified fields
│   ├── Updates continuityStatus
│   └── Returns: Updated contract
│
├── addOrUpdateCampaign(contract, campaign)
│   └── Returns: Contract with campaign added/updated
│
├── pauseCampaign(contract, campaignId)
│   └── Returns: Contract with campaign paused
│
├── killCampaign(contract, campaignId, rationale)
│   ├── Records revision
│   └── Returns: Contract with campaign killed
│
├── validateTradeoff(contract, tradeoff)
│   └── Returns: {valid: boolean, reason?: string}
│
├── validateNonNegotiable(contract, decision)
│   └── Returns: {valid: boolean}
│
└── generateContinuityStatusRationale(contract)
    └── Returns: String explanation of current status
```

## Backend Models

```
CoreMissionContract (SQLAlchemy)
├── user_id (FK to User)
├── mission_id (unique string)
├── profile_id (indexed)
├── timestamps
├── Objective fields (durable_objective, magnitude_target, horizon_years, current_phase)
├── Thesis field (strategic_thesis)
├── Commitment JSON fields (non_negotiables_json, allowed_tradeoffs_json, forbidden_tradeoffs_json)
├── Campaign JSON fields (active_campaign_ids_json, campaign_registry_json)
├── Signals JSON fields (continuity_signals_json, derailment_signals_json)
├── History JSON fields (entropy_events_json, revision_history_json)
├── Status fields (continuity_status, continuity_status_rationale)
├── Relationship field (master_plan_ids_json)
└── Relationships (User)

CoreMissionRevisionLog (SQLAlchemy)
├── mission_id (FK, indexed)
├── user_id (FK)
├── timestamp
├── revision_type (objective-update|thesis-refinement|campaign-adjustment|tradeoff-decision)
├── description, rationale
├── continuous_elements_json
└── previous_state_json

EntropyEventLog (SQLAlchemy)
├── mission_id (FK, indexed)
├── user_id (FK)
├── timestamp
├── category (string)
├── description
├── impacted_campaign_ids_json
├── correction_applied
└── continuity_preserved (boolean)
```

## API Endpoints (To Be Implemented)

```
Missions
├── POST /api/missions/                          Create
├── GET /api/missions/{missionId}                Read
├── PATCH /api/missions/{missionId}              Update
├── DELETE /api/missions/{missionId}             Delete
│
├── Thesis
├── PATCH /api/missions/{missionId}/thesis       Update thesis with revision
│
├── Campaigns
├── POST /api/missions/{missionId}/campaigns     Add campaign
├── PATCH /api/missions/{missionId}/campaigns/{campaignId}   Update
├── DELETE /api/missions/{missionId}/campaigns/{campaignId}   Remove
│
├── Entropy & Status
├── POST /api/missions/{missionId}/entropy       Record entropy event
├── PATCH /api/missions/{missionId}/continuity-status   Update status
│
└── History
    ├── GET /api/missions/{missionId}/revision-history     All revisions
    ├── GET /api/missions/{missionId}/entropy-events       All entropy
    └── GET /api/missions/{missionId}/timeline             Combined history
```

## Testing Coverage

```
CoreMissionContractFactory.test.ts
│
├── createCoreMissionContract()
│   ├── ✓ Creates valid contract
│   ├── ✓ Throws on missing fields
│   ├── ✓ Validates tradeoff contradictions
│   └── ✓ Sets default values
│
├── recordEntropyEvent()
│   ├── ✓ Adds event and updates timestamp
│   └── ✓ Changes status when entropy uncontrolled
│
├── recordRevision()
│   ├── ✓ Records thesis refinement
│   └── ✓ Tracks continuous elements
│
├── Campaign management
│   ├── ✓ Adds new campaign
│   ├── ✓ Pauses campaign
│   └── ✓ Kills campaign with revision
│
├── Validation
│   ├── ✓ validateTradeoff (allowed/forbidden)
│   └── ✓ Continuity status rationale
│
└── Assessment
    ├── ✓ Aligned status
    ├── ✓ Strained status
    ├── ✓ Drifting status
    └── ✓ Endangered status
```

## Implementation Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Backend | 2-3 days | Models, migrations, User relationship |
| Phase 2: API | 3-4 days | CRUD endpoints, entropy/revision recording |
| Phase 3: Frontend | 4-5 days | Dashboard, managers, recorders |
| Phase 4: Integration | 2-3 days | Link to MasterPlan, lane mapping |
| Phase 5: Testing | 2-3 days | Unit tests, integration tests, validation |
| Phase 6: Documentation | 1-2 days | Setup guides, examples |
| **Total** | **15-20 days** | **Production-ready system** |

## The Doctrine

```
Protect the core.          ← Defend the durable objective
Question the thesis.       ← Evolve understanding as evidence arrives
Adjust the campaign.       ← Pivot routes actively
Rewrite the cycle.         ← Timebound execution is flexible
Move the block.            ← Individual tasks are disposable

One goal. Many routes.
One objective. Multiple campaigns.
One mission. Countless adjustments.

Entropy is expected.
Adaptation is victory.
Route changes are not goal changes.
```

---

## Document Reading Order

1. **[CORE_MISSION_CONTRACT_DELIVERY.md](CORE_MISSION_CONTRACT_DELIVERY.md)** - Start here (what was built)
2. **[CORE_MISSION_CONTRACT_IMPLEMENTATION_SUMMARY.md](CORE_MISSION_CONTRACT_IMPLEMENTATION_SUMMARY.md)** - Quick reference
3. **[JERICHO_CONTINUITY_DOCTRINE.md](JERICHO_CONTINUITY_DOCTRINE.md)** - Philosophy for decisions
4. **[CORE_MISSION_CONTRACT_ARCHITECTURE.md](CORE_MISSION_CONTRACT_ARCHITECTURE.md)** - Technical deep dive
5. **[CORE_MISSION_CONTRACT_INTEGRATION_GUIDE.md](CORE_MISSION_CONTRACT_INTEGRATION_GUIDE.md)** - Implementation steps
6. **This file** - Architecture reference

---

**Clean summary**: *Jericho protects mission continuity while adapting the route under entropy.*
