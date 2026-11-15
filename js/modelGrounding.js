import * as THREE from 'three';

// Contact points belong to the visual object, excluding the splat renderer's
// callback sphere and collision/debug helpers.
export function getModelSupportPoints(inst) {
  inst.group.updateWorldMatrix(true, true);
  const inverse = inst.group.matrixWorld.clone().invert();
  const points = [];
  const point = new THREE.Vector3();
  if (inst.assetId === 'asset_mars_lander') {
    inst.visualGroup.traverse(mesh => {
      if (!mesh.isMesh || mesh.geometry?.parameters?.height !== 0.1) return;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      for (let i = 0; i < 4; i++) points.push(new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x, box.min.y, i & 2 ? box.max.z : box.min.z,
      ).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));
    });
  }
  if (points.length) return points;
  const mesh = inst.splatViewer?.splatMesh;
  const data = mesh?.splatDataTextures?.baseData;
  if (data?.centers) {
    const samples = [], count = mesh.getSplatCount();
    const stride = Math.max(1, Math.floor(count / 2048));
    const matrix = inverse.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < count; i += stride) {
      if (data.colors[i * 4 + 3] < 32) continue;
      point.fromArray(data.centers, i * 3).applyMatrix4(matrix);
      if (Number.isFinite(point.lengthSq())) samples.push(point.clone());
    }
    samples.sort((a, b) => a.y - b.y);
    // Ignore sparse low floaters; sample the actual visible base of the asset.
    return samples.slice(Math.floor(samples.length * .01), Math.max(1, Math.ceil(samples.length * .08)));
  }
  const box = new THREE.Box3().setFromObject(inst.visualGroup || inst.group);
  if (!box.isEmpty()) {
    for (let i = 0; i < 4; i++) points.push(new THREE.Vector3(
      i & 1 ? box.max.x : box.min.x, box.min.y, i & 2 ? box.max.z : box.min.z,
    ).applyMatrix4(inverse));
  }
  return points;
}

export function groundModelInstance(inst, terrainHeight, cachedSupports = null) {
  if (!inst?.group || !terrainHeight) return false;
  const supports = cachedSupports || getModelSupportPoints(inst);
  const point = new THREE.Vector3();
  let lift = -Infinity;
  for (const local of supports) {
    point.copy(local).applyMatrix4(inst.group.matrixWorld);
    const height = terrainHeight(point.x, point.z);
    if (Number.isFinite(height)) lift = Math.max(lift, height - point.y);
  }
  if (!Number.isFinite(lift)) return false;
  inst.group.getWorldPosition(point); point.y += lift;
  if (inst.group.parent) inst.group.parent.worldToLocal(point);
  inst.group.position.copy(point);
  inst.group.updateMatrixWorld(true);
  return true;
}

// Project the grid onto the same surface used for walking. Chunk the one-time
// ray sampling so loading detailed terrain does not stall the scene.
export async function conformGridToTerrain(grid, terrainHeight, size = 30, divisions = 30) {
  const generation = (grid.userData.groundGeneration || 0) + 1;
  grid.userData.groundGeneration = generation;
  grid.userData.terrainDraped = false;
  grid.geometry.setDrawRange(0, 0);
  const steps = divisions * 2, rowWidth = steps + 1;
  const heights = new Float32Array(rowWidth * rowWidth);
  for (let z = 0; z <= steps; z++) {
    for (let x = 0; x <= steps; x++) heights[z * rowWidth + x] = terrainHeight(-size / 2 + x * size / steps, -size / 2 + z * size / steps) + .015;
    if (z % 6 === 5) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (grid.userData.groundGeneration !== generation) return false;
    }
  }
  const positions = [], colors = [];
  const major = new THREE.Color(0x38bdf8), minor = new THREE.Color(0x1e293b);
  const add = (x, z, color) => {
    positions.push(-size / 2 + x * size / steps, heights[z * rowWidth + x], -size / 2 + z * size / steps);
    colors.push(color.r, color.g, color.b);
  };
  for (let line = 0; line <= steps; line += 2) {
    const color = line === steps / 2 ? major : minor;
    for (let segment = 0; segment < steps; segment++) {
      add(segment, line, color); add(segment + 1, line, color);
      add(line, segment, color); add(line, segment + 1, color);
    }
  }
  if (grid.userData.groundGeneration !== generation) return false;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  grid.geometry.dispose(); grid.geometry = geometry;
  grid.position.y = 0;
  grid.userData.terrainDraped = true;
  return true;
}
