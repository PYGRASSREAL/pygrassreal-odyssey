import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveCharacterCollision, getColliderSurfaceHeight } from './modelManager.js';
import { fitAnimatedCharacter } from './characterGrounding.js';

let astronaut = null;
let mixer = null;
const actions = {};
let currentAction = null;
let footGrounding = null;
let castingAction = null;
let pendingCastTarget = null;
const spellTarget = new THREE.Vector3();
const heldShiftKeys = new Set();
export const WALK_SPEED = 3.2;
export const RUN_SPEED = 6.4;
const MARS_GRAVITY = 9.8 * 0.38;
const JUMP_SPEED = 2.2;

export const astroPos = new THREE.Vector3(1.2, 0, 3.2);
const astroVelocity = new THREE.Vector3(0, 0, 0);
let astroRotation = Math.PI;
let isGrounded = true;
let jumpRequested = false;

function fadeToAction(name, duration = 0.2, restart = false) {
  const target = actions[name.toLowerCase()];
  if (!target || (target === currentAction && !restart)) return;
  if (currentAction && currentAction !== target) currentAction.fadeOut(duration);
  target.reset().fadeIn(duration).play();
  currentAction = target;
  if (astronaut) astronaut.userData.animation = target.getClip().name;
}

function locomotionAction() {
  if (!isGrounded) return 'jumping';
  const moving = keyState.w || keyState.a || keyState.s || keyState.d;
  return moving ? keyState.shift ? 'running' : 'walking' : 'idle';
}

export function cancelAstronautSpell() {
  pendingCastTarget = null;
  if (!castingAction) return;
  castingAction = null;
  if (astronaut) astronaut.userData.isCasting = false;
  fadeToAction(locomotionAction(), .15);
}

export function castAstronautSpell(target) {
  if (!astronaut || !target) return false;
  if (target.isObject3D) target.getWorldPosition(spellTarget);
  else spellTarget.copy(target);
  if (!mixer || !isGrounded) { pendingCastTarget = spellTarget.clone(); return true; }
  const action = actions.magic_attack;
  if (!action) return false;
  const dx = spellTarget.x - astroPos.x, dz = spellTarget.z - astroPos.z;
  if (Math.hypot(dx, dz) > .001) astroRotation = Math.atan2(dx, dz);
  astronaut.rotation.y = astroRotation;
  if (currentAction && currentAction !== action) currentAction.fadeOut(.15);
  const restarting = currentAction === action;
  action.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(1);
  action.clampWhenFinished = true;
  if (!restarting) action.fadeIn(.15);
  action.play();
  currentAction = action;
  castingAction = action;
  astronaut.userData.animation = action.getClip().name;
  astronaut.userData.isCasting = true;
  astronaut.userData.castCount = (astronaut.userData.castCount || 0) + 1;
  return true;
}
const cameraForward = new THREE.Vector3(), cameraRight = new THREE.Vector3(), worldUp = new THREE.Vector3(0, 1, 0);
const followTarget = new THREE.Vector3(), followStep = new THREE.Vector3();
let hudElapsed = 0, hudPosition = null, lastHudText = '';

export const keyState = { w: false, a: false, s: false, d: false, space: false, shift: false };

export function setVirtualKey(key, isDown) {
  if (key === 'shift' && !isDown) heldShiftKeys.clear();
  if (keyState[key] === isDown) return;
  if (key === 'space' && isDown) jumpRequested = true;
  keyState[key] = isDown;
  const el = document.getElementById(`key-${key}`);
  if (el) el.classList.toggle('pressed', isDown);
}

export function releaseAstronautControls() {
  heldShiftKeys.clear();
  jumpRequested = false;
  for (const key of Object.keys(keyState)) setVirtualKey(key, false);
}

export function setupKeyboardControls(isCurrentPhase3D) {
  function handleKeyEvent(e, isDown) {
    const code = e.code;
    const key = (e.key || '').toLowerCase();
    if (isDown && (!isCurrentPhase3D() || e.isComposing || e.ctrlKey || e.metaKey || e.altKey ||
      e.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))) return;
    if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
      if (isDown) heldShiftKeys.add(code || 'Shift');
      else heldShiftKeys.delete(code || 'Shift');
      setVirtualKey('shift', heldShiftKeys.size > 0 || e.shiftKey);
      return;
    }
    if (isDown && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(code)) {
      setVirtualKey('shift', e.shiftKey || heldShiftKeys.size > 0);
    }

    if (code === 'KeyF' || key === 'f' || key === 'ด') {
      if (isDown && isCurrentPhase3D()) {
        if (window.reset3DCamera) window.reset3DCamera();
        e.preventDefault();
      }
      return;
    }

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
  window.addEventListener('blur', releaseAstronautControls);
  window.addEventListener('focusin', event => {
    if (event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) releaseAstronautControls();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAstronautControls(); });
}

export function createAstronautCharacter(scene, getTerrainHeight) {
  if (astronaut) scene.remove(astronaut);

  astronaut = new THREE.Group();
  astronaut.name = 'AstronautCharacter';
  astronaut.userData.isCasting = false;
  astronaut.userData.isSprinting = false;
  astronaut.userData.castCount = 0;
  astroPos.set(2.5, getTerrainHeight(2.5, 2.5), 2.5);
  astronaut.position.copy(astroPos);
  astronaut.rotation.y = astroRotation;
  scene.add(astronaut);

  // Load the rigged & animated character
  const loader = new GLTFLoader();
  loader.load('./assets/models/Astronaut_Animated.glb?v=434ea95f9ad4', (gltf) => {
    while (astronaut.children.length > 0) {
      astronaut.remove(astronaut.children[0]);
    }
    const model = gltf.scene;

    model.traverse((c) => {
      if (c.isMesh) {
        // A cached idle-pose sphere does not cover every animated limb pose.
        // The single player character must stay visible during jump transitions.
        if (c.isSkinnedMesh) c.frustumCulled = false;
        c.castShadow = true;
        c.receiveShadow = true;
        if (c.name === '0_1') {
          // Reflective gold Apollo helmet visor
          c.material = new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            roughness: 0.12,
            metalness: 0.92
          });
        } else {
          // Apollo white space suit
          c.material = new THREE.MeshStandardMaterial({
            color: 0xf1f5f9,
            roughness: 0.60,
            metalness: 0.20
          });
        }
      }
    });

    // Setup Animation Mixer
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
    }
    actions.idle = actions.idle || Object.values(actions)[0];
    actions.walking = actions.walking || actions.run || actions.idle;
    actions.running = actions.running || actions.walking;
    actions.jumping = actions.jumping || actions.jump || actions.idle;
    if (actions.jumping !== actions.idle) {
      // Play the updated jump once over the physical hop, without looping mid-air.
      actions.jumping.setLoop(THREE.LoopOnce, 1);
      actions.jumping.clampWhenFinished = true;
      actions.jumping.setDuration(2 * JUMP_SPEED / MARS_GRAVITY);
    }
    mixer.addEventListener('finished', event => {
      if (event.action !== castingAction) return;
      castingAction = null;
      astronaut.userData.isCasting = false;
      fadeToAction(locomotionAction(), .18);
    });

    currentAction = null;
    fadeToAction('idle', 0);
    mixer.update(0);
    footGrounding = fitAnimatedCharacter(model, astronaut);
    astronaut.add(model);
    footGrounding.align(getTerrainHeight);
    if (pendingCastTarget) {
      const target = pendingCastTarget;
      pendingCastTarget = null;
      castAstronautSpell(target);
    }
    console.log('[Astronaut] Loaded rigged character with animations:', Object.keys(actions));
  }, undefined, (err) => {
    console.warn('[Astronaut] Failed to load Astronaut_Animated.glb:', err);
  });

  return astronaut;
}

export function resetAstronautToLander(getTerrainHeight) {
  releaseAstronautControls();
  cancelAstronautSpell();
  astroPos.set(1.2, getTerrainHeight(1.2, 3.2), 3.2);
  astroVelocity.set(0, 0, 0);
  isGrounded = true;
  astroRotation = Math.PI;
  if (astronaut) {
    astronaut.position.copy(astroPos);
    astronaut.rotation.y = astroRotation;
  }
  fadeToAction('idle', 0.1);
}

export function updateAstronautPhysics(delta, getTerrainHeight, camera, controls, isCameraFollow) {
  if (!astronaut) return;
  if (mixer) mixer.update(delta);

  const wantsJump = jumpRequested;
  jumpRequested = false;

  const moveSpeed = keyState.shift ? RUN_SPEED : WALK_SPEED;
  let moveX = 0;
  let moveZ = 0;

  const camForward = cameraForward;
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  camForward.normalize();

  const camRight = cameraRight;
  camRight.crossVectors(camForward, worldUp).normalize();

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
  astronaut.userData.isSprinting = isMoving && keyState.shift;
  if ((castingAction || pendingCastTarget) && (isMoving || keyState.space)) cancelAstronautSpell();

  if (isMoving) {
    moveX /= inputLen;
    moveZ /= inputLen;

    const oldPos = astroPos.clone();
    const nextX = astroPos.x + moveX * moveSpeed * delta;
    const nextZ = astroPos.z + moveZ * moveSpeed * delta;

    const testPos = new THREE.Vector3(nextX, astroPos.y, nextZ);
    const resolvedPos = resolveCharacterCollision(testPos, oldPos, 0.40);

    astroPos.x = resolvedPos.x;
    astroPos.z = resolvedPos.z;
    if (resolvedPos.y !== astroPos.y && isGrounded) {
      astroPos.y = THREE.MathUtils.lerp(astroPos.y, resolvedPos.y, 0.5);
    }

    const targetAngle = Math.atan2(moveX, moveZ);
    const turn = Math.atan2(Math.sin(targetAngle - astroRotation), Math.cos(targetAngle - astroRotation));
    astroRotation += turn * (1 - Math.exp(-15 * delta));
    astronaut.rotation.y = astroRotation;

    if (isGrounded) {
      fadeToAction(keyState.shift ? 'running' : 'walking', 0.2);
    }
  } else {
    // Anti-penetration check: push out if currently stuck inside any collider
    const unstickPos = resolveCharacterCollision(astroPos, astroPos, 0.40);
    astroPos.x = unstickPos.x;
    astroPos.z = unstickPos.z;

    if (isGrounded && !castingAction) {
      fadeToAction('idle', 0.25);
    }
  }

  const groundTerrainY = getTerrainHeight(astroPos.x, astroPos.z);
  const colliderY = getColliderSurfaceHeight(astroPos.x, astroPos.z, astroPos.y, 0.20);
  const groundY = (colliderY !== null && colliderY > groundTerrainY) ? colliderY : groundTerrainY;

  // Realistic Mars EVA Hop
  if (wantsJump && isGrounded) {
    astroVelocity.y = JUMP_SPEED;
    isGrounded = false;
    fadeToAction('jumping', .15);
  }

  astroVelocity.y -= MARS_GRAVITY * delta;
  astroPos.y += astroVelocity.y * delta;

  if (astroPos.y <= groundY) {
    astroPos.y = groundY;
    astroVelocity.y = 0;
    const justLanded = !isGrounded;
    isGrounded = true;
    if (justLanded) {
      fadeToAction(isMoving ? keyState.shift ? 'running' : 'walking' : 'idle', 0.15);
    }
  }

  astronaut.position.copy(astroPos);
  if (isGrounded && pendingCastTarget) {
    const target = pendingCastTarget;
    pendingCastTarget = null;
    castAstronautSpell(target);
  }
  if (isGrounded) footGrounding?.align(getTerrainHeight, colliderY !== null && colliderY > groundTerrainY ? groundY : null);

  // 3rd-Person Follow Camera: Tracks character translation and vertical step-up
  if (isCameraFollow && controls && camera) {
    const targetY = astroPos.y + 1.2;
    const desiredTarget = followTarget.set(astroPos.x, targetY, astroPos.z);
    
    // Smooth frame-rate independent follow (exponential decay damping)
    const lerpRate = 1.0 - Math.exp(-9.0 * delta);
    const targetDelta = followStep.subVectors(desiredTarget, controls.target);
    const step = targetDelta.multiplyScalar(lerpRate);

    controls.target.add(step);
    camera.position.add(step);
  }

  hudElapsed += delta;
  if (hudElapsed >= 0.1) {
    hudElapsed %= 0.1;
    hudPosition ||= document.getElementById('hud-astro-pos');
    const state = castingAction ? 'Casting' : isMoving ? keyState.shift ? 'Running' : 'Walking' : isGrounded ? 'Standing' : 'Airborne';
    const text = `X: ${astroPos.x.toFixed(1)}, Z: ${astroPos.z.toFixed(1)} (${state})`;
    if (hudPosition && text !== lastHudText) { hudPosition.textContent = text; lastHudText = text; }
  }
}

