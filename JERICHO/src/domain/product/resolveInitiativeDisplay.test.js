import { describe, expect, it } from 'vitest';

import { resolveInitiativeDisplay } from './resolveInitiativeDisplay.js';

describe('resolveInitiativeDisplay', () => {
  it('maps Operation Endgame app platform blocks to Jericho System', () => {
    expect(
      resolveInitiativeDisplay({
        title: 'Validate onboarding path for Operation Endgame app platform in P1 product/software lane',
        laneLabel: 'Operation Endgame app platform',
      })
    ).toMatchObject({
      initiative: 'Jericho System',
      lane: 'Product / Software',
      confidence: 'high',
      source: 'alias:title',
    });
  });

  it('maps media narrative pipeline language to Podcast Pilot', () => {
    expect(
      resolveInitiativeDisplay({
        title: 'Plan content pipeline proof sequence for Operation Endgame media narrative pipeline in P1 media/content lane',
        laneLabel: 'Operation Endgame media narrative pipeline',
      })
    ).toMatchObject({
      initiative: 'Podcast Pilot',
      lane: 'Media / Content',
    });
  });

  it('maps album release engine language to Romance Riot', () => {
    expect(
      resolveInitiativeDisplay({
        title: 'Sequence release asset completion for Operation Endgame album release engine in P1 creative project lane',
        laneLabel: 'Operation Endgame album release engine',
      })
    ).toMatchObject({
      initiative: 'Romance Riot',
      lane: 'Creative Project',
    });
  });

  it('maps operations system language to Global State Solutions', () => {
    expect(
      resolveInitiativeDisplay({
        title: 'Define operator checklist for Operation Endgame studio operations system in P1 company/operations lane',
        laneLabel: 'Operation Endgame studio operations system',
      })
    ).toMatchObject({
      initiative: 'Global State Solutions',
      lane: 'Company / Operations',
    });
  });

  it('maps real estate thesis language to 79th Street Real Estate', () => {
    expect(
      resolveInitiativeDisplay({
        title: 'Validate financing prerequisites for Operation Endgame real estate acquisition thesis in P2 capital/real-estate lane',
        laneLabel: 'Operation Endgame real estate acquisition thesis',
      })
    ).toMatchObject({
      initiative: '79th Street Real Estate',
      lane: 'Capital / Real Estate',
    });
  });

  it('maps institution design language to Institution / School', () => {
    expect(
      resolveInitiativeDisplay({
        title: 'Define institution model assumptions for Operation Endgame apprenticeship institution design in P1 institution/education lane',
        laneLabel: 'Operation Endgame apprenticeship institution design',
      })
    ).toMatchObject({
      initiative: 'Institutional Product',
      lane: 'Institution / Education',
    });
  });

  it('falls back to the lane when no initiative is known', () => {
    expect(
      resolveInitiativeDisplay({
        title: 'Clarify launch-blocker requirements',
        laneLabel: 'Product / Software',
      })
    ).toEqual({
      initiative: 'Product / Software',
      lane: 'Product / Software',
      confidence: 'fallback',
      source: 'lane',
    });
  });
});
