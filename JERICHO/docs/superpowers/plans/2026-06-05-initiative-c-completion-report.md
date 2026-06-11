# Initiative C — Completion Report

**Status: COMPLETE — Operation Endgame ready for browser live run**

Branch: `rtg-remediation-1` (3 new commits past Initiative B closure).

---

## 1. Root cause of the chart readability issue

The formal chart's row projection in `StructurePageConsolidated.jsx` was rendering raw substrate identifiers as primary cell content:

- **Line 853** stored `block.id` as `blockId` and **line 1688** rendered it as a `whitespace-normal break-all` long string (e.g. `fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-...-2026-05-19-0`).
- **Line 877** computed `consumedArtifactsLabel = block.consumedArtifactIds.join(', ')`, dumping `artifact:fh-masterplan-...` strings into the **Consumed artifacts** column.
- **Line 880** built `gateCriteriaLabel = ${metricName}: ${threshold}` — already structured but with no fallback to `'—'` for non-gate rows beyond a basic check, and no length safeguard.

The display-layer was using raw engine substrate fields directly. The engine substrate itself was correct — the projection layer was simply not formatting it for users. The cure is a small view-model formatter module; no engine change.

---

## 2. Files changed

**Created (3 files):**
- `src/components/zion/formalChartFormatters.js` (105 lines) — six pure helpers
- `src/components/zion/formalChartFormatters.test.js` (120 lines) — 20 unit tests
- `tests/components/ZionDashboard.formalChartReadability.test.jsx` (84 lines) — 8 integration-style readability assertions

**Modified (1 file):**
- `src/components/zion/StructurePageConsolidated.jsx` (+129 −6) — added formatter import, built `chartBlocksById` and `artifactRegistry` locals inside the projection useMemo, replaced raw-join projection fields with formatter calls, renamed `"Block ID"` column to `"Ref"`, added `data-block-id` + `title` attributes for traceability

**Engine substrate files (`src/domain/masterPlan/*`):** **zero changes**. Confirmed by `git show --stat` for each Initiative C commit and by 118/118 passing tests across the entire Initiative B + longHorizon suite.

---

## 3. Formatting helpers added

All in `src/components/zion/formalChartFormatters.js`. Pure functions, no React/state/DOM:

| Helper | Purpose |
|---|---|
| `isInternalId(value)` | Detects `fh-` prefix, `artifact:fh-` prefix, UUID-shape, or long hex-heavy hyphenated strings |
| `shortenInternalId(value)` | Preserves trailing `YYYY-MM-DD-N` suffix when present, else last 12 chars |
| `formatBlockRef(block, index)` | Produces `P1·Product·001` style or `Block 001` fallback |
| `formatArtifactLabel(idOrName, registry)` | Registry lookup → semantic `artifactName`; passes through non-ID strings; falls back to shortened ID |
| `formatConsumedArtifacts(ids, registry, idToBlock)` | Single semantic label, "(+N more)" leader, or "N upstream artifacts" count; never raw IDs |
| `formatGateSummary(block)` | `'—'` for non-gate rows; for gates: `Metric: <name> · Pass: <≤60-char threshold>`, capped at 140 chars; never raw object dump |

---

## 4. Tests added or updated

**Unit tests** (`formalChartFormatters.test.js`) — 20 assertions covering all six helpers including null/empty handling, registry lookup, fallback paths, length caps, and "no raw object dump" guarantees.

**Integration-style readability test** (`tests/components/ZionDashboard.formalChartReadability.test.jsx`) — 8 assertions using synthetic block + registry fixtures shaped like real engine output:
- Block ref short (<30 chars), no `fh-` substring
- Consumed artifacts use semantic labels, never `artifact:`
- Multi-upstream summary shows leader + count, never raw IDs
- Empty-registry fallback stays under 50 chars
- Output artifact label converts raw ID via registry
- Non-gate rows show `'—'`
- Gate rows include metric name, stay under 160 chars, never contain `{` or `}`
- Cross-helper guarantee: no formatter returns a string containing the raw block ID substring

**Updated:** none of the prior tests required changes — engine substrate is unchanged, all 118 prior assertions still pass.

---

## 5. Focused validation results

| Suite | Result |
|---|---|
| Initiative C formatter unit tests | **20/20 PASS** |
| Initiative C readability regression | **8/8 PASS** |
| `ZionDashboard.applyDraftSchedule.test.jsx` (duplicate-render dedupe) | **PASS** |
| Initiative B SDLC depth | **PASS** |
| Initiative B commercial depth | **PASS** |
| Initiative B cross-lane semantic | **PASS** |
| Initiative B title specificity | **PASS** |
| `incubatingActivationPath`, `gateReadability`, `gateCriteria`, `bdMechanics`, `ownerClass`, `artifactDependencyIntegrity` | **PASS** |
| `fullHorizonProfessionalism.regression` | **PASS** |
| `longHorizon.{blockGeneration, countStability, mergeBehavior, phaseCoverage, visibilityModes}` | **PASS** |
| **Total** | **19 test files / 118 tests — all PASS** |

---

## 6. Confirmation of display-only scope

- `git show --stat` for each of the 3 Initiative C commits shows only `src/components/zion/*` and `tests/components/*` files. **Zero `src/domain/masterPlan/*` files.** Zero engine modules touched.
- `formalChartFormatters.js` has no React imports, no state, no DOM, no mutation of input objects. Verified by inspection — all helpers return new strings from input data.
- Block.id substrate untouched: `data-block-id={block.rawBlockId}` preserves raw ID on the rendered cell. `title={block.rawBlockId}` provides hover access. Devtools/inspector can still read the canonical ID.
- consumedArtifactIds substrate untouched: `title={block.consumedArtifactIds.join('\n')}` preserves the raw upstream list on the cell. Export payload (`ExportFullScheduleButton.jsx`) still emits the raw `consumedArtifactIds` array — verified unchanged.
- Engine determinism preserved: the same 1072 deterministic blocks produced, with the same IDs, are now rendered with compact refs.

---

## 7. Ready for browser live run after this patch

**Yes.** The substrate that passed the Operation Endgame UI Rerun Checklist on the prior RTG is unchanged; the chart is now readable rather than dominated by long internal IDs. The user-facing failure mode (a strong substrate appearing unusable) is removed without altering the substrate.

Recommended next step: browser run of Operation Endgame, focus on the **Structure** view's formal chart. Expect:
- "Ref" column reads as `P1·Product·001` style (compact, no wrap)
- "Consumed artifacts" column reads as semantic names or `N upstream artifacts` (no `artifact:fh-...`)
- "Gate criteria" reads as `Metric: launch readiness · Pass: validated_proof_artifacts >= 1` for gate rows, `—` elsewhere
- Hover any "Ref" cell → tooltip shows the full `fh-...` raw ID for debugging
- Inspect element on any row → `data-block-id` attribute is the canonical ID

---

## Commit sequence (Initiative C on `rtg-remediation-1`)

```
4a873ba test(zion): add formal chart readability regression
5e98709 feat(zion): replace raw IDs with compact refs and semantic labels in formal chart
85290c5 feat(zion): add formal chart view-model formatters
```

Three commits, +438 lines added, −6 lines removed, exclusively in the presentation layer.
