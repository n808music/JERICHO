import { describe, it, expect } from 'vitest';
import {
  ENTERPRISE_IDENTITY_MAP,
  INCORRECT_ENTITY_NAME_ALIASES,
  findEnterpriseEntityByDisplayName,
  findEnterpriseEntityByCategory,
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

  it('finds an entity by company category', () => {
    const tech = findEnterpriseEntityByCategory('Technology');
    expect(tech?.displayName).toBe('Global State Systems');
    expect(tech?.products).toContain('Jericho System');
  });

  it('has unique company categories across the canonical map', () => {
    const categories = ENTERPRISE_IDENTITY_MAP.map((entity) => entity.companyCategory);
    expect(new Set(categories).size).toBe(categories.length);
  });
});
