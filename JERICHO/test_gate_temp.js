import fs from 'fs';
import { loadReferenceMatrix } from './src/domain/masterGrid/loadReferenceMatrix.js';

// Load the original fixture
const originalFixture = JSON.parse(fs.readFileSync('./tests/fixtures/reference_matrix_v3_0.json', 'utf8'));

// Find and remove the "D8 N8 — Release" artifact (the one with publication_artifact: true)
const mutatedNodes = originalFixture.nodes.filter((n) => {
  return !(n.class === 'Artifact' && n.name === 'D8 N8 — Release');
});

console.log(`Original nodes: ${originalFixture.nodes.length}`);
console.log(`Mutated nodes: ${mutatedNodes.length}`);
console.log(`Removed: 1 artifact (D8 N8 — Release)\n`);

// Create mutated fixture
const mutatedFixture = { ...originalFixture, nodes: mutatedNodes };

// Load through loadReferenceMatrix
console.log('=== LOADING MUTATED FIXTURE THROUGH loadReferenceMatrix ===\n');
const result = loadReferenceMatrix(mutatedFixture);

// Check for lastPlanError
if (result.lastPlanError) {
  console.log('✗ GATE FIRED');
  console.log(`Code: ${result.lastPlanError.code}`);
  console.log(`Reason:\n${result.lastPlanError.reason}`);
} else {
  console.log('✓ NO GATE ERROR');
  console.log('Gate accepted the mutated fixture silently.');
  console.log('The publication_artifact requirement is NOT enforced at load time.');
}
