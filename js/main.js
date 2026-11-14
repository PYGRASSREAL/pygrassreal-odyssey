import * as THREE from 'three';
import { initTimeline, jumpToTimeline, getCurrentPhase } from './timeline.js';
import {
  initMarsScene,
  getTerrainHeight,
  onWindowResize3D,
  toggleEnvironment,
  toggleWindSim,
  updateWindSim,
  toggleCameraFollow,
  getIsCameraFollow,
  reset3DCamera,
  fireImpactTest
} from './marsScene.js';
import {
  createAstronautCharacter,
  resetAstronautToLander,
  setupKeyboardControls,
  setVirtualKey,
  updateAstronautPhysics,
  astroPos
} from './astronaut.js';
import {
  initModelManager,
  createProceduralMarsCraft,
  loadSamplePy3s,
  setShadingMode,
  processLoadedFile,
  exportPrint3D,
  currentModelGroup,
  getModelBoundingBox,
  flipModelOrientation,
  adjustModelScale,
  adjustSplatSize,
  adjustColliderHeight,
  realignModelToGround
} from './modelManager.js';

// Initialize 3D Engine
const canvas3D = document.getElementById('threejs-canvas');
const { scene, camera, renderer, controls } = initMarsScene(canvas3D);

// Initialize Astronaut & Model Manager
createAstronautCharacter(scene, getTerrainHeight);
initModelManager(scene, getTerrainHeight);

// Setup Keyboard Controls
setupKeyboardControls(() => getCurrentPhase() === '3d');

// Initialize Timeline with callbacks
initTimeline({
  onEnter3D: () => {
    onWindowResize3D();
  },
  onLeave3D: () => {}
});

// Render Loop
let lastTime = performance.now();
function animate3D() {
  requestAnimationFrame(animate3D);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  updateAstronautPhysics(delta, getTerrainHeight, camera, controls, getIsCameraFollow());

  if (controls) controls.update();

  updateWindSim();

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
animate3D();

// =========================================================================
// Global Windows API for HTML Interactive Controls
// =========================================================================
window.jumpToTimeline = jumpToTimeline;
window.setShadingMode = setShadingMode;
window.toggleCameraFollow = toggleCameraFollow;
window.toggleEnvironment = toggleEnvironment;
window.toggleWindSim = toggleWindSim;
window.reset3DCamera = () => reset3DCamera(astroPos);
window.resetAstronautToLander = () => resetAstronautToLander(getTerrainHeight);
window.THREE = THREE;
window.astroPos = astroPos;
window.loadPresetMarsCraft = () => createProceduralMarsCraft();
window.loadSamplePy3s = (filename) => loadSamplePy3s(filename);
window.fireImpactTest = fireImpactTest;
window.exportPrint3D = exportPrint3D;
window.setVirtualKey = setVirtualKey;
window.flipModelOrientation = flipModelOrientation;
window.adjustModelScale = adjustModelScale;
window.adjustSplatSize = adjustSplatSize;
window.adjustColliderHeight = adjustColliderHeight;
window.realignModelToGround = realignModelToGround;
window.currentModelGroup = currentModelGroup;
window.getModelBoundingBox = getModelBoundingBox;
window.handleFileSelect = (e) => {
  if (e.target.files && e.target.files[0]) {
    processLoadedFile(e.target.files[0]);
  }
};

