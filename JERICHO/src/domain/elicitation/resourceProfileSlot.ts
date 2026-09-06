import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';
import { RESOURCE_DIMENSIONS, NO_GAP_SENTINEL } from './resourceDimensions';

export const RESOURCE_PROFILE_SLOT_ID = 'slot:resourceProfile';
export const BINDING_CONSTRAINT_SLOT_ID = 'slot:bindingConstraint';

// isSection9Complete: true iff every declared initiative has a resource profile.
// Returns false when no initiatives exist (an empty section is not complete).
export function isSection9Complete(matrixSnapshot: unknown): boolean {
  const snap = matrixSnapshot as Record<string, unknown> | undefined;
  const initiatives = Object.keys((snap?.initiativesById as Record<string, unknown>) || {});
  if (initiatives.length === 0) return false;
  const profiles = (snap?.resourceProfilesById as Record<string, unknown>) || {};
  return initiatives.every((id) => Boolean(profiles[id]));
}

// Returns initiative ids that lack a profile — the set the engine should next elicit.
export function unprofiledInitiatives(matrixSnapshot: unknown): string[] {
  const snap = matrixSnapshot as Record<string, unknown> | undefined;
  const initiatives = Object.keys((snap?.initiativesById as Record<string, unknown>) || {});
  const profiles = (snap?.resourceProfilesById as Record<string, unknown>) || {};
  return initiatives.filter((id) => !profiles[id]);
}

function isGapMissing(val: unknown): boolean {
  return !val || String(val).trim() === '';
}

function isGapNotSubstantive(val: unknown): boolean {
  const s = String(val || '').trim();
  // Sentinel is a valid "no gap" declaration — always passes.
  if (s === NO_GAP_SENTINEL) return false;
  return !hasAuthoredSubstance(s);
}

// Gate ladder: 2 initiative gates + 4 dimensions × 4 gates each = 18 total.
const dimensionGates = RESOURCE_DIMENSIONS.flatMap((dim) => {
  const DIM = dim.toUpperCase();
  const needField = `${dim}Need`;
  const gapField = `${dim}Gap`;
  return [
    {
      code: `RESOURCE_${DIM}_NEED_MISSING` as string,
      fieldName: needField,
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.[needField] || String(c[needField]).trim() === '';
      },
    },
    {
      code: `RESOURCE_${DIM}_NEED_NOT_SUBSTANTIVE` as string,
      fieldName: needField,
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.[needField] || String(c[needField]).trim() === '') return false;
        return !hasAuthoredSubstance(String(c[needField]));
      },
    },
    {
      code: `RESOURCE_${DIM}_GAP_MISSING` as string,
      fieldName: gapField,
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return isGapMissing(c?.[gapField]);
      },
    },
    {
      code: `RESOURCE_${DIM}_GAP_NOT_SUBSTANTIVE` as string,
      fieldName: gapField,
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        if (isGapMissing(c?.[gapField])) return false;
        return isGapNotSubstantive(c?.[gapField]);
      },
    },
  ];
});

export const RESOURCE_PROFILE_SLOT = {
  slotId: RESOURCE_PROFILE_SLOT_ID,
  section: 9,
  gate: [
    {
      code: 'RESOURCE_INITIATIVE_MISSING',
      fieldName: 'initiativeId',
      pickSet: 'unprofiledInitiativeOptions',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.initiativeId || String(c.initiativeId).trim() === '';
      },
    },
    {
      code: 'RESOURCE_INITIATIVE_UNRESOLVED',
      fieldName: 'initiativeId',
      pickSet: 'unprofiledInitiativeOptions',
      detect: (captured: unknown, ctx?: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.initiativeId) return false;
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot as Record<string, unknown> | undefined;
        const initiatives = snap?.initiativesById as Record<string, unknown> | undefined;
        return !initiatives?.[String(c.initiativeId)];
      },
    },
    ...dimensionGates,
  ],
};

export const BINDING_CONSTRAINT_SLOT = {
  slotId: BINDING_CONSTRAINT_SLOT_ID,
  section: 9,
  dependsOn: ['slot:resourceProfile'],
  gate: [
    {
      code: 'BINDING_COVERAGE_INCOMPLETE',
      fieldName: 'bindingDimension',
      detect: (_captured: unknown, ctx?: unknown) => {
        const snap = (ctx as Record<string, unknown>)?.matrixSnapshot;
        return !isSection9Complete(snap);
      },
    },
    {
      code: 'BINDING_DIMENSION_MISSING',
      fieldName: 'bindingDimension',
      pickSet: 'resourceDimensionOptions',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.bindingDimension || String(c.bindingDimension).trim() === '';
      },
    },
    {
      code: 'BINDING_DIMENSION_INVALID',
      fieldName: 'bindingDimension',
      pickSet: 'resourceDimensionOptions',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.bindingDimension) return false;
        return !(RESOURCE_DIMENSIONS as readonly string[]).includes(String(c.bindingDimension));
      },
    },
    {
      code: 'BINDING_RATIONALE_MISSING',
      fieldName: 'rationale',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        return !c?.rationale || String(c.rationale).trim() === '';
      },
    },
    {
      code: 'BINDING_RATIONALE_NOT_SUBSTANTIVE',
      fieldName: 'rationale',
      detect: (captured: unknown) => {
        const c = captured as Record<string, unknown>;
        if (!c?.rationale) return false;
        return !hasAuthoredSubstance(String(c.rationale));
      },
    },
  ],
};

export function buildResourceProfileDeclarePayload(captured: unknown) {
  const c = captured as Record<string, unknown>;
  const initiativeId = String(c?.initiativeId || '').trim();
  const id = `rp-${initiativeId}`;

  const buildDim = (dim: string) => {
    const gapRaw = String(c?.[`${dim}Gap`] || '').trim();
    return {
      need: String(c?.[`${dim}Need`] || '').trim(),
      gap: gapRaw === NO_GAP_SENTINEL ? null : gapRaw,
    };
  };

  return {
    id,
    initiativeId,
    dimensions: {
      money: buildDim('money'),
      time: buildDim('time'),
      skills: buildDim('skills'),
      tech: buildDim('tech'),
    },
  };
}

export function buildBindingConstraintDeclarePayload(captured: unknown) {
  const c = captured as Record<string, unknown>;
  return {
    bindingDimension: String(c?.bindingDimension || '').trim(),
    rationale: String(c?.rationale || '').trim(),
  };
}
