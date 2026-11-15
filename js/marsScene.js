import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { conformGridToTerrain } from './modelGrounding.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

let scene, camera, renderer, controls;
let marsTerrainMesh = null;
let gridHelper = null;
let windParticles = null;
let isWindActive = false;
let isMarsEnvActive = true;
let isCameraFollow = true;

const terrainRaycaster = new THREE.Raycaster();
terrainRaycaster.firstHitOnly = true;
const rayDown = new THREE.Vector3(0, -1, 0);
const rayOrigin = new THREE.Vector3();

export function getTerrainHeight(x, z) {
  if (marsTerrainMesh && marsTerrainMesh.geometry && marsTerrainMesh.geometry.boundsTree) {
    rayOrigin.set(x, 50, z);
    terrainRaycaster.set(rayOrigin, rayDown);
    const hits = terrainRaycaster.intersectObject(marsTerrainMesh, false);
    if (hits.length > 0) {
      return hits[0].point.y;
    }
  }
  const dist = Math.sqrt(x * x + z * z);
  if (dist > 4.5) {
    return Math.sin(x * 0.2) * Math.cos(z * 0.2) * 0.8 + Math.sin(x * 0.5) * 0.3 - 0.25;
  }
  return -0.05;
}

export function initMarsScene(canvasElement) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020408);
  scene.fog = new THREE.FogExp2(0x180b07, 0.025);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(4.7, 3.3, 6.5);

  renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true });
  // Keep splat overdraw bounded on high-DPI screens; HUD text stays at CSS resolution.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.02;
  controls.minDistance = 1.2;
  controls.maxDistance = 50;
  controls.target.set(2.5, 1.15, 2.5);

  const ambient = new THREE.AmbientLight(0xffeedd, 0.8);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffa257, 2.2);
  sun.position.set(12, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 512;
  sun.shadow.mapSize.height = 512;
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 60;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.0005;
  sun.shadow.normalBias = .035;
  scene.add(sun);

  const cyanRim = new THREE.DirectionalLight(0x38bdf8, 1.2);
  cyanRim.position.set(-10, 8, -10);
  scene.add(cyanRim);

  const cameraFill = new THREE.DirectionalLight(0xfff5ea, 1.2);
  cameraFill.position.set(8, 12, 16);
  scene.add(cameraFill);

  gridHelper = new THREE.GridHelper(30, 30, 0x38bdf8, 0x1e293b);
  gridHelper.name = 'TerrainGrid';
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  createMarsTerrain();
  createWindSimulation();

  window.addEventListener('resize', onWindowResize3D);

  return { scene, camera, renderer, controls };
}

export function onWindowResize3D() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createMarsTerrain() {
  const geo = new THREE.PlaneGeometry(60, 60, 48, 48);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getTerrainHeight(x, z));
  }
  geo.computeVertexNormals();
  geo.computeBoundsTree();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x933b1e,
    roughness: 0.88,
    metalness: 0.1,
    flatShading: true
  });
  marsTerrainMesh = new THREE.Mesh(geo, mat);
  marsTerrainMesh.receiveShadow = true;
  scene.add(marsTerrainMesh);
  void conformGridToTerrain(gridHelper, getTerrainHeight);

  // Asynchronously load real NASA Apollo 12 Terrain model
  const loader = new GLTFLoader();
  loader.load('./assets/models/Apollo_12_Terrain.glb', (gltf) => {
    const terrain = gltf.scene.getObjectByProperty('isMesh', true);
    if (!terrain) return;

    terrain.geometry.rotateX(Math.PI / 2);
    terrain.geometry.center();
    terrain.geometry.computeVertexNormals();

    const terrainScale = 0.16;
    terrain.scale.setScalar(terrainScale);

    terrain.material = new THREE.MeshStandardMaterial({
      color: 0x933b1e, // Mars terrain palette
      roughness: 0.90,
      metalness: 0.08,
      flatShading: true
    });
    terrain.receiveShadow = true;
    // A large terrain casting into a small directional shadow map creates a
    // dark rectangular frustum footprint. Only objects cast onto this surface.
    terrain.castShadow = false;

    // Compute BVH for rapid terrain collision and exact surface height
    terrain.geometry.computeBoundsTree();
    terrain.updateMatrixWorld(true);

    // Align center landing site elevation to Y = 0
    const tempRay = new THREE.Raycaster();
    tempRay.firstHitOnly = true;
    tempRay.set(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0));
    const hits = tempRay.intersectObject(terrain, false);
    const centerElevation = hits.length > 0 ? hits[0].point.y : 0;
    terrain.position.y = -centerElevation;
    terrain.updateMatrixWorld(true);

    // Swap temporary mesh with Apollo 12 terrain
    if (marsTerrainMesh) {
      scene.remove(marsTerrainMesh);
      marsTerrainMesh.geometry.dispose();
      marsTerrainMesh.material.dispose();
    }
    marsTerrainMesh = terrain;
    marsTerrainMesh.visible = isMarsEnvActive;
    scene.add(marsTerrainMesh);
    void conformGridToTerrain(gridHelper, getTerrainHeight);
    window.dispatchEvent(new CustomEvent('odyssey-terrain-ready'));

    if (renderer) renderer.shadowMap.needsUpdate = true;
    console.log('[MarsScene] Apollo 12 Terrain loaded & aligned to Y=0 successfully');
  }, undefined, (err) => {
    console.warn('[MarsScene] Failed to load Apollo_12_Terrain.glb, keeping fallback:', err);
  });
}

function createWindSimulation() {
  const count = 700;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = Math.random() * 4 + 0.1;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.08, transparent: true, opacity: 0.6 });
  windParticles = new THREE.Points(geo, mat);
  windParticles.visible = false;
  scene.add(windParticles);
}

export function updateWindSim() {
  if (isWindActive && windParticles) {
    const pos = windParticles.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += 0.12;
      if (pos[i] > 8) pos[i] = -8;
    }
    windParticles.geometry.attributes.position.needsUpdate = true;
  }
}

export function toggleEnvironment() {
  isMarsEnvActive = !isMarsEnvActive;
  if (marsTerrainMesh) marsTerrainMesh.visible = isMarsEnvActive;
  const btn = document.getElementById('btn-env-toggle');
  if (btn) btn.classList.toggle('active', isMarsEnvActive);
  if (isMarsEnvActive) {
    scene.background = new THREE.Color(0x020408);
    scene.fog = new THREE.FogExp2(0x180b07, 0.025);
  } else {
    scene.background = new THREE.Color(0x000205);
    scene.fog = null;
  }
}

export function toggleWindSim() {
  isWindActive = !isWindActive;
  if (windParticles) windParticles.visible = isWindActive;
  const btn = document.getElementById('btn-wind-toggle');
  if (btn) btn.classList.toggle('active', isWindActive);
}

export function toggleCameraFollow() {
  isCameraFollow = !isCameraFollow;
  const btn = document.getElementById('btn-cam-follow');
  const txt = document.getElementById('cam-follow-text');
  if (btn) btn.classList.toggle('active', isCameraFollow);
  if (txt) txt.innerText = isCameraFollow ? 'Follow' : 'Free';
  if (isCameraFollow && window.astroPos) {
    reset3DCamera(window.astroPos);
  }
}

export function getIsCameraFollow() {
  return isCameraFollow;
}

export function reset3DCamera(astroPos) {
  if (!camera || !controls) return;
  const targetPos = astroPos || (window.astroPos ? window.astroPos : { x: 2.5, y: -0.05, z: 2.5 });
  controls.target.set(targetPos.x, targetPos.y + 1.15, targetPos.z);
  camera.position.set(targetPos.x + 2.2, targetPos.y + 2.2, targetPos.z + 4.0);
  controls.update();
}

export function fireImpactTest() {
  const impactLog = document.getElementById('impact-log');
  if (impactLog) {
    impactLog.classList.remove('show');
    void impactLog.offsetWidth;
    impactLog.classList.add('show');
  }

  const meteorGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const meteorMat = new THREE.MeshBasicMaterial({ color: 0xff3311 });
  const meteor = new THREE.Mesh(meteorGeo, meteorMat);
  meteor.position.set(8, 6, 6);
  scene.add(meteor);

  const targetPos = new THREE.Vector3(0, 1.6, 0);
  const startPos = meteor.position.clone();
  const startTime = performance.now();
  const duration = 450;

  function animateMeteor() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    meteor.position.lerpVectors(startPos, targetPos, t);
    if (t < 1) requestAnimationFrame(animateMeteor);
    else {
      scene.remove(meteor);
      createImpactShockwave(targetPos);
    }
  }
  requestAnimationFrame(animateMeteor);
}

function createImpactShockwave(pos) {
  const ringGeo = new THREE.RingGeometry(0.1, 0.5, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 1 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(pos);
  ring.lookAt(camera.position);
  scene.add(ring);

  let scale = 1;
  function expand() {
    scale += 0.3;
    ring.scale.set(scale, scale, 1);
    ringMat.opacity -= 0.06;
    if (ringMat.opacity > 0) requestAnimationFrame(expand);
    else scene.remove(ring);
  }
  expand();
}

export function setGridVisible(visible) {
  if (gridHelper) {
    gridHelper.visible = visible;
  }
  updateGridXYUI(visible);
}

export function isGridVisible() {
  return gridHelper ? gridHelper.visible : true;
}

export function toggleGridVisible() {
  if (gridHelper) {
    gridHelper.visible = !gridHelper.visible;
    updateGridXYUI(gridHelper.visible);
    return gridHelper.visible;
  }
  return true;
}

export function updateGridXYUI(visible) {
  const btn = document.getElementById('btn-toggle-grid');
  const sw = document.getElementById('switch-grid');
  if (btn) btn.classList.toggle('active', visible);
  if (sw) sw.classList.toggle('active', visible);
}

if (typeof window !== 'undefined') {
  window.toggleGridXY = toggleGridVisible;
  window.setGridVisible = setGridVisible;
  window.isGridVisible = isGridVisible;
}

