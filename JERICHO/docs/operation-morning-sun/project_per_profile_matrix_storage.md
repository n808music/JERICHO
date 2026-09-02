---
name: project_per_profile_matrix_storage
description: Where the canonical matrix lives per profile and how activation loads it — the storage the intake writes to
metadata: 
  node_type: memory
  type: project
  originSessionId: e55bb945-a654-46be-82c2-1e527e2d17ab
---

Traced 2026-07-16 (Gate 5, Option-2 seed). There is **no per-profile matrix slot**; persistence is a single localStorage key `jericho-identity` holding the entire identity-state blob.

- `state.matrix` (slices `entitiesById/initiativesById/projectsById/artifactsById/systemsById` + `milestonesById` + `matrixLinksById`) is canonical and **IS persisted** — it is NOT in `DERIVED_PERSISTENCE_KEYS` (identityStore.js:43), so `buildPersistableIdentityState` keeps it.
- Active profile = `state.activeProfileId`; records in `state.profilesById`. Load path: boot → `loadPersisted()` reads `jericho-identity` → `rehydratePersistedState` → `store.matrix`.
- The real intake write path is `matrixDispatch → DECLARE_* → computeDerivedState` (mutates `state.matrix`) → `persistState` writes the whole blob.
- **Why the OE profile ("Continue as James" → `restoreOperationEndgameProfile`) showed an EMPTY matrix:** the restore seeds profile/goal/plan/cycle but never populates `state.matrix`. Empty matrix was a seeding gap, not a persistence strip.
- AppShell dashboard entry requires `evaluateProfileContextCoherence` to return zero reason codes: non-placeholder `activeProfileId` + profile record + `profileAccess.status==='profile_selected'` (selectedProfileId===activeProfileId) + `profile.masterCalendarId` resolvable + owned goal/plan. A **null `activeCycleId` does NOT block** (the cycle check is guarded by `if (activeCycleId)`).
- Faithful Option-2 seed recipe: `buildOperationEndgameFixtureState` → `promoteOperationEndgameReferenceProfile` (→ `profile-james-endgame`, sets profileAccess selected) → overlay `state.matrix = loadReferenceMatrix(fixture).matrix` → `buildPersistableIdentityState`. Renders the dashboard with no click, so restore never re-runs to wipe the matrix.

**Reading the LIVE store from the sandbox:** the browser's `localStorage` is NOT reachable from the agent sandbox. But "Save Progress" pushes `buildPersistableIdentityState(state)` to the backend — `backend/jericho_dev.db`, table `user_states(id, user_id, state_blob TEXT, client_updated_at, updated_at)`. The `state_blob` is the same identity-state shape as `jericho-identity` (has `meta.version`, `profileAccess`, `matrix`) and is directly injectable as a Playwright seed. Pick the row by `updated_at` matching the session in question.

**Live-store finding (2026-07-16):** the real intake-built store (`profile-james-endgame`, block count 3) carries `phase: null` on ALL projects AND ALL initiatives, with only 1 dependency edge — genuinely no phase signal anywhere. The `phase` field is present under the correct key (not a hidden shape). So the Master Grid correctly renders it 0·0·0 / all-RESIDUAL-PHASE. **Real intake never elicits phase** — that is an intake-completeness gap, separate from the grid render (which is correct). The all-residual tripwire's message was recalibrated to name both causes (read-mismatch vs incomplete-intake) rather than dismissing incomplete intake.

**Seed-vs-live classification determination (Gate 7 close, 2026-07-17):** the "10 Initiative / 18 Project vs 11 Initiative / 17 Project" question was **neither a reclassification nor seed drift** — it compared two different datasets. The SEED (reference_matrix_v1_4.json) is deterministic: classification is byte-identical across runs and AC1-locks it at 7/11/17/12/6 (53 total) — it always yields 11/17, never 10/18. The 10/18 was the LIVE store (43 total), the operator's own intake data, which contains an EXTRA node "F8 ENERGY GUM" as a Project that the fixture lacks (fixture F8: `Entity:F8 ENERGY Company` + `Initiative:F8 market entry`; live F8: those two plus `Project:F8 ENERGY GUM`). No node changed class within a dataset; the seed can't drift. Two different stores compared side by side.

Related: [[project_matrix_intake_wiring]], [[project_master_grid_tab]], [[project_goal_admission_gate]].
