const OWNER_BY_LANE_FAMILY = {
  product_software: 'Product Lead',
  creative_media: 'Creative Lead',
  media_channel: 'Media Lead',
  company_operations: 'Operations Lead',
  income_stream: 'Revenue Lead',
  capital_real_estate: 'Capital Lead',
  institution_education: 'Institution Lead',
  civic_development: 'Civic Lead',
};

const OWNER_NORMALIZATION = {
  founder: 'Founder',
  operator: 'Operator',
  executor: 'Operator',
  reviewer: 'Operator',
  system: 'Operator',
  product_owner: 'Product Lead',
  creative_owner: 'Creative Lead',
  media_owner: 'Media Lead',
  operations_owner: 'Operations Lead',
  revenue_owner: 'Revenue Lead',
  capital_owner: 'Capital Lead',
  institution_owner: 'Institution Lead',
  civic_owner: 'Civic Lead',
  gate_authority: 'Operator',
  terminal_authority: 'Operator',
  external_partner: 'External Partner',
};

export function defaultOwnerForLaneFamily(laneFamily = null) {
  return OWNER_BY_LANE_FAMILY[String(laneFamily || '').trim()] || 'Operator';
}

export function normalizeOwnerLabel(owner = null, laneFamily = null) {
  const normalized = String(owner || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (normalized && OWNER_NORMALIZATION[normalized]) {
    return OWNER_NORMALIZATION[normalized];
  }
  if (owner && String(owner).trim()) {
    return String(owner).trim();
  }
  return defaultOwnerForLaneFamily(laneFamily);
}
