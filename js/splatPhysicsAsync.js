import { isSplatFieldMode } from './splatPhysics.js?v=20261115_en_v21';

// Keep Gaussian math and packing off the rendering/input thread.
export function createAsyncSplatPhysicsSession(viewer, mode, worldTransform) {
  const mesh = viewer.splatMesh;
  const textures = mesh?.splatDataTextures;
  const count = mesh?.getSplatCount();
  if (typeof Worker === 'undefined' || !count || !textures || textures.covariances?.compressionLevel !== 0 ||
      !(textures.baseData?.centers instanceof Float32Array) || textures.baseData.centers.length < count * 3 ||
      textures.baseData.covariances.length < count * 6) return null;

  const base = textures.baseData;
  const rest = {
    centers: base.centers.slice(0, count * 3),
    covariances: base.covariances.slice(0, count * 6),
    colors: base.colors.slice(0, count * 4),
    packed: textures.centerColors.data.slice(),
    covarianceTexture: textures.covariances.data.slice(),
  };
  const sceneIndexes = new Uint32Array(count);
  const sceneCount = mesh.getSceneCount?.() ?? 1;
  if (sceneCount > 1) {
    for (let i = 0; i < count; i++) sceneIndexes[i] = mesh.getSceneIndexForSplat(i);
  }
  const matrices = Array.from({ length: sceneCount }, (_, index) =>
    mesh.getScene(index).transform.elements.slice());
  const integerSort = viewer.integerBasedSort === true;
  let worker;
  try {
    const workerUrl = new URL(`./splatPhysicsWorker.js?v=${Date.now()}`, import.meta.url);
    worker = new Worker(workerUrl, { type: 'module', name: 'odyssey-splat-physics' });
  }
  catch { return null; }
  const originalTree = mesh.getSplatTree;
  mesh.getSplatTree = () => null;
  let disposed = false, failed = false, ready = false, busy = false, enabled = true;
  let generation = 0, pending = null, recycled = null, lastSeconds = 0;
  const isField = isSplatFieldMode(mode);
  const minimumInterval = count > 300000 ? 1 / 15 : count > 100000 ? 1 / 25 : 1 / 30;
  let interval = minimumInterval;

  const valid = () => !disposed && !failed && mesh.splatDataTextures === textures && mesh.getSplatCount() === count;
  let lastSortTime = 0;
  const sendSort = (centers, force = false) => {
    if (!viewer.sortWorker) return;
    const now = performance.now();
    if (!force && now - lastSortTime < 120) return;
    lastSortTime = now;
    // Feed the newest positions before sorting; never queue obsolete sorts.
    viewer.sortWorker.postMessage({ centers: centers.buffer, sceneIndexes: sceneIndexes.buffer, range: { from: 0, count } });
    if (!viewer.sortRunning) void viewer.runSplatSort?.(true, true);
  };
  const dispatch = () => {
    if (!valid() || !enabled || !ready || busy || !pending) return;
    const request = pending; pending = null; busy = true;
    const frame = recycled; recycled = null;
    worker.postMessage({ type: 'update', ...request, frame }, frame ? Object.values(frame).filter(a => a && a.buffer && a.buffer.byteLength > 0).map(array => array.buffer) : []);
  };
  worker.onmessage = ({ data }) => {
    if (!valid()) return;
    if (data.type === 'ready') { ready = true; dispatch(); return; }
    if (data.type === 'error') { failed = true; worker.terminate(); return; }
    if (data.type !== 'frame') return;
    busy = false;
    const frame = data.frame;
    if (enabled && data.generation === generation) {
      base.centers.set(frame.centers);
      base.colors.set(frame.colors);
      textures.centerColors.data.set(frame.packed);
      textures.centerColors.texture.needsUpdate = true;
      if (!isField && frame.covariances && frame.covariances.length > 0) {
        base.covariances.set(frame.covariances);
        textures.covariances.data.set(frame.covariances);
        textures.covariances.texture.needsUpdate = true;
      }
      sendSort(frame.sortCenters);
      lastSeconds = data.seconds;
      // Leave CPU headroom on slower devices instead of building a work queue.
      interval = Math.min(0.12, Math.max(minimumInterval, data.computeMs * 0.001));
      viewer.forceRenderNextFrame?.();
    }
    recycled = frame;
    dispatch();
  };
  worker.onerror = event => { event.preventDefault(); failed = true; worker.terminate(); };
  const input = {
    centers: rest.centers.slice(), covariances: rest.covariances.slice(), colors: rest.colors.slice(),
    sceneIndexes: sceneIndexes.slice(), matrices, worldTransform: worldTransform.elements.slice(), integerSort, mode,
  };
  worker.postMessage({ type: 'init', ...input }, [input.centers.buffer, input.covariances.buffer, input.colors.buffer, input.sceneIndexes.buffer]);

  return {
    count,
    get interval() { return interval; },
    get lastSeconds() { return lastSeconds; },
    invalidate() { generation++; pending = null; },
    setEnabled(value) {
      if (enabled === value) return;
      enabled = value;
      generation++; pending = null;
    },
    update(seconds, strength, heatmap = true) {
      if (!valid()) return false;
      pending = { seconds, strength, heatmap, generation };
      dispatch();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      worker.terminate(); pending = null; recycled = null;
      mesh.getSplatTree = originalTree;
      if (mesh.splatDataTextures !== textures || mesh.getSplatCount() !== count) return;
      base.centers.set(rest.centers); base.covariances.set(rest.covariances); base.colors.set(rest.colors);
      textures.centerColors.data.set(rest.packed); textures.covariances.data.set(rest.covarianceTexture);
      textures.centerColors.texture.needsUpdate = true; textures.covariances.texture.needsUpdate = true;
      const centers = integerSort ? new Int32Array(count * 4) : new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        for (let axis = 0; axis < 3; axis++) centers[i * 4 + axis] = integerSort ? Math.round(rest.centers[i * 3 + axis] * 1000) : rest.centers[i * 3 + axis];
        centers[i * 4 + 3] = integerSort ? 1000 : 1;
      }
      sendSort(centers, true);
      viewer.forceRenderNextFrame?.();
    },
  };
}
