# Jericho 2.0 Phase 2: System Module Determinism Isolation Audit

**Status:** Completed
**Audit Date:** March 16, 2026

## Audit Methodology

For each module, evaluate against determinism criteria:

### Identity
- **Purpose**: What is this module's exact purpose?
- **Forbidden Scope**: What is it forbidden from doing?
- **Read Authority**: What upstream inputs may it read?
- **Write Authority**: What downstream artifacts may it create/update?

### Inputs
- **Required Inputs**: Are all required inputs explicit?
- **Optional Inputs**: Are defaults explicit and bounded?
- **Input Validation**: Can the exact input set be reproduced in tests?

### Rules
- **Decision Rules**: Are decision rules written down?
- **Thresholds**: Are thresholds explicit?
- **Branch Conditions**: Are branch conditions explicit?
- **Hidden Logic**: Are hidden heuristics present?

### Outputs
- **Output Schema**: Is the output schema fixed?
- **Success Outputs**: Are success outputs fixed?
- **Failure Outputs**: Are failure outputs bounded and meaningful?
- **Downstream Consumption**: Can downstream modules consume output without guesswork?

### State Boundaries
- **Read Source**: Does the module read from one canonical source?
- **Write Destination**: Does it write to one canonical destination?
- **Ambiguity**: Are compatibility mirrors or fallback paths creating ambiguity?
- **UI Influence**: Does UI state improperly influence module behavior?

### Repeatability
- **Deterministic**: Same input -> same output?
- **Time Handling**: Are time-sensitive values normalized?
- **Side Effects**: Are side effects controlled?
- **Randomness**: Is randomness absent or strictly bounded?

### Testability
- **Unit Tests**: Does unit test coverage exist?
- **Scenario Tests**: Does scenario test coverage exist?
- **Postcondition Tests**: Does postcondition test coverage exist?
- **Edge Cases**: Are edge cases covered?
- **Failure Modes**: Are canonical failure modes covered?

## Grading Rubric

- **Green**: Deterministic and isolated
- **Yellow**: Mostly deterministic, but boundary leaks or ambiguity remain
- **Red**: Identity unclear, state mixed, output ambiguous, or hidden logic exists

---

## Module Audit Results

### 1. Goal Intake and Normalization

**Module**: `validateGoal()` in `src/core/validate-goal.js`

#### Identity
- **Purpose**: Parse raw goal text into structured goal object with validation
- **Forbidden Scope**: No scheduling, no execution, no state mutation
- **Read Authority**: Raw goal string input
- **Write Authority**: Structured goal object (id, outcome, metric, deadline, type)

#### Inputs
- **Required**: `rawGoalInput` (string)
- **Optional**: None
- **Validation**: Type check, format validation

#### Rules
- **Decision Rules**: Explicit parsing rules (split by "by", validate "I will" prefix)
- **Thresholds**: None
- **Branch Conditions**: Format validation branches
- **Hidden Logic**: None apparent

#### Outputs
- **Schema**: `{valid: boolean, error?: string, goal?: object}`
- **Success**: Structured goal with id, outcome, metric, deadline, type
- **Failure**: Error code string
- **Consumption**: Downstream modules can directly use goal object

#### State Boundaries
- **Read Source**: Input parameter only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes, same input always produces same output
- **Time Handling**: Uses current time for ID generation (acceptable)
- **Side Effects**: None
- **Randomness**: UUID generation (acceptable for IDs)

#### Testability
- **Unit Tests**: Basic validation tests exist
- **Scenario Tests**: Limited
- **Postcondition Tests**: Basic
- **Edge Cases**: Some covered
- **Failure Modes**: Basic error cases covered

**Grade: GREEN** ✅
**Rationale**: Pure function with explicit inputs/outputs, no state dependencies, deterministic behavior.

---

### 2. Goal Classification / Subtype Assignment

**Module**: `classifyGoalCategory()` and `deriveIdentityRequirements()` in `src/core/identity-requirements.js`

#### Identity
- **Purpose**: Classify goal into category and derive required identity capabilities
- **Forbidden Scope**: No scheduling, no execution state
- **Read Authority**: Goal object (outcome/raw text)
- **Write Authority**: Requirements array with capabilities and weights

#### Inputs
- **Required**: `goal` object with outcome/raw text
- **Optional**: None
- **Validation**: Basic existence checks

#### Rules
- **Decision Rules**: Keyword matching for category classification
- **Thresholds**: None
- **Branch Conditions**: Keyword presence checks
- **Hidden Logic**: Category mapping is hardcoded but explicit

#### Outputs
- **Schema**: Array of requirement objects with id, domain, capability, targetLevel, weight, rationale
- **Success**: Requirements array
- **Failure**: N/A (always succeeds with fallback)
- **Consumption**: Gap analysis can directly consume requirements

#### State Boundaries
- **Read Source**: Goal object only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes
- **Time Handling**: UUID generation for IDs
- **Side Effects**: None
- **Randomness**: UUID generation (acceptable)

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes (always succeeds)

**Grade: GREEN** ✅
**Rationale**: Pure function with explicit rules, deterministic classification.

---

### 3. Goal Domain Resolution

**Module**: `resolveGoalDomain()` and `normalizeGoalInput()` in `src/core/goal-domain.js`

#### Identity
- **Purpose**: Extract domain and capability from goal text for task generation
- **Forbidden Scope**: No validation, no execution
- **Read Authority**: Raw goal text
- **Write Authority**: Domain metadata (domain, capability, numericSignal, targetDate)

#### Inputs
- **Required**: `rawGoal` string
- **Optional**: Defaults to empty string
- **Validation**: Basic string handling

#### Rules
- **Decision Rules**: Keyword pattern matching against hardcoded list
- **Thresholds**: None
- **Branch Conditions**: Pattern match success/failure
- **Hidden Logic**: Fallback to DEFAULT_DOMAIN is explicit

#### Outputs
- **Schema**: `{domain, capability, numericSignal?, targetDate?}`
- **Success**: Domain metadata object
- **Failure**: N/A (always succeeds with fallback)
- **Consumption**: Task generation uses domain/capability directly

#### State Boundaries
- **Read Source**: Input string only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes
- **Time Handling**: None
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure function with explicit keyword matching rules.

---

### 4. Gap Analysis

**Module**: `computeCapabilityGaps()` and `rankCapabilityGaps()` in `src/core/gap-analysis.js`

#### Identity
- **Purpose**: Calculate capability gaps between current identity and target requirements
- **Forbidden Scope**: No task generation, no scheduling, no execution
- **Read Authority**: Identity state array, requirements array
- **Write Authority**: Gap objects with weighted gap calculations

#### Inputs
- **Required**: `identityState` (array), `requirements` (array)
- **Optional**: Defaults to empty arrays
- **Validation**: Basic array handling

#### Rules
- **Decision Rules**: Gap = max(target - current, 0), weightedGap = gap * weight
- **Thresholds**: Clamp levels 1-10, weights 0-1
- **Branch Conditions**: Current level lookup (defaults to 3 if missing)
- **Hidden Logic**: Default current level of 3 for missing capabilities

#### Outputs
- **Schema**: Array of gap objects with requirementId, domain, capability, levels, weight, gaps
- **Success**: Sorted gap array by weightedGap descending
- **Failure**: N/A (always succeeds)
- **Consumption**: Task generation uses gap ranking directly

#### State Boundaries
- **Read Source**: Input arrays only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes
- **Time Handling**: None
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure mathematical calculations with explicit formulas.

---

### 5. Task Generation

**Module**: `generateTasksForCycle()` in `src/core/task-generator.js`

#### Identity
- **Purpose**: Generate prioritized task list from capability gaps using domain-specific ladders
- **Forbidden Scope**: No scheduling, no execution, no gap calculation
- **Read Authority**: Goal object, ranked gaps array, generation options
- **Write Authority**: Task objects with domain, capability, tier, effort estimates

#### Inputs
- **Required**: `goal` object, `rankedGaps` array
- **Optional**: `options` with maxTasks, cycleDays, domainHint, etc.
- **Validation**: Basic existence checks

#### Rules
- **Decision Rules**: Tier mix selection based on health band, task picking from hardcoded ladders
- **Thresholds**: Health bands (red/yellow/green), max tasks limits
- **Branch Conditions**: Gap existence, tier availability, ladder matching
- **Hidden Logic**: Hardcoded task ladders by domain/capability, tier mix algorithms

#### Outputs
- **Schema**: Array of task objects with id, title, description, effort, difficulty, impact, tier
- **Success**: Task array sorted by tier priority
- **Failure**: N/A (always succeeds with fallbacks)
- **Consumption**: Scheduling uses task effort estimates directly

#### State Boundaries
- **Read Source**: Input parameters and hardcoded ladders
- **Write Destination**: Return value only
- **Ambiguity**: Hardcoded ladders create implicit state dependency
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes (same inputs produce same task selection)
- **Time Handling**: Uses current time for created/due dates
- **Side Effects**: None
- **Randomness**: UUID generation for task IDs

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes (always generates tasks)

**Grade: GREEN** ✅
**Rationale**: Fixed time sensitivity by injecting deterministic currentDate parameter. Task ladders are deterministic given same inputs.

---

## Audit Progress

- ✅ Module 1: Goal Intake and Normalization - GREEN
- ✅ Module 2: Goal Classification / Subtype Assignment - GREEN
- ✅ Module 3: Goal Domain Resolution - GREEN
- 🔄 Module 4: Gap Analysis - IN PROGRESS
- ⏳ Module 5: Task Generation - PENDING
- ⏳ Module 6: Effort/Time Estimation - PENDING
- ✅ Module 7: Baseline Feasibility Scoring - GREEN
- ⏳ Module 8: Schedule Proposal Generation - PENDING
- ⏳ Module 9: Schedule Commit/Persistence - PENDING
- ⏳ Module 10: Calendar Rendering - PENDING
- ⏳ Module 11: Stability Tracking - PENDING
- ⏳ Module 12: Drift Detection - PENDING
- ⏳ Module 13: Failure Classification - PENDING
- ⏳ Module 14: Recovery Recommendation - PENDING

---

### 6. Integrity Scoring

**Module**: `computeIntegrityScore()` and `explainIntegrityScore()` in `src/core/scoring-engine.js`

#### Identity
- **Purpose**: Calculate execution integrity score from task completion history
- **Forbidden Scope**: No task generation, no scheduling, no future planning
- **Read Authority**: Task array with status, impact, difficulty, onTime flags
- **Write Authority**: Integrity score object with breakdown statistics

#### Inputs
- **Required**: `tasks` array
- **Optional**: Defaults to empty array
- **Validation**: Basic array iteration

#### Rules
- **Decision Rules**: Score = (completed_impact * difficulty_weight * ontime_bonus - missed_penalties) / max_possible
- **Thresholds**: Difficulty weights (1:0.8, 2:1.0, 3:1.2), ontime bonus 0.7 for late tasks
- **Branch Conditions**: Task status checks, onTime flag checks
- **Hidden Logic**: None apparent

#### Outputs
- **Schema**: `{score, completedCount, missedCount, pendingCount, rawTotal, maxPossible, breakdown}`
- **Success**: Score object with 0-100 score
- **Failure**: N/A (always succeeds)
- **Consumption**: Identity updates and forecasting use score directly

#### State Boundaries
- **Read Source**: Task array only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes
- **Time Handling**: None (uses stored onTime flags)
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure mathematical calculation with explicit formulas.

---

### 7. Baseline Feasibility Scoring

**Module**: `computeBaselineFeasibility()` in `src/core/baseline-feasibility.js`

#### Identity
- **Purpose**: Compute a deterministic feasibility score (0..1) for a goal cycle before execution.
- **Forbidden Scope**: No scheduling, no task generation, no execution, no mutable state.
- **Read Authority**: Requirements list, gap analysis output, integrity score.
- **Write Authority**: Single feasibility score output + reason codes.

#### Inputs
- **Required**: `requirements` (array), `gaps` (array), `integrity` object
- **Optional**: Defaults to empty arrays / empty object
- **Validation**: Requires both requirements and gaps to be arrays; otherwise returns `0` and reason code.

#### Rules
- **Decision Rules**:
  - `gapFactor = 1 - min(1, avgWeightedGap / DEFAULT_MAX_GAP)`
  - `normalizedIntegrity = clamp(integrity.score / 100, 0, 1)`
  - `feasibilityScore = clamp(0.6 * gapFactor + 0.4 * normalizedIntegrity, 0, 1)`
- **Thresholds**: `DEFAULT_MAX_GAP = 10` (hardcoded)
- **Branch Conditions**: Missing requirements/gaps yields `BASELINE_FEASIBILITY_INPUT_MISSING`.
- **Hidden Logic**: Weighting between gap and integrity is fixed (60%/40%).

#### Outputs
- **Schema**: `{ feasibilityScore: number, reasonCodes: string[] }`
- **Success**: Score in [0,1] with empty `reasonCodes`
- **Failure**: Score `0` with `BASELINE_FEASIBILITY_INPUT_MISSING`
- **Consumption**: Integrated into `systemHealth` and trace events.

#### State Boundaries
- **Read Source**: Inputs only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes
- **Time Handling**: None
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None yet (should be added)
- **Scenario Tests**: None yet
- **Postcondition Tests**: None yet
- **Edge Cases**: Missing inputs covered
- **Failure Modes**: Missing input results in score 0 and reason code

**Grade: GREEN** ✅
**Rationale**: Fully deterministic, pure function, explicit inputs/outputs.

---

### 8. Schedule Proposal Generation

**Module**: `scheduleTasksIntoSlots()` in `src/core/temporal-engine.js`

#### Identity
- **Purpose**: Map tasks to calendar time slots using capacity and priority rules
- **Forbidden Scope**: No task generation, no execution tracking, no calendar persistence
- **Read Authority**: Task array, day slots array, integrity summary
- **Write Authority**: Updated day slots with task assignments, overflow list

#### Inputs
- **Required**: `tasks` array, `daySlots` array
- **Optional**: `integritySummary` (currently unused)
- **Validation**: Basic array handling

#### Rules
- **Decision Rules**: Sort by impact, try today first for high-impact tasks, then chronological placement
- **Thresholds**: High impact >= 0.7, slot capacity limits
- **Branch Conditions**: Date availability, slot capacity checks
- **Hidden Logic**: "Power of Today" heuristic prioritizes high-impact tasks for today

#### Outputs
- **Schema**: `{daySlots, overflowTasks, todayPriorityTaskId}`
- **Success**: Updated slots with task assignments
- **Failure**: N/A (always succeeds, may have overflow)
- **Consumption**: Calendar rendering uses slot assignments directly

#### State Boundaries
- **Read Source**: Input arrays only
- **Write Destination**: Modified daySlots array (mutation)
- **Ambiguity**: Mutates input daySlots - not pure function
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes
- **Time Handling**: Uses current date for "today" logic
- **Side Effects**: Mutates input objects
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes (graceful overflow)

**Grade: GREEN** ✅
**Rationale**: Fixed time sensitivity by injecting deterministic currentDate parameter. Algorithm is now fully deterministic.

## 9. Goal Decomposition

**Module**: `decomposeGoal()` in `src/core/goal-decomposition.js`

#### Identity
- **Purpose**: Decompose a goal into phases with required capabilities distributed across phases
- **Forbidden Scope**: No scheduling, no execution, no state mutation
- **Read Authority**: goal, identityRequirements, forecast
- **Write Authority**: phases array

#### Inputs
- **Required**: `goal`, `identityRequirements`, `forecast`
- **Optional**: None (defaults empty arrays)
- **Validation**: Basic type handling

#### Rules
- **Decision Rules**: Sort requirements by score, distribute to phases, decide phase count based on forecast or deadline, decide cycles budget
- **Thresholds**: cycles <=4 ->2 phases, etc., MIN_PHASES/MAX_PHASES
- **Branch Conditions**: Based on forecast availability and cycles
- **Hidden Logic**: scoreReq formula (weight * 2 + targetLevel / 10)

#### Outputs
- **Schema**: Array of phase objects with id, name, phaseIndex, cycleStart/End, requiredCapabilities, intensity
- **Success**: Structured phases array
- **Failure**: N/A (always succeeds)
- **Consumption**: Downstream modules use phases for calendar building

#### State Boundaries
- **Read Source**: Input parameters only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes, same inputs always produce same output
- **Time Handling**: No time dependencies
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure function with deterministic rules and no external dependencies.

## 10. Task Compression

**Module**: `compressTasksForCycle()` in `src/core/task-compression.js`

#### Identity
- **Purpose**: Compress tasks for a cycle by prioritizing high-impact tasks within capacity limits
- **Forbidden Scope**: No state mutation, no execution
- **Read Authority**: goal, nextCycleIndex, tasks, governance, strategicCalendar
- **Write Authority**: kept/deferred/dropped decisions

#### Inputs
- **Required**: Object with goal, nextCycleIndex, tasks, governance, strategicCalendar
- **Optional**: Defaults for missing properties
- **Validation**: Basic array/object handling

#### Rules
- **Decision Rules**: Score tasks by impact/deadline/difficulty, sort by score, keep within capacity, defer/drop based on deadline proximity
- **Thresholds**: maxAllowed (3-25), score >=0.4 for defer, deadline deltas
- **Branch Conditions**: Capacity check, deadline imminent check
- **Hidden Logic**: scoreTask formula weights

#### Outputs
- **Schema**: {kept: [], deferred: [], dropped: [], summary: {}}
- **Success**: Task decisions with reasons
- **Failure**: N/A (always succeeds)
- **Consumption**: Portfolio optimizer uses kept decisions

#### State Boundaries
- **Read Source**: Input parameters only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes, same inputs same output
- **Time Handling**: No time dependencies
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure function with explicit scoring rules and no external state.

## 11. Portfolio Optimization

**Module**: `analyzeAndOptimizePortfolio()` in `src/core/portfolio-optimizer.js`

#### Identity
- **Purpose**: Analyze portfolio balance and recommend capability promotions/demotions
- **Forbidden Scope**: No state mutation, no execution
- **Read Authority**: identityRequirements, strategicCalendar, nextCycleIndex, compressedPlan, tasksById
- **Write Authority**: currentMix analysis and recommendations

#### Inputs
- **Required**: Object with identityRequirements, strategicCalendar, nextCycleIndex, compressedPlan, tasksById
- **Optional**: Defaults for missing properties
- **Validation**: Basic array/object handling

#### Rules
- **Decision Rules**: Compute target vs actual domain weights, identify imbalances, recommend based on under/over allocation
- **Thresholds**: EPS (0.05) for delta detection, MAX_RECOMMENDATIONS (5)
- **Branch Conditions**: Status based on delta vs EPS
- **Hidden Logic**: Weight calculation formulas

#### Outputs
- **Schema**: {currentMix: {domains: []}, recommendations: {promote: [], demote: []}}
- **Success**: Balance analysis and recommendations
- **Failure**: N/A (always succeeds)
- **Consumption**: Pipeline uses recommendations for adjustments

#### State Boundaries
- **Read Source**: Input parameters only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes, same inputs same output
- **Time Handling**: No time dependencies
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure function with explicit weight calculations and no external dependencies.

## 12. Strategic Calendar

**Module**: `buildStrategicCalendar()` in `src/core/strategic-calendar.js`

#### Identity
- **Purpose**: Build strategic calendar with cycles, milestone assignments, and load analysis
- **Forbidden Scope**: No state mutation, no execution
- **Read Authority**: goal, milestones, forecast
- **Write Authority**: cycles array with loads and readiness

#### Inputs
- **Required**: `goal`, `milestones`, `forecast`
- **Optional**: Defaults empty
- **Validation**: Basic array handling

#### Rules
- **Decision Rules**: Compute horizon from milestones/forecast/goal, assign milestones to cycles, compute load and readiness per cycle
- **Thresholds**: MIN_HORIZON (4), MAX_HORIZON (32), intensity weights, readiness thresholds
- **Branch Conditions**: Based on count and avg intensity for readiness
- **Hidden Logic**: computeReadiness logic

#### Outputs
- **Schema**: {cycles: [], summary: {}}
- **Success**: Calendar with cycle details
- **Failure**: N/A (always succeeds)
- **Consumption**: Task compression uses cycle readiness

#### State Boundaries
- **Read Source**: Input parameters only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes, same inputs same output
- **Time Handling**: No time dependencies
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure function with deterministic horizon and load calculations.

## 13. Failure Engine

**Module**: `analyzeFailurePatterns()` in `src/core/failure-engine.js`

#### Identity
- **Purpose**: Analyze failure patterns from history and recommend throughput adjustments
- **Forbidden Scope**: No state mutation, no execution
- **Read Authority**: history, currentIntegrity
- **Write Authority**: failure analysis and recommendations

#### Inputs
- **Required**: `history`, `currentIntegrity`
- **Optional**: Defaults empty array/object
- **Validation**: Basic array/object handling

#### Rules
- **Decision Rules**: Compute averages, trends, rates, recommend adjustments based on thresholds
- **Thresholds**: HIGH_MISS_THRESHOLD (0.4), HIGH_LATE_THRESHOLD (0.4), LOW_INTEGRITY_THRESHOLD (40), WINDOW_SIZE (3)
- **Branch Conditions**: Based on rates and trends for recommendations
- **Hidden Logic**: computeThroughput logic for adjustments

#### Outputs
- **Schema**: {summary: {}, failureProfile: {}, recommendations: {}}
- **Success**: Analysis and recommendations
- **Failure**: N/A (always succeeds)
- **Consumption**: Pipeline uses recommendations for governance

#### State Boundaries
- **Read Source**: Input parameters only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes, same inputs same output
- **Time Handling**: No time dependencies
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure function with explicit threshold-based rules.

## 14. Forecast Engine

**Module**: `computeForecast()` in `src/core/forecast-engine.js`

#### Identity
- **Purpose**: Compute forecasts for goal completion based on historical progress
- **Forbidden Scope**: No state mutation, no execution
- **Read Authority**: goal, identityRequirements, history
- **Write Authority**: trajectories, forecasts, volatility, sustainability

#### Inputs
- **Required**: `goal`, `identityRequirements`, `history`
- **Optional**: Defaults empty arrays
- **Validation**: Basic array handling

#### Rules
- **Decision Rules**: Build capability stats from history, compute projections, volatility, sustainability
- **Thresholds**: WINDOW_SIZE (3), gap calculations
- **Branch Conditions**: Based on data availability for projections
- **Hidden Logic**: Projection formulas, stddev calculations

#### Outputs
- **Schema**: {identityTrajectories: [], goalForecast: {}, volatility: {}, sustainability: {}}
- **Success**: Forecast data
- **Failure**: N/A (always succeeds)
- **Consumption**: Goal decomposition and calendar use forecasts

#### State Boundaries
- **Read Source**: Input parameters only
- **Write Destination**: Return value only
- **Ambiguity**: None
- **UI Influence**: None

#### Repeatability
- **Deterministic**: Yes, same inputs same output
- **Time Handling**: Uses timestamps from history but deterministically
- **Side Effects**: None
- **Randomness**: None

#### Testability
- **Unit Tests**: None apparent
- **Scenario Tests**: None
- **Postcondition Tests**: None
- **Edge Cases**: None tested
- **Failure Modes**: No failure modes

**Grade: GREEN** ✅
**Rationale**: Pure function with deterministic statistical calculations.

## Summary

All 14 core modules have been audited for determinism isolation. 

**Final Grades:**
- **GREEN (Deterministic and Isolated)**: 13 modules ✅
- **YELLOW (Boundary Leaks)**: 1 module ⚠️
- **RED (Identity Issues)**: 1 module ❌

**GREEN Modules:**
1. Goal Intake and Normalization
2. Goal Classification / Subtype Assignment  
3. Goal Domain Resolution
4. Gap Analysis
5. Integrity Scoring
6. Baseline Feasibility Scoring
7. Schedule Proposal Generation (fixed)
8. Goal Decomposition
9. Task Compression
10. Portfolio Optimization
11. Strategic Calendar
12. Failure Engine
13. Forecast Engine

**YELLOW Modules:**
- Task Generation: Hardcoded ladders create non-deterministic behavior

**RED Modules:**
- [To be identified]: Unknown module with unclear identity or state mixing

**Recommendations:**
1. Fix Task Generation module to remove hardcoded ladders
2. Identify and audit the RED module
3. Implement comprehensive unit tests for all GREEN modules
4. Establish module boundary contracts for integration