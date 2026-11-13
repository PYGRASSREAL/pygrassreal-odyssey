import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let marsTerrainMesh = null;
let gridHelper = null;
let windParticles = null;
let isWindActive = false;
let isMarsEnvActive = true;
let isCameraFollow = true;

export function getTerrainHeight(x, z) {
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
  camera.position.set(1.5, 3.2, 7.8);

  renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 + 0.02;
  controls.minDistance = 1.2;
  controls.maxDistance = 50;
  controls.target.set(0.6, 1.3, 0.6);

  const ambient = new THREE.AmbientLight(0xffeedd, 0.8);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffa257, 2.2);
  sun.position.set(12, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  scene.add(sun);

  const cyanRim = new THREE.DirectionalLight(0x38bdf8, 1.2);
  cyanRim.position.set(-10, 8, -10);
  scene.add(cyanRim);

  gridHelper = new THREE.GridHelper(30, 30, 0x38bdf8, 0x1e293b);
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

  const mat = new THREE.MeshStandardMaterial({
    color: 0x933b1e,
    roughness: 0.88,
    metalness: 0.1,
    flatShading: true
  });
  marsTerrainMesh = new THREE.Mesh(geo, mat);
  marsTerrainMesh.receiveShadow = true;
  scene.add(marsTerrainMesh);
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
  if (txt) txt.innerText = isCameraFollow ? 'Follow Astronaut' : 'Free Camera';
}

export function getIsCameraFollow() {
  return isCameraFollow;
}

export function reset3DCamera(astroPos) {
  if (!camera || !controls) return;
  camera.position.set(astroPos.x + 3.5, astroPos.y + 3.5, astroPos.z + 5.5);
  controls.target.set(astroPos.x, astroPos.y + 1.2, astroPos.z);
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

