import { loadReferenceMatrix, slugId } from './src/domain/masterGrid/loadReferenceMatrix.js';
import fs from 'fs';

const fixture = JSON.parse(fs.readFileSync('tests/fixtures/reference_matrix_v3_0.json', 'utf8'));
const state = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' });
const m = state.matrix;

console.log('Entities:', Object.keys(m.entitiesById).length);
console.log('Entity keys:', Object.keys(m.entitiesById).slice(0, 3));

const gsId = `entity-${slugId('Global State Solutions')}`;
console.log('\nLooking for:', gsId);
console.log('Found:', !!m.entitiesById[gsId]);
if (m.entitiesById[gsId]) {
  console.log('Entity name:', m.entitiesById[gsId].name);
}
