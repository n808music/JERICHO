import { describe, it } from 'vitest';
import { loadReferenceMatrix } from '../../src/domain/masterGrid/loadReferenceMatrix.js';
import { readFileSync } from 'fs';
import path from 'path';

describe('Read rejection details', () => {
  it('logs artifact rejections', () => {
    const fixture = JSON.parse(readFileSync(path.resolve('tests/fixtures/reference_matrix_v3_0.json'), 'utf8'));
    const state = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' });
    const m = state.matrix;

    console.log('\n\n=== ARTIFACT STATUS ===');
    console.log('Loaded into m.artifactsById:', Object.keys(m.artifactsById).length);
    console.log('Nodes in fixture with class="Artifact":', fixture.nodes.filter(n => n.class === 'Artifact').length);
    
    // Check lastPlanError
    console.log('\n=== STATE ERROR ===');
    if (state.lastPlanError) {
      console.log('lastPlanError exists:');
      console.log(`  code: ${state.lastPlanError.code}`);
      console.log(`  reason: ${state.lastPlanError.reason}`);
      console.log(`  meta:`, JSON.stringify(state.lastPlanError.meta).slice(0, 200));
    } else {
      console.log('lastPlanError: null/undefined');
    }

    // Build a map of fixture artifacts by name to check status
    const fixtureArtifacts = fixture.nodes.filter(n => n.class === 'Artifact');
    const loadedNames = new Set(Object.values(m.artifactsById).map(a => a.name));
    
    console.log('\n=== MISSING ARTIFACTS (with buffer_anchor) ===');
    const missingWithAnchor = fixtureArtifacts.filter(
      a => !loadedNames.has(a.name) && a.buffer_anchor
    );
    console.log(`Total: ${missingWithAnchor.length}`);
    
    // Categorize by forwardRef and anchorStored
    const byCategory = {};
    missingWithAnchor.forEach(a => {
      const key = `forwardRef:${!!a.forwardRef}, anchorStored:${!!a.anchorStored}`;
      byCategory[key] = (byCategory[key] || 0) + 1;
    });
    
    console.log('Breakdown:');
    Object.entries(byCategory).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });

    console.log('\n=== SAMPLES (first 3 missing with anchor) ===');
    missingWithAnchor.slice(0, 3).forEach(a => {
      console.log(`  ${a.name}:`);
      console.log(`    buffer_anchor: ${a.buffer_anchor}`);
      console.log(`    forwardRef: ${a.forwardRef}`);
      console.log(`    anchorStored: ${a.anchorStored}`);
    });

    console.log('\n=== LOADED WITH ANCHOR ===');
    const loadedWithAnchor = Object.values(m.artifactsById).filter(a => a.buffer_anchor);
    console.log(`Total loaded with buffer_anchor: ${loadedWithAnchor.length}`);
  });
});
