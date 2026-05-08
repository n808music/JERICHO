/**
 * autoDeliverables.test.ts
 *
 * Tests for template-based auto-deliverables generation.
 * Ensures each mechanism class generates appropriate deliverables.
 */

import { describe, it, expect } from 'vitest';
import {
  generateAutoDeliverables,
  totalAutoBlocksRequired,
  debugAutoDeliverablesGeneration,
} from '../autoDeliverables';

describe('autoDeliverables', () => {
  describe('generateAutoDeliverables', () => {
    it('generates deliverables for PUBLISH goals', () => {
      const goal = { terminalOutcome: { text: 'Publish music to Spotify' } };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Prepare');
      expect(deliverables[1].title).toContain('release');
      expect(deliverables[2].title).toContain('Deploy');
      expect(deliverables[3].title).toContain('Monitor');

      // All should be numbered/unique
      expect(new Set(deliverables.map((d) => d.id)).size).toBe(4);

      // All should have positive block counts
      deliverables.forEach((d) => {
        expect(d.requiredBlocks).toBeGreaterThan(0);
      });
    });

    it('generates deliverables for CREATE goals', () => {
      const goal = { goalText: 'Build a new dashboard' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(3);
      expect(deliverables[0].title).toContain('Design');
      expect(deliverables[1].title).toContain('Build');
      expect(deliverables[2].title).toContain('Test');

      const totalBlocks = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
      expect(totalBlocks).toBeGreaterThan(0);
    });

    it('generates deliverables for MARKET goals', () => {
      const goal = { goalText: 'Grow user acquisition by 50%' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      deliverables.forEach((d) => {
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.requiredBlocks).toBeGreaterThan(0);
      });
    });

    it('generates launch-family deliverables for VentureLaunch service goals', () => {
      const goal = {
        executionType: 'VentureLaunch',
        terminalOutcome: {
          text: 'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('project management consulting service offer'),
          expect.stringContaining('pricing tiers'),
          expect.stringContaining('onboarding workflow'),
          expect.stringContaining('outreach scripts'),
          expect.stringContaining('discovery calls'),
        ])
      );
      expect(titles.some((title) => title.includes('launch outreach'))).toBe(false);
    });

    it('generates object-bearing deliverables for VentureLaunch product goals', () => {
      const goal = {
        executionType: 'VentureLaunch',
        terminalOutcome: {
          text: 'Launch a habit tracking app in 45 days with landing page, waitlist, first 25 user interviews, and traction review completed.',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          'define habit tracking app value proposition and target customer',
          'build habit tracking app landing page, waitlist flow, and first-user funnel',
          'prepare habit tracking app customer outreach list and interview script',
          'run habit tracking app first-user validation and feedback loop',
          'compile habit tracking app traction evidence and launch next-step review',
        ])
      );
    });

    it('generates launch-family deliverables for BrandLaunch goals', () => {
      const goal = {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: 'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('positioning'),
          expect.stringContaining('messaging'),
          expect.stringContaining('identity'),
          expect.stringContaining('brand kit'),
          expect.stringContaining('brand launch announcement'),
        ])
      );
      expect(titles.some((title) => title.includes('launch-week content batch'))).toBe(false);
      expect(titles.some((title) => title.includes('engagement and response follow-up'))).toBe(false);
    });

    it('generates commercial product launch deliverables for BrandLaunch gum first-sales goals', () => {
      const goal = {
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: 'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.',
          verificationCriteria:
            'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('formula, sample approval, packaging, sourcing'),
          expect.stringContaining('offer, pricing, product page, checkout, ordering, and fulfillment path'),
          expect.stringContaining('first-sales outreach to initial buyers'),
          expect.stringContaining('first-sales evidence, conversion results, and next-step decision'),
        ])
      );
      expect(titles).not.toEqual(
        expect.arrayContaining([
          'define brand positioning and audience promise',
          'build messaging architecture for priority channels',
          'publish brand launch announcement and audience cta',
        ])
      );
    });

    it('scales commercial product launch work from the contract horizon and raw goal text', () => {
      const goal = {
        executionType: 'BrandLaunch',
        goalText: 'Build a caffeinated gum brand and take it to first real sales',
        terminalOutcome: {
          text: 'Launch the brand with concept validation and launch setup completed.',
          verificationCriteria: 'The brand has launch setup complete.',
        },
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());
      const requiredBlocks = deliverables.reduce((sum, deliverable) => sum + deliverable.requiredBlocks, 0);

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('formula, sample approval, packaging, sourcing'),
          expect.stringContaining('checkout, ordering, and fulfillment path'),
          expect.stringContaining('first-sales outreach to initial buyers'),
          expect.stringContaining('first-sales evidence'),
        ])
      );
      expect(requiredBlocks).toBeGreaterThan(40);
    });

    it('sizes long-horizon commercial product launch work above sparse weekly cadence', () => {
      const goal = {
        executionType: 'BrandLaunch',
        goalText: 'Build a caffeinated gum brand and take it to first real sales',
        terminalOutcome: {
          text: 'Launch the brand with concept validation and launch setup completed.',
          verificationCriteria: 'The brand has launch setup complete.',
        },
        temporalBinding: { startDayKey: '2026-01-01' },
        deadline: { dayKey: '2026-12-31' },
      };
      const deliverables = generateAutoDeliverables(goal);
      const requiredBlocks = deliverables.reduce((sum, deliverable) => sum + deliverable.requiredBlocks, 0);
      const requiredBlocksByFamily = deliverables.map((deliverable) => deliverable.requiredBlocks);

      expect(requiredBlocks).toBeGreaterThanOrEqual(104);
      expect(requiredBlocksByFamily).toEqual([24, 29, 20, 40, 25]);
      expect(requiredBlocksByFamily).not.toEqual([18, 18, 15, 18, 12]);
      expect(requiredBlocks).toBeGreaterThan(18 + 18 + 15 + 18 + 12);
      expect(deliverables.map((deliverable) => deliverable.id)).toEqual([
        'auto-deliv-product-readiness',
        'auto-deliv-product-commerce',
        'auto-deliv-product-launch-communications',
        'auto-deliv-product-first-sales',
        'auto-deliv-product-sales-review',
      ]);
    });

    it('generates revenue-capital deliverables for SalesPipeline goals', () => {
      const goal = {
        executionType: 'SalesPipeline',
        terminalOutcome: {
          text: 'Build a sales pipeline for my consulting service with defined offer, ICP, outreach, discovery calls, proposals, and onboarding handoff completed.',
          verificationCriteria: 'Qualified opportunities move through proposal and close stages',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('offer'),
          expect.stringContaining('icp'),
          expect.stringContaining('outreach'),
          expect.stringContaining('crm'),
          expect.stringContaining('discovery'),
          expect.stringContaining('proposal'),
          expect.stringContaining('negotiation'),
          expect.stringContaining('handoff'),
        ])
      );
    });

    it('generates revenue-capital deliverables for Fundraising goals', () => {
      const goal = {
        executionType: 'Fundraising',
        terminalOutcome: {
          text: 'Run a seed fundraising round with thesis, deck, target investors, outreach, meetings, diligence, terms, and close completed.',
          verificationCriteria: 'Investor conversations move through diligence to commitment',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('objective'),
          expect.stringContaining('deck'),
          expect.stringContaining('diligence'),
          expect.stringContaining('investor'),
          expect.stringContaining('outreach'),
          expect.stringContaining('meetings'),
          expect.stringContaining('commitment'),
          expect.stringContaining('signature'),
        ])
      );
    });

    it('keeps fundraising package-preparation goals inside preparation/readiness scope', () => {
      const goal = {
        executionType: 'Fundraising',
        terminalOutcome: {
          text: 'Prepare a friends-and-family fundraising package for Jericho with a clear pitch, financial ask, use-of-funds story, and investor-ready materials.',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('use-of-funds'),
          expect.stringContaining('pitch deck'),
          expect.stringContaining('financial package'),
          expect.stringContaining('target investor list'),
          expect.stringContaining('send package checklist'),
          expect.stringContaining('readiness review'),
        ])
      );
      expect(titles.join(' ')).not.toMatch(
        /\bmeetings?\b|\bdiligence requests\b|\bcommitment\b|\bsignature workflow\b|\blegal close\b/
      );
    });

    it('generates employment-pipeline deliverables for JobSearchPipeline goals', () => {
      const goal = {
        executionType: 'JobSearchPipeline',
        terminalOutcome: {
          text: 'Run a weekly job search pipeline for a corporate role with target roles, materials, outreach, applications, interviews, and follow-up completed.',
          verificationCriteria: 'Applications submitted and interviews advance through the search pipeline',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target role'),
          expect.stringContaining('resume'),
          expect.stringContaining('company'),
          expect.stringContaining('application'),
          expect.stringContaining('interview'),
          expect.stringContaining('follow-up'),
        ])
      );
    });

    it('generates employment-pipeline deliverables for JobSearchPipeline goals', () => {
      const goal = {
        executionType: 'JobSearchPipeline',
        terminalOutcome: {
          text: 'Run a weekly job search pipeline for a corporate role with target roles, materials, outreach, applications, interviews, and follow-up completed.',
          verificationCriteria: 'Applications submitted and interviews advance through the search pipeline',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target role'),
          expect.stringContaining('resume'),
          expect.stringContaining('company'),
          expect.stringContaining('application'),
          expect.stringContaining('interview'),
          expect.stringContaining('follow-up'),
        ])
      );
    });

    it('generates capability-credential deliverables for SkillAcquisition goals', () => {
      const goal = {
        executionType: 'SkillAcquisition',
        terminalOutcome: {
          text: 'Learn React well enough in 45 days to build and publish two working portfolio projects with baseline recorded and proof artifact complete.',
          verificationCriteria: 'Baseline assessment, practice plan, proof artifact, and readiness review completed',
        },
      };
      const titles = generateAutoDeliverables(goal).map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          'audit baseline in react',
          'complete first react portfolio project and walkthrough',
          'complete second react portfolio project with higher complexity',
          'produce proof artifact showing react',
          'run final readiness review for react',
        ])
      );
      expect(titles.join(' ')).not.toContain('project 1');
      expect(titles.join(' ')).not.toContain('project 2');
      expect(titles.join(' ')).not.toContain('research');
      expect(titles.join(' ')).not.toContain('coursework');
      expect(titles.join(' ')).not.toContain('document knowledge');
    });

    it('preserves explicit multi-project branches for SkillAcquisition goals', () => {
      const goal = {
        executionType: 'SkillAcquisition',
        terminalOutcome: {
          text: 'Learn project management and data analysis well enough in 90 days to complete three working portfolio projects.',
          verificationCriteria:
            'Projects: project management workflow dashboard, stakeholder communication plan, data analysis case study.',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('project management workflow dashboard'),
          expect.stringContaining('stakeholder communication plan'),
          expect.stringContaining('data analysis case study'),
        ])
      );
      expect(titles.some((title) => title.includes('study core concepts'))).toBe(false);
    });

    it('builds SQL-native deliverables for three-project interview-ready skill goals', () => {
      const goal = {
        executionType: 'SkillAcquisition',
        terminalOutcome: {
          text: 'Build job-ready SQL and dashboard analysis skills in 30 days so I can complete three portfolio-quality data projects and speak confidently about them in interviews.',
          verificationCriteria:
            'Complete three SQL portfolio projects, publish GitHub-ready work, and be able to explain SQL decisions in interviews.',
        },
      };
      const titles = generateAutoDeliverables(goal).map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          'establish sql fundamentals query practice baseline',
          'complete relational schema and data import project',
          'complete business analysis query case study',
          'complete advanced reporting and window function project',
          'produce github portfolio and query explanation package',
          'run sql interview drill and readiness review',
        ])
      );
      expect(titles.join(' ')).not.toContain('project 1');
      expect(titles.join(' ')).not.toContain('project 2');
      expect(titles.join(' ')).not.toContain('project 3');
      expect(titles.join(' ')).not.toContain('portfolio-quality');
    });

    it('generates object-bearing creative-production deliverables for video goals', () => {
      const goal = {
        executionType: 'CreativeProduction',
        terminalOutcome: {
          text: 'Produce and release a short documentary film about neighborhood businesses',
          verificationCriteria:
            'Documentary film is edited, packaged, and published with a release checklist complete.',
        },
      };
      const titles = generateAutoDeliverables(goal).map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          'define video production concept, outline, and audience brief',
          'build video production shot plan, production checklist, and asset list',
          'produce first cut and rough edit for video production',
          'complete final edit, sound polish, and graphics for video production',
          'prepare video production release package and publication checklist',
        ])
      );
      expect(titles.some((title) => title.includes('core artifact'))).toBe(false);
      expect(titles.some((title) => title.includes('creative brief and narrative intent'))).toBe(false);
    });

    it('generates capability-credential deliverables for ProfessionalQualification goals', () => {
      const goal = {
        executionType: 'ProfessionalQualification',
        terminalOutcome: {
          text: 'Pass the AWS Certified Cloud Practitioner exam by May 15 with study coverage mapped and eligibility verified.',
          verificationCriteria: 'Requirements review, practice exams, proof packet, and credential step completed',
        },
      };
      const titles = generateAutoDeliverables(goal).map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          'verify aws certified cloud practitioner exam requirements, eligibility, and exam boundary',
          'build aws certified cloud practitioner exam domain coverage map and study note set',
          'complete aws certified cloud practitioner exam question bank and timed mock exam set',
          'compile aws certified cloud practitioner exam weak-domain remediation log and cheat sheet',
          'run aws certified cloud practitioner exam readiness review and credential-day checklist',
        ])
      );
      expect(titles.join(' ')).not.toContain('research');
      expect(titles.join(' ')).not.toContain('coursework');
      expect(titles.join(' ')).not.toContain('document knowledge');
    });

    it('generates deliverables for LEARN goals', () => {
      const goal = { terminalOutcome: { text: 'Learn TypeScript deeply' } };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Research');
      expect(deliverables[1].title).toContain('course');
      expect(deliverables[2].title).toContain('Practice');
      expect(deliverables[3].title).toContain('Document');
    });

    it('generates physical progression deliverables for PhysicalTraining goals', () => {
      const goal = {
        executionType: 'PhysicalTraining',
        terminalOutcome: {
          text: 'Complete a 12-week physical training cycle with baseline recorded, recovery stable, and benchmark re-test complete.',
          verificationCriteria:
            'Baseline benchmark, training progression, recovery checkpoints, and readiness review completed',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase()).join(' ');

      expect(titles).toContain('baseline');
      expect(titles).toContain('progression');
      expect(titles).toContain('recovery');
      expect(titles).toContain('benchmark');
      expect(titles).not.toContain('improve fitness');
      expect(titles).not.toContain('workout tasks');
      expect(titles).not.toContain('get stronger');
    });

    it('generates body-composition deliverables with explicit exercise and adherence work', () => {
      const goal = {
        executionType: 'PhysicalTraining',
        terminalOutcome: {
          text: 'Lose 10 pounds and improve conditioning in 10 weeks with weekly weigh-ins and conditioning improvement.',
          verificationCriteria:
            '10 pounds lost with conditioning sessions complete, weigh-in trend recorded, and final adjustment review complete',
        },
      };
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase()).join(' | ');

      expect(titles).toContain('calorie/protein targets');
      expect(titles).toContain('weekly conditioning and strength sessions');
      expect(titles).toContain('nutrition adherence and weigh-in tracking block');
      expect(titles).toContain('review body composition trend and adjust training plan');
      expect(titles).not.toContain('nutrition guardrails');
      expect(titles).not.toContain('body composition progression and nutrition cadence');
    });

    it('generates deliverables for OPS goals', () => {
      const goal = { goalText: 'Set up CI/CD pipeline' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Plan');
      expect(deliverables[1].title).toContain('Implement');
      expect(deliverables[2].title).toContain('Test');
      expect(deliverables[3].title).toContain('monitoring');
    });

    it('generates deliverables for REVIEW goals', () => {
      const goal = { goalText: 'Review and refactor codebase' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Audit');
      expect(deliverables[1].title).toContain('Plan');
      expect(deliverables[2].title).toContain('refactor');
      expect(deliverables[3].title).toContain('Verify');
    });

    // Deliverable structure tests
    describe('Deliverable structure', () => {
      it('all deliverables have required fields', () => {
        const goal = { goalText: 'Publish a book' };
        const deliverables = generateAutoDeliverables(goal);

        deliverables.forEach((d) => {
          expect(d).toHaveProperty('id');
          expect(d).toHaveProperty('title');
          expect(d).toHaveProperty('requiredBlocks');

          expect(typeof d.id).toBe('string');
          expect(typeof d.title).toBe('string');
          expect(typeof d.requiredBlocks).toBe('number');

          expect(d.id.length).toBeGreaterThan(0);
          expect(d.title.length).toBeGreaterThan(0);
          expect(d.requiredBlocks).toBeGreaterThan(0);
        });
      });

      it('IDs are unique within result set', () => {
        const goal = { goalText: 'Build something' };
        const deliverables = generateAutoDeliverables(goal);
        const ids = deliverables.map((d) => d.id);

        expect(new Set(ids).size).toBe(ids.length);
      });

      it('IDs include mechanism class prefix', () => {
        const goal1 = { goalText: 'Publish music' };
        const goal2 = { goalText: 'Learn Python' };

        const d1 = generateAutoDeliverables(goal1);
        const d2 = generateAutoDeliverables(goal2);

        expect(d1[0].id).toMatch(/auto-PUBLISH/);
        expect(d2[0].id).toMatch(/auto-LEARN/);
      });
    });

    // Outcome noun extraction tests
    describe('Outcome noun substitution', () => {
      it('substitutes {outcome} placeholder with extracted noun', () => {
        const goal = { goalText: 'Build a website application' };
        const deliverables = generateAutoDeliverables(goal);

        // At least one deliverable should have a meaningful substitution (noun extraction)
        expect(deliverables.length).toBeGreaterThan(0);
        deliverables.forEach((d) => {
          // Should not have unsubstituted placeholders
          expect(d.title).not.toContain('{outcome}');
          expect(d.title).not.toContain('{noun}');
        });
      });

      it('handles missing goal text gracefully', () => {
        const goal = {};
        const deliverables = generateAutoDeliverables(goal);

        expect(deliverables).toBeDefined();
        expect(deliverables.length).toBeGreaterThan(0);
        // Should still have proper titles
        deliverables.forEach((d) => {
          expect(d.title.length).toBeGreaterThan(0);
          expect(d.title).not.toContain('{outcome}');
        });
      });

      it('generates meaningful deliverable titles', () => {
        const goal1 = { goalText: 'Learn Python programming' };
        const goal2 = { goalText: 'Publish an electronic album' };

        const d1 = generateAutoDeliverables(goal1);
        const d2 = generateAutoDeliverables(goal2);

        // Should have concrete titles
        d1.forEach((d) => {
          expect(d.title.length).toBeGreaterThan(5);
          expect(d.title).not.toContain('{');
        });

        d2.forEach((d) => {
          expect(d.title.length).toBeGreaterThan(5);
          expect(d.title).not.toContain('{');
        });
      });
    });

    // Determinism tests (critical)
    describe('Determinism: same input = identical output', () => {
      it('same goal produces identical deliverables on repeat calls', () => {
        const goal = { goalText: 'Publish book to Amazon' };

        const d1 = generateAutoDeliverables(goal);
        const d2 = generateAutoDeliverables(goal);
        const d3 = generateAutoDeliverables(goal);

        expect(JSON.stringify(d1)).toEqual(JSON.stringify(d2));
        expect(JSON.stringify(d2)).toEqual(JSON.stringify(d3));
      });

      it('different goals produce different deliverables', () => {
        const goal1 = { goalText: 'Build web app' };
        const goal2 = { goalText: 'Learn programming' };

        const d1 = generateAutoDeliverables(goal1);
        const d2 = generateAutoDeliverables(goal2);

        // Different mechanisms should produce different delivery sets
        expect(d1[0].title).not.toEqual(d2[0].title);
      });
    });
  });

  describe('totalAutoBlocksRequired', () => {
    it('sums all deliverable blocks', () => {
      const goal = { goalText: 'Build a website' };
      const total = totalAutoBlocksRequired(goal);

      const manual = generateAutoDeliverables(goal);
      const expected = manual.reduce((sum, d) => sum + d.requiredBlocks, 0);

      expect(total).toBe(expected);
      expect(total).toBeGreaterThan(0);
    });

    it('returns reasonable totals per mechanism', () => {
      const testCases = [
        { goal: { goalText: 'Publish album' }, minBlocks: 10, maxBlocks: 30 },
        { goal: { goalText: 'Learn TypeScript' }, minBlocks: 20, maxBlocks: 40 },
        { goal: { goalText: 'Build dashboard' }, minBlocks: 15, maxBlocks: 35 },
        { goal: { goalText: 'Review code' }, minBlocks: 10, maxBlocks: 30 },
      ];

      testCases.forEach((tc) => {
        const total = totalAutoBlocksRequired(tc.goal);
        expect(total).toBeGreaterThanOrEqual(tc.minBlocks);
        expect(total).toBeLessThanOrEqual(tc.maxBlocks);
      });
    });
  });

  describe('debugAutoDeliverablesGeneration', () => {
    it('returns diagnostic output object', () => {
      const goal = { goalText: 'Publish music to Spotify' };
      const debug = debugAutoDeliverablesGeneration(goal);

      expect(debug).toHaveProperty('goalText');
      expect(debug).toHaveProperty('derivedMechanism');
      expect(debug).toHaveProperty('mechanismDescription');
      expect(debug).toHaveProperty('deliverables');
      expect(debug).toHaveProperty('totalBlocksRequired');

      expect(debug.goalText).toContain('Publish');
      expect(debug.derivedMechanism).toBe('PUBLISH');
      expect(Array.isArray(debug.deliverables)).toBe(true);
      expect(debug.totalBlocksRequired).toBeGreaterThan(0);
    });

    it('diagnostic deliverables match actual generation', () => {
      const goal = { goalText: 'Learn Python' };
      const debug = debugAutoDeliverablesGeneration(goal);
      const actual = generateAutoDeliverables(goal);

      expect(debug.deliverables.length).toBe(actual.length);
      debug.deliverables.forEach((d, i) => {
        expect(d.title).toBe(actual[i].title);
        expect(d.blocks).toBe(actual[i].requiredBlocks);
      });
    });
  });

  // Integration tests
  describe('Integration: mechanism class → templates → deliverables', () => {
    it('end-to-end: goal text → mechanism → deliverables', () => {
      const goals = [
        { text: 'Publish album to Spotify', expectedMechanism: 'PUBLISH', minCount: 4 },
        { text: 'Learn AWS certification', expectedMechanism: 'LEARN', minCount: 4 },
        { text: 'Build React component library', expectedMechanism: 'CREATE', minCount: 3 },
        { text: 'Review codebase quality', expectedMechanism: 'REVIEW', minCount: 4 },
        { text: 'Market new product', expectedMechanism: 'MARKET', minCount: 4 },
        { text: 'Set up deployment infrastructure', expectedMechanism: 'OPS', minCount: 4 },
      ];

      goals.forEach((goal) => {
        const deliverables = generateAutoDeliverables({ goalText: goal.text });

        expect(deliverables.length).toBe(goal.minCount);
        deliverables.forEach((d) => {
          expect(d.id).toContain(`auto-${goal.expectedMechanism}`);
        });
      });
    });
    it('all deliverables are schedulable (positive block counts)', () => {
      const goals = [{ goalText: 'Publish book' }, { goalText: 'Learn Python' }, { goalText: 'Build dashboard' }];

      goals.forEach((goal) => {
        const deliverables = generateAutoDeliverables(goal);
        const totalBlocks = totalAutoBlocksRequired(goal);

        expect(totalBlocks).toBeGreaterThan(0);

        deliverables.forEach((d) => {
          expect(d.requiredBlocks).toBeGreaterThan(0);
          expect(Number.isInteger(d.requiredBlocks)).toBe(true);
        });
      });
    });
  });

  // Edge cases
  describe('Edge cases', () => {
    it('handles empty goal contract', () => {
      const goal = {};
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      expect(deliverables.length).toBeGreaterThan(0);
    });

    it('handles null/undefined text fields', () => {
      const goal = {
        terminalOutcome: null,
        goalText: undefined,
        aim: { text: null },
      };
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      // Should default to CREATE mechanism
      expect(deliverables[0].id).toMatch(/auto-CREATE/);
    });

    it('handles very long goal text', () => {
      const longText = 'Learn ' + 'programming '.repeat(100);
      const goal = { goalText: longText };
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      expect(deliverables.length).toBeGreaterThan(0);
      deliverables.forEach((d) => {
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.title.length).toBeLessThan(500); // Reasonable length
      });
    });

    it('handles special characters in goal text', () => {
      const goal = { goalText: 'Publish #music @spotify!!! 🎵' };
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      expect(deliverables.length).toBeGreaterThan(0);
    });
  });
});

// ST-01 remediation tests (RC-02: music-release deliverable semantic validity)
// These tests use executionType: 'CreativeProduction' to route through buildCreativeProductionDeliverables,
// which is the path taken by admitted creative-production EP/album goals in the live system.
describe('ST-01 remediation: music-release deliverable quality', () => {
  const MUSIC_GOAL_VARIANTS = [
    { executionType: 'CreativeProduction', terminalOutcome: { text: 'Finish and release a polished 3-song EP' } },
    { executionType: 'CreativeProduction', terminalOutcome: { text: 'Release my album on streaming platforms' } },
    {
      executionType: 'CreativeProduction',
      terminalOutcome: { text: 'Record and release a single before end of month' },
    },
    { executionType: 'CreativeProduction', terminalOutcome: { text: 'Complete my mixtape and publish to SoundCloud' } },
  ];

  it('no music-release deliverable title is a session-attendance label', () => {
    MUSIC_GOAL_VARIANTS.forEach((goal) => {
      const deliverables = generateAutoDeliverables(goal);
      const titles = deliverables.map((d) => d.title.toLowerCase());
      titles.forEach((title) => {
        expect(title).not.toMatch(/draft sessions?$/);
        expect(title).not.toMatch(/refine music release draft sessions?/);
        expect(title).not.toMatch(/^produce and refine/);
      });
    });
  });

  it('music-release deliverables reference a concrete artifact or completion state', () => {
    const goal = {
      executionType: 'CreativeProduction',
      terminalOutcome: { text: 'Finish and release a polished 3-song EP' },
    };
    const deliverables = generateAutoDeliverables(goal);
    // Every deliverable should reference either a recording artifact, a release asset,
    // a distribution state, or a readiness gate — not pure session activity
    const artifactTerms = [
      'recording',
      'recordings',
      'concept',
      'tracklist',
      'mix',
      'master',
      'artwork',
      'metadata',
      'distribution',
      'readiness',
      'checklist',
      'launch',
    ];
    deliverables.forEach((d) => {
      const lower = d.title.toLowerCase();
      const hasArtifactTerm = artifactTerms.some((term) => lower.includes(term));
      expect(hasArtifactTerm).toBe(true);
    });
  });

  it('music-release deliverables are distinguishable from one another', () => {
    const goal = { executionType: 'CreativeProduction', terminalOutcome: { text: 'Release my EP on Spotify' } };
    const deliverables = generateAutoDeliverables(goal);
    const titles = deliverables.map((d) => d.title);
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(titles.length);
  });

  it('music-release deliverable for tracked recordings names a tangible completion state', () => {
    const goal = {
      executionType: 'CreativeProduction',
      terminalOutcome: { text: 'Finish and release a polished 3-song EP' },
    };
    const deliverables = generateAutoDeliverables(goal);
    const draftDeliverable = deliverables.find((d) => d.id === 'auto-deliv-creative-music-draft');
    expect(draftDeliverable).toBeDefined();
    const title = draftDeliverable!.title.toLowerCase();
    // Should name a completion state (tracked recordings) not activity attendance (draft sessions)
    expect(title).toContain('recordings');
    expect(title).not.toMatch(/draft sessions?/);
  });
});
