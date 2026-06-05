# Initiative C — Formal Chart Readability Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hide long raw block IDs and raw consumed-artifact IDs from the primary formal chart table in `StructurePageConsolidated.jsx`, replacing them with compact semantic labels — while preserving raw IDs for debug/export/traceability via data-attributes and tooltips.

**Architecture:** New `formalChartFormatters.js` view-model helper module. The row-projection useMemo in `StructurePageConsolidated.jsx` calls the helpers to produce display-only fields. Raw IDs stay on the underlying block object and on `data-block-id` / `title` attributes for inspector tooling.

**Scope discipline (explicit):**
- No changes to engine substrate, block ID generation, artifact ID generation, dependency resolution, gate criteria logic, schedule generation, horizon generation, dedupe behavior, first-cycle activation, or work-window placement.
- Only files modified: one new formatter module + `StructurePageConsolidated.jsx` view-model projection + table cell JSX + one new test file.

**Non-regression contract:**
- `tests/components/ZionDashboard.applyDraftSchedule.test.jsx` (duplicate-render dedupe)
- The 11 Initiative B test files (sdlcDepth, commercialDepth, crossLaneSemantic, titleSpecificity, incubatingActivationPath, gateReadability, gateCriteria, bdMechanics, ownerClass, artifactDependencyIntegrity, professionalism.regression)
- All longHorizon test files
- Any existing StructurePageConsolidated tests

---

## Phase 0 — View-model formatter module

### Task 1: Create `formalChartFormatters.js` with helpers + unit tests

**Files:**
- Create: `src/components/zion/formalChartFormatters.js`
- Create: `src/components/zion/formalChartFormatters.test.js`

**Helpers required (matches spec):**
- `isInternalId(value)` — true if value looks like a long internal ID (`fh-`, `artifact:`, UUID-shape, or > 30 chars with hex)
- `shortenInternalId(value)` — last segment of an `fh-...-2026-05-19-0` style ID, or last 8 chars
- `formatBlockRef(block, index)` — produces `P1·Product·001` style or fallback `Block 001`
- `formatArtifactLabel(idOrName, artifactRegistry)` — looks up registry to convert `artifact:fh-...` → semantic name; falls back to shortened ref
- `formatConsumedArtifacts(consumedArtifactIds, artifactRegistry, idToBlock)` — produces compact summary like `launch-proof packet`, `2 upstream artifacts`, or `—`
- `formatGateSummary(block)` — for non-gate: `'—'`; for gate: ``Metric: <metricName>; Pass: <short threshold>`` (no raw object dump)

**Write tests first** (TDD):

```javascript
import { describe, it, expect } from 'vitest';
import {
  isInternalId,
  shortenInternalId,
  formatBlockRef,
  formatArtifactLabel,
  formatConsumedArtifacts,
  formatGateSummary,
} from './formalChartFormatters.js';

describe('isInternalId', () => {
  it('returns true for fh- prefixed IDs', () => {
    expect(isInternalId('fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-x-2026-05-19-0')).toBe(true);
  });
  it('returns true for artifact: prefixed IDs', () => {
    expect(isInternalId('artifact:fh-masterplan-2b657ad0-988e')).toBe(true);
  });
  it('returns true for UUID-shape strings', () => {
    expect(isInternalId('aab862ed-8f27-4d7d-bd4e-81dc7d08c1cf')).toBe(true);
  });
  it('returns false for normal short labels', () => {
    expect(isInternalId('launch-proof packet')).toBe(false);
    expect(isInternalId('Block 001')).toBe(false);
    expect(isInternalId(null)).toBe(false);
    expect(isInternalId('')).toBe(false);
  });
});

describe('shortenInternalId', () => {
  it('takes the last 12 chars of a long ID by default', () => {
    expect(shortenInternalId('fh-masterplan-2b657ad0-2026-05-19-0')).toMatch(/2026-05-19-0$/);
  });
  it('returns the input if already short', () => {
    expect(shortenInternalId('abc123')).toBe('abc123');
  });
  it('handles null/undefined', () => {
    expect(shortenInternalId(null)).toBe('');
    expect(shortenInternalId(undefined)).toBe('');
  });
});

describe('formatBlockRef', () => {
  it('produces phase + family + index when available', () => {
    const block = { phaseLabel: 'P1', laneLabel: 'Operation Endgame product engine', laneTitle: 'Operation Endgame product engine' };
    const ref = formatBlockRef(block, 0);
    expect(ref).toMatch(/^P1/);
    expect(ref).toMatch(/001$/);
  });
  it('falls back to Block NNN when phase/lane missing', () => {
    expect(formatBlockRef({}, 4)).toBe('Block 005');
  });
  it('pads the index to 3 digits', () => {
    expect(formatBlockRef({}, 0)).toBe('Block 001');
    expect(formatBlockRef({}, 99)).toBe('Block 100');
  });
});

describe('formatArtifactLabel', () => {
  it('looks up the registry to convert artifact id to artifactName', () => {
    const registry = { 'artifact:fh-x-1': { artifactName: 'launch-proof packet' } };
    expect(formatArtifactLabel('artifact:fh-x-1', registry)).toBe('launch-proof packet');
  });
  it('returns the input unchanged when it does not look like an internal id', () => {
    expect(formatArtifactLabel('release notes', {})).toBe('release notes');
  });
  it('falls back to shortened id when registry has no entry', () => {
    expect(formatArtifactLabel('artifact:fh-x-unknown-12345', {})).toMatch(/.{4,}/);
  });
});

describe('formatConsumedArtifacts', () => {
  it('returns "—" when empty', () => {
    expect(formatConsumedArtifacts([], {}, new Map())).toBe('—');
  });
  it('returns a single semantic label when one upstream and registry hits', () => {
    const registry = { 'artifact:fh-x-1': { artifactName: 'launch-proof packet' } };
    expect(formatConsumedArtifacts(['artifact:fh-x-1'], registry, new Map())).toBe('launch-proof packet');
  });
  it('summarizes count when multiple', () => {
    const registry = {
      'artifact:fh-x-1': { artifactName: 'release notes' },
      'artifact:fh-x-2': { artifactName: 'qa checklist' },
      'artifact:fh-x-3': { artifactName: 'telemetry review' },
    };
    const result = formatConsumedArtifacts(['artifact:fh-x-1','artifact:fh-x-2','artifact:fh-x-3'], registry, new Map());
    expect(result).toMatch(/3 upstream/);
  });
  it('uses block lookup when artifact id resolves to a block id', () => {
    const idToBlock = new Map([['fh-x-1', { outputArtifact: { artifactName: 'product proof' } }]]);
    expect(formatConsumedArtifacts(['fh-x-1'], {}, idToBlock)).toBe('product proof');
  });
});

describe('formatGateSummary', () => {
  it('returns "—" for non-gate blocks', () => {
    expect(formatGateSummary({ blockType: 'action' })).toBe('—');
    expect(formatGateSummary({ blockType: 'review' })).toBe('—');
    expect(formatGateSummary({})).toBe('—');
  });
  it('produces compact summary for gate blocks', () => {
    const gate = {
      blockType: 'gate',
      gateCriteria: {
        metricName: 'launch readiness',
        threshold: 'validated_proof_artifacts >= 1',
        acceptanceCriteria: 'Upstream proof threshold met. Required evidence: launch packet.',
      },
    };
    const result = formatGateSummary(gate);
    expect(result).toMatch(/launch readiness/);
    expect(result.length).toBeLessThan(200);
    expect(result).not.toContain('{');
  });
  it('falls back when gateCriteria object missing on gate-type block', () => {
    expect(formatGateSummary({ blockType: 'gate' })).toBe('—');
  });
});
```

**Implementation:**

```javascript
// View-model formatters for the formal plan chart.
// Pure functions — no React, no state, no DOM.
// Engine substrate (block.id, consumedArtifactIds, gateCriteria) is never mutated.

const FH_PREFIX = /^(fh-|artifact:fh-)/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX_HEAVY = /^[a-z0-9-]{30,}$/i;

const FAMILY_KEYWORDS = [
  [/product|software|app/i, 'Product'],
  [/creative|album|music/i, 'Creative'],
  [/media|podcast|channel|content/i, 'Media'],
  [/ops|operations|brand|company/i, 'Ops'],
  [/income|service|revenue|runway/i, 'Income'],
  [/capital|real.?estate|asset/i, 'Capital'],
  [/institution|education/i, 'Institution'],
  [/civic|community|government/i, 'Civic'],
];

export function isInternalId(value) {
  if (typeof value !== 'string' || !value) return false;
  if (FH_PREFIX.test(value)) return true;
  if (UUID_SHAPE.test(value)) return true;
  if (LONG_HEX_HEAVY.test(value) && /-/.test(value) && value.length >= 30) return true;
  return false;
}

export function shortenInternalId(value) {
  const s = typeof value === 'string' ? value : '';
  if (!s) return '';
  if (s.length <= 14) return s;
  // Prefer the trailing date-suffix segment if present (fh-...-YYYY-MM-DD-N)
  const dateMatch = s.match(/\d{4}-\d{2}-\d{2}-\d+$/);
  if (dateMatch) return dateMatch[0];
  return s.slice(-12);
}

function familyTokenFromLane(laneLabel) {
  const t = String(laneLabel || '').trim();
  if (!t) return null;
  for (const [pat, token] of FAMILY_KEYWORDS) {
    if (pat.test(t)) return token;
  }
  return null;
}

export function formatBlockRef(block, index) {
  const idx = String((Number(index) || 0) + 1).padStart(3, '0');
  const phase = String(block?.phaseLabel || '').trim();
  const family = familyTokenFromLane(block?.laneLabel || block?.laneTitle || '');
  if (phase && family) return `${phase}·${family}·${idx}`;
  if (phase) return `${phase}·${idx}`;
  return `Block ${idx}`;
}

export function formatArtifactLabel(idOrName, artifactRegistry = {}) {
  const s = typeof idOrName === 'string' ? idOrName : '';
  if (!s) return '—';
  if (!isInternalId(s)) return s;
  const reg = artifactRegistry?.[s] || artifactRegistry?.byId?.[s] || null;
  const name = reg?.artifactName || reg?.name;
  if (name) return name;
  return shortenInternalId(s);
}

export function formatConsumedArtifacts(consumedArtifactIds, artifactRegistry = {}, idToBlock = new Map()) {
  if (!Array.isArray(consumedArtifactIds) || consumedArtifactIds.length === 0) return '—';
  const ids = consumedArtifactIds.filter(Boolean);
  if (ids.length === 0) return '—';
  const labels = ids.map((id) => {
    // Registry hit takes precedence
    const reg = artifactRegistry?.[id] || artifactRegistry?.byId?.[id] || null;
    if (reg?.artifactName) return reg.artifactName;
    // Block lookup — the id may be a block id whose outputArtifact is the upstream
    const upstream = idToBlock.get(id);
    const upstreamName = upstream?.outputArtifact?.artifactName || upstream?.outputArtifact;
    if (typeof upstreamName === 'string' && upstreamName) return upstreamName;
    if (typeof upstream?.producesArtifact === 'string') return upstream.producesArtifact;
    // Fallback: shortened id
    return shortenInternalId(id);
  });
  if (labels.length === 1) return labels[0];
  // If the first label is semantic (not a shortened id), show it with a count
  const first = labels[0];
  if (!isInternalId(first) && first !== '—' && !/^\d{4}-\d{2}-\d{2}/.test(first)) {
    return `${first} (+${labels.length - 1} more)`;
  }
  return `${labels.length} upstream artifacts`;
}

function shortenPhrase(text, maxLen = 80) {
  const s = String(text || '').trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

export function formatGateSummary(block) {
  const type = String(block?.blockType || '').toLowerCase();
  if (type !== 'gate') return '—';
  const gc = block?.gateCriteria;
  if (!gc || typeof gc !== 'object') return '—';
  const metric = String(gc.metricName || '').trim();
  const threshold = String(gc.threshold || '').trim();
  if (!metric && !threshold) return '—';
  const head = metric ? `Metric: ${metric}` : 'Gate';
  const tail = threshold ? ` · Pass: ${shortenPhrase(threshold, 60)}` : '';
  return shortenPhrase(head + tail, 140);
}
```

**Commands:**

```bash
cd /Users/jamesdotson/vscode/JERICHO/JERICHO
# Write the test first
# Run test, confirm failures
npx vitest run src/components/zion/formalChartFormatters.test.js
# Write implementation
# Re-run, confirm pass
npx vitest run src/components/zion/formalChartFormatters.test.js
# Commit
git add src/components/zion/formalChartFormatters.js src/components/zion/formalChartFormatters.test.js
git commit -m "feat(zion): add formal chart view-model formatters"
```

---

## Phase 1 — Wire formatters into StructurePageConsolidated

### Task 2: Update row projection + rendered cells

**File:** `src/components/zion/StructurePageConsolidated.jsx`

**Edit A — Add import at top of file:**

After existing imports near the top, add:

```javascript
import {
  formatBlockRef,
  formatArtifactLabel,
  formatConsumedArtifacts,
  formatGateSummary,
} from './formalChartFormatters.js';
```

**Edit B — Update row projection (around line 851-882):**

Replace the existing return object inside the `chartScheduleBlocks.map((block, blockIndex) => ...)` (the one starting `return { id: block?.id || ..., blockId: ..., ... }`). The projection currently produces `consumedArtifactsLabel` via raw `.join(', ')` and `gateCriteriaLabel` via direct field access.

Find:

```javascript
            outputArtifactLabel:
              String(block?.outputArtifact?.artifactName || block?.producesArtifact || '').trim() || '—',
            consumedArtifactsLabel:
              Array.isArray(block?.consumedArtifactIds) && block.consumedArtifactIds.length > 0
                ? block.consumedArtifactIds.join(', ')
                : '—',
            gateCriteriaLabel: block?.gateCriteria
              ? `${block.gateCriteria.metricName}: ${block.gateCriteria.threshold}`
              : '—',
          };
```

Replace with:

```javascript
            outputArtifactLabel: formatArtifactLabel(
              block?.outputArtifact?.artifactName || block?.outputArtifact?.id || block?.outputArtifactId || block?.producesArtifact || '',
              artifactRegistry,
            ),
            consumedArtifactsLabel: formatConsumedArtifacts(
              block?.consumedArtifactIds,
              artifactRegistry,
              chartBlocksById,
            ),
            gateCriteriaLabel: formatGateSummary(block),
            blockRef: formatBlockRef(block, blockIndex),
            rawBlockId: String(block?.id || `${deliverableId}-block-${blockIndex + 1}`),
          };
```

**Edit C — Make `chartBlocksById` and `artifactRegistry` available to the projection.**

The projection is wrapped in `useMemo`. We need to build `chartBlocksById` from `chartScheduleBlocks` once, and obtain `artifactRegistry` from props/state (the export already returns it).

At the top of the same `useMemo` body (just before `return deliverables.map(...)`), add:

```javascript
    const chartBlocksById = new Map(
      (chartScheduleBlocks || [])
        .filter((b) => b && b.id)
        .map((b) => [b.id, b]),
    );
    const artifactRegistry = (workspace?.fullHorizonScheduleExport?.artifactRegistry) || {};
```

If `workspace?.fullHorizonScheduleExport?.artifactRegistry` is not the right source (varies by store shape), fall back to `{}` — the formatters degrade gracefully (consumed artifacts will use shortened IDs only when registry is empty).

**Edit D — Update the rendered table header (around line 1629):**

Find:

```jsx
                        <th className="px-2 py-2 font-semibold">Block ID</th>
```

Replace with:

```jsx
                        <th className="px-2 py-2 font-semibold">Ref</th>
```

**Edit E — Update the rendered table row cell (around line 1687-1689):**

Find:

```jsx
                            <td className="px-2 py-2 text-muted/80 whitespace-normal break-all leading-4">
                              {block.blockId}
                            </td>
```

Replace with:

```jsx
                            <td
                              className="px-2 py-2 text-muted/80 whitespace-nowrap leading-4"
                              data-block-id={block.rawBlockId}
                              title={block.rawBlockId}
                            >
                              {block.blockRef}
                            </td>
```

**Edit F — Update consumed-artifacts cell (around line 1697-1700):**

Find:

```jsx
                            <td className="px-2 py-2 text-muted/80 whitespace-normal break-all leading-4">
                              {block.consumedArtifactsLabel}
                            </td>
```

Replace with:

```jsx
                            <td
                              className="px-2 py-2 text-muted/80 whitespace-normal break-words leading-4"
                              title={Array.isArray(block.consumedArtifactIds) ? block.consumedArtifactIds.join('\n') : ''}
                            >
                              {block.consumedArtifactsLabel}
                            </td>
```

For this `title` attribute to work, also add `consumedArtifactIds: block?.consumedArtifactIds || []` to the projected row object in Edit B.

**Verification:**

```bash
cd /Users/jamesdotson/vscode/JERICHO/JERICHO
npx vitest run src/components/zion/formalChartFormatters.test.js  # must still pass
# Also run any existing StructurePageConsolidated tests
npx vitest run tests/components/structure  # only if such tests exist
# And the broad non-regression contract
npx vitest run tests/components/ZionDashboard.applyDraftSchedule.test.jsx
```

**Commit:**

```bash
git add src/components/zion/StructurePageConsolidated.jsx
git commit -m "feat(zion): replace raw IDs with compact refs and semantic labels in formal chart"
```

---

## Phase 2 — Chart readability regression test

### Task 3: Add focused readability test against synthetic fixture

**File:** `tests/components/ZionDashboard.formalChartReadability.test.jsx`

```jsx
import { describe, it, expect } from 'vitest';
import {
  formatBlockRef,
  formatArtifactLabel,
  formatConsumedArtifacts,
  formatGateSummary,
  isInternalId,
} from '../../src/components/zion/formalChartFormatters.js';

// Synthetic blocks shaped like the engine output, with raw internal IDs and
// realistic gate criteria. The chart row projection must convert these into
// compact labels.

const RAW_BLOCK_ID = 'fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-x-2026-05-19-0';
const RAW_ARTIFACT_ID_1 = 'artifact:fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-x-2026-05-19-0';
const RAW_ARTIFACT_ID_2 = 'artifact:fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-y-2026-05-20-0';

const SAMPLE_REGISTRY = {
  [RAW_ARTIFACT_ID_1]: { artifactName: 'launch-proof packet' },
  [RAW_ARTIFACT_ID_2]: { artifactName: 'onboarding clearance' },
};

describe('Formal chart readability — synthetic rows', () => {
  it('block ref is short and does not contain the raw block id', () => {
    const block = { id: RAW_BLOCK_ID, phaseLabel: 'P1', laneLabel: 'Operation Endgame product engine' };
    const ref = formatBlockRef(block, 0);
    expect(ref.length).toBeLessThan(30);
    expect(ref).not.toContain('fh-');
    expect(ref).not.toContain(RAW_BLOCK_ID);
    expect(isInternalId(ref)).toBe(false);
  });

  it('consumed artifacts cell uses semantic labels, not raw IDs', () => {
    const label = formatConsumedArtifacts([RAW_ARTIFACT_ID_1], SAMPLE_REGISTRY, new Map());
    expect(label).toBe('launch-proof packet');
    expect(label).not.toContain('artifact:');
    expect(label).not.toContain('fh-');
  });

  it('consumed artifacts cell summarizes multiple upstream as count + leader', () => {
    const label = formatConsumedArtifacts(
      [RAW_ARTIFACT_ID_1, RAW_ARTIFACT_ID_2],
      SAMPLE_REGISTRY,
      new Map(),
    );
    expect(label).toMatch(/launch-proof packet|onboarding clearance/);
    expect(label).not.toContain('artifact:');
    expect(label).not.toContain('fh-');
  });

  it('consumed artifacts cell falls back gracefully when registry is empty', () => {
    const label = formatConsumedArtifacts([RAW_ARTIFACT_ID_1], {}, new Map());
    expect(label).not.toContain('artifact:fh-masterplan-2b657ad0');
    expect(label.length).toBeLessThan(50);
  });

  it('output artifact label uses registry when given a raw id', () => {
    const label = formatArtifactLabel(RAW_ARTIFACT_ID_1, SAMPLE_REGISTRY);
    expect(label).toBe('launch-proof packet');
  });

  it('non-gate rows show "—" for gate summary', () => {
    expect(formatGateSummary({ blockType: 'action' })).toBe('—');
    expect(formatGateSummary({ blockType: 'review' })).toBe('—');
  });

  it('gate rows show compact human summary, never a raw object dump', () => {
    const gate = {
      blockType: 'gate',
      gateCriteria: {
        metricName: 'launch readiness',
        threshold: 'validated_proof_artifacts >= 1 && critical_blockers_open = 0',
        acceptanceCriteria: 'Upstream proof threshold met...',
      },
    };
    const summary = formatGateSummary(gate);
    expect(summary).toContain('launch readiness');
    expect(summary.length).toBeLessThan(160);
    expect(summary).not.toContain('{');
    expect(summary).not.toContain('}');
  });

  it('no helper returns a string containing the raw block id substring', () => {
    const block = { id: RAW_BLOCK_ID, phaseLabel: 'P1', laneLabel: 'Operation Endgame product engine' };
    expect(formatBlockRef(block, 0)).not.toContain(RAW_BLOCK_ID);
    expect(formatGateSummary(block)).not.toContain(RAW_BLOCK_ID);
  });
});
```

**Commands:**

```bash
cd /Users/jamesdotson/vscode/JERICHO/JERICHO
npx vitest run tests/components/ZionDashboard.formalChartReadability.test.jsx
git add tests/components/ZionDashboard.formalChartReadability.test.jsx
git commit -m "test(zion): add formal chart readability regression"
```

---

## Phase 3 — Verify substrate untouched + completion report

### Task 4: Full non-regression contract + RTG

```bash
cd /Users/jamesdotson/vscode/JERICHO/JERICHO

# Initiative B contract (substrate must be identical)
npx vitest run \
  src/domain/masterPlan/fullHorizonScheduleExpansion.sdlcDepth.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.commercialDepth.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.crossLaneSemantic.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.titleSpecificity.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.incubatingActivationPath.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.gateReadability.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.gateCriteria.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.bdMechanics.test.js \
  src/domain/masterPlan/fullHorizonScheduleExpansion.ownerClass.test.js \
  src/domain/masterPlan/artifactDependencyIntegrity.test.js \
  src/domain/masterPlan/fullHorizonProfessionalism.regression.test.js \
  tests/state/longHorizon.blockGeneration.test.js \
  tests/state/longHorizon.countStability.test.js \
  tests/state/longHorizon.mergeBehavior.test.js \
  tests/state/longHorizon.phaseCoverage.test.js \
  tests/state/longHorizon.visibilityModes.test.js \
  tests/components/ZionDashboard.applyDraftSchedule.test.jsx \
  src/components/zion/formalChartFormatters.test.js \
  tests/components/ZionDashboard.formalChartReadability.test.jsx
```

All must PASS. The stale-fixture residue on `exportFullHorizonSchedule.test.js` is unrelated and not in this run.

### Task 5: Write completion report

**File:** `docs/superpowers/plans/2026-06-05-initiative-c-completion-report.md`

Report covers the 7 required outputs from the implementation prompt:
1. Root cause
2. Files changed
3. Formatters added
4. Tests added/updated
5. Focused validation results
6. Confirmation of display-only scope (no engine substrate mutation)
7. Browser-run readiness

---

## Self-Review Checklist

- ✓ Spec coverage: §1 block ref column, §2 consumed artifact label, §3 output artifact (already semantic, preserved), §4 gate criteria summary, §5 column strategy (renamed "Block ID" → "Ref"), §6 debug traceability via `data-block-id` + `title`, §7 view-model formatters, §8 tests, §9 prior invariant protection.
- ✓ No placeholders. All code, helper signatures, test fixtures, and integration points are concrete.
- ✓ Type/name consistency: `formatBlockRef`, `formatConsumedArtifacts`, `formatGateSummary`, `formatArtifactLabel`, `isInternalId`, `shortenInternalId` — names match between the helper module, the projection code, and the tests.
- ✓ Scope discipline: only `formalChartFormatters.js` (new), `StructurePageConsolidated.jsx` (modify), `formalChartFormatters.test.js` (new), `ZionDashboard.formalChartReadability.test.jsx` (new). Engine substrate files explicitly NOT touched.
