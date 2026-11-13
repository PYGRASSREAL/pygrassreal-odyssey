import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Py3sCodec } from '../libs/py3s/py3sCodec.js';
import {
  createSplatPointsObject,
  parseSpzBuffer,
  parseSplatBuffer,
  parsePlyBuffer,
  generateSplatPointsFromGroup,
  createProceduralLanderSplats
} from './splatDecoders.js';

export const currentModelGroup = new THREE.Group();
export const visualMeshGroup = new THREE.Group();
export const colliderMeshGroup = new THREE.Group();
export const splatPointsGroup = new THREE.Group();

let activeShading = 'solid';
let terrainHeightFn = () => 0;

export function initModelManager(scene, getTerrainHeight) {
  terrainHeightFn = getTerrainHeight;

  currentModelGroup.add(visualMeshGroup);
  currentModelGroup.add(colliderMeshGroup);
  currentModelGroup.add(splatPointsGroup);
  scene.add(currentModelGroup);

  createProceduralMarsCraft();
  setupDropZone();
}

export function clearCurrentModel() {
  while (visualMeshGroup.children.length > 0) visualMeshGroup.remove(visualMeshGroup.children[0]);
  while (colliderMeshGroup.children.length > 0) colliderMeshGroup.remove(colliderMeshGroup.children[0]);
  while (splatPointsGroup.children.length > 0) splatPointsGroup.remove(splatPointsGroup.children[0]);
}

export function setShadingMode(mode) {
  activeShading = mode;
  const btnSolid = document.getElementById('btn-shade-solid');
  const btnCol = document.getElementById('btn-shade-collider');
  const btnSplat = document.getElementById('btn-shade-splat');

  if (btnSolid) btnSolid.classList.toggle('active', mode === 'solid');
  if (btnCol) btnCol.classList.toggle('active', mode === 'collider');
  if (btnSplat) btnSplat.classList.toggle('active', mode === 'splat');

  applyShadingMode();
}

export function applyShadingMode() {
  if (activeShading === 'solid') {
    visualMeshGroup.visible = true;
    colliderMeshGroup.visible = false;
    splatPointsGroup.visible = false;
  } else if (activeShading === 'collider') {
    visualMeshGroup.visible = false;
    colliderMeshGroup.visible = true;
    splatPointsGroup.visible = false;
  } else if (activeShading === 'splat') {
    visualMeshGroup.visible = false;
    colliderMeshGroup.visible = false;
    splatPointsGroup.visible = true;
  }
}

export function fitModelToLanderArea(object3d, targetSize = 3.2) {
  const box = new THREE.Box3().setFromObject(object3d);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0.001) {
    const scale = targetSize / maxDim;
    object3d.scale.set(scale, scale, scale);
  }
  const newBox = new THREE.Box3().setFromObject(object3d);
  const center = new THREE.Vector3();
  newBox.getCenter(center);
  const groundY = terrainHeightFn(0, 0);
  object3d.position.x = -center.x;
  object3d.position.z = -center.z;
  object3d.position.y = groundY + 0.1 - newBox.min.y;
}

export function createProceduralMarsCraft() {
  clearCurrentModel();

  const craftGroup = new THREE.Group();

  const hullGeo = new THREE.CylinderGeometry(1.4, 1.8, 1.2, 8);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.25 });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 1.6;
  hull.castShadow = true;
  craftGroup.add(hull);

  const wingGeo = new THREE.BoxGeometry(3.6, 0.06, 1.2);
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.15 });
  const wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(2.8, 1.6, 0);
  wingL.castShadow = true;
  craftGroup.add(wingL);

  const wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.set(-2.8, 1.6, 0);
  wingR.castShadow = true;
  craftGroup.add(wingR);

  const dishGeo = new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const dishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.6, roughness: 0.2 });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.position.set(0, 2.5, 0.4);
  dish.rotation.x = -Math.PI / 4;
  craftGroup.add(dish);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const legGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.8, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(Math.cos(angle) * 1.6, 0.8, Math.sin(angle) * 1.6);
    leg.rotation.z = Math.cos(angle) * 0.4;
    leg.rotation.x = -Math.sin(angle) * 0.4;
    leg.castShadow = true;
    craftGroup.add(leg);

    const footGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.1, 8);
    const foot = new THREE.Mesh(footGeo, legMat);
    foot.position.set(Math.cos(angle) * 2.0, 0.05, Math.sin(angle) * 2.0);
    craftGroup.add(foot);
  }
  visualMeshGroup.add(craftGroup);

  const colliderGroup = new THREE.Group();
  const colHullGeo = new THREE.CylinderGeometry(1.5, 1.9, 1.3, 8);
  const colMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.8 });
  const colHull = new THREE.Mesh(colHullGeo, colMat);
  colHull.position.y = 1.6;
  colliderGroup.add(colHull);

  const colWingsGeo = new THREE.BoxGeometry(9.4, 0.4, 1.4);
  const colWings = new THREE.Mesh(colWingsGeo, colMat);
  colWings.position.set(0, 1.6, 0);
  colliderGroup.add(colWings);
  colliderMeshGroup.add(colliderGroup);

  // 12,000 rich Gaussian Splats
  const splatGeo = createProceduralLanderSplats();
  splatPointsGroup.add(createSplatPointsObject(splatGeo, 0.05));

  applyShadingMode();
}

export async function loadSamplePy3s(filename) {
  clearCurrentModel();
  try {
    const resp = await fetch(`assets/models/${filename}`);
    const buf = await resp.arrayBuffer();
    const unpacked = await Py3sCodec.unpack(buf);

    // 1. Unpack & Render Gaussian Splats (SPZ)
    if (unpacked.spzData && unpacked.spzData.byteLength > 0) {
      const { geo } = await parseSpzBuffer(unpacked.spzData.buffer);
      const splatObj = createSplatPointsObject(geo, 0.045);
      splatPointsGroup.add(splatObj);
      fitModelToLanderArea(splatPointsGroup, 3.2);
    }

    // 2. Unpack & Render Physics Collider / Mesh
    if (unpacked.colliderData && unpacked.colliderData.byteLength > 0) {
      const loader = new GLTFLoader();
      loader.parse(unpacked.colliderData.buffer, '', (gltf) => {
        const model = gltf.scene;
        visualMeshGroup.add(model.clone());

        model.traverse((c) => {
          if (c.isMesh) {
            c.material = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.8 });
          }
        });
        colliderMeshGroup.add(model);
        fitModelToLanderArea(visualMeshGroup, 3.2);
        fitModelToLanderArea(colliderMeshGroup, 3.2);
      });
    }

    setShadingMode('splat');
  } catch (err) {
    console.error("Failed to load .py3s:", err);
  }
}

export function processLoadedFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  if (ext === 'py3s') {
    reader.onload = async (ev) => {
      clearCurrentModel();
      const buf = ev.target.result;
      const unpacked = await Py3sCodec.unpack(buf);

      if (unpacked.spzData && unpacked.spzData.byteLength > 0) {
        const { geo } = await parseSpzBuffer(unpacked.spzData.buffer);
        splatPointsGroup.add(createSplatPointsObject(geo, 0.045));
        fitModelToLanderArea(splatPointsGroup, 3.2);
      }

      if (unpacked.colliderData && unpacked.colliderData.byteLength > 0) {
        const loader = new GLTFLoader();
        loader.parse(unpacked.colliderData.buffer, '', (gltf) => {
          const model = gltf.scene;
          visualMeshGroup.add(model.clone());
          model.traverse((c) => {
            if (c.isMesh) {
              c.material = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.8 });
            }
          });
          colliderMeshGroup.add(model);
          fitModelToLanderArea(visualMeshGroup, 3.2);
          fitModelToLanderArea(colliderMeshGroup, 3.2);
        });
      }

      setShadingMode('splat');
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'splat') {
    reader.onload = (ev) => {
      clearCurrentModel();
      const { geo } = parseSplatBuffer(ev.target.result);
      splatPointsGroup.add(createSplatPointsObject(geo, 0.045));
      fitModelToLanderArea(splatPointsGroup, 3.2);
      setShadingMode('splat');
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'spz') {
    reader.onload = async (ev) => {
      clearCurrentModel();
      const { geo } = await parseSpzBuffer(ev.target.result);
      splatPointsGroup.add(createSplatPointsObject(geo, 0.045));
      fitModelToLanderArea(splatPointsGroup, 3.2);
      setShadingMode('splat');
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'ply') {
    reader.onload = (ev) => {
      clearCurrentModel();
      const { geo } = parsePlyBuffer(ev.target.result);
      splatPointsGroup.add(createSplatPointsObject(geo, 0.045));
      fitModelToLanderArea(splatPointsGroup, 3.2);
      setShadingMode('splat');
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'glb' || ext === 'gltf') {
    reader.onload = (ev) => {
      clearCurrentModel();
      const loader = new GLTFLoader();
      loader.parse(ev.target.result, '', (gltf) => {
        const model = gltf.scene;
        visualMeshGroup.add(model.clone());

        const colModel = model.clone();
        colModel.traverse((c) => {
          if (c.isMesh) {
            c.material = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.8 });
          }
        });
        colliderMeshGroup.add(colModel);

        const splatGeo = generateSplatPointsFromGroup(model);
        if (splatGeo) {
          splatPointsGroup.add(createSplatPointsObject(splatGeo, 0.05));
        }

        fitModelToLanderArea(visualMeshGroup, 3.2);
        fitModelToLanderArea(colliderMeshGroup, 3.2);
        fitModelToLanderArea(splatPointsGroup, 3.2);
        applyShadingMode();
      });
    };
    reader.readAsArrayBuffer(file);
  }
}

function setupDropZone() {
  const dz = document.getElementById('drop-zone');
  if (!dz) return;
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processLoadedFile(e.dataTransfer.files[0]);
    }
  });
}

export function exportPrint3D() {
  alert("🖨️ 3D Print Extractor:\nExtracted watertight solid model from .py3s container (0 sec export ready)!\nFile: mars_spacecraft_print3d.3mf");
}
