import * as THREE from 'three';

function updatePose(model, meshes) {
  model.updateWorldMatrix(true, true);
  for (const mesh of meshes) mesh.skeleton.update();
}

// Measure the first animated pose, not the GLB bind pose: Mixamo root translation
// can differ by nearly a metre after scaling. Keep the visual offset independent
// of the physics root, and track a small boot sample instead of scanning the skin
// on every frame.
export function fitAnimatedCharacter(model, actor, targetHeight = 1.65) {
  const meshes = [];
  model.traverse(mesh => { if (mesh.isSkinnedMesh) meshes.push(mesh); });
  updatePose(model, meshes);
  const box = new THREE.Box3().setFromObject(model, true);
  const height = box.max.y - box.min.y;
  if (height > .001) model.scale.multiplyScalar(targetHeight / height);
  updatePose(model, meshes);
  box.setFromObject(model, true);
  model.position.y -= box.min.y;
  updatePose(model, meshes);
  box.setFromObject(model, true);

  const vertex = new THREE.Vector3(), inverse = new THREE.Matrix4();
  const candidates = [], unique = new Set();
  const centerX = (box.min.x + box.max.x) / 2;
  for (const mesh of meshes) {
    for (let index = 0; index < mesh.geometry.attributes.position.count; index++) {
      mesh.getVertexPosition(index, vertex).applyMatrix4(mesh.matrixWorld);
      if (vertex.y > box.min.y + targetHeight * .16) continue;
      const key = `${vertex.x.toFixed(4)}:${vertex.y.toFixed(4)}:${vertex.z.toFixed(4)}`;
      if (unique.has(key)) continue;
      unique.add(key);
      candidates.push({ mesh, index, x: vertex.x, y: vertex.y, z: vertex.z, side: vertex.x < centerX ? 0 : 1 });
    }
  }
  candidates.sort((a, b) => a.y - b.y);
  const stride = Math.max(1, Math.ceil(candidates.length / 160));
  const samples = candidates.filter((_, index) => index % stride === 0);
  const footBounds = [new THREE.Box3(), new THREE.Box3()];
  for (const sample of candidates) footBounds[sample.side].expandByPoint(vertex.set(sample.x, sample.y, sample.z));
  const centers = footBounds.map(bounds => bounds.getCenter(new THREE.Vector3()));
  for (const sample of samples) sample.bin = sample.side * 4 + (sample.x > centers[sample.side].x ? 1 : 0) + (sample.z > centers[sample.side].z ? 2 : 0);
  const foot = Array.from({ length: 8 }, () => new THREE.Vector3());
  const footY = new Float64Array(8);

  return {
    sampleCount: samples.length,
    align(surfaceHeight, supportHeight = null) {
      if (!samples.length) return;
      updatePose(model, meshes);
      inverse.copy(actor.matrixWorld).invert();
      let lowest = Infinity;
      footY.fill(Infinity);
      for (const sample of samples) {
        sample.mesh.getVertexPosition(sample.index, vertex).applyMatrix4(sample.mesh.matrixWorld);
        if (vertex.y < footY[sample.bin]) { footY[sample.bin] = vertex.y; foot[sample.bin].copy(vertex); }
        vertex.applyMatrix4(inverse);
        lowest = Math.min(lowest, vertex.y);
      }
      let correction = surfaceHeight ? -Infinity : -lowest;
      if (surfaceHeight) {
        for (let bin = 0; bin < foot.length; bin++) {
          if (Number.isFinite(footY[bin])) {
            const height = Math.max(surfaceHeight(foot[bin].x, foot[bin].z), supportHeight ?? -Infinity);
            correction = Math.max(correction, height - footY[bin]);
          }
        }
      }
      if (Number.isFinite(correction)) {
        model.position.y += correction;
        model.updateMatrixWorld(true);
      }
    },
  };
}
