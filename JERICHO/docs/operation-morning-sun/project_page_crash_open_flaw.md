---
name: project_page_crash_open_flaw
description: RESOLVED 2026-07-09 — enterprise-scale UI freeze / idle crash root-caused (per-mutation full-horizon recompute) and fixed via memoization; Save Progress button added
metadata: 
  node_type: memory
  type: project
  originSessionId: 495c5b1c-5982-411c-952c-2b0ee393691d
---

**RESOLVED 2026-07-09.** The enterprise-scale freeze ("can't type") and long-session
crash were root-caused and fixed. Changes currently UNCOMMITTED on execution-readiness-wip.

**Root cause (measured, not guessed):** `computeDerivedState` runs on EVERY mutation and
rebuilt the full-horizon substrate each time — `applyLongHorizonCalendarBlocks` in
identityCompute.js calls `expandFullHorizonSchedule` + `projectBlocksForDisplay` + audits,
producing two ~6MB arrays (`fullHorizonScheduleBlocks`, `calendarDisplayBlocks`). At
Operation-Endgame scale (1072-block plan) one mutation = **~907ms** and ~12MB of fresh
garbage → per-keystroke freeze + GC-pressure crash on long sessions. Reducer deep-clone
was NOT the problem (native structuredClone = 31ms).

**Fix:** memoized the full-horizon expansion on a content key of its inputs
(`buildFullHorizonMemoKey`); unchanged inputs reuse the prior derivation carried on the
draft, only refreshing cheap day-dependent agenda metadata. Result: **907ms → 42ms/mutation**
(21x). Key excludes `plan.policyState` (a wall-clock timestamp re-stamped every compute —
also a latent determinism smell worth a separate look). Guard test:
tests/state/fullHorizon.computeMemo.test.js. `__fullHorizonMemoKey` added to
DERIVED_PERSISTENCE_KEYS. Full suite held at 27-failure baseline, zero regressions.

**Also this session (separate from the crash):**
- Vite `/api` proxy added to vite.config.mjs (was missing → sync 404s).
- Device auth contract fixed the RIGHT way: frontend keeps its CORS-simple query-param POST
  (no body/preflight — see tests/services/syncService.deviceAuth.test.js); BACKEND
  (backend/app/api/auth.py device_auth) now reads device_id as a query param. Live: 200.
  (First attempt wrongly added a JSON body to the frontend and broke that test — reverted.)
- **Save Progress button** (server push + visible status): SaveProgressButton.jsx wired into
  StructurePageConsolidated; store.saveProgress action; pushState now returns
  {ok,status}/{ok:false,error} (also fixed a latent dropped-401-retry-result bug). Tests:
  SaveProgressButton.test.jsx + syncService.pushResult.test.js.

Recovery workaround if it ever recurs pre-fix: clear `jericho-identity` in LocalStorage + reload.
See [[project_matrix_intake_defects]].
