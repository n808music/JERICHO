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
