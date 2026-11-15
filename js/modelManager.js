import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { Py3sCodec } from '../libs/py3s/py3sCodec.js';
import { pushHistory } from './historyManager.js?v=20261115_en_v18';
import { limitSplatSortWork } from './scenePerformance.js?v=20261115_en_v18';
import { groundModelInstance, getModelSupportPoints } from './modelGrounding.js?v=20261115_en_v18';
import { createAssetPlacement } from './assetPlacement.js?v=20261115_en_v18';
import { hasInstanceCollision, syncPhysicsUI } from './instancePhysics.js?v=20261115_en_v21';
import {
  convertSpzToSplatBlob,
  createProceduralLanderSplatBlob
} from './splatDecoders.js?v=20261115_en_v18';

// Modular Subsystems
import {
  setupOptimizedColliderMesh,
  getNearbyColliders,
  adjustColliderHeight as adjustPhysicsColliderHeight,
  adjustColliderOpacity as adjustPhysicsColliderOpacity,
  exportPrint3D,
  getColliderSurfaceHeight as getPhysicsSurfaceHeight,
  resolveCharacterCollision as resolvePhysicsCollision,
  checkSingleBoxCollision
} from './collisionPhysics.js?v=20261115_en_v18';

import {
  initGumballControls,
  getTransformControls,
  selectModel,
  toggleGumball,
  setGumballMode,
  resetModelTransform as resetGumballTransform,
  snapModelToGround as snapGumballToGround,
  updateGumballUI,
  updateGumballCoordinatesUI
} from './gumballManager.js?v=20261115_en_v18';

import {
  placedInstances,
  selectedInstanceId,
  registerOutlinerHooks,
  getSelectedInstance,
  selectInstance,
  selectTerrainLayer,
  toggleInstanceVisibility,
  toggleInstanceLock,
  handleDeleteInstance,
  executeDeleteInstance,
  toggleRhinoVisibility,
  toggleRhinoLock,
  selectRhinoLayer,
  handleDeleteLayer,
  executeDeleteLayer,
  updateRhinoLayersUI,
  togglePy3sLayer,
  applyPy3sLayers,
  toggleColliderMode,
  setShadingMode,
  applyShadingMode,
  py3sLayersState,
  py3sLayersLocked,
  py3sLayersDeleted,
  selectedRhinoLayer
} from './outlinerManager.js?v=20261115_en_v18';

import {
  assetLibrary,
  py3sFileList,
  registerAssetBrowserHandlers,
  renderPy3sFileList,
  handleAssetDragStart,
  handleDeleteAsset,
  handleDeletePy3s,
  removeAssetFile,
  formatFileSize,
  setupDropZone as setupAssetDropZone,
  processLoadedFiles,
  processLoadedFile,
  activatePy3sFile
} from './assetBrowser.js?v=20261115_en_v19';

// Central scene node groups
export let currentModelGroup = new THREE.Group();
export const visualMeshGroup = new THREE.Group();
export const colliderMeshGroup = new THREE.Group();
export const splatContainerGroup = new THREE.Group();

let activeShading = 'splat';
let terrainHeightFn = () => 0;
let mainScene = null;
let mainCamera = null;
let mainRenderer = null;
let mainOrbitControls = null;
let dropInViewer = null;
let currentBlobUrl = null;

let currentModelScaleMultiplier = 1.0;
let currentFlipX = false;
let currentBaseTargetSize = 4.2;
let assetPlacement = null;
export function cancelAssetPlacement() { assetPlacement?.cancel(); }

export function getActiveColliders() {
  const colliders = [];
  for (const inst of placedInstances) {
    if (inst.deleted || !inst.visible || !hasInstanceCollision(inst)) continue;
    if (inst.colliders) {
      for (const c of inst.colliders) {
        if (c.isMesh && !c.isLineSegments) colliders.push(c);
      }
    }
  }
  if (colliders.length === 0 && placedInstances.length === 0) {
    colliderMeshGroup.traverse((c) => {
      if (c.isMesh && !c.isLineSegments) colliders.push(c);
    });
    if (colliders.length === 0) {
      visualMeshGroup.traverse((c) => {
        if (c.isMesh && !c.isLineSegments) colliders.push(c);
      });
    }
  }
  return colliders;
}

export function initModelManager(scene, getTerrainHeight, camera = null, renderer = null, orbitControls = null) {
  mainScene = scene;
  terrainHeightFn = getTerrainHeight;
  mainCamera = camera;
  mainRenderer = renderer;
  mainOrbitControls = orbitControls;
  window.addEventListener('odyssey-terrain-ready', () => {
    for (const inst of placedInstances) {
      if (inst.deleted || !inst.groundAnchor) continue;
      const anchor = inst.groundAnchor;
      if (!inst.group.position.equals(anchor.pos) || !inst.group.quaternion.equals(anchor.rot) || !inst.group.scale.equals(anchor.scale)) continue;
      groundModelInstance(inst, terrainHeightFn);
      inst.groundAnchor.pos.copy(inst.group.position);
    }
    updateGumballCoordinatesUI();
  });

  scene.add(currentModelGroup);

  // Hook up Outliner with Gumball and Scene
  registerOutlinerHooks({
    onSelectionChange: (instId, inst) => {
      syncPhysicsUI();
      const tc = getTransformControls();
      if (!tc) return;
      if (!inst || inst.deleted) {
        tc.detach();
        tc.getHelper().visible = false;
        updateGumballUI();
        return;
      }
      currentModelGroup = inst.group;
      if (inst.locked || !inst.visible) {
        tc.detach();
        tc.getHelper().visible = false;
        const textEl = document.getElementById('gumball-status-text');
        if (textEl) {
          textEl.innerText = inst.locked
            ? `Target: ${inst.layerName} (LOCKED 🔒)`
            : `Target: ${inst.layerName} (HIDDEN 🚫)`;
        }
      } else {
        tc.attach(inst.group);
        tc.getHelper().visible = true;
        updateGumballUI();
      }
      updateGumballCoordinatesUI();
    },
    onDeleteInstance: (instId, inst) => {
      if (mainScene && inst && inst.group) {
        mainScene.remove(inst.group);
      }
      renderPy3sFileList();
    },
    onLayerStateChange: (state) => {
      for (const inst of placedInstances) {
        if (inst.colliderGroup) inst.colliderGroup.visible = state.collider;
        if (inst.visualGroup) inst.visualGroup.visible = state.splat;
      }
      if (splatContainerGroup) splatContainerGroup.visible = state.splat;
      if (colliderMeshGroup) colliderMeshGroup.visible = state.collider;
      if (visualMeshGroup) visualMeshGroup.visible = state.solid;
      activeShading = state.collider ? 'collider' : 'splat';
    }
  });

  // Hook up Asset Browser with Placed Instances
  registerAssetBrowserHandlers({
    onSpawnFromAsset: async (assetId) => {
      await spawnModelFromAsset(assetId);
    },
    getPlacedInstances: () => placedInstances
  });

  // Initialize Gumball Controls
  if (camera && renderer) {
    initGumballControls({
      camera,
      renderer,
      orbitControls,
      scene,
      getTargetInstance: () => getSelectedInstance() || (currentModelGroup ? { group: currentModelGroup, layerName: 'Active Model', locked: false, visible: true, id: 'active' } : null),
      onSelectInstance: (id) => selectInstance(id)
    });
  }

  // Setup Dropzone on viewport
  if (camera && renderer) assetPlacement = createAssetPlacement({
    scene, camera, canvas: renderer.domElement, terrainHeight: terrainHeightFn,
    load: createPlacementPreview,
    commit: (assetId, position, preview) => spawnModelInstance(assetId, position, preview),
  });
  setupAssetDropZone({
    canvas: renderer ? renderer.domElement : null,
    threeLayer: document.getElementById('threejs-layer'),
    camera,
    terrainHeightFn,
    placementPreview: assetPlacement,
    onSpawnInstanceAt: async (assetId, pos) => {
      return await spawnModelInstance(assetId, pos);
    }
  });

  renderPy3sFileList();
  updateRhinoLayersUI();

  // Automatically spawn the persistent Sci-Fi Spacecraft Probe on 3D ground with its Layer
  setTimeout(async () => {
    try {
      if (placedInstances.filter(i => !i.deleted).length === 0) {
        await spawnDefaultSceneModel();
      }
    } catch (err) {
      console.warn('[ModelManager] Default scene model auto-spawn note:', err);
    }
  }, 120);

  // Pre-warm sample model assets in the background so drag & drop is buttery smooth and instant
  setTimeout(() => {
    assetLibrary.forEach(a => {
      if (a.filename && !a.buffer) {
        fetch(`assets/models/${a.filename}`)
          .then(r => (r.ok ? r.arrayBuffer() : null))
          .then(buf => {
            if (buf) {
              a.buffer = buf;
              console.log(`[ModelManager] Asset ${a.displayName || a.name} pre-warmed in memory cache.`);
            }
          })
          .catch(err => console.warn('[ModelManager] Pre-warm note:', err));
      }
    });
  }, 600);
}

async function loadPy3sAssetData(asset, enableSceneOpacity = false) {
  let unpacked = null;

  const isTemple = (asset.name && asset.name.toLowerCase().includes('thai-temple')) ||
                   (asset.id && asset.id.includes('temple'));

  if (asset.buffer) {
    try {
      unpacked = await Py3sCodec.unpack(asset.buffer);
    } catch (e) {
      console.warn('[ModelManager] Unpack uploaded buffer error:', e);
    }
  }

  // Seamlessly upgrade compact thai-temple-gate seed (55KB) to full 262k high-res 3DGS model (2.8MB)
  if (isTemple && (!unpacked || !unpacked.spzData || unpacked.spzData.byteLength < 100000)) {
    if (asset.buffer && asset.buffer.byteLength > 100000) {
      try {
        unpacked = await Py3sCodec.unpack(asset.buffer);
      } catch (e) {
        console.warn('[ModelManager] Unpack cached buffer error:', e);
      }
    }
    if (!unpacked || !unpacked.spzData || unpacked.spzData.byteLength < 100000) {
      try {
        const resp = await fetch('assets/models/thai_temple_gate_262k.py3s');
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          asset.buffer = buf;
          unpacked = await Py3sCodec.unpack(buf);
        }
      } catch (e) {
        console.warn('[ModelManager] Temple asset fetch note:', e);
      }
    }
  } else if (!unpacked && asset.filename) {
    try {
      const resp = await fetch(`assets/models/${asset.filename}`);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        asset.buffer = buf;
        unpacked = await Py3sCodec.unpack(buf);
      }
    } catch (e) {
      console.warn(`[ModelManager] Asset fetch note for ${asset.filename}:`, e);
    }
  }

  if (!unpacked) return null;

  const visualGroup = new THREE.Group();
  const colliderGroup = new THREE.Group();
  const colliders = [];
  let splatViewer = null;
  let colliderModel = null;

  // 1. Decode & Hydrate SPZ to authentic 3D Gaussian Splats
  let splatUrl = null;
  if (unpacked.spzData && unpacked.spzData.byteLength > 0) {
    try {
      const spzSub = unpacked.spzData.buffer.slice(
        unpacked.spzData.byteOffset,
        unpacked.spzData.byteOffset + unpacked.spzData.byteLength
      );
      const targetPoints = unpacked.metadata?.telemetryProfile?.fullPointCount || 262144;
      const splatBlob = await convertSpzToSplatBlob(spzSub, targetPoints);
      const blobUrl = URL.createObjectURL(splatBlob) + '#model.splat';
      splatUrl = blobUrl;

      splatViewer = new GaussianSplats3D.DropInViewer({
        gpuAcceleratedSort: false,
        sharedMemoryForWorkers: false,
        integerBasedSort: true,
        halfPrecisionCovariancesOnGPU: false,
        sphericalHarmonicsDegree: 0,
        dynamicScene: true,
        enableOptionalEffects: enableSceneOpacity,
        logLevel: GaussianSplats3D.LogLevel.None
      });

      limitSplatSortWork(splatViewer);
      await splatViewer.addSplatScene(blobUrl, {
        format: GaussianSplats3D.SceneFormat.Splat,
        showLoadingUI: false,
        splatAlphaRemovalThreshold: 1,
        progressiveLoad: false
      });
    } catch (err) {
      console.error('[ModelManager] Splat viewer decode error:', err);
      if (splatViewer) { await splatViewer.dispose(); splatViewer = null; }
    } finally {
      if (splatUrl) URL.revokeObjectURL(splatUrl.split('#')[0]);
    }
  }

  // 2. Decode GLTF Physics Collider Mesh
  if (unpacked.colliderData && unpacked.colliderData.byteLength > 0) {
    try {
      const colSub = unpacked.colliderData.buffer.slice(
        unpacked.colliderData.byteOffset,
        unpacked.colliderData.byteOffset + unpacked.colliderData.byteLength
      );
      colliderModel = await new Promise((resolve) => {
        new GLTFLoader().parse(colSub, '', (g) => resolve(g.scene), () => resolve(null));
      });
    } catch (err) {
      console.warn('[ModelManager] Collider parse note:', err);
    }
  }

  // 3. Compute original dimensions and scale up to authentic 4.5m target size (not tiny 0.45)
  const box = new THREE.Box3();
  if (colliderModel) {
    box.setFromObject(colliderModel);
  } else if (splatViewer && splatViewer.splatMesh) {
    try {
      box.copy(splatViewer.splatMesh.computeBoundingBox(false));
    } catch {
      box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
    }
  }

  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  let scaleFactor = (maxDim > 0.001) ? (4.5 / maxDim) : 1.0;
  if (asset.name?.includes('spacecraft') || asset.id === 'asset_spacecraft_probe') {
    scaleFactor = 11.57;
  }

  // 4. Align orientation & grounding (Align 3DGS Gaussian Splats and Collider Mesh 1:1)
  if (isTemple) {
    if (splatViewer) {
      let sBox = null;
      try {
        if (splatViewer.splatMesh) {
          sBox = splatViewer.splatMesh.computeBoundingBox(false);
        }
      } catch {}
      const sMaxY = (sBox && isFinite(sBox.max.y)) ? sBox.max.y : 0.43725;
      splatViewer.rotation.set(Math.PI, 0, 0);
      splatViewer.position.set(0, sMaxY, 0);
      visualGroup.add(splatViewer);
    }

    if (colliderModel) {
      colliderModel.rotation.set(0, 0, 0);
      colliderModel.position.set(0, 0.062, 0);
      setupOptimizedColliderMesh(colliderModel);
      colliderModel.traverse((c) => {
        if (c.isMesh && !c.isLineSegments) colliders.push(c);
      });
      colliderGroup.add(colliderModel);
    }
  } else {
    // Generic models: auto ground base of both visual and collider to y = 0
    if (splatViewer) {
      let sBox = null;
      try {
        if (splatViewer.splatMesh) {
          sBox = splatViewer.splatMesh.computeBoundingBox(false);
        }
      } catch {}
      const sMaxY = (sBox && isFinite(sBox.max.y)) ? sBox.max.y : 0;
      splatViewer.rotation.set(Math.PI, 0, 0);
      splatViewer.position.set(0, sMaxY, 0);
      visualGroup.add(splatViewer);
    }

    if (colliderModel) {
      colliderModel.rotation.set(0, 0, 0);
      const cBox = new THREE.Box3().setFromObject(colliderModel);
      if (cBox.min.y !== 0) {
        colliderModel.position.y = -cBox.min.y;
      }
      setupOptimizedColliderMesh(colliderModel);
      colliderModel.traverse((c) => {
        if (c.isMesh && !c.isLineSegments) colliders.push(c);
      });
      colliderGroup.add(colliderModel);
    }
  }

  colliderGroup.visible = py3sLayersState.collider;
  return { visualGroup, colliderGroup, colliders, scaleFactor, splatViewer };
}

export function buildProceduralMarsCraftMesh() {
  const visualGroup = new THREE.Group();

  const hullGeo = new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.25 });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 1.6;
  hull.castShadow = true;
  visualGroup.add(hull);

  const wingGeo = new THREE.BoxGeometry(3.6, 0.06, 1.2);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.15 });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(2.8, 1.6, 0);
  wingL.castShadow = true;
  visualGroup.add(wingL);

  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.set(-2.8, 1.6, 0);
  wingR.castShadow = true;
  visualGroup.add(wingR);

  const dishGeo = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const dishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.2 });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.position.set(0, 2.5, 0.4);
  dish.rotation.x = -Math.PI / 4;
  visualGroup.add(dish);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const legGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.8, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(Math.cos(angle) * 1.6, 0.8, Math.sin(angle) * 1.6);
    leg.rotation.z = Math.cos(angle) * 0.4;
    leg.rotation.x = -Math.sin(angle) * 0.4;
    leg.castShadow = true;
    visualGroup.add(leg);

    const footGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8);
    const foot = new THREE.Mesh(footGeo, legMat);
    foot.position.set(Math.cos(angle) * 2.0, 0.05, Math.sin(angle) * 2.0);
    visualGroup.add(foot);
  }

  const colliderGroup = new THREE.Group();
  const colMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.8 });
  const colHullGeo = new THREE.CylinderGeometry(1.5, 1.9, 1.3, 8);
  const colHull = new THREE.Mesh(colHullGeo, colMat);
  colHull.position.y = 1.6;
  colliderGroup.add(colHull);

  const colWingsGeo = new THREE.BoxGeometry(9.4, 0.4, 1.4);
  const colWings = new THREE.Mesh(colWingsGeo, colMat);
  colWings.position.set(0, 1.6, 0);
  colliderGroup.add(colWings);

  colliderGroup.visible = py3sLayersState.collider;
  const colliders = [colHull, colWings];
  for (const collider of colliders) collider.geometry.computeBoundsTree();

  return { visualGroup, colliderGroup, colliders };
}

let isSpawningInstance = false;
let lastSpawnTimestamp = 0;
let lastSpawnAssetKey = null;

async function createPlacementPreview(assetId) {
  const asset = assetLibrary.find(item => item.id === assetId);
  if (!asset) return null;

  // Use false for enableSceneOpacity so splats stay in maximum performance mode (no multi-pass alpha sorting)
  const loaded = await loadPy3sAssetData(asset, false);
  if (!loaded) return null;

  const group = new THREE.Group();
  group.name = 'AssetPlacementPreview';
  group.userData.placementPreview = true;
  group.userData.assetId = assetId;
  group.scale.setScalar(loaded.scaleFactor || 1);

  // CRITICAL OPTIMIZATION: Hide heavy 262k 3DGS splats while dragging cursor.
  // This eliminates all 3DGS worker sorting and WebGL alpha overdraw during mouse drag!
  loaded.visualGroup.visible = false;

  // Show lightweight wireframe mesh (only ~100 lines) as authentic 3D blueprint!
  loaded.colliderGroup.visible = true;

  group.add(loaded.visualGroup, loaded.colliderGroup);
  group.visible = false;
  mainScene.add(group);

  const preview = { ...loaded, group, assetId, adopted: false };
  const supports = getModelSupportPoints(preview);
  preview.supports = supports;
  let disposed = false;

  // Fast drag: update position directly with zero redundant 4-point terrain raycasting
  preview.move = position => {
    group.position.copy(position);
  };

  preview.restore = () => {
    // Reveal full photorealistic 3DGS splats instantly on drop
    loaded.visualGroup.visible = true;
    loaded.colliderGroup.visible = py3sLayersState.collider;
    group.name = '';
    delete group.userData.placementPreview;
    group.visible = true;
    // Ground model precisely once on drop to settle cleanly on Mars slopes
    groundModelInstance(preview, terrainHeightFn, supports);
  };

  preview.dispose = () => {
    if (disposed || preview.adopted) return;
    disposed = true;
    group.removeFromParent();
    loaded.splatViewer?.removeFromParent();
    loaded.splatViewer?.dispose().catch(error => console.warn('[AssetPlacement] Dispose failed:', error));
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) materials.add(material);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    for (const geometry of geometries) { geometry.disposeBoundsTree?.(); geometry.dispose(); }
    for (const texture of textures) texture.dispose();
  };
  return preview;
}

export async function spawnModelInstance(assetId, targetPos = null, prepared = null) {
  if (prepared && (prepared.assetId !== assetId || !assetLibrary.some(asset => asset.id === assetId))) return null;
  if (prepared?.adopted) return null;
  const now = Date.now();
  const assetKey = `${assetId}_${targetPos ? `${targetPos.x.toFixed(2)}_${targetPos.z.toFixed(2)}` : 'auto'}`;
  if (!prepared && (isSpawningInstance || (now - lastSpawnTimestamp < 280 && lastSpawnAssetKey === assetKey))) {
    console.warn(`[ModelManager] Suppressed duplicate spawnModelInstance for ${assetKey}`);
    return null;
  }
  if (!prepared) isSpawningInstance = true;
  lastSpawnTimestamp = now;
  lastSpawnAssetKey = assetKey;

  const asset = assetLibrary.find(a => a.id === assetId) || (
    assetId === 'asset_mars_lander'
      ? {
          id: 'asset_mars_lander',
          name: 'mars_lander_alpha.py3s',
          displayName: 'Mars Lander Alpha',
          type: 'procedural'
        }
      : assetLibrary[0]
  );

  const existingSameType = placedInstances.filter(i => i.assetId === asset.id && !i.deleted);
  const num = String(existingSameType.length + 1).padStart(2, '0');
  const layerName = `${asset.displayName} (${num})`;

  let pos = targetPos;
  if (!pos) {
    const count = placedInstances.filter(i => !i.deleted).length;
    const angle = (count * 1.35) + 0.35;
    const dist = 3.2 + (count * 0.85);
    const x = Math.sin(angle) * dist;
    const z = Math.cos(angle) * dist;
    const y = terrainHeightFn(x, z);
    pos = new THREE.Vector3(x, y, z);
  }

  const instGroup = prepared?.group || new THREE.Group();
  instGroup.position.copy(pos);

  let visualGroup, colliderGroup, colliders, splatViewer;

  if (prepared?.assetId === asset.id) {
    ({ visualGroup, colliderGroup, colliders, splatViewer } = prepared);
    prepared.restore();
  } else if (asset.type === 'procedural' || asset.id === 'asset_mars_lander') {
    const built = buildProceduralMarsCraftMesh();
    visualGroup = built.visualGroup;
    colliderGroup = built.colliderGroup;
    colliders = built.colliders;

    if (placedInstances.length === 0) {
      const landerSplatBlob = createProceduralLanderSplatBlob();
      await loadGaussianSplatBlob(landerSplatBlob, GaussianSplats3D.SceneFormat.Splat, 'splat', false, false);
      instGroup.add(splatContainerGroup);
      splatViewer = dropInViewer;
      const splatSize = dropInViewer.splatMesh.computeBoundingBox(false).getSize(new THREE.Vector3());
      instGroup.scale.setScalar(4.5 / Math.max(splatSize.x, splatSize.y, splatSize.z, .001));
    }
  } else {
    const loaded = await loadPy3sAssetData(asset);
    if (loaded) {
      visualGroup = loaded.visualGroup;
      colliderGroup = loaded.colliderGroup;
      colliders = loaded.colliders;
      splatViewer = loaded.splatViewer;
      if (loaded.scaleFactor) {
        instGroup.scale.set(loaded.scaleFactor, loaded.scaleFactor, loaded.scaleFactor);
      }
    } else {
      visualGroup = new THREE.Group();
      colliderGroup = new THREE.Group();
      colliders = [];
    }
  }

  instGroup.add(visualGroup);
  instGroup.add(colliderGroup);
  if (mainScene) mainScene.add(instGroup);

  const inst = {
    id: 'inst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    assetId: asset.id,
    name: asset.name,
    layerName: layerName,
    group: instGroup,
    visualGroup: visualGroup,
    colliderGroup: colliderGroup,
    colliders: colliders,
    splatViewer: splatViewer || null,
    physics: { mode: 'static', strength: 0.65, paused: false, heatmap: true },
    visible: true,
    locked: false,
    deleted: false,
    createdAt: Date.now()
  };

  inst.defaultScale = instGroup.scale.clone();
  groundModelInstance(inst, terrainHeightFn, prepared?.supports);
  inst.groundAnchor = { pos: instGroup.position.clone(), rot: instGroup.quaternion.clone(), scale: instGroup.scale.clone() };
  placedInstances.push(inst);
  if (prepared) prepared.adopted = true;
  if (placedInstances.length > 1) {
    pushHistory({
      type: 'spawn',
      instanceId: inst.id
    });
  }
  selectInstance(inst.id);
  updateRhinoLayersUI();
  renderPy3sFileList();

  if (!prepared) setTimeout(() => {
    isSpawningInstance = false;
  }, 250);

  return inst;
}

export async function spawnModelFromAsset(assetId) {
  const count = placedInstances.filter(i => !i.deleted).length;
  const angle = (count * 1.35) + 0.35;
  const dist = 3.2 + (count * 0.85);
  const x = Math.sin(angle) * dist;
  const z = Math.cos(angle) * dist;
  const y = terrainHeightFn(x, z);
  return await spawnModelInstance(assetId, new THREE.Vector3(x, y, z));
}

async function spawnDefaultSceneModel() {
  if (placedInstances.filter(i => !i.deleted).length > 0) return null;
  const probeAsset = assetLibrary.find(a => a.id === 'asset_spacecraft_probe' || a.name === 'sci-fi-spacecraft-probe.py3s');
  if (!probeAsset) return null;
  const targetPos = new THREE.Vector3(9.0, -0.1, 4.9);
  const inst = await spawnModelInstance(probeAsset.id, targetPos);
  if (inst) {
    inst.group.scale.set(11.57, 11.57, 11.57);
    inst.group.position.set(9.0, -0.1, 4.9);
    inst.group.rotation.set(0, 0, 0);
    inst.defaultScale = inst.group.scale.clone();
    if (inst.groundAnchor) {
      inst.groundAnchor.pos.copy(inst.group.position);
      inst.groundAnchor.rot.copy(inst.group.quaternion);
      inst.groundAnchor.scale.copy(inst.group.scale);
    }
    selectInstance(inst.id);
    updateGumballCoordinatesUI();
  }
  return inst;
}

export function resetModelTransform() {
  resetGumballTransform(terrainHeightFn);
}

export function snapModelToGround() {
  snapGumballToGround(terrainHeightFn);
}

export function clearCurrentModel() {
  while (visualMeshGroup.children.length > 0) {
    visualMeshGroup.remove(visualMeshGroup.children[0]);
  }
  while (colliderMeshGroup.children.length > 0) {
    colliderMeshGroup.remove(colliderMeshGroup.children[0]);
  }
  py3sLayersDeleted.splat = false;
  py3sLayersDeleted.collider = false;
  py3sLayersDeleted.solid = false;
  updateRhinoLayersUI();
}

export async function resetDropInViewer() {
  if (currentBlobUrl) {
    try {
      URL.revokeObjectURL(currentBlobUrl.split('#')[0]);
    } catch {
      // ignore
    }
    currentBlobUrl = null;
  }

  if (dropInViewer) {
    try {
      splatContainerGroup.remove(dropInViewer);
      if (typeof dropInViewer.dispose === 'function') {
        await dropInViewer.dispose();
      }
    } catch (err) {
      console.warn('[ModelManager] DropInViewer dispose note:', err);
    }
    dropInViewer = null;
  }

  while (splatContainerGroup.children.length > 0) {
    const child = splatContainerGroup.children[0];
    splatContainerGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
  }

  dropInViewer = new GaussianSplats3D.DropInViewer({
    gpuAcceleratedSort: false,
    sharedMemoryForWorkers: false,
    integerBasedSort: true,
    halfPrecisionCovariancesOnGPU: false,
    sphericalHarmonicsDegree: 0,
    dynamicScene: true,
    logLevel: GaussianSplats3D.LogLevel.None,
  });
  limitSplatSortWork(dropInViewer);

  splatContainerGroup.add(dropInViewer);
  applyShadingMode();
  return dropInViewer;
}

export function getModelBoundingBox() {
  if (dropInViewer && dropInViewer.splatMesh) {
    try {
      const sBox = dropInViewer.splatMesh.computeBoundingBox(false);
      if (sBox && isFinite(sBox.min.x) && isFinite(sBox.max.x) && (sBox.max.x - sBox.min.x) > 0.001) {
        return sBox;
      }
    } catch {
      // fallback
    }
  }
  if (visualMeshGroup.children.length > 0) {
    const box = new THREE.Box3().setFromObject(visualMeshGroup);
    if (isFinite(box.min.x)) return box;
  }
  if (colliderMeshGroup.children.length > 0) {
    const box = new THREE.Box3().setFromObject(colliderMeshGroup);
    if (isFinite(box.min.x)) return box;
  }
  return new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 3, 2));
}

export function alignMeshLayersWithSplat() {
  if (!dropInViewer || !dropInViewer.splatMesh) return;
  let sBox = null;
  try {
    sBox = dropInViewer.splatMesh.computeBoundingBox(false);
  } catch {
    return;
  }
  if (!sBox || !isFinite(sBox.max.y)) return;

  const targetY = sBox.max.y;
  const alignModel = (model) => {
    if (!model) return;
    if (currentFlipX) {
      model.rotation.set(Math.PI, 0, 0);
      model.position.set(0, targetY - 0.04, 0);
    } else {
      model.rotation.set(0, 0, 0);
      model.position.set(0, 0.062, 0);
    }
    model.updateMatrixWorld(true);
  };

  colliderMeshGroup.children.forEach(alignModel);
  visualMeshGroup.children.forEach(alignModel);
}

export function fitModelToLanderArea(targetSize = 4.2) {
  currentBaseTargetSize = targetSize;
  currentModelScaleMultiplier = 1.0;
  realignModelToGround();
  alignMeshLayersWithSplat();
}

export function realignModelToGround() {
  if (!currentModelGroup) return;

  const box = getModelBoundingBox();
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);

  let finalScale = 1.0;
  if (maxDim > 0.001) {
    finalScale = (currentBaseTargetSize / maxDim) * currentModelScaleMultiplier;
  }
  currentModelGroup.scale.set(finalScale, finalScale, finalScale);

  const center = new THREE.Vector3();
  box.getCenter(center);
  const groundY = terrainHeightFn(0, 0);

  if (currentFlipX) {
    currentModelGroup.rotation.set(Math.PI, 0, 0);
    currentModelGroup.position.x = -center.x * finalScale;
    currentModelGroup.position.z = center.z * finalScale;
    currentModelGroup.position.y = groundY + box.max.y * finalScale;
  } else {
    currentModelGroup.rotation.set(0, 0, 0);
    currentModelGroup.position.x = -center.x * finalScale;
    currentModelGroup.position.z = -center.z * finalScale;
    currentModelGroup.position.y = groundY - box.min.y * finalScale;
  }

  alignMeshLayersWithSplat();
  currentModelGroup.updateMatrixWorld(true);
  const tc = getTransformControls();
  if (tc) {
    tc.attach(currentModelGroup);
  }
  updateGumballCoordinatesUI();
}

export function flipModelOrientation() {
  currentFlipX = !currentFlipX;
  realignModelToGround();
}

export function adjustModelScale(factor) {
  currentModelScaleMultiplier *= factor;
  realignModelToGround();
}

export function adjustSplatSize(factor) {
  if (dropInViewer && dropInViewer.splatMesh && typeof dropInViewer.splatMesh.setSplatScale === 'function') {
    const cur = dropInViewer.splatMesh.getSplatScale();
    dropInViewer.splatMesh.setSplatScale(Math.max(0.05, cur * factor));
  }
}

export function adjustColliderHeight(delta) {
  adjustPhysicsColliderHeight(delta, alignMeshLayersWithSplat);
}

export function adjustColliderOpacity(delta) {
  adjustPhysicsColliderOpacity(delta, colliderMeshGroup);
}

export async function loadGaussianSplatBlob(blob, format = GaussianSplats3D.SceneFormat.Splat, ext = 'splat', shouldFlip = true, fitToScene = true) {
  currentFlipX = shouldFlip;
  const viewer = await resetDropInViewer();
  const blobUrl = `${URL.createObjectURL(blob)}#model.${ext}`;
  currentBlobUrl = blobUrl;

  try {
    await viewer.addSplatScene(blobUrl, {
      format: format,
      showLoadingUI: false,
      splatAlphaRemovalThreshold: 1,
      progressiveLoad: false,
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });

    if (fitToScene) fitModelToLanderArea(4.5);

    setShadingMode('splat');
  } catch (err) {
    console.error('[ModelManager] Failed to load Gaussian Splat Scene:', err);
  }
}

export async function createProceduralMarsCraft() {
  clearCurrentModel();
  currentFlipX = false;

  const built = buildProceduralMarsCraftMesh();
  visualMeshGroup.add(built.visualGroup);
  colliderMeshGroup.add(built.colliderGroup);

  const landerSplatBlob = createProceduralLanderSplatBlob();
  await loadGaussianSplatBlob(landerSplatBlob, GaussianSplats3D.SceneFormat.Splat, 'splat', false);

  applyShadingMode();
}

export async function loadSamplePy3s(filename) {
  clearCurrentModel();
  try {
    const resp = await fetch(`assets/models/${filename}`);
    const buf = await resp.arrayBuffer();
    const unpacked = await Py3sCodec.unpack(buf);

    if (unpacked.spzData && unpacked.spzData.byteLength > 0) {
      const spzSubBuffer = unpacked.spzData.buffer.slice(
        unpacked.spzData.byteOffset,
        unpacked.spzData.byteOffset + unpacked.spzData.byteLength
      );
      const targetPoints = unpacked.metadata?.telemetryProfile?.fullPointCount || 262144;
      const splatBlob = await convertSpzToSplatBlob(spzSubBuffer, targetPoints);
      await loadGaussianSplatBlob(splatBlob, GaussianSplats3D.SceneFormat.Splat, 'splat', true);
    }

    if (unpacked.colliderData && unpacked.colliderData.byteLength > 0) {
      const colSubBuffer = unpacked.colliderData.buffer.slice(
        unpacked.colliderData.byteOffset,
        unpacked.colliderData.byteOffset + unpacked.colliderData.byteLength
      );
      const colU8 = new Uint8Array(colSubBuffer);
      const isGlb = colU8[0] === 0x67 && colU8[1] === 0x6C && colU8[2] === 0x54 && colU8[3] === 0x46;
      const isGltfJson = colU8[0] === 0x7B;

      if (isGlb || isGltfJson) {
        try {
          const loader = new GLTFLoader();
          loader.parse(colSubBuffer, '', (gltf) => {
            const model = gltf.scene;
            const visualClone = model.clone();
            visualMeshGroup.add(visualClone);

            setupOptimizedColliderMesh(model);
            colliderMeshGroup.add(model);
            alignMeshLayersWithSplat();
            fitModelToLanderArea(4.5);
          });
        } catch (colErr) {
          console.warn('[ModelManager] Non-standard collider mesh, skipping GLTF parse:', colErr);
        }
      }
    }

    setShadingMode('splat');
  } catch (err) {
    console.error('[ModelManager] Failed to load .py3s:', err);
  }
}

export async function loadPy3sFromBuffer(buf, filename = 'model.py3s') {
  clearCurrentModel();
  let unpacked = await Py3sCodec.unpack(buf);

  if (filename.includes('thai-temple-gate') && unpacked.spzData && unpacked.spzData.byteLength < 100000) {
    try {
      const fullResp = await fetch('assets/models/thai_temple_gate_262k.py3s');
      if (fullResp.ok) {
        const fullBuf = await fullResp.arrayBuffer();
        const fullUnpacked = await Py3sCodec.unpack(fullBuf);
        if (fullUnpacked.spzData) {
          unpacked = fullUnpacked;
        }
      }
    } catch (e) {
      console.warn('[ModelManager] Full asset resolution fallback:', e);
    }
  }

  if (unpacked.spzData && unpacked.spzData.byteLength > 0) {
    const spzSubBuffer = unpacked.spzData.buffer.slice(
      unpacked.spzData.byteOffset,
      unpacked.spzData.byteOffset + unpacked.spzData.byteLength
    );
    const targetPoints = unpacked.metadata?.telemetryProfile?.fullPointCount || 262144;
    const splatBlob = await convertSpzToSplatBlob(spzSubBuffer, targetPoints);
    await loadGaussianSplatBlob(splatBlob, GaussianSplats3D.SceneFormat.Splat, 'splat', true);
  }

  if (unpacked.colliderData && unpacked.colliderData.byteLength > 0) {
    const colSubBuffer = unpacked.colliderData.buffer.slice(
      unpacked.colliderData.byteOffset,
      unpacked.colliderData.byteOffset + unpacked.colliderData.byteLength
    );
    const colU8 = new Uint8Array(colSubBuffer);
    const isGlb = colU8[0] === 0x67 && colU8[1] === 0x6C && colU8[2] === 0x54 && colU8[3] === 0x46;
    const isGltfJson = colU8[0] === 0x7B;

    if (isGlb || isGltfJson) {
      try {
        const loader = new GLTFLoader();
        loader.parse(colSubBuffer, '', (gltf) => {
          const model = gltf.scene;
          const visualClone = model.clone();
          visualMeshGroup.add(visualClone);

          setupOptimizedColliderMesh(model);
          colliderMeshGroup.add(model);
          alignMeshLayersWithSplat();
          fitModelToLanderArea(4.5);
        });
      } catch (colErr) {
        console.warn('[ModelManager] Non-standard collider mesh, skipping GLTF parse:', colErr);
      }
    }
  }

  setShadingMode(activeShading || 'splat');
}

export function getColliderSurfaceHeight(x, z, currentY, maxStep = 0.20) {
  const colliders = getNearbyColliders(getActiveColliders(), { x, y: currentY, z });
  return getPhysicsSurfaceHeight(x, z, currentY, maxStep, colliders, currentModelGroup);
}

export function resolveCharacterCollision(newPos, oldPos, charRadius = 0.40) {
  const active = getActiveColliders();
  const colliders = getNearbyColliders(active, newPos, oldPos, charRadius);
  const fallbackBox = active.length === 0 && placedInstances.length === 0 ? getModelBoundingBox() : null;
  return resolvePhysicsCollision(newPos, oldPos, charRadius, colliders, fallbackBox, currentModelGroup);
}

// Re-export all functions and states for backwards compatibility with main.js and global bindings
export {
  setupOptimizedColliderMesh,
  exportPrint3D,
  checkSingleBoxCollision,
  initGumballControls,
  selectModel,
  toggleGumball,
  setGumballMode,
  updateGumballUI,
  updateGumballCoordinatesUI,
  spawnDefaultSceneModel,
  placedInstances,
  selectedInstanceId,
  selectInstance,
  selectTerrainLayer,
  toggleInstanceVisibility,
  toggleInstanceLock,
  handleDeleteInstance,
  executeDeleteInstance,
  toggleRhinoVisibility,
  toggleRhinoLock,
  selectRhinoLayer,
  handleDeleteLayer,
  executeDeleteLayer,
  updateRhinoLayersUI,
  togglePy3sLayer,
  applyPy3sLayers,
  toggleColliderMode,
  setShadingMode,
  applyShadingMode,
  py3sLayersState,
  py3sLayersLocked,
  py3sLayersDeleted,
  selectedRhinoLayer,
  assetLibrary,
  py3sFileList,
  renderPy3sFileList,
  handleAssetDragStart,
  handleDeleteAsset,
  handleDeletePy3s,
  removeAssetFile,
  processLoadedFiles,
  processLoadedFile,
  activatePy3sFile
};
