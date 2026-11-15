// Run from the workspace root: node pygrassreal-odyssey/scripts/sync_splat_physics.mjs
import fs from 'node:fs';
import ts from 'typescript';

const source = new URL('../../src/dashboard/ThreeDModelPage/components/MatchanuViewer/SplatPhysics.ts', import.meta.url);
// Include the DropInViewer's parent transform so flipped/scaled assets deform upright.
const input = fs.readFileSync(source, 'utf8')
  .replace(/\r\n/g, '\n')
  .replace('mode: SplatPhysicsMode) {\n  const mesh', 'mode: SplatPhysicsMode, worldTransform = new THREE.Matrix4()) {\n  const mesh')
  .replace('const matrix = mesh.getScene?.(si)?.transform?.clone() ?? new THREE.Matrix4();',
    'const matrix = worldTransform.clone().multiply(mesh.getScene?.(si)?.transform ?? new THREE.Matrix4());');
const output = ts.transpileModule(input, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText.replace("from 'three';", "from '../libs/three/three.module.js';");
if (!output.includes('mode, worldTransform = new THREE.Matrix4()') || !output.includes('worldTransform.clone().multiply')) {
  throw new Error('Matchanu physics source changed; review the world transform adapter.');
}
fs.writeFileSync(new URL('../js/splatPhysics.js', import.meta.url),
  '// Generated from Matchanu SplatPhysics.ts by scripts/sync_splat_physics.mjs.\n' + output);
