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
