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

export function mapLaneToEntity(
  laneIdOrDomain: string,
): EnterpriseIdentityEntity | null {
  const normalized = String(laneIdOrDomain || '').trim().toLowerCase();
  if (!normalized) return null;
  const category = LANE_TO_CATEGORY[normalized];
  const inferredCategory =
    category ||
    CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(normalized))?.[0] ||
    null;
  if (!inferredCategory) return null;
  return (
    ENTERPRISE_IDENTITY_MAP.find(
      (entity) => entity.companyCategory === inferredCategory,
    ) || null
  );
}
