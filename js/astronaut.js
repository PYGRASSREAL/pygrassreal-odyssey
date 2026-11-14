import * as THREE from 'three';
import { resolveCharacterCollision, getColliderSurfaceHeight } from './modelManager.js';

let astronaut = null;
const astroLimbs = { lLeg: null, rLeg: null, lArm: null, rArm: null, torso: null };
export const astroPos = new THREE.Vector3(1.2, 0, 3.2);
const astroVelocity = new THREE.Vector3(0, 0, 0);
let astroRotation = Math.PI;
let isGrounded = true;
let walkAnimTime = 0;

export const keyState = { w: false, a: false, s: false, d: false, space: false };

export function setVirtualKey(key, isDown) {
  keyState[key] = isDown;
  const el = document.getElementById(`key-${key}`);
  if (el) el.classList.toggle('pressed', isDown);
}

export function setupKeyboardControls(isCurrentPhase3D) {
  function handleKeyEvent(e, isDown) {
    const code = e.code;
    const key = (e.key || '').toLowerCase();

    if (code === 'KeyW' || key === 'w' || key === 'ไ' || code === 'ArrowUp') {
      setVirtualKey('w', isDown);
      if (isCurrentPhase3D()) e.preventDefault();
    } else if (code === 'KeyA' || key === 'a' || key === 'ฟ' || code === 'ArrowLeft') {
      setVirtualKey('a', isDown);
      if (isCurrentPhase3D()) e.preventDefault();
    } else if (code === 'KeyS' || key === 's' || key === 'ห' || code === 'ArrowDown') {
      setVirtualKey('s', isDown);
      if (isCurrentPhase3D()) e.preventDefault();
    } else if (code === 'KeyD' || key === 'd' || key === 'ก' || code === 'ArrowRight') {
      setVirtualKey('d', isDown);
      if (isCurrentPhase3D()) e.preventDefault();
    } else if (code === 'Space' || key === ' ') {
      setVirtualKey('space', isDown);
      if (isCurrentPhase3D()) e.preventDefault();
    }
  }

  window.addEventListener('keydown', (e) => handleKeyEvent(e, true), { passive: false });
  window.addEventListener('keyup', (e) => handleKeyEvent(e, false), { passive: false });
}

export function createAstronautCharacter(scene, getTerrainHeight) {
  if (astronaut) scene.remove(astronaut);

  astronaut = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.4 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.05, metalness: 0.95 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.6 });

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.5, 0.65, 0.35);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.position.y = 0.95;
  torso.castShadow = true;
  astronaut.add(torso);
  astroLimbs.torso = torso;

  // Chest panel
  const chestGeo = new THREE.BoxGeometry(0.3, 0.25, 0.08);
  const chest = new THREE.Mesh(chestGeo, darkMat);
  chest.position.set(0, 0.05, 0.2);
  torso.add(chest);

  const lightGeo = new THREE.BoxGeometry(0.18, 0.06, 0.02);
  const light = new THREE.Mesh(lightGeo, cyanMat);
  light.position.set(0, 0.05, 0.05);
  chest.add(light);

  // Life support backpack
  const packGeo = new THREE.BoxGeometry(0.42, 0.55, 0.22);
  const pack = new THREE.Mesh(packGeo, suitMat);
  pack.position.set(0, 0.05, -0.25);
  pack.castShadow = true;
  torso.add(pack);

  // Helmet & Visor
  const helmetGeo = new THREE.SphereGeometry(0.24, 16, 16);
  const helmet = new THREE.Mesh(helmetGeo, suitMat);
  helmet.position.set(0, 0.52, 0);
  helmet.castShadow = true;
  torso.add(helmet);

  const visorGeo = new THREE.SphereGeometry(0.20, 16, 16, -Math.PI / 2.5, Math.PI / 1.25, 0, Math.PI / 1.3);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.52, 0.07);
  torso.add(visor);

  // Left Arm
  const lArmPivot = new THREE.Group();
  lArmPivot.position.set(0.34, 0.25, 0);
  const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8);
  const lArmMesh = new THREE.Mesh(armGeo, suitMat);
  lArmMesh.position.y = -0.22;
  lArmMesh.castShadow = true;
  lArmPivot.add(lArmMesh);
  torso.add(lArmPivot);
  astroLimbs.lArm = lArmPivot;

  // Right Arm
  const rArmPivot = new THREE.Group();
  rArmPivot.position.set(-0.34, 0.25, 0);
  const rArmMesh = new THREE.Mesh(armGeo, suitMat);
  rArmMesh.position.y = -0.22;
  rArmMesh.castShadow = true;
  rArmPivot.add(rArmMesh);
  torso.add(rArmPivot);
  astroLimbs.rArm = rArmPivot;

  // Left Leg
  const lLegPivot = new THREE.Group();
  lLegPivot.position.set(0.16, 0.65, 0);
  const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.65, 8);
  const lLegMesh = new THREE.Mesh(legGeo, suitMat);
  lLegMesh.position.y = -0.32;
  lLegMesh.castShadow = true;
  lLegPivot.add(lLegMesh);

  const bootGeo = new THREE.BoxGeometry(0.18, 0.12, 0.26);
  const lBoot = new THREE.Mesh(bootGeo, darkMat);
  lBoot.position.set(0, -0.62, 0.05);
  lBoot.castShadow = true;
  lLegPivot.add(lBoot);
  astronaut.add(lLegPivot);
  astroLimbs.lLeg = lLegPivot;

  // Right Leg
  const rLegPivot = new THREE.Group();
  rLegPivot.position.set(-0.16, 0.65, 0);
  const rLegMesh = new THREE.Mesh(legGeo, suitMat);
  rLegMesh.position.y = -0.32;
  rLegMesh.castShadow = true;
  rLegPivot.add(rLegMesh);

  const rBoot = new THREE.Mesh(bootGeo, darkMat);
  rBoot.position.set(0, -0.62, 0.05);
  rBoot.castShadow = true;
  rLegPivot.add(rBoot);
  astronaut.add(rLegPivot);
  astroLimbs.rLeg = rLegPivot;

  astroPos.set(2.5, getTerrainHeight(2.5, 2.5), 2.5);
  astronaut.position.copy(astroPos);
  astronaut.rotation.y = astroRotation;
  scene.add(astronaut);
  return astronaut;
}

export function resetAstronautToLander(getTerrainHeight) {
  astroPos.set(1.2, getTerrainHeight(1.2, 3.2), 3.2);
  astroVelocity.set(0, 0, 0);
  astroRotation = Math.PI;
  if (astronaut) {
    astronaut.position.copy(astroPos);
    astronaut.rotation.y = astroRotation;
  }
}

export function updateAstronautPhysics(delta, getTerrainHeight, camera, controls, isCameraFollow) {
  if (!astronaut) return;

  const moveSpeed = 3.2;
  let moveX = 0;
  let moveZ = 0;

  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  camForward.normalize();

  const camRight = new THREE.Vector3();
  camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

  if (keyState.w) {
    moveX += camForward.x;
    moveZ += camForward.z;
  }
  if (keyState.s) {
    moveX -= camForward.x;
    moveZ -= camForward.z;
  }
  if (keyState.a) {
    moveX -= camRight.x;
    moveZ -= camRight.z;
  }
  if (keyState.d) {
    moveX += camRight.x;
    moveZ += camRight.z;
  }

  const inputLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
  const isMoving = inputLen > 0.01;

  if (isMoving) {
    moveX /= inputLen;
    moveZ /= inputLen;

    const oldPos = astroPos.clone();
    const nextX = astroPos.x + moveX * moveSpeed * delta;
    const nextZ = astroPos.z + moveZ * moveSpeed * delta;

    const testPos = new THREE.Vector3(nextX, astroPos.y, nextZ);
    const resolvedPos = resolveCharacterCollision(testPos, oldPos, 0.45);

    astroPos.x = resolvedPos.x;
    astroPos.z = resolvedPos.z;
    if (resolvedPos.y !== astroPos.y && isGrounded) {
      astroPos.y = resolvedPos.y;
    }

    const targetAngle = Math.atan2(moveX, moveZ);
    astroRotation = THREE.MathUtils.lerp(astroRotation, targetAngle, 0.22);
    astronaut.rotation.y = astroRotation;

    walkAnimTime += delta * 10.0;
    const swing = Math.sin(walkAnimTime) * 0.65;
    if (astroLimbs.lLeg) astroLimbs.lLeg.rotation.x = swing;
    if (astroLimbs.rLeg) astroLimbs.rLeg.rotation.x = -swing;
    if (astroLimbs.lArm) astroLimbs.lArm.rotation.x = -swing * 0.85;
    if (astroLimbs.rArm) astroLimbs.rArm.rotation.x = swing * 0.85;
    if (astroLimbs.torso) astroLimbs.torso.position.y = 0.95 + Math.abs(Math.sin(walkAnimTime * 2)) * 0.05;
  } else {
    // Anti-penetration check: push out if currently stuck inside any collider
    const unstickPos = resolveCharacterCollision(astroPos, astroPos, 0.45);
    astroPos.x = unstickPos.x;
    astroPos.z = unstickPos.z;

    if (astroLimbs.lLeg) astroLimbs.lLeg.rotation.x *= 0.82;
    if (astroLimbs.rLeg) astroLimbs.rLeg.rotation.x *= 0.82;
    if (astroLimbs.lArm) astroLimbs.lArm.rotation.x *= 0.82;
    if (astroLimbs.rArm) astroLimbs.rArm.rotation.x *= 0.82;
    if (astroLimbs.torso) astroLimbs.torso.position.y = 0.95 + Math.sin(performance.now() * 0.003) * 0.015;
  }

  const groundTerrainY = getTerrainHeight(astroPos.x, astroPos.z);
  const colliderY = getColliderSurfaceHeight(astroPos.x, astroPos.z, astroPos.y, 0.65);
  const groundY = (colliderY !== null && colliderY > groundTerrainY) ? colliderY : groundTerrainY;
  const marsGravity = 9.8 * 0.38;

  if (keyState.space && isGrounded) {
    astroVelocity.y = 3.8;
    isGrounded = false;
  }

  astroVelocity.y -= marsGravity * delta;
  astroPos.y += astroVelocity.y * delta;

  if (astroPos.y <= groundY) {
    astroPos.y = groundY;
    astroVelocity.y = 0;
    isGrounded = true;
  }

  astronaut.position.copy(astroPos);

  if (isCameraFollow && controls) {
    const targetLook = new THREE.Vector3(astroPos.x * 0.45, astroPos.y + 1.2, astroPos.z * 0.45);
    controls.target.lerp(targetLook, 0.12);
  }

  const hudAstroPos = document.getElementById('hud-astro-pos');
  if (hudAstroPos) {
    hudAstroPos.innerText = `X: ${astroPos.x.toFixed(1)}, Z: ${astroPos.z.toFixed(1)} (${isMoving ? 'Walking' : isGrounded ? 'Standing' : 'Airborne'})`;
  }
}

