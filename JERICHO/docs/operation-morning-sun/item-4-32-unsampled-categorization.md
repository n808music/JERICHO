---
name: item-4-32-unsampled-categorization
description: 32 unsampled failures categorized by root cause pattern; high-impact fixes identified
metadata: 
  node_type: memory
  type: project
  originSessionId: fe8a9a8d-7f49-46bf-a7f2-30bbb0bd35a1
  modified: 2026-08-18T17:59:00.950Z
---

# Item 4 — 32 Unsampled Failures: Category Analysis

## Overall Distribution

| Category | Files | Tests | % of Total |
|----------|-------|-------|-----------|
| **Render/Component** | 1 | 7 | 22% |
| **Convergence Logic** | 1 | 5 | 16% |
| **Schedule Generation** | 2 | 4 | 13% |
| **Gum Acceptance (E2E)** | 4 | 4 | 13% |
| **Other Logic** | 3 | 5 | 16% |
| **Full Horizon Expansion** | 2 | 2 | 6% |
| **Intake/Elicitation** | 2 | 2 | 6% |
| **Plan Quality Gate** | 1 | 2 | 6% |
| **Phase Audit** | 1 | 1 | 3% |

**Total: 17 files, 32 failures (26% of the 109-failure Jan count)**

---

## High-Impact Categories (>10% of failures)

### 1. RENDER/COMPONENT: 7 failures (22%)

**File:** `tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx`

**Likely root causes:**
- DOM rendering issues (component tree, hierarchy display, state sync)
- Props drilling or state mutation during render
- Potential Item-3 impact: phase field now required in block data

**Sample impact:** Sample K (fullHorizon.computeMemo, verified independent) suggests memoization issues; this could be related if BlockDetailsPanel uses stale memoized data.

**Fix strategy:** Unit test the panel in isolation with mock data; verify phase field is present and used in hierarchy logic.

---

### 2. CONVERGENCE: 5 failures (16%)

**File:** `src/state/__tests__/convergence_step3_forward_declaration.test.js`

**Likely root causes:**
- Step 3 edge declaration logic (likely independent of Item-3)
- May expose missing prerequisite setup (Entity→Project→Deliverable chains)
- Memory notes "full convergence declaration flow requires complex prerequisite setup"

**Fix strategy:** Review test setup; check if Phase field (newly required by Item 3) is being seeded in convergence test fixtures.

---

### 3. SCHEDULE GENERATION: 4 failures (13%)

**Files:**
- `src/state/__tests__/autoAsana.scheduler.v1_1.test.js` (2)
- `tests/state/schedule.generate.nonSilent.test.js` (2)

**Likely root causes:**
- Scheduler logic may be sensitive to new phase windows (Item-3 related)
- Block placement, deadline arithmetic, or workable-day computation
- Could be timestamp/date handling issues

**Fix strategy:** Trace whether phase computation affects schedule generation downstream; check if fixture data seeds phase values correctly.

---

### 4. GUM ACCEPTANCE: 4 failures (13%)

**Files:** 4 E2E/acceptance tests across different gum scenarios
- `tests/state/gumGoal.liveParity.test.ts`
- `tests/state/regulatedConsumable.energyGum.acceptance.test.ts`
- `tests/state/jerichoLoop.gum.e2e.test.ts`
- `tests/state/dailyCheckIn.energyGum.acceptance.test.ts`

**Likely root causes:**
- E2E tests are sensitive to full-stack state changes
- Probably cumulative: phase auto-calling + schedule generation + rendering all compounding
- May not be Item-3-specific; could be test isolation or timing issues

**Fix strategy:** Run one of these in isolation with verbose logging; check for race conditions or state pollution across tests.

---

### 5. OTHER LOGIC: 5 failures (16%)

**Files:**
- `tests/state/autoAsanaPlan.distribution.spread.test.ts` (3)
- `tests/state/jerichoLoop.creativeProduction.ep.e2e.test.ts` (1)
- `tests/state/masterPlanAtomicBlocks.test.js` (1)

**Likely root causes:**
- Distribution/spread logic (likely independent)
- Atomic block formation (may be Item-3 if phase affects block structure)
- E2E creative production (cumulative effects)

**Fix strategy:** Start with `autoAsanaPlan.distribution.spread` (3 failures in one file); likely easier to isolate than E2E tests.

---

## Medium-Impact Categories (6-13% of failures)

### Full Horizon Expansion: 2 failures (6%)
- Substance compliance checking
- Block expansion logic
- **Fix impact:** Low individual impact but part of plan quality chain

### Intake/Elicitation: 2 failures (6%)
- Master plan intake completion
- Elicitation engine acceptance
- **Fix impact:** Could unlock gum acceptance tests if shared fixture issue

### Plan Quality Gate: 2 failures (6%)
- Block detail authority validation
- **Fix impact:** May be high; if gate is broken, many downstream tests cascade

---

## Low-Impact Categories (<6%)

### Phase Audit: 1 failure (3%)
- `tests/masterGrid/phaseRetroactiveAudit.test.js`
- Already sampled in Round 4, confirmed Item-3-linked
- **Status:** Known, likely part of phase auto-calling changes

---

## Root Cause Hypothesis

**Tier 1: Item-3-Linked (Phase auto-calling + windows)**
- Phase Audit (1)
- Schedule Generation (likely 2–3 of 4)
- Convergence (likely 2–3 of 5 if phase field missing)

**Tier 2: Independent Logic**
- Render/Component (likely all 7; DOM issues usually unrelated to phase)
- Gum Acceptance (3–4 of 4; E2E noise)
- Distribution Spread (likely all 3)
- Atomic Blocks (1)

**Tier 3: Fixture/Setup Issues (cross-cutting)**
- Intake/Elicitation (2; fixture seeding)
- Plan Quality Gate (2; gate expectations)

---

## Recommended Fix Priority

### Phase 1: Fixture Seeding (High-leverage, ~5–10 failures fixed)
1. Audit which tests lack `phase` field in fixture data
2. Add phase seeding to `buildBlankIdentityState` or test setup
3. Should fix: Convergence (2–3), Schedule Generation (1–2), Intake/Elicitation (2)

### Phase 2: Component Isolation (High-impact, 7 failures in 1 file)
4. Debug `BlockDetailsPanel.hierarchyDisplay` in isolation
5. Verify phase field is present in mock block data
6. Check for stale memoized state

### Phase 3: E2E Stability (Risk mitigation, 4 gum failures)
7. Run gum acceptance tests in isolation; check for state pollution
8. May be timeout/vite process-pool issues (memory notes ~42 baseline improvements from isolation)

### Phase 4: Logic-Level Fixes (Deeper investigation)
9. Distribution spread (3 failures; likely independent logic)
10. Atomic blocks (1 failure; likely independent)
11. Full horizon expansion (2 failures; substance compliance)

---

## Quick Wins (Estimated ROI)

| Fix | Estimated Impact | Effort | ROI |
|-----|------------------|--------|-----|
| Add phase to fixtures | 5–10 failures | 1–2h | **Very High** |
| Block Details Panel debug | 7 failures | 2–3h | **High** |
| E2E test isolation | 2–3 failures | 1h | **Medium** |
| Schedule gen tracing | 1–2 failures | 2h | **Medium** |
| Convergence setup review | 2–3 failures | 1h | **Medium** |

**Recommended starting point:** Fixture seeding audit. If 5+ of the 32 failures are missing `phase` field in initial state, that's a high-ROI fix.
