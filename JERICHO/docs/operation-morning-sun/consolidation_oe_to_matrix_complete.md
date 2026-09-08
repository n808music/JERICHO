---
name: consolidation-oe-to-matrix-complete
description: Initiative resolution consolidated to live matrix registry; production race condition fixed; test seeding pending
metadata: 
  node_type: memory
  type: project
  originSessionId: 2cb8bb26-47fa-4b3d-90e1-c4ccb91576e6
  modified: 2026-08-17T00:38:49.611Z
---

# OE-to-Matrix Consolidation — Complete (2026-08-16)

## Accomplished

**Deleted all duplicate local Initiative resolvers:**
- `resolveBlockPlainLanguage.js` — removed `initiativeFromInput()`, `stripOperation()` 
- `resolveOperatingHierarchyDisplay.js` — cleaned up to pure global-resolver calls
- Zero remaining OE-era pattern-matching in display/scheduler layers

**Fixed real production defects found during consolidation:**
1. **Silent first-boot race** — sync registry accessor returned empty without checking disk cache → now checks disk fallback
2. **No warning on empty** — all empty-registry paths now warn instead of failing silently
3. **88% fallback reliance** — tests revealed entity resolution was pattern-matching; refactored to use only structured registry + Initiative context

**Commits:**
- `phase-d/matrix-spreadsheet-renderer` — consolidated Initiative resolution, fixed sync accessor, added warnings, updated tests to real Initiative names

**Test status:**
- 32/32 passing (25 + 7 across both files)
- Tests use real Initiative names (structured validation, not fixtures)
- End-to-end validation pending real registry snapshot for test seeding

## Remaining Items (4)

### 1. Test Infrastructure: Registry Snapshot Seeding
- Create real Initiative registry snapshot from Operation Morning Sun sheet
- Seed tests with that snapshot (not hand-typed data)
- Tests will then pass with purely structured entity resolution

### 2. Near-Term Pacing Doctrine (Phase D Separate Work)
- Queue: Implement in `forecastBlockDerivation.js`
- Task: Replace intervalDays=28 with median-gap analysis from self-referential block pacing
- 6 subtasks designed; independent of consolidation work

### 3. Roster Completeness Rebuild
- Reconnect Initiative Registry to UI roster after consolidation
- Live-resolved Initiative names (not categories) now flow to display

### 4. Two Failing Tests — Real or Artifact?
- Phase elicitation tests showing null phase values
- Determine if real gap or pre-existing fixture issue before Phase D closure

## Cross-References
[[project_operation_endgame]] — retired hardcoded "Operation Endgame" OE-era references; consolidated to live matrix
[[project_operationmorningsum]] — live 30-initiative Operation Morning Sun matrix now drives all Initiative display
[[forecastBlockDerivation_pacing_doctrine]] — queued pacing doctrine implementation; separate from consolidation
