import {
  ENTERPRISE_IDENTITY_MAP,
  findEnterpriseEntityByDisplayName,
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

const ENTITY_ALIAS_RULES: Array<{ entityDisplayName: string; pattern: RegExp }> = [
  {
    entityDisplayName: 'F8 Energy Co.',
    pattern: /\b(f8|fate|energy gum|energy gym)\b/i,
  },
  {
    entityDisplayName: 'Global State Holdings',
    pattern: /\b(civic|district|corridor|real estate|property|site control|acquisition thesis|global state holdings)\b/i,
  },
  {
    entityDisplayName: 'Global State Systems',
    pattern: /\b(product|software|jericho|app platform|product platform|global state systems)\b/i,
  },
  {
    entityDisplayName: 'Global State Corp.',
    pattern: /\b(creative|album|music|record label|release engine|romance riot|blackman|d8 n8|global state corp)\b/i,
  },
  {
    entityDisplayName: 'Global State Productions',
    pattern: /\b(media|podcast|broadcast|narrative|content pipeline|help yourself|global state productions)\b/i,
  },
  {
    entityDisplayName: 'Global State Solutions',
    pattern: /\b(operations|brand|operator|operating system|studio operations|project management|global state solutions)\b/i,
  },
  {
    entityDisplayName: 'Global State Academy',
    pattern: /\b(institution|education|school|academy|apprenticeship|global state academy)\b/i,
  },
  {
    entityDisplayName: 'Capital Path or Revenue Engine',
    pattern: /\b(capital|funding|investor|monetization|runway|capital stack|services revenue bridge|revenue bridge|buyer outreach|first offer)\b/i,
  },
];

const CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ['Technology', /\b(product|software|jericho|app platform|product platform|global state systems)\b/i],
  ['Record Label', /\b(creative|album|music|record label|release engine|global state corp)\b/i],
  ['Production', /\b(media|podcast|broadcast|narrative|global state productions)\b/i],
  ['Project Management', /\b(operations|brand|operator|operating system|project management|global state solutions)\b/i],
  ['Capital / Revenue', /\b(capital|revenue|income|runway|funding|monetization|capital path)\b/i],
  ['Real Estate', /\b(civic|district|corridor|real estate|property|site control|global state holdings)\b/i],
  ['Private Schools', /\b(institution|education|school|academy|global state academy)\b/i],
  ['Energy Gym', /\b(energy gym|f8|fate|energy co)\b/i],
];

/**
 * User-facing lane labels we no longer want to display as primary chart text.
 * `civic` normalizes to Real Estate / Global State Holdings.
 */
export const DEPRECATED_LANE_LABELS: ReadonlyArray<string> = ['civic'];

function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function resolveLaneEntity(
  input:
    | string
    | {
        laneId?: string | null;
        laneLabel?: string | null;
      },
): EnterpriseIdentityEntity | null {
  const laneId =
    typeof input === 'string' ? normalizeText(input) : normalizeText(input?.laneId || '');
  const laneLabel =
    typeof input === 'string' ? normalizeText(input) : normalizeText(input?.laneLabel || '');
  const haystacks = [laneLabel, laneId].filter(Boolean);

  for (const haystack of haystacks) {
    const explicitMatch = ENTITY_ALIAS_RULES.find((rule) => rule.pattern.test(haystack));
    if (explicitMatch) {
      return findEnterpriseEntityByDisplayName(explicitMatch.entityDisplayName);
    }
  }

  for (const haystack of haystacks) {
    const category =
      LANE_TO_CATEGORY[haystack] ||
      CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(haystack))?.[0] ||
      null;
    if (!category) {
      continue;
    }
    const entity = ENTERPRISE_IDENTITY_MAP.find((candidate) => candidate.companyCategory === category) || null;
    if (entity) {
      return entity;
    }
  }

  return null;
}

export function mapLaneToEntity(
  laneIdOrDomain: string,
): EnterpriseIdentityEntity | null {
  return resolveLaneEntity({ laneId: laneIdOrDomain, laneLabel: laneIdOrDomain });
}
