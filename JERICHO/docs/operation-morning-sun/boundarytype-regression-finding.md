---
name: boundarytype-regression-finding
description: boundaryType transcription fix introduced regressions — needs investigation before landing
metadata: 
  node_type: memory
  type: project
  originSessionId: 271d54e7-3396-4bd2-a281-453969054c56
  modified: 2026-09-02T17:58:35.415Z
---

## Finding

The boundaryType fix (transcribe from fixture instead of infer from terminalDate string) introduced **3 new test failures** when landed as commit 237113f.

**Results:**
- Baseline: 48 failures, 4404 passing
- After boundaryType fix: 51 failures, 4401 passing
- Net: +3 failures

**Affected test areas:**
1. `src/domain/masterGrid/phaseGridFromStore.test.js` — phase sorting tests failing
2. `src/state/__tests__/convergence_step3_*.test.js` — convergence declaration tests failing
3. Project phase elicitation tests in `elicitationEngine.projectPhase.test.js`

## Hypothesis

The fix correctly stops inferring boundaryType from terminalDate string. However:
- Tests may be creating projects WITH terminalDate but WITHOUT explicit boundaryType in payload
- The new code expects `payload?.boundaryType` to be present
- Projects without declared boundaryType now get `null` instead of inferred value
- This cascades through phaseAnchor computation (terminating projects → use terminalDate, but boundaryType is null so no anchor)

## Investigation Needed

1. Check if v1.4 fixture has `boundary_type` field on all projects
2. Check if test fixtures in elicitationEngine tests provide boundaryType
3. Determine if boundaryType should have fallback behavior or if tests need fixture updates
4. Review the split: what should loadReferenceMatrix transcribe vs what should declareProject infer?

## Status

**Reverted** (commit 237113f 🔙 9d29da5). Do not re-land without resolving regressions.

The fix is logically sound but needs fixture/test alignment before it can land cleanly.
