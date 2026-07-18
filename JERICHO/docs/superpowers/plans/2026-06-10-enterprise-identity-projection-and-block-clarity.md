# Enterprise Identity Projection & Molecular Block Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Plan tab overview chart, Block Details panel, and audit layer display intake-backed company/project/product reality (Global State Systems, F8 Energy Co., etc.) instead of abstract generated lane names like `civic` or `Operation Endgame product...`, while preventing the system from silently inventing execution lanes that intake never declared.

**Architecture:** Introduce a new pure-TS domain layer at `src/domain/enterprise/` containing (a) the canonical paper-map enterprise identity reference, (b) a provenance classifier, (c) a projection function that maps internal lane IDs to founder-facing display names, and (d) an audit that compares declared/inferred identities against the canonical map. The audit produces typed failure codes (separate from `PlanQualityFailureCode`) that the Plan chart and Block Details panel consume read-only. No existing engine substrate is mutated; the projection layer is purely additive at the display boundary.

**Tech Stack:** TypeScript (pure domain), React (read-only consumers in `MasterPlanTimeline.jsx` and `BlockDetailsPanel.jsx`), Vitest, existing `resolveBlockPlainLanguage` / `evaluatePlanQualityGate` integration points.

---

## File Structure

**New files (all pure TS, no React):**
- `src/domain/enterprise/enterpriseIdentityMap.ts` — canonical 8-entity paper map (Global State Solutions, Productions, Systems, Holdings, F8 Energy Co., Academy, Corp., Capital/Revenue), plus typo-guard list (`E8 Energy Co.`).
- `src/domain/enterprise/enterpriseIdentityMap.test.ts`
- `src/domain/enterprise/provenanceClassification.ts` — `ProvenanceStatus` type + `classifyProvenance(entity, intakeSignals)` function.
- `src/domain/enterprise/provenanceClassification.test.ts`
- `src/domain/enterprise/laneToEntity.ts` — `mapLaneToEntity(laneId | domainKey)` returns the canonical entity row (e.g., `civic` → `Global State Holdings`, `energy_gym` → `F8 Energy Co.`).
- `src/domain/enterprise/laneToEntity.test.ts`
- `src/domain/enterprise/enterpriseDisplayProjection.ts` — `EnterpriseDisplayProjection` type + `projectEnterpriseDisplay(lane, intakeSignals)` returns founder-facing display name, subtitle, products, type label, phase scope, priority status, provenance status, warnings.
- `src/domain/enterprise/enterpriseDisplayProjection.test.ts`
- `src/domain/enterprise/evaluateEnterpriseIdentityAudit.ts` — `EnterpriseIdentityFailureCode` type + `evaluateEnterpriseIdentityAudit({lanes, projections, blocks})` returns audit findings.
- `src/domain/enterprise/evaluateEnterpriseIdentityAudit.test.ts`

**Modified files:**
- `src/domain/product/resolveBlockPlainLanguage.js` — enforce 5-section molecular output; emit `BLOCK_DETAIL_TOO_ABSTRACT` / `BLOCK_PROVENANCE_MISSING` when `expectedOutput` or `acceptanceEvidence` are missing or generic.
- `src/components/zion/formalChartFormatters.js:9-18` — replace `[/civic|community|government/i, 'Civic']` and add F8/E8 detection by consulting the projection.
- `src/ui/masterPlan/MasterPlanTimeline.jsx:50,94,315,431` — replace hard-coded `civic: 'Civic'` and `{value: 'civic', label: 'Civic'}` with calls into the projection layer.
- `src/components/zion/BlockDetailsPanel.jsx` — add an Enterprise Identity header row above Hierarchy that shows `displayName / displaySubtitle / provenance tag`.
- `src/state/identityCompute.js` — wire `evaluateEnterpriseIdentityAudit` into derived state alongside the existing plan quality gate; expose `enterpriseIdentityAudit` on derived state.

**RTG verification:**
- `src/dev/operationEndgameRestore.js` is the restore source; do not modify it. After implementation, run it through the live engine and inspect the Plan chart + Block Details for civic→Global State Holdings, no E8 references, and molecular block detail structure.

---

### Task 1: Canonical Enterprise Identity Map

The paper-map reference table from the spec, encoded as a typed constant. This is the comparison standard the audit uses — nothing more.

**Files:**
- Create: `src/domain/enterprise/enterpriseIdentityMap.ts`
- Test: `src/domain/enterprise/enterpriseIdentityMap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/enterprise/enterpriseIdentityMap.test.ts
import { describe, it, expect } from 'vitest';
import {
  ENTERPRISE_IDENTITY_MAP,
  INCORRECT_ENTITY_NAME_ALIASES,
  findEnterpriseEntityByDisplayName,
} from './enterpriseIdentityMap';

describe('enterpriseIdentityMap', () => {
  it('contains all 8 paper-map entities', () => {
    expect(ENTERPRISE_IDENTITY_MAP).toHaveLength(8);
  });

  it('uses F8 Energy Co. for the Energy Gym company', () => {
    const energy = ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.companyCategory === 'Energy Gym',
    );
    expect(energy?.displayName).toBe('F8 Energy Co.');
    expect(energy?.products).toContain('Energy Gym concept');
    expect(energy?.phaseScope).toBe('P2-P3');
  });

  it('never contains E8 Energy Co. as a canonical display name', () => {
    const e8 = ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.displayName === 'E8 Energy Co.',
    );
    expect(e8).toBeUndefined();
  });

  it('flags E8 Energy Co. as an incorrect alias', () => {
    expect(INCORRECT_ENTITY_NAME_ALIASES['E8 Energy Co.']).toBe('F8 Energy Co.');
  });

  it('classifies Real Estate as Global State Holdings, P2-P3', () => {
    const realEstate = ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.companyCategory === 'Real Estate',
    );
    expect(realEstate?.displayName).toBe('Global State Holdings');
    expect(realEstate?.phaseScope).toBe('P2-P3');
  });

  it('classifies Project Management as Global State Solutions, P1-P3', () => {
    const pm = ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.companyCategory === 'Project Management',
    );
    expect(pm?.displayName).toBe('Global State Solutions');
    expect(pm?.phaseScope).toBe('P1-P3');
  });

  it('finds an entity by display name', () => {
    const tech = findEnterpriseEntityByDisplayName('Global State Systems');
    expect(tech?.companyCategory).toBe('Technology');
    expect(tech?.products).toContain('Jericho System');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/enterprise/enterpriseIdentityMap.test.ts`
Expected: FAIL with "Cannot find module './enterpriseIdentityMap'".

- [ ] **Step 3: Implement the map**

```ts
// src/domain/enterprise/enterpriseIdentityMap.ts

export type EnterprisePhaseScope = 'P1' | 'P2' | 'P3' | 'P1-P3' | 'P2-P3';

export interface EnterpriseIdentityEntity {
  /** Founder-facing display name (e.g., "Global State Systems", "F8 Energy Co."). */
  displayName: string;
  /** Category label from the paper map (e.g., "Technology", "Real Estate"). */
  companyCategory: string;
  /** Product or project list under this entity. */
  products: string[];
  /** Type label from the paper map. */
  typeLabel: string;
  /** Default phase scope for this entity. */
  phaseScope: EnterprisePhaseScope;
}

/**
 * Canonical paper-map enterprise identity reference. This is the comparison
 * standard the audit uses — it is NOT permission for the schedule generator
 * to invent new execution lanes. Lanes only enter execution content when
 * intake supports them.
 */
export const ENTERPRISE_IDENTITY_MAP: ReadonlyArray<EnterpriseIdentityEntity> = [
  {
    displayName: 'Global State Solutions',
    companyCategory: 'Project Management',
    products: [
      'Parent company',
      'Consulting firm',
      'Operation Endgame operating system',
    ],
    typeLabel: 'Management + consulting / operations',
    phaseScope: 'P1-P3',
  },
  {
    displayName: 'Global State Productions',
    companyCategory: 'Production',
    products: [
      'Help Yourself Broadcast',
      'Podcast',
      'TV',
      'Documentaries',
      'Media products',
    ],
    typeLabel: 'Media / broadcast / production',
    phaseScope: 'P1-P3',
  },
  {
    displayName: 'Global State Systems',
    companyCategory: 'Technology',
    products: ['Jericho System'],
    typeLabel: 'Behavioral Execution Engine / app',
    phaseScope: 'P1-P3',
  },
  {
    displayName: 'Global State Holdings',
    companyCategory: 'Real Estate',
    products: [
      '79th Street',
      'HQ',
      'Private school real estate',
      'Corridor strategy',
    ],
    typeLabel: 'Urban development / property acquisition',
    phaseScope: 'P2-P3',
  },
  {
    displayName: 'F8 Energy Co.',
    companyCategory: 'Energy Gym',
    products: ['Energy Gym concept'],
    typeLabel: 'Gym / manufacturing / wellness concept',
    phaseScope: 'P2-P3',
  },
  {
    displayName: 'Global State Academy',
    companyCategory: 'Private Schools',
    products: ['Private school franchise', 'Education model'],
    typeLabel: 'Education institution',
    phaseScope: 'P2-P3',
  },
  {
    displayName: 'Global State Corp.',
    companyCategory: 'Record Label',
    products: [
      'N8',
      'Romance Riot',
      'Singles',
      'Music streams',
      'Syncs',
      'Shows',
      'Artists',
    ],
    typeLabel: 'Music / record label / artist business',
    phaseScope: 'P1-P3',
  },
  {
    displayName: 'Capital Path or Revenue Engine',
    companyCategory: 'Capital / Revenue',
    products: ['Runway', 'Funding', 'First revenue', 'Monetization'],
    typeLabel: 'Financing / income / commercial proof',
    phaseScope: 'P1-P3',
  },
];

/**
 * Known incorrect aliases that must be normalized. The audit uses this map
 * to flag drift (e.g., the system rendering "E8 Energy Co." instead of "F8").
 * F8 is pronounced like "fate".
 */
export const INCORRECT_ENTITY_NAME_ALIASES: Record<string, string> = {
  'E8 Energy Co.': 'F8 Energy Co.',
  'E8 Energy Company': 'F8 Energy Co.',
  'E8 Energy': 'F8 Energy Co.',
};

export function findEnterpriseEntityByDisplayName(
  displayName: string,
): EnterpriseIdentityEntity | null {
  const normalized = String(displayName || '').trim();
  if (!normalized) return null;
  return (
    ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.displayName.toLowerCase() === normalized.toLowerCase(),
    ) || null
  );
}

export function findEnterpriseEntityByCategory(
  category: string,
): EnterpriseIdentityEntity | null {
  const normalized = String(category || '').trim();
  if (!normalized) return null;
  return (
    ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.companyCategory.toLowerCase() === normalized.toLowerCase(),
    ) || null
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/enterprise/enterpriseIdentityMap.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/enterprise/enterpriseIdentityMap.ts src/domain/enterprise/enterpriseIdentityMap.test.ts
git commit -m "Add canonical enterprise identity map with F8 Energy Co."
```

---

### Task 2: Provenance Classification

Each enterprise entity must be classifiable as intake-declared, intake-normalized, system-inferred, placeholder, deprecated, or unsupported. This is the discipline that prevents the system from silently inventing companies.

**Files:**
- Create: `src/domain/enterprise/provenanceClassification.ts`
- Test: `src/domain/enterprise/provenanceClassification.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/enterprise/provenanceClassification.test.ts
import { describe, it, expect } from 'vitest';
import { classifyProvenance } from './provenanceClassification';

describe('classifyProvenance', () => {
  it('returns intake_declared when an exact lane name appears in intake text', () => {
    const result = classifyProvenance({
      laneId: 'product',
      laneLabel: 'Product',
      intakeSignals: {
        goalText: 'Build product, creative, media, operations lanes.',
        declaredLaneIds: ['product', 'creative', 'media', 'operations'],
      },
    });
    expect(result.status).toBe('intake_declared');
    expect(result.sourceEvidence).toContain('declaredLaneIds');
  });

  it('returns intake_normalized when civic was declared but display normalizes to Real Estate', () => {
    const result = classifyProvenance({
      laneId: 'civic',
      laneLabel: 'Civic',
      normalizedDisplayName: 'Global State Holdings',
      intakeSignals: {
        goalText: 'Civic pathways across the 5-year horizon.',
        declaredLaneIds: ['civic'],
      },
    });
    expect(result.status).toBe('intake_normalized');
  });

  it('returns system_placeholder when lane has no intake signal at all', () => {
    const result = classifyProvenance({
      laneId: 'energy_gym',
      laneLabel: 'Energy Gym',
      intakeSignals: {
        goalText: 'Build product, creative, media lanes.',
        declaredLaneIds: ['product', 'creative', 'media'],
      },
    });
    expect(result.status).toBe('system_placeholder');
  });

  it('returns system_inferred when goal text mentions the concept without declaring a lane', () => {
    const result = classifyProvenance({
      laneId: 'capital',
      laneLabel: 'Capital',
      intakeSignals: {
        goalText:
          'Build product, creative, and media. Funded capital pathway by 2031.',
        declaredLaneIds: ['product', 'creative', 'media'],
      },
    });
    expect(result.status).toBe('system_inferred');
  });

  it('returns deprecated when the lane is on the deprecated list', () => {
    const result = classifyProvenance({
      laneId: 'civic',
      laneLabel: 'Civic',
      isDeprecatedLabel: true,
      intakeSignals: { goalText: '', declaredLaneIds: [] },
    });
    expect(result.status).toBe('deprecated');
  });

  it('returns unsupported when the entity has no map entry and no intake support', () => {
    const result = classifyProvenance({
      laneId: 'unknown_lane',
      laneLabel: 'Unknown',
      hasMapEntry: false,
      intakeSignals: { goalText: '', declaredLaneIds: [] },
    });
    expect(result.status).toBe('unsupported');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/enterprise/provenanceClassification.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement classification**

```ts
// src/domain/enterprise/provenanceClassification.ts

export type ProvenanceStatus =
  | 'intake_declared'
  | 'intake_normalized'
  | 'system_inferred'
  | 'system_placeholder'
  | 'deprecated'
  | 'unsupported';

export interface IntakeSignals {
  /** The goal contract text the user submitted at intake. */
  goalText: string;
  /** Lane IDs the intake explicitly declared. */
  declaredLaneIds: string[];
}

export interface ProvenanceClassificationInput {
  laneId: string;
  laneLabel: string;
  /** When the display name differs from the raw lane label (e.g., civic → Global State Holdings). */
  normalizedDisplayName?: string | null;
  /** True when the raw lane label is on the deprecated list. */
  isDeprecatedLabel?: boolean;
  /** True when this entity exists in the canonical enterprise map. */
  hasMapEntry?: boolean;
  intakeSignals: IntakeSignals;
}

export interface ProvenanceClassification {
  status: ProvenanceStatus;
  sourceEvidence: string[];
}

const CONCEPT_KEYWORDS_BY_LANE: Record<string, RegExp[]> = {
  capital: [/capital/i, /funding/i, /runway/i],
  revenue: [/revenue/i, /income/i, /monetization/i],
  product: [/product/i, /software/i, /app/i],
  creative: [/creative/i, /album/i, /music/i, /artist/i],
  media: [/media/i, /podcast/i, /tv\b/i, /documentar/i],
  operations: [/operations/i, /ops\b/i, /operating system/i],
  civic: [/civic/i, /coalition/i],
  real_estate: [/real estate/i, /property/i, /corridor/i, /79th/i, /\bhq\b/i],
  institution: [/institution/i],
  education: [/private school/i, /education/i, /academy/i],
  energy_gym: [/energy gym/i, /f8/i],
};

export function classifyProvenance(
  input: ProvenanceClassificationInput,
): ProvenanceClassification {
  const { laneId, intakeSignals, isDeprecatedLabel, hasMapEntry, normalizedDisplayName } = input;
  const evidence: string[] = [];

  if (isDeprecatedLabel === true) {
    return { status: 'deprecated', sourceEvidence: ['deprecatedLabelList'] };
  }

  const declared = Array.isArray(intakeSignals.declaredLaneIds)
    ? intakeSignals.declaredLaneIds.map((value) => String(value || '').toLowerCase().trim())
    : [];
  const isDeclared = declared.includes(String(laneId || '').toLowerCase().trim());

  if (isDeclared && normalizedDisplayName) {
    evidence.push('declaredLaneIds', 'normalizedDisplayName');
    return { status: 'intake_normalized', sourceEvidence: evidence };
  }

  if (isDeclared) {
    evidence.push('declaredLaneIds');
    return { status: 'intake_declared', sourceEvidence: evidence };
  }

  const goalText = String(intakeSignals.goalText || '');
  const keywords = CONCEPT_KEYWORDS_BY_LANE[laneId] || [];
  const conceptMatch = keywords.some((pattern) => pattern.test(goalText));
  if (conceptMatch) {
    evidence.push('goalTextConceptMatch');
    return { status: 'system_inferred', sourceEvidence: evidence };
  }

  if (hasMapEntry === false) {
    return { status: 'unsupported', sourceEvidence: [] };
  }

  return { status: 'system_placeholder', sourceEvidence: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/enterprise/provenanceClassification.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/enterprise/provenanceClassification.ts src/domain/enterprise/provenanceClassification.test.ts
git commit -m "Classify enterprise provenance against intake signals"
```

---

### Task 3: Internal Lane → Enterprise Entity Mapping

Bridge between the schedule's domain keys (`civic`, `product`, `real_estate`, `energy_gym`) and the canonical entities. This is also where the `civic → Global State Holdings` normalization lives.

**Files:**
- Create: `src/domain/enterprise/laneToEntity.ts`
- Test: `src/domain/enterprise/laneToEntity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/enterprise/laneToEntity.test.ts
import { describe, it, expect } from 'vitest';
import {
  mapLaneToEntity,
  DEPRECATED_LANE_LABELS,
} from './laneToEntity';

describe('mapLaneToEntity', () => {
  it('maps civic to Global State Holdings (Real Estate)', () => {
    const entity = mapLaneToEntity('civic');
    expect(entity?.displayName).toBe('Global State Holdings');
    expect(entity?.companyCategory).toBe('Real Estate');
  });

  it('maps real_estate to Global State Holdings', () => {
    expect(mapLaneToEntity('real_estate')?.displayName).toBe('Global State Holdings');
  });

  it('maps product to Global State Systems', () => {
    expect(mapLaneToEntity('product')?.displayName).toBe('Global State Systems');
  });

  it('maps creative to Global State Corp. (record label)', () => {
    expect(mapLaneToEntity('creative')?.displayName).toBe('Global State Corp.');
  });

  it('maps media to Global State Productions', () => {
    expect(mapLaneToEntity('media')?.displayName).toBe('Global State Productions');
  });

  it('maps operations to Global State Solutions (consulting/PM)', () => {
    expect(mapLaneToEntity('operations')?.displayName).toBe('Global State Solutions');
  });

  it('maps capital and revenue to Capital Path or Revenue Engine', () => {
    expect(mapLaneToEntity('capital')?.displayName).toBe('Capital Path or Revenue Engine');
    expect(mapLaneToEntity('revenue')?.displayName).toBe('Capital Path or Revenue Engine');
  });

  it('maps energy_gym to F8 Energy Co.', () => {
    expect(mapLaneToEntity('energy_gym')?.displayName).toBe('F8 Energy Co.');
  });

  it('maps education and institution to Global State Academy', () => {
    expect(mapLaneToEntity('education')?.displayName).toBe('Global State Academy');
    expect(mapLaneToEntity('institution')?.displayName).toBe('Global State Academy');
  });

  it('returns null for an unrecognized lane id', () => {
    expect(mapLaneToEntity('unrecognized_xyz')).toBeNull();
  });

  it('treats civic as deprecated as a user-facing label', () => {
    expect(DEPRECATED_LANE_LABELS).toContain('civic');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/enterprise/laneToEntity.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the mapping**

```ts
// src/domain/enterprise/laneToEntity.ts
import {
  ENTERPRISE_IDENTITY_MAP,
  type EnterpriseIdentityEntity,
} from './enterpriseIdentityMap';

const LANE_TO_CATEGORY: Record<string, string> = {
  product: 'Technology',
  software: 'Technology',
  creative: 'Record Label',
  album: 'Record Label',
  music: 'Record Label',
  media: 'Production',
  podcast: 'Production',
  broadcast: 'Production',
  operations: 'Project Management',
  ops: 'Project Management',
  brand: 'Project Management',
  company: 'Project Management',
  capital: 'Capital / Revenue',
  revenue: 'Capital / Revenue',
  income: 'Capital / Revenue',
  runway: 'Capital / Revenue',
  civic: 'Real Estate',
  district: 'Real Estate',
  real_estate: 'Real Estate',
  property: 'Real Estate',
  institution: 'Private Schools',
  education: 'Private Schools',
  energy_gym: 'Energy Gym',
};

/**
 * User-facing lane labels we no longer want to display as primary chart text.
 * `civic` normalizes to Real Estate / Global State Holdings.
 */
export const DEPRECATED_LANE_LABELS: ReadonlyArray<string> = ['civic'];

export function mapLaneToEntity(
  laneIdOrDomain: string,
): EnterpriseIdentityEntity | null {
  const normalized = String(laneIdOrDomain || '').trim().toLowerCase();
  if (!normalized) return null;
  const category = LANE_TO_CATEGORY[normalized];
  if (!category) return null;
  return (
    ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.companyCategory === category,
    ) || null
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/enterprise/laneToEntity.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/enterprise/laneToEntity.ts src/domain/enterprise/laneToEntity.test.ts
git commit -m "Map schedule lane keys to canonical enterprise entities"
```

---

### Task 4: Enterprise Display Projection

The pure projection function the Plan chart and Block Details consume. Combines entity + provenance + priority status into a single founder-facing payload.

**Files:**
- Create: `src/domain/enterprise/enterpriseDisplayProjection.ts`
- Test: `src/domain/enterprise/enterpriseDisplayProjection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/enterprise/enterpriseDisplayProjection.test.ts
import { describe, it, expect } from 'vitest';
import { projectEnterpriseDisplay } from './enterpriseDisplayProjection';

describe('projectEnterpriseDisplay', () => {
  const OE_INTAKE = {
    goalText:
      'Build product, creative, media, operations, revenue, capital, institution, and civic pathways. Funded capital pathway by 2031.',
    declaredLaneIds: [
      'product', 'creative', 'media', 'operations',
      'revenue', 'capital', 'institution', 'civic',
    ],
  };

  it('projects product as Global State Systems / Jericho with intake_declared', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'product',
      laneLabel: 'Product',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).toBe('Global State Systems');
    expect(projection.displaySubtitle).toContain('Jericho');
    expect(projection.companyCategory).toBe('Technology');
    expect(projection.provenanceStatus).toBe('intake_declared');
    expect(projection.phaseScope).toBe('P1-P3');
  });

  it('projects civic as Global State Holdings with intake_normalized and Real Estate warning', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'civic',
      laneLabel: 'Civic',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).toBe('Global State Holdings');
    expect(projection.companyCategory).toBe('Real Estate');
    expect(projection.provenanceStatus).toBe('intake_normalized');
    expect(projection.phaseScope).toBe('P2-P3');
    expect(projection.priorityStatus).toBe('deferred');
    expect(projection.warnings?.[0]).toMatch(/Real Estate is not P1-critical/);
  });

  it('projects energy_gym with no intake support as F8 Energy Co. system_placeholder', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'energy_gym',
      laneLabel: 'Energy Gym',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).toBe('F8 Energy Co.');
    expect(projection.provenanceStatus).toBe('system_placeholder');
    expect(projection.priorityStatus).toBe('deferred');
  });

  it('never produces E8 Energy Co. as a display name', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'energy_gym',
      laneLabel: 'E8 Energy Co.',
      intakeSignals: OE_INTAKE,
    });
    expect(projection.displayName).not.toBe('E8 Energy Co.');
    expect(projection.displayName).toBe('F8 Energy Co.');
  });

  it('produces unsupported projection with no display name when the lane has no map entry', () => {
    const projection = projectEnterpriseDisplay({
      laneId: 'mystery_lane',
      laneLabel: 'Mystery',
      intakeSignals: { goalText: '', declaredLaneIds: [] },
    });
    expect(projection.provenanceStatus).toBe('unsupported');
    expect(projection.displayName).toBe('Mystery');
    expect(projection.warnings?.[0]).toMatch(/no canonical enterprise entity/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/enterprise/enterpriseDisplayProjection.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the projection**

```ts
// src/domain/enterprise/enterpriseDisplayProjection.ts
import { mapLaneToEntity, DEPRECATED_LANE_LABELS } from './laneToEntity';
import {
  classifyProvenance,
  type IntakeSignals,
  type ProvenanceStatus,
} from './provenanceClassification';
import type { EnterprisePhaseScope } from './enterpriseIdentityMap';

export type EnterprisePriorityStatus =
  | 'active'
  | 'incubating'
  | 'deferred'
  | 'gated'
  | 'blocked';

export interface EnterpriseDisplayProjection {
  displayName: string;
  displaySubtitle: string;
  internalLane: string;
  companyCategory: string;
  products: string[];
  typeLabel: string;
  phaseScope: EnterprisePhaseScope;
  priorityStatus: EnterprisePriorityStatus;
  provenanceStatus: ProvenanceStatus;
  sourceEvidence: string[];
  warnings: string[];
}

export interface EnterpriseDisplayProjectionInput {
  laneId: string;
  laneLabel: string;
  intakeSignals: IntakeSignals;
}

const PRIORITY_BY_SCOPE: Record<EnterprisePhaseScope, EnterprisePriorityStatus> = {
  P1: 'active',
  'P1-P3': 'active',
  P2: 'incubating',
  P3: 'incubating',
  'P2-P3': 'deferred',
};

const REAL_ESTATE_WARNING =
  'Real Estate is not P1-critical unless prerequisite proof, capital, legal, runway, or dependency constraints justify it.';
const F8_PRONUNCIATION_NOTE =
  'F8 Energy Co. (pronounced like "fate"). Energy Gym belongs under F8 Energy Co., not E8 Energy Co.';
const UNSUPPORTED_WARNING =
  'No canonical enterprise entity matched this lane; treat as system-only until intake supports it.';

export function projectEnterpriseDisplay(
  input: EnterpriseDisplayProjectionInput,
): EnterpriseDisplayProjection {
  const { laneId, laneLabel, intakeSignals } = input;
  const entity = mapLaneToEntity(laneId);
  const isDeprecatedLabel = DEPRECATED_LANE_LABELS.includes(
    String(laneId || '').toLowerCase().trim(),
  );

  if (!entity) {
    const classification = classifyProvenance({
      laneId,
      laneLabel,
      hasMapEntry: false,
      intakeSignals,
    });
    return {
      displayName: laneLabel || laneId || 'Unknown',
      displaySubtitle: '',
      internalLane: laneId,
      companyCategory: '',
      products: [],
      typeLabel: '',
      phaseScope: 'P2-P3',
      priorityStatus: 'deferred',
      provenanceStatus: classification.status,
      sourceEvidence: classification.sourceEvidence,
      warnings: [UNSUPPORTED_WARNING],
    };
  }

  const classification = classifyProvenance({
    laneId,
    laneLabel,
    normalizedDisplayName: entity.displayName,
    isDeprecatedLabel,
    hasMapEntry: true,
    intakeSignals,
  });

  const warnings: string[] = [];
  if (entity.companyCategory === 'Real Estate') {
    warnings.push(REAL_ESTATE_WARNING);
  }
  if (entity.companyCategory === 'Energy Gym') {
    warnings.push(F8_PRONUNCIATION_NOTE);
  }

  const priorityStatus: EnterprisePriorityStatus =
    classification.status === 'system_placeholder' ||
    classification.status === 'deprecated'
      ? 'deferred'
      : PRIORITY_BY_SCOPE[entity.phaseScope];

  const subtitle = entity.products.length > 0
    ? entity.products.slice(0, 3).join(' / ')
    : entity.typeLabel;

  return {
    displayName: entity.displayName,
    displaySubtitle: subtitle,
    internalLane: laneId,
    companyCategory: entity.companyCategory,
    products: [...entity.products],
    typeLabel: entity.typeLabel,
    phaseScope: entity.phaseScope,
    priorityStatus,
    provenanceStatus: classification.status,
    sourceEvidence: classification.sourceEvidence,
    warnings,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/enterprise/enterpriseDisplayProjection.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/enterprise/enterpriseDisplayProjection.ts src/domain/enterprise/enterpriseDisplayProjection.test.ts
git commit -m "Project enterprise identity for founder-facing display"
```

---

### Task 5: Enterprise Identity Audit

The audit that consumes a list of projections (and block detail signals) and emits the typed failure codes from the spec. This is the gate the Plan chart and Block Details consult to decide what to flag.

**Files:**
- Create: `src/domain/enterprise/evaluateEnterpriseIdentityAudit.ts`
- Test: `src/domain/enterprise/evaluateEnterpriseIdentityAudit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/enterprise/evaluateEnterpriseIdentityAudit.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateEnterpriseIdentityAudit } from './evaluateEnterpriseIdentityAudit';
import { projectEnterpriseDisplay } from './enterpriseDisplayProjection';

const OE_INTAKE = {
  goalText:
    'Build product, creative, media, operations, revenue, capital, institution, and civic pathways.',
  declaredLaneIds: [
    'product', 'creative', 'media', 'operations',
    'revenue', 'capital', 'institution', 'civic',
  ],
};

describe('evaluateEnterpriseIdentityAudit', () => {
  it('emits no failures when civic resolves to Global State Holdings normalized', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'civic', laneLabel: 'Civic', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: projections.map((p) => ({ primaryLabel: p.displayName, laneId: p.internalLane })),
      blocks: [],
    });
    expect(audit.findings.filter((f) => f.code === 'CIVIC_LABEL_NOT_NORMALIZED')).toHaveLength(0);
  });

  it('emits CIVIC_LABEL_NOT_NORMALIZED when the chart still renders "Civic" as the primary label', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'civic', laneLabel: 'Civic', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Civic', laneId: 'civic' }],
      blocks: [],
    });
    expect(audit.findings.some((f) => f.code === 'CIVIC_LABEL_NOT_NORMALIZED')).toBe(true);
  });

  it('emits INCORRECT_ENTERPRISE_ENTITY_NAME when E8 Energy Co. appears anywhere', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'energy_gym', laneLabel: 'Energy Gym', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'E8 Energy Co.', laneId: 'energy_gym' }],
      blocks: [],
    });
    const finding = audit.findings.find((f) => f.code === 'INCORRECT_ENTERPRISE_ENTITY_NAME');
    expect(finding).toBeDefined();
    expect(finding?.detail).toMatch(/F8 Energy Co/);
  });

  it('emits DISPLAY_ROW_USES_INTERNAL_LANE_NAME when chart label looks like an internal id', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'product', laneLabel: 'Product', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Operation Endgame product proof...', laneId: 'product' }],
      blocks: [],
    });
    expect(audit.findings.some((f) => f.code === 'DISPLAY_ROW_USES_INTERNAL_LANE_NAME')).toBe(true);
  });

  it('emits REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED when a Real Estate block is scheduled in P1 without justification', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'civic', laneLabel: 'Civic', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Global State Holdings', laneId: 'civic' }],
      blocks: [
        {
          id: 'block-x',
          laneId: 'civic',
          phaseLabel: 'P1',
          blockType: 'execution',
          gatesJustification: null,
        },
      ],
    });
    expect(audit.findings.some((f) => f.code === 'REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED')).toBe(true);
  });

  it('emits BLOCK_DETAIL_TOO_ABSTRACT when block has no concrete artifact or evidence', () => {
    const projections = [
      projectEnterpriseDisplay({ laneId: 'product', laneLabel: 'Product', intakeSignals: OE_INTAKE }),
    ];
    const audit = evaluateEnterpriseIdentityAudit({
      projections,
      chartRows: [{ primaryLabel: 'Global State Systems', laneId: 'product' }],
      blocks: [
        {
          id: 'block-y',
          laneId: 'product',
          phaseLabel: 'P1',
          blockType: 'execution',
          expectedOutput: '',
          acceptanceEvidence: '',
        },
      ],
    });
    expect(audit.findings.some((f) => f.code === 'BLOCK_DETAIL_TOO_ABSTRACT')).toBe(true);
  });

  it('emits BLOCK_PROVENANCE_MISSING when a block has no resolvable lane or entity', () => {
    const audit = evaluateEnterpriseIdentityAudit({
      projections: [],
      chartRows: [],
      blocks: [
        {
          id: 'block-z',
          laneId: null,
          phaseLabel: 'P1',
          blockType: 'execution',
        },
      ],
    });
    expect(audit.findings.some((f) => f.code === 'BLOCK_PROVENANCE_MISSING')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/enterprise/evaluateEnterpriseIdentityAudit.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the audit**

```ts
// src/domain/enterprise/evaluateEnterpriseIdentityAudit.ts
import type { EnterpriseDisplayProjection } from './enterpriseDisplayProjection';
import { INCORRECT_ENTITY_NAME_ALIASES } from './enterpriseIdentityMap';

export type EnterpriseIdentityFailureCode =
  | 'CIVIC_LABEL_NOT_NORMALIZED'
  | 'REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED'
  | 'DISPLAY_ROW_USES_INTERNAL_LANE_NAME'
  | 'COMPANY_NAME_MISSING_FROM_PLAN_CHART'
  | 'PRODUCT_NAME_MISSING_FROM_PLAN_CHART'
  | 'UNSUPPORTED_ENTERPRISE_ENTITY'
  | 'AMBIGUOUS_REVENUE_RUNWAY_LANE'
  | 'BLOCK_DETAIL_TOO_ABSTRACT'
  | 'BLOCK_PROVENANCE_MISSING'
  | 'INCORRECT_ENTERPRISE_ENTITY_NAME';

export interface EnterpriseIdentityFinding {
  code: EnterpriseIdentityFailureCode;
  detail: string;
  laneId?: string;
  blockId?: string;
}

export interface EnterpriseIdentityAuditChartRow {
  primaryLabel: string;
  laneId: string;
}

export interface EnterpriseIdentityAuditBlockSignal {
  id: string;
  laneId: string | null;
  phaseLabel?: string;
  blockType?: string;
  /** Truthy when the Real Estate / capital P1 placement has explicit justification. */
  gatesJustification?: unknown;
  expectedOutput?: string;
  acceptanceEvidence?: string;
}

export interface EnterpriseIdentityAuditInput {
  projections: EnterpriseDisplayProjection[];
  chartRows: EnterpriseIdentityAuditChartRow[];
  blocks: EnterpriseIdentityAuditBlockSignal[];
}

export interface EnterpriseIdentityAuditResult {
  findings: EnterpriseIdentityFinding[];
}

const INTERNAL_NAME_PATTERN = /^operation endgame|\.{3}$|prod\.{3}|civic\b|product_|lane_/i;
const GENERIC_OUTPUT_TOKENS = ['', '—', 'tbd', 'todo', 'n/a'];

function isGenericText(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return GENERIC_OUTPUT_TOKENS.includes(normalized);
}

export function evaluateEnterpriseIdentityAudit(
  input: EnterpriseIdentityAuditInput,
): EnterpriseIdentityAuditResult {
  const findings: EnterpriseIdentityFinding[] = [];
  const projectionByLane = new Map(
    input.projections.map((p) => [p.internalLane, p]),
  );

  for (const row of input.chartRows) {
    const normalizedLabel = String(row.primaryLabel || '').trim();
    const lowered = normalizedLabel.toLowerCase();

    if (lowered === 'civic') {
      findings.push({
        code: 'CIVIC_LABEL_NOT_NORMALIZED',
        detail: 'Chart row renders "Civic" as primary label; expected "Global State Holdings".',
        laneId: row.laneId,
      });
    }

    const incorrectAlias = Object.keys(INCORRECT_ENTITY_NAME_ALIASES).find(
      (alias) => alias.toLowerCase() === lowered,
    );
    if (incorrectAlias) {
      findings.push({
        code: 'INCORRECT_ENTERPRISE_ENTITY_NAME',
        detail: `Chart row renders "${incorrectAlias}"; expected "${INCORRECT_ENTITY_NAME_ALIASES[incorrectAlias]}".`,
        laneId: row.laneId,
      });
    }

    if (INTERNAL_NAME_PATTERN.test(normalizedLabel)) {
      findings.push({
        code: 'DISPLAY_ROW_USES_INTERNAL_LANE_NAME',
        detail: `Chart row "${normalizedLabel}" looks like an internal lane name rather than a founder-facing display name.`,
        laneId: row.laneId,
      });
    }

    const projection = projectionByLane.get(row.laneId);
    if (projection && projection.provenanceStatus === 'unsupported') {
      findings.push({
        code: 'UNSUPPORTED_ENTERPRISE_ENTITY',
        detail: `Chart row "${normalizedLabel}" has no canonical enterprise entity.`,
        laneId: row.laneId,
      });
    }
  }

  for (const block of input.blocks) {
    if (!block.laneId) {
      findings.push({
        code: 'BLOCK_PROVENANCE_MISSING',
        detail: 'Block has no resolvable lane id; provenance cannot be determined.',
        blockId: block.id,
      });
      continue;
    }

    const projection = projectionByLane.get(block.laneId);
    const isRealEstate = projection?.companyCategory === 'Real Estate';
    const isExecution = String(block.blockType || '').toLowerCase() === 'execution';
    const isP1 = String(block.phaseLabel || '').toUpperCase() === 'P1';
    if (isRealEstate && isP1 && isExecution && !block.gatesJustification) {
      findings.push({
        code: 'REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED',
        detail:
          'Real Estate execution block scheduled in P1 without prerequisite, capital, legal, runway, or dependency justification.',
        laneId: block.laneId,
        blockId: block.id,
      });
    }

    if (isGenericText(block.expectedOutput) || isGenericText(block.acceptanceEvidence)) {
      findings.push({
        code: 'BLOCK_DETAIL_TOO_ABSTRACT',
        detail:
          'Block detail is missing a concrete artifact (Produces) or inspectable proof (Acceptance evidence).',
        laneId: block.laneId,
        blockId: block.id,
      });
    }
  }

  return { findings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/enterprise/evaluateEnterpriseIdentityAudit.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/enterprise/evaluateEnterpriseIdentityAudit.ts src/domain/enterprise/evaluateEnterpriseIdentityAudit.test.ts
git commit -m "Audit enterprise identity projections and chart rows"
```

---

### Task 6: Plan Tab Overview Chart — Use Projection Layer

Replace hard-coded `civic: 'Civic'` and lane lists in `MasterPlanTimeline.jsx` with calls into the projection. Also fix `formalChartFormatters.js` family detector to consult the projection.

**Files:**
- Modify: `src/ui/masterPlan/MasterPlanTimeline.jsx:48-56,92-100,313-320,429-438`
- Modify: `src/components/zion/formalChartFormatters.js:9-18,37-44`
- Test: `tests/components/MasterPlanTimeline.enterpriseLabels.test.jsx` (new)

- [ ] **Step 1: Write the failing component test**

```jsx
// tests/components/MasterPlanTimeline.enterpriseLabels.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MasterPlanTimeline from '../../src/ui/masterPlan/MasterPlanTimeline.jsx';

const OE_LANES = [
  { id: 'product', domain: 'product', label: 'Product' },
  { id: 'civic', domain: 'civic', label: 'Civic' },
  { id: 'energy_gym', domain: 'energy_gym', label: 'Energy Gym' },
];

const OE_INTAKE = {
  goalText: 'product, creative, media, operations, civic pathways',
  declaredLaneIds: ['product', 'civic'],
};

describe('MasterPlanTimeline enterprise-facing labels', () => {
  it('renders Global State Holdings instead of Civic for the civic lane', () => {
    render(
      <MasterPlanTimeline
        lanes={OE_LANES}
        milestones={[]}
        intakeSignals={OE_INTAKE}
      />,
    );
    expect(screen.getByText('Global State Holdings')).toBeInTheDocument();
    expect(screen.queryByText(/^Civic$/)).toBeNull();
  });

  it('renders F8 Energy Co. (not E8) for the energy_gym lane', () => {
    render(
      <MasterPlanTimeline
        lanes={OE_LANES}
        milestones={[]}
        intakeSignals={OE_INTAKE}
      />,
    );
    expect(screen.getByText('F8 Energy Co.')).toBeInTheDocument();
    expect(screen.queryByText(/E8 Energy Co\./)).toBeNull();
  });

  it('renders Global State Systems for product lane', () => {
    render(
      <MasterPlanTimeline
        lanes={OE_LANES}
        milestones={[]}
        intakeSignals={OE_INTAKE}
      />,
    );
    expect(screen.getByText('Global State Systems')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/MasterPlanTimeline.enterpriseLabels.test.jsx`
Expected: FAIL with "Unable to find element 'Global State Holdings'".

- [ ] **Step 3: Replace the hard-coded lane label table in `MasterPlanTimeline.jsx`**

Read lines 40-60 first to confirm exact content; then replace the static `domainLaneLabels` object. The shape currently looks like:

```jsx
// Around line 45-56
const domainLaneLabels = {
  product: 'Product',
  creative: 'Creative',
  media: 'Media',
  operations: 'Operations',
  revenue: 'Revenue',
  capital: 'Capital',
  institution: 'Institution',
  civic: 'Civic',
};
```

Replace with a projection-driven helper:

```jsx
import { projectEnterpriseDisplay } from '../../domain/enterprise/enterpriseDisplayProjection';

function resolveDomainLaneLabel(domain, intakeSignals) {
  const projection = projectEnterpriseDisplay({
    laneId: domain,
    laneLabel: domain,
    intakeSignals: intakeSignals || { goalText: '', declaredLaneIds: [] },
  });
  return projection.displayName;
}
```

And accept `intakeSignals` as a prop on `MasterPlanTimeline`. Where `domainLaneLabels[laneId]` was looked up, call `resolveDomainLaneLabel(laneId, intakeSignals)` instead. Also adjust line ~94 (`{ value: 'civic', label: 'Civic' }`) to compute labels via the projection.

- [ ] **Step 4: Replace family detector in `formalChartFormatters.js`**

```js
// src/components/zion/formalChartFormatters.js (around line 9-18)
import { projectEnterpriseDisplay } from '../../domain/enterprise/enterpriseDisplayProjection';

function familyTokenFromLane(laneLabel) {
  const t = String(laneLabel || '').trim();
  if (!t) return null;
  const projection = projectEnterpriseDisplay({
    laneId: t,
    laneLabel: t,
    intakeSignals: { goalText: '', declaredLaneIds: [] },
  });
  if (projection.companyCategory) return projection.companyCategory;
  return null;
}
```

(Remove the `FAMILY_KEYWORDS` constant and its references.)

- [ ] **Step 5: Wire intakeSignals from store into MasterPlanTimeline render site**

Find where `MasterPlanTimeline` is rendered (likely `StructurePageConsolidated.jsx` or `Workspace.jsx`) and pass `intakeSignals={{ goalText: state.coreMissionContract?.goalText || '', declaredLaneIds: (state.masterPlan?.laneIds || []) }}`.

```bash
grep -n "MasterPlanTimeline" src/components/zion/*.jsx src/components/*.jsx
```

Then add the prop at the call site.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/components/MasterPlanTimeline.enterpriseLabels.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Run formalChartFormatters tests to confirm no regression**

Run: `npx vitest run src/components/zion/formalChartFormatters.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/masterPlan/MasterPlanTimeline.jsx src/components/zion/formalChartFormatters.js src/components/zion/StructurePageConsolidated.jsx tests/components/MasterPlanTimeline.enterpriseLabels.test.jsx
git commit -m "Render founder-facing entity names in Plan tab chart"
```

---

### Task 7: Harden Block Details to Enforce Molecular Standard

`BlockDetailsPanel.jsx` already has the 5-section layout. The data quality (`resolveBlockPlainLanguage.js`) is the gap: it can return empty `expectedOutput` or generic `acceptanceEvidence`. Add a quality check that classifies a block detail as `under_specified` when those fields are missing or generic.

**Files:**
- Modify: `src/domain/product/resolveBlockPlainLanguage.js` (add quality-section enforcement)
- Test: `src/domain/product/resolveBlockPlainLanguage.molecular.test.js` (new)

- [ ] **Step 1: Write the failing test**

```js
// src/domain/product/resolveBlockPlainLanguage.molecular.test.js
import { describe, it, expect } from 'vitest';
import { resolveBlockPlainLanguage } from './resolveBlockPlainLanguage.js';

const HIERARCHY = {
  block: 'Operator review',
  lane: 'Operations',
  phase: 'P1',
};

describe('resolveBlockPlainLanguage molecular sections', () => {
  it('flags under_specified when expectedOutput is empty', () => {
    const block = {
      id: 'a',
      label: 'Review thing',
      laneId: 'operations',
      expectedOutput: '',
      acceptanceEvidence: 'a saved review',
      plainAction: 'Do the review',
      steps: ['Open the file', 'Mark each row', 'Sign off'],
      doneWhen: 'All rows signed',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality.status).toBe('under_specified');
    expect(result.quality.failureCodes).toContain('BLOCK_DETAIL_TOO_ABSTRACT');
  });

  it('flags under_specified when acceptanceEvidence is generic', () => {
    const block = {
      id: 'b',
      label: 'Review thing',
      laneId: 'operations',
      expectedOutput: 'A control sheet',
      acceptanceEvidence: 'TBD',
      plainAction: 'Do the review',
      steps: ['Open the file', 'Mark each row', 'Sign off'],
      doneWhen: 'All rows signed',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality.status).toBe('under_specified');
    expect(result.quality.failureCodes).toContain('BLOCK_DETAIL_TOO_ABSTRACT');
  });

  it('flags under_specified when steps array is empty', () => {
    const block = {
      id: 'c',
      label: 'Review thing',
      laneId: 'operations',
      expectedOutput: 'A control sheet',
      acceptanceEvidence: 'A saved sheet reviewed in May',
      plainAction: '',
      steps: [],
      doneWhen: 'All rows signed',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality.status).toBe('under_specified');
    expect(result.quality.failureCodes).toContain('BLOCK_DETAIL_DO_THIS_EMPTY');
  });

  it('passes when all five molecular sections have concrete content', () => {
    const block = {
      id: 'd',
      label: 'Operations control sheet review',
      laneId: 'operations',
      expectedOutput:
        'Operations checklist with each control, owner, review cadence, dependency, and next gate date.',
      acceptanceEvidence:
        'A saved checklist that can be opened and reviewed during the May 2026 operating review.',
      plainAction: 'Open the operations checklist and review each control.',
      steps: [
        'Open the operations checklist file in the shared workspace.',
        'For every row, confirm owner, cadence, dependency, and next gate date.',
        'Save and notify the operating review chair.',
      ],
      doneWhen: 'All rows reviewed and the checklist is saved.',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality.status).not.toBe('under_specified');
    expect(result.quality.failureCodes || []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/product/resolveBlockPlainLanguage.molecular.test.js`
Expected: FAIL — current resolver does not enforce molecular sections.

- [ ] **Step 3: Add a `computeMolecularQuality` helper and call it inside `resolveBlockPlainLanguage`**

Open `src/domain/product/resolveBlockPlainLanguage.js`, locate the return statement (search for `return {` near the bottom), and:

1. Add helper at top of file:

```js
const GENERIC_DETAIL_TOKENS = new Set(['', '—', 'tbd', 'todo', 'n/a', 'unspecified']);

function isGenericDetail(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return GENERIC_DETAIL_TOKENS.has(normalized);
}

function computeMolecularQuality({ expectedOutput, acceptanceEvidence, plainAction, steps, doneWhen }) {
  const failureCodes = [];
  if (isGenericDetail(expectedOutput)) failureCodes.push('BLOCK_DETAIL_TOO_ABSTRACT');
  if (isGenericDetail(acceptanceEvidence)) {
    if (!failureCodes.includes('BLOCK_DETAIL_TOO_ABSTRACT')) {
      failureCodes.push('BLOCK_DETAIL_TOO_ABSTRACT');
    }
  }
  const hasPlainAction = !isGenericDetail(plainAction);
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  if (!hasPlainAction && !hasSteps) failureCodes.push('BLOCK_DETAIL_DO_THIS_EMPTY');
  if (isGenericDetail(doneWhen)) failureCodes.push('BLOCK_DETAIL_DONE_WHEN_EMPTY');
  return {
    status: failureCodes.length > 0 ? 'under_specified' : 'passes',
    failureCodes,
  };
}
```

2. In the function body where the return object is assembled, replace the existing `quality` field (or add one if absent) with:

```js
const quality = computeMolecularQuality({
  expectedOutput,
  acceptanceEvidence,
  plainAction,
  steps,
  doneWhen,
});
```

3. Ensure the returned object includes `quality`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/product/resolveBlockPlainLanguage.molecular.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the existing resolveBlockPlainLanguage test to confirm no regression**

Run: `npx vitest run src/domain/product/resolveBlockPlainLanguage.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/product/resolveBlockPlainLanguage.js src/domain/product/resolveBlockPlainLanguage.molecular.test.js
git commit -m "Enforce molecular block detail quality sections"
```

---

### Task 8: Surface Enterprise Identity in BlockDetailsPanel

Render the enterprise display projection at the top of the Block Details panel so the operator sees `F8 Energy Co. / Energy Gym (deferred)` instead of just `energy_gym`.

**Files:**
- Modify: `src/components/zion/BlockDetailsPanel.jsx` (insert enterprise header block above Hierarchy section)
- Test: `tests/components/BlockDetailsPanel.enterpriseHeader.test.jsx` (new)

- [ ] **Step 1: Write the failing test**

```jsx
// tests/components/BlockDetailsPanel.enterpriseHeader.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlockDetailsPanel from '../../src/components/zion/BlockDetailsPanel.jsx';

describe('BlockDetailsPanel enterprise header', () => {
  const baseBlock = {
    id: 'b1',
    start: '2026-06-10T09:00:00.000Z',
    end: '2026-06-10T10:00:00.000Z',
    label: 'Operations review',
    laneId: 'civic',
    domain: 'civic',
    practice: 'FOCUS',
    status: 'pending',
  };

  it('shows Global State Holdings for a civic block', () => {
    render(
      <BlockDetailsPanel
        blockId="b1"
        blocks={[baseBlock]}
        hierarchyContext={{
          masterPlan: { laneIds: ['civic'] },
          lane: 'Civic',
        }}
        enterpriseContext={{
          intakeSignals: { goalText: 'civic', declaredLaneIds: ['civic'] },
        }}
      />,
    );
    expect(screen.getByText('Global State Holdings')).toBeInTheDocument();
  });

  it('shows F8 Energy Co. (never E8) for an energy_gym block', () => {
    render(
      <BlockDetailsPanel
        blockId="b1"
        blocks={[{ ...baseBlock, laneId: 'energy_gym', domain: 'energy_gym' }]}
        hierarchyContext={{ lane: 'Energy Gym' }}
        enterpriseContext={{
          intakeSignals: { goalText: 'energy gym', declaredLaneIds: ['energy_gym'] },
        }}
      />,
    );
    expect(screen.getByText('F8 Energy Co.')).toBeInTheDocument();
    expect(screen.queryByText(/E8 Energy Co\./)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/BlockDetailsPanel.enterpriseHeader.test.jsx`
Expected: FAIL — "Global State Holdings" not yet rendered.

- [ ] **Step 3: Add the enterprise header block to `BlockDetailsPanel.jsx`**

Add import at top:

```jsx
import { projectEnterpriseDisplay } from '../../domain/enterprise/enterpriseDisplayProjection';
```

Add a new prop `enterpriseContext` to the function signature. Inside the component, after `hierarchy` resolution, compute:

```jsx
const enterprise = useMemo(() => {
  if (!block) return null;
  const laneId = block.laneId || block.domain || hierarchyContext?.lane || '';
  return projectEnterpriseDisplay({
    laneId,
    laneLabel: hierarchyContext?.lane || laneId,
    intakeSignals: enterpriseContext?.intakeSignals || { goalText: '', declaredLaneIds: [] },
  });
}, [block, hierarchyContext, enterpriseContext]);
```

Then insert the new section in the JSX, immediately after the opening `<div className="rounded-md border border-line/60 ...">` and `<p className="text-muted font-semibold">Block details</p>`, BEFORE the existing Hierarchy block:

```jsx
{enterprise && enterprise.displayName ? (
  <div className="rounded-md border border-line/40 bg-jericho-bg/70 px-2 py-2 text-[11px] space-y-1">
    <p className="text-muted font-semibold">Enterprise</p>
    <p className="text-muted">
      <span className="font-semibold text-jericho-text">{enterprise.displayName}</span>
      {enterprise.displaySubtitle ? ` — ${enterprise.displaySubtitle}` : ''}
    </p>
    <p className="text-muted">
      Phase scope: {enterprise.phaseScope} · Status: {enterprise.priorityStatus} · Provenance: {enterprise.provenanceStatus}
    </p>
    {enterprise.warnings.length > 0 ? (
      <p className="text-amber-700">{enterprise.warnings[0]}</p>
    ) : null}
  </div>
) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/BlockDetailsPanel.enterpriseHeader.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the existing BlockDetailsPanel hierarchy test to confirm no regression**

Run: `npx vitest run tests/components/BlockDetailsPanel.hierarchyDisplay.test.jsx`
Expected: PASS.

- [ ] **Step 6: Wire `enterpriseContext` at the call site**

Find every JSX usage of `BlockDetailsPanel`:

```bash
grep -rn "BlockDetailsPanel" src/ --include="*.jsx" --include="*.tsx" | grep -v "BlockDetailsPanel.jsx"
```

For each, pass `enterpriseContext={{ intakeSignals: { goalText: state.coreMissionContract?.goalText || '', declaredLaneIds: state.masterPlan?.laneIds || [] } }}`.

- [ ] **Step 7: Commit**

```bash
git add src/components/zion/BlockDetailsPanel.jsx tests/components/BlockDetailsPanel.enterpriseHeader.test.jsx src/components/zion/Workspace.jsx
git commit -m "Surface enterprise identity in Block Details panel"
```

---

### Task 9: Wire Enterprise Audit into Derived State

Run `evaluateEnterpriseIdentityAudit` in `identityCompute.js` and expose its findings on derived state so the UI can read it without re-running the audit per render.

**Files:**
- Modify: `src/state/identityCompute.js`
- Test: `src/state/__tests__/identityCompute.enterpriseAudit.test.js` (new)

- [ ] **Step 1: Write the failing test**

```js
// src/state/__tests__/identityCompute.enterpriseAudit.test.js
import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

describe('identityCompute enterprise audit', () => {
  it('exposes enterpriseIdentityAudit on derived state', () => {
    const derived = computeDerivedState({
      coreMissionContract: {
        goalText: 'product, civic pathways',
      },
      masterPlan: {
        laneIds: ['product', 'civic'],
      },
      masterPlanLanesById: {
        product: { id: 'product', domain: 'product', label: 'Product' },
        civic: { id: 'civic', domain: 'civic', label: 'Civic' },
      },
      blocks: [],
    });
    expect(derived.enterpriseIdentityAudit).toBeDefined();
    expect(Array.isArray(derived.enterpriseIdentityAudit.findings)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/__tests__/identityCompute.enterpriseAudit.test.js`
Expected: FAIL — `enterpriseIdentityAudit` is undefined.

- [ ] **Step 3: Add the audit call into `computeDerivedState`**

Open `src/state/identityCompute.js`. Add imports:

```js
import { projectEnterpriseDisplay } from '../domain/enterprise/enterpriseDisplayProjection';
import { evaluateEnterpriseIdentityAudit } from '../domain/enterprise/evaluateEnterpriseIdentityAudit';
```

Near the end of `computeDerivedState`, after existing audit computations, add:

```js
const intakeSignals = {
  goalText: state?.coreMissionContract?.goalText || '',
  declaredLaneIds: Array.isArray(state?.masterPlan?.laneIds) ? state.masterPlan.laneIds : [],
};
const enterpriseProjections = (intakeSignals.declaredLaneIds || []).map((laneId) => {
  const lane = state?.masterPlanLanesById?.[laneId] || null;
  return projectEnterpriseDisplay({
    laneId,
    laneLabel: lane?.label || laneId,
    intakeSignals,
  });
});
const enterpriseIdentityAudit = evaluateEnterpriseIdentityAudit({
  projections: enterpriseProjections,
  chartRows: enterpriseProjections.map((p) => ({
    primaryLabel: p.displayName,
    laneId: p.internalLane,
  })),
  blocks: (state?.blocks || []).map((block) => ({
    id: block.id,
    laneId: block.laneId || block.domain || null,
    phaseLabel: block.phaseLabel,
    blockType: block.blockType,
    expectedOutput: block.expectedOutput,
    acceptanceEvidence: block.acceptanceEvidence,
  })),
});
```

Include `enterpriseProjections` and `enterpriseIdentityAudit` in the returned derived state object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/__tests__/identityCompute.enterpriseAudit.test.js`
Expected: PASS.

- [ ] **Step 5: Run the broader state test suite to confirm no regression**

Run: `npx vitest run src/state/__tests__/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state/identityCompute.js src/state/__tests__/identityCompute.enterpriseAudit.test.js
git commit -m "Wire enterprise identity audit into derived state"
```

---

### Task 10: RTG Operation Endgame

Per the RTG convention ([[feedback_rtg_run_the_goal]]), after merge-quality work, run the saved Operation Endgame goal through the live engine and inspect the rendered output.

**Files:**
- No code changes. Manual verification + screenshot/notes.

- [ ] **Step 1: Reset and restore Operation Endgame**

In the running app at http://localhost:5183, open the dev tools console and call:

```js
window.__JERICHO_OPERATION_ENDGAME_RESTORE__()
```

(or trigger via the Profile menu if a UI control exists)

- [ ] **Step 2: Inspect the Plan tab overview chart**

Verify every row label matches the expected founder-facing entity name:
- Product → `Global State Systems`
- Creative → `Global State Corp.`
- Media → `Global State Productions`
- Operations → `Global State Solutions`
- Capital/Revenue → `Capital Path or Revenue Engine`
- Civic → `Global State Holdings` (with deferred status tag)
- Institution/Education → `Global State Academy`

Confirm NO row reads `Civic`, `civic`, or `E8 Energy Co.`.

- [ ] **Step 3: Inspect Block Details for a Real Estate block**

Click a civic-domain block. Verify:
- Enterprise header reads `Global State Holdings — 79th Street / HQ / Private school real estate`
- Warning surfaces: "Real Estate is not P1-critical unless prerequisite..."
- All 5 molecular sections render with concrete content
- No `under_specified` flag

- [ ] **Step 4: Verify audit findings**

Open the dev tools console and inspect derived state:

```js
window.__JERICHO_STATE__?.derived?.enterpriseIdentityAudit
```

Expected: `findings` array. Document each finding (code + lane + block).

- [ ] **Step 5: Run the full vitest suite to confirm zero regressions**

Run: `npm test`
Expected: All tests pass (including new tests added in Tasks 1–9).

- [ ] **Step 6: Record RTG result and commit memory note**

If RTG passes, save a memory note recording RTG_PASSED with date and findings count. If RTG produces unresolved findings, file each as a follow-up before declaring the remediation closed.

- [ ] **Step 7: Final commit (only if Tasks 1–9 were not already commit-stamped)**

```bash
git add docs/
git commit -m "Harden enterprise identity projection and block clarity"
```

---

## Acceptance Criteria (per spec, mapped to tasks)

| Spec criterion | Task |
|---|---|
| Plan tab displays company/project/product names, not abstract lane names | T6 |
| Every chart row has provenance status | T4 + T6 |
| Every chart row has phase scope | T4 + T6 |
| Civic no longer appears as user-facing lane label | T3 + T6 |
| Real Estate = Global State Holdings, defaults to P2-P3 / deferred | T1 + T4 |
| Energy Gym = F8 Energy Co. (never E8) | T1 + T4 |
| Audit flags E8 Energy Co. if it appears | T5 |
| Block Details follow 5 molecular sections | T7 |
| Block detail fails without concrete artifact / inspectable evidence | T7 |
| Audit identifies provenance category for every entity | T2 + T4 |
| No new company/project/product silently added | T2 + T4 |

## Suggested commit name (per spec)

`Harden enterprise identity projection and block clarity`

