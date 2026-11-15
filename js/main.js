import * as THREE from 'three';
import { initTimeline, jumpToTimeline, getCurrentPhase } from './timeline.js?v=20261115_en_v19';
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
  fireImpactTest,
  toggleGridVisible,
  setGridVisible,
  isGridVisible
} from './marsScene.js?v=20261115_en_v18';
import {
  createAstronautCharacter,
  resetAstronautToLander,
  setupKeyboardControls,
  releaseAstronautControls,
  castAstronautSpell,
  cancelAstronautSpell,
  setVirtualKey,
  updateAstronautPhysics,
  astroPos
} from './astronaut.js?v=20261115_en_v18';
import {
  initModelManager,
  cancelAssetPlacement,
  createProceduralMarsCraft,
  loadSamplePy3s,
  setShadingMode,
  toggleColliderMode,
  togglePy3sLayer,
  py3sLayersState,
  toggleRhinoVisibility,
  toggleRhinoLock,
  selectRhinoLayer,
  handleDeleteLayer,
  py3sLayersDeleted,
  updateRhinoLayersUI,
  placedInstances,
  assetLibrary,
  spawnModelInstance,
  spawnModelFromAsset,
  spawnDefaultSceneModel,
  selectInstance,
  selectTerrainLayer,
  toggleInstanceVisibility,
  toggleInstanceLock,
  handleDeleteInstance,
  executeDeleteInstance,
  handleAssetDragStart,
  handleDeleteAsset,
  processLoadedFile,
  processLoadedFiles,
  activatePy3sFile,
  handleDeletePy3s,
  renderPy3sFileList,
  exportPrint3D,
  currentModelGroup,
  getModelBoundingBox,
  flipModelOrientation,
  adjustModelScale,
  adjustSplatSize,
  adjustColliderHeight,
  adjustColliderOpacity,
  realignModelToGround,
  getColliderSurfaceHeight,
  resolveCharacterCollision,
  colliderMeshGroup,
  toggleGumball,
  setGumballMode,
  resetModelTransform,
  snapModelToGround,
  selectModel
} from './modelManager.js?v=20261115_assets_v24';
import {
  getTransformControls,
  updateGumballUI,
  updateGumballCoordinatesUI
} from './gumballManager.js?v=20261115_en_v18';
import { initHistoryManager, undo, redo } from './historyManager.js?v=20261115_en_v18';
import { createSceneFrameBudget } from './scenePerformance.js?v=20261115_en_v18';
import { getSelectedInstance } from './outlinerManager.js?v=20261115_en_v18';
import { initInstancePhysics, updateInstancePhysics, applyInstancePhysics, closePhysicsMenu, renderPhysicsInteraction, PHYSICS_MODES } from './instancePhysics.js?v=20261115_en_v21';
import { initPhysicsHelp } from './physicsHelp.js?v=20261115_assets_v24';
import {
  initBenchmarkModal,
  toggleBenchmarkModal,
  switchBenchmarkTab,
  runSpaceTransmissionCalc,
  handleBackdropClick
} from './benchmarkModal.js?v=20261115_en_v18';

// 1. Initialize Timeline FIRST so storytelling and scroll navigation work immediately
window.jumpToTimeline = jumpToTimeline;
let physicsHelpInstance = null;
initTimeline({
  onEnter3D: async () => {
    if (physicsHelpInstance) physicsHelpInstance.setActive(true);
    onWindowResize3D();
    reset3DCamera(astroPos);
    if (placedInstances.filter(i => !i.deleted).length === 0) {
      if (spawnDefaultSceneModel) await spawnDefaultSceneModel();
    }
  },
  onLeave3D: () => {
    cancelAssetPlacement();
    if (physicsHelpInstance) physicsHelpInstance.setActive(false);
    closePhysicsMenu();
    releaseAstronautControls();
    cancelAstronautSpell();
  }
});

// 2. Initialize 3D Engine & Astronaut
const canvas3D = document.getElementById('threejs-canvas');
const { scene, camera, renderer, controls } = initMarsScene(canvas3D);

createAstronautCharacter(scene, getTerrainHeight);
initModelManager(scene, getTerrainHeight, camera, renderer, controls);
initBenchmarkModal();
const physicsHelp = initPhysicsHelp({
  modes: PHYSICS_MODES,
  onOpen: () => { cancelAssetPlacement(); closePhysicsMenu({ restoreFocus: false }); releaseAstronautControls(); },
  onClose: releaseAstronautControls,
});
physicsHelpInstance = physicsHelp;

initInstancePhysics({
  camera, renderer, astroPos,
  placedInstances,
  getSelectedInstance,
  selectInstance,
  hideGizmo: () => selectModel(false),
  getTransformControls,
  isActive: () => getCurrentPhase() === '3d',
  releaseMovement: releaseAstronautControls,
  onPhysicsModeSelected: inst => castAstronautSpell(inst.group),
});

// Initialize History / Undo-Redo Subsystem
initHistoryManager({
  scene,
  placedInstances,
  updateRhinoLayersUI,
  selectInstance,
  getTransformControls,
  updateGumballUI,
  updateGumballCoordinatesUI,
  renderPy3sFileList,
  applyInstancePhysics,
  onPhysicsModeSelected: inst => castAstronautSpell(inst.group),
});

// Setup Keyboard Controls
setupKeyboardControls(() => getCurrentPhase() === '3d');

// Focus camera on astronaut immediately on startup
reset3DCamera(astroPos);

// Render Loop
let lastTime = performance.now();
const frameBudget = createSceneFrameBudget(renderer);
frameBudget.reset(lastTime);
function animate3D() {
  requestAnimationFrame(animate3D);

  const now = performance.now();
  // Continue the initial DropInViewer setup, then leave the GPU idle while the
  // timeline is showing 2D media or this browser tab is in the background.
  if (document.hidden || getCurrentPhase() !== '3d') {
    lastTime = now;
    frameBudget.reset(now);
    updateInstancePhysics(0);
    if (!document.hidden && placedInstances.length === 0) renderer.render(scene, camera);
    return;
  }
  if (!frameBudget.shouldRender(now)) return;
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const frameStart = performance.now();
  updateInstancePhysics(delta);
  updateAstronautPhysics(delta, getTerrainHeight, camera, controls, getIsCameraFollow());

  if (controls) controls.update();

  updateWindSim();

  if (renderer && scene && camera) {
    frameBudget.shadows(delta);
    renderer.render(scene, camera);
    renderPhysicsInteraction(now);
    frameBudget.record(now, performance.now() - frameStart);
  }
}
animate3D();

// =========================================================================
// Global Windows API for HTML Interactive Controls
// =========================================================================
window.jumpToTimeline = jumpToTimeline;
window.setShadingMode = setShadingMode;
window.toggleColliderMode = toggleColliderMode;
window.togglePy3sLayer = togglePy3sLayer;
window.py3sLayersState = py3sLayersState;
window.toggleRhinoVisibility = toggleRhinoVisibility;
window.toggleRhinoLock = toggleRhinoLock;
window.selectRhinoLayer = selectRhinoLayer;
window.handleDeleteLayer = handleDeleteLayer;
window.py3sLayersDeleted = py3sLayersDeleted;
window.updateRhinoLayersUI = updateRhinoLayersUI;
window.placedInstances = placedInstances;
window.assetLibrary = assetLibrary;
window.spawnModelInstance = spawnModelInstance;
window.spawnModelFromAsset = spawnModelFromAsset;
window.spawnDefaultSceneModel = spawnDefaultSceneModel;
window.selectInstance = selectInstance;
window.selectTerrainLayer = selectTerrainLayer;
window.toggleInstanceVisibility = toggleInstanceVisibility;
window.toggleInstanceLock = toggleInstanceLock;
window.handleDeleteInstance = handleDeleteInstance;
window.executeDeleteInstance = executeDeleteInstance;
window.handleAssetDragStart = handleAssetDragStart;
window.handleDeleteAsset = handleDeleteAsset;
window.toggleCameraFollow = toggleCameraFollow;
window.toggleEnvironment = toggleEnvironment;
window.toggleWindSim = toggleWindSim;
window.reset3DCamera = () => reset3DCamera(astroPos);
window.resetAstronautToLander = () => resetAstronautToLander(getTerrainHeight);
window.THREE = THREE;
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.controls = controls;
window.astroPos = astroPos;
window.loadPresetMarsCraft = () => createProceduralMarsCraft();
window.loadSamplePy3s = (filename) => loadSamplePy3s(filename);
window.fireImpactTest = fireImpactTest;
window.exportPrint3D = exportPrint3D;
window.setVirtualKey = setVirtualKey;
window.toggleBenchmarkModal = toggleBenchmarkModal;
window.switchBenchmarkTab = switchBenchmarkTab;
window.runSpaceTransmissionCalc = runSpaceTransmissionCalc;
window.handleBackdropClick = handleBackdropClick;
window.flipModelOrientation = flipModelOrientation;
window.adjustModelScale = adjustModelScale;
window.getColliderSurfaceHeight = getColliderSurfaceHeight;
window.resolveCharacterCollision = resolveCharacterCollision;
window.colliderMeshGroup = colliderMeshGroup;
window.adjustSplatSize = adjustSplatSize;
window.adjustColliderHeight = adjustColliderHeight;
window.adjustColliderOpacity = adjustColliderOpacity;
window.realignModelToGround = realignModelToGround;
window.currentModelGroup = currentModelGroup;
window.getModelBoundingBox = getModelBoundingBox;
window.activatePy3sFile = activatePy3sFile;
window.handleDeletePy3s = handleDeletePy3s;
window.processLoadedFiles = processLoadedFiles;
window.renderPy3sFileList = renderPy3sFileList;
window.toggleGumball = toggleGumball;
window.setGumballMode = setGumballMode;
window.resetModelTransform = resetModelTransform;
window.snapModelToGround = snapModelToGround;
window.selectModel = selectModel;
window.applyInstancePhysics = applyInstancePhysics;
window.historyUndo = undo;
window.historyRedo = redo;
window.toggleGridXY = toggleGridVisible;
window.setGridVisible = setGridVisible;
window.isGridVisible = isGridVisible;
window.handleFileSelect = (e) => {
  if (e.target.files && e.target.files.length > 0) {
    processLoadedFiles(Array.from(e.target.files));
    e.target.value = '';
  }
};

