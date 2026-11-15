// Keep work bounded independently of a monitor's refresh rate.
export function createSceneFrameBudget(renderer) {
  const frameMs = 1000 / 60;
  let previousTick = 0, accumulated = 0, shadowTime = 0;
  let windowStart = 0, frames = 0, workTime = 0, lastQualityChange = 0;
  const maximumRatio = Math.min(devicePixelRatio || 1, 1.25);
  const minimumRatio = Math.min(maximumRatio, 0.7);
  return {
    reset(now) { previousTick = now; accumulated = frameMs; windowStart = 0; frames = 0; workTime = 0; },
    shouldRender(now) {
      accumulated += Math.max(0, now - previousTick); previousTick = now;
      if (accumulated < frameMs - 0.25) return false;
      accumulated = Math.max(0, accumulated - frameMs) % frameMs;
      return true;
    },
    shadows(delta) {
      shadowTime += delta;
      if (shadowTime >= 1 / 20) {
        renderer.shadowMap.needsUpdate = true;
        shadowTime %= 1 / 20;
      }
    },
    record(now, milliseconds) {
      if (!windowStart) windowStart = now;
      frames++; workTime += milliseconds;
      const elapsed = now - windowStart;
      if (elapsed < 2000) return;
      const fps = (frames - 1) * 1000 / elapsed;
      const ratio = renderer.getPixelRatio();
      let next = ratio;
      if (fps < 48) next = Math.max(minimumRatio, ratio - 0.15);
      else if (fps > 57 && workTime / frames < 7 && now - lastQualityChange > 12000) next = Math.min(maximumRatio, ratio + 0.1);
      if (Math.abs(next - ratio) > 0.01) {
        renderer.setPixelRatio(next);
        renderer.shadowMap.needsUpdate = true;
        lastQualityChange = now;
      }
      windowStart = now; frames = 0; workTime = 0;
    },
  };
}

// Dynamic splat viewers otherwise sort and copy every point on every frame,
// even when both the camera and object are stationary. Physics updates still
// force a sort immediately; ordinary motion is refreshed at up to 30 Hz.
export function limitSplatSortWork(dropIn) {
  const viewer = dropIn.viewer;
  const original = viewer.runSplatSort.bind(viewer);
  const skipped = Promise.resolve(false);
  let lastSort = -Infinity, savedCount = -1;
  let snapshot = new Float64Array(0);
  viewer.runSplatSort = (force = false, all = false) => {
    if (!viewer.initialized || !viewer.camera || viewer.sortRunning) return original(force, all);
    const mesh = viewer.splatMesh;
    const scenes = mesh.getSceneCount();
    const count = mesh.getSplatCount();
    const now = performance.now();
    if (!force && now - lastSort < 1000 / 30) return skipped;
    const matrices = [viewer.camera.matrixWorld, viewer.camera.projectionMatrix, mesh.matrixWorld];
    for (let i = 0; i < scenes; i++) matrices.push(mesh.getScene(i).transform);
    const length = matrices.length * 16;
    let changed = count !== savedCount || snapshot.length !== length;
    if (snapshot.length !== length) snapshot = new Float64Array(length);
    for (let m = 0; m < matrices.length && !changed; m++) {
      const elements = matrices[m].elements;
      for (let i = 0; i < 16; i++) if (Math.abs(elements[i] - snapshot[m * 16 + i]) > 0.00001) { changed = true; break; }
    }
    if (!force && !changed) return skipped;
    matrices.forEach((matrix, index) => snapshot.set(matrix.elements, index * 16));
    savedCount = count; lastSort = now;
    return original(force, all);
  };
}
