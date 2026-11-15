import * as THREE from '../libs/three/three.module.js';
import { createSplatPhysicsSession, isSplatFieldMode } from './splatPhysics.js?v=20261115_en_v21';

let session = null;
let textures = null;
let sortCenters = null;
let isField = false;

function allocateFrame(count, integerSort, isFieldMode) {
  return {
    centers: new Float32Array(count * 3),
    covariances: isFieldMode ? new Float32Array(0) : new Float32Array(count * 6),
    colors: new Uint8Array(count * 4),
    packed: new Uint32Array(count * 4),
    sortCenters: integerSort ? new Int32Array(count * 4) : new Float32Array(count * 4),
  };
}

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      const { centers, covariances, colors, sceneIndexes, matrices, integerSort, mode, worldTransform } = data;
      const count = centers.length / 3;
      isField = isSplatFieldMode(mode);
      textures = {
        baseData: { centers, covariances, colors },
        centerColors: { data: new Uint32Array(count * 4), texture: {} },
        covariances: { data: covariances, compressionLevel: 0, texture: {} },
      };
      const scenes = matrices.map(elements => ({ transform: new THREE.Matrix4().fromArray(elements) }));
      // Reuse the same physics kernel and worker sort protocol.
      session = createSplatPhysicsSession({
        splatMesh: {
          getSplatCount: () => count,
          getSceneIndexForSplat: index => sceneIndexes[index],
          getScene: index => scenes[index],
          getSplatTree: () => null,
          splatDataTextures: textures,
        },
        integerBasedSort: integerSort,
        sortWorker: { postMessage: message => { sortCenters = integerSort ? new Int32Array(message.centers) : new Float32Array(message.centers); } },
      }, mode, new THREE.Matrix4().fromArray(worldTransform));
      if (!session) throw new Error('Gaussian data is not supported by the physics kernel.');
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'update' && session) {
      const start = performance.now();
      if (!session.update(data.seconds, data.strength, data.heatmap)) throw new Error('Gaussian data changed.');
      // Transfer and recycle one output bundle, with at most one update in flight.
      // The kernel keeps its own rest data; no renderer-owned buffers are detached.
      const frame = data.frame || allocateFrame(session.count, sortCenters instanceof Int32Array, isField);
      frame.centers.set(textures.baseData.centers);
      if (!isField && frame.covariances.length > 0) {
        frame.covariances.set(textures.baseData.covariances);
      }
      frame.colors.set(textures.baseData.colors);
      frame.packed.set(textures.centerColors.data);
      frame.sortCenters.set(sortCenters);
      const transfers = Object.values(frame)
        .filter(arr => arr && arr.buffer && arr.buffer.byteLength > 0)
        .map(arr => arr.buffer);
      self.postMessage({ type: 'frame', frame, generation: data.generation, seconds: data.seconds, computeMs: performance.now() - start },
        transfers);
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
