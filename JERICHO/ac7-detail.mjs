import fs from 'fs';
import {loadReferenceMatrix, slugId} from './src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync('tests/fixtures/reference_matrix_v1_4.json'));
const {matrix} = loadReferenceMatrix(fixture, {nowISO: '2026-07-08T00:00:00Z'});

const byId = {
  ...matrix.entitiesById, ...matrix.initiativesById, ...matrix.projectsById,
  ...matrix.deliverablesById, ...matrix.artifactsById, ...matrix.systemsById,
};

const mismatches = [];
for (const node of fixture.nodes) {
  if (node.class === 'Initiative') continue;
  const prefix = {'Entity':'entity-', 'Initiative':'initiative-', 'Project':'project-', 
    'Deliverable':'deliverable-', 'System':'system-', 'Artifact':''}[node.class] || '';
  const key = `${prefix}${slugId(node.name)}`;
  const stored = byId[key];
  const canon = node.phase ?? null;
  const stor = stored ? stored.phase ?? null : '(missing)';
  if (String(stor) !== String(canon)) {
    mismatches.push({name: node.name, class: node.class, canon, stor, found: !!stored});
  }
}

console.log(`Total: ${mismatches.length} mismatches\n`);
const byFound = {};
for (const m of mismatches) byFound[m.found ? 'found-mismatch' : 'not-found'] = (byFound[m.found ? 'found-mismatch' : 'not-found'] || 0) + 1;
console.log('Breakdown:', byFound);
console.log('\nFirst 10 mismatches:');
mismatches.slice(0, 10).forEach(m => 
  console.log(`  ${m.class.padEnd(12)} ${m.name.substring(0,30).padEnd(30)} canon=${String(m.canon).padEnd(4)} stor=${String(m.stor).padEnd(8)}`));
