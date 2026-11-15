import * as THREE from 'three';
import { Py3sCodec } from '../libs/py3s/py3sCodec.js';

/**
 * Asset Browser & Content Drawer Manager (Unreal Engine 5 style)
 * Handles left panel .py3s Asset Library, Drag & Drop to 3D Viewport,
 * File upload parsing, and 2-step deletion of library assets.
 */

export const assetLibrary = [
  {
    id: 'asset_spacecraft_probe',
    name: 'sci-fi-spacecraft-probe.py3s',
    displayName: 'Sci-Fi Spacecraft Probe',
    sizeStr: '3.2 MB',
    icon: './assets/logo-icon-mark.webp',
    isDefault: false,
    type: 'sample',
    filename: 'sci-fi-spacecraft-probe.py3s'
  },
  {
    id: 'asset_mars_rover',
    name: 'mars-rover-model.py3s',
    displayName: 'Mars Rover Model',
    sizeStr: formatFileSize(5078908),
    icon: './assets/logo-icon-mark.webp',
    isDefault: false,
    type: 'sample',
    filename: 'mars-rover-model.py3s'
  },
  {
    id: 'asset_mars_habitat_dome',
    name: 'mars-habitat-dome.py3s',
    displayName: 'Mars Habitat Dome',
    sizeStr: formatFileSize(5334802),
    icon: './assets/logo-icon-mark.webp',
    isDefault: false,
    type: 'sample',
    filename: 'mars-habitat-dome.py3s'
  }
];

export const py3sFileList = [
  {
    id: 'default_probe_03',
    name: 'sci-fi-spacecraft-probe.py3s',
    sizeStr: '3.2 MB',
    active: true,
    isDefault: false
  }
];

let pendingDeleteAssetId = null;
let pendingDeleteAssetTimeout = null;

let onSpawnFromAssetCallback = null;
let getPlacedInstancesFn = () => [];

export function registerAssetBrowserHandlers({
  onSpawnFromAsset = null,
  getPlacedInstances = null
} = {}) {
  if (onSpawnFromAsset) onSpawnFromAssetCallback = onSpawnFromAsset;
  if (getPlacedInstances) getPlacedInstancesFn = getPlacedInstances;
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderSlotIcon(icon) {
  // Always use the official PyGrassReal brand logo icon mark for all py3s assets
  const brandLogo = './assets/logo-icon-mark.webp';
  return `<img src="${brandLogo}" alt="PyGrassReal" class="file-slot-icon-img" draggable="false" />`;
}

let isDraggingAsset = false;
let draggedAssetId = null;
let placementPreview = null;
let blankDragImage = null;
let isProcessingFiles = false;
const recentlyAddedFileSignatures = new Map();

/**
 * Drag & Drop from Asset Browser to 3D Viewport Handler
 */
export function handleAssetDragStart(event, assetId) {
  isDraggingAsset = true;
  draggedAssetId = assetId;
  placementPreview?.begin(assetId);
  if (event && event.dataTransfer) {
    event.dataTransfer.setData('text/plain', assetId);
    event.dataTransfer.setData('application/json', JSON.stringify({ assetId }));
    event.dataTransfer.effectAllowed = 'copy';
    if (!blankDragImage) {
      blankDragImage = document.createElement('canvas');
      blankDragImage.width = blankDragImage.height = 1;
      blankDragImage.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;pointer-events:none';
      blankDragImage.setAttribute('aria-hidden', 'true');
      document.body.append(blankDragImage);
    }
    event.dataTransfer.setDragImage(blankDragImage, 0, 0);
  }
}

export function handleAssetDragEnd(event) {
  placementPreview?.cancel();
  draggedAssetId = null;
  setTimeout(() => {
    isDraggingAsset = false;
  }, 250);
}

export function handleAssetCardClick(event, assetId) {
  if (isDraggingAsset) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }
  if (window.spawnModelFromAsset) {
    window.spawnModelFromAsset(assetId);
  }
}

/**
 * Two-Step Confirmation Delete for Asset Library item
 */
export function handleDeletePy3s(event, id) {
  handleDeleteAsset(event, id);
}

export function handleDeleteAsset(event, id) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  if (pendingDeleteAssetId === id) {
    if (pendingDeleteAssetTimeout) {
      clearTimeout(pendingDeleteAssetTimeout);
      pendingDeleteAssetTimeout = null;
    }
    pendingDeleteAssetId = null;
    removeAssetFile(id);
  } else {
    if (pendingDeleteAssetTimeout) clearTimeout(pendingDeleteAssetTimeout);
    pendingDeleteAssetId = id;
    renderPy3sFileList();

    pendingDeleteAssetTimeout = setTimeout(() => {
      pendingDeleteAssetId = null;
      renderPy3sFileList();
    }, 4500);
  }
}

export function removeAssetFile(id) {
  const index = assetLibrary.findIndex(it => it.id === id);
  if (index === -1) return;
  assetLibrary.splice(index, 1);
  renderPy3sFileList();
}

export function renderPy3sFileList() {
  const container = document.getElementById('py3s-file-list-container');
  if (!container) return;

  if (assetLibrary.length === 0) {
    container.innerHTML = `
      <div style="font-size: 0.68rem; color: #94a3b8; text-align: center; padding: 0.5rem 0.3rem;">
        No files in library (Click + Add below to import)
      </div>
    `;
    return;
  }

  const placed = getPlacedInstancesFn();

  container.innerHTML = assetLibrary.map(item => {
    const isConfirming = (pendingDeleteAssetId === item.id);
    const placedCount = placed.filter(i => i.assetId === item.id && !i.deleted).length;
    return `
      <div class="py3s-file-slot py3s-asset-row draggable-asset" 
           id="asset-row-${item.id}"
           draggable="true" 
           ondragstart="window.handleAssetDragStart(event, '${item.id}')"
           ondragend="window.handleAssetDragEnd(event)"
           onclick="window.handleAssetCardClick(event, '${item.id}')"
           title="Click to place model on 3D ground (or drag and drop)">
        <span class="file-slot-icon">${renderSlotIcon(item.icon)}</span>
        <div class="file-slot-info">
          <span class="file-slot-name" title="${escapeHtml(item.displayName || item.name)}">${escapeHtml(item.displayName || item.name)}</span>
          <span class="file-slot-meta">${item.sizeStr} ${placedCount > 0 ? `• In Scene (${placedCount})` : '• 🖱️ Drag to Ground'}</span>
        </div>
        ${!item.isDefault ? `
          <button class="btn-layer-del ${isConfirming ? 'confirming' : ''}" 
                  onclick="window.handleDeleteAsset(event, '${item.id}')" 
                  title="${isConfirming ? 'Click again to confirm removal' : 'Delete from library (Click twice to confirm)'}">
            ${isConfirming ? '⚠️ Delete?' : '🗑️'}
          </button>
        ` : '<span style="width: 26px; margin-left: auto; flex-shrink: 0;"></span>'}
      </div>
    `;
  }).join('');
}

/**
 * Imports .py3s files into the library. Scene placement is a separate action.
 */
export async function processLoadedFiles(files) {
  if (!files || files.length === 0) return;
  if (isProcessingFiles) return;
  isProcessingFiles = true;

  try {
    const validFiles = [];
    const invalidFiles = [];

    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'py3s') {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (invalidFiles.length > 0) {
      alert(`⚠️ Found ${invalidFiles.length} unsupported files (${invalidFiles.join(', ')}).\nOnly .py3s format is supported.`);
    }

    if (validFiles.length === 0) return;

    const now = Date.now();
    for (const file of validFiles) {
      const sig = `${file.name}_${file.size}`;
      const lastTime = recentlyAddedFileSignatures.get(sig) || 0;
      if (now - lastTime < 1800) {
        console.warn(`[AssetBrowser] Duplicate file upload suppressed: ${file.name}`);
        continue;
      }
      recentlyAddedFileSignatures.set(sig, now);

      const buf = await file.arrayBuffer();
      let displayBytes = file.size;
      try {
        const unpackedInfo = await Py3sCodec.unpack(buf);
        if (unpackedInfo.metadata?.telemetryProfile?.fullSpzBytes) {
          displayBytes = unpackedInfo.metadata.telemetryProfile.fullSpzBytes;
        } else if (unpackedInfo.metadata?.telemetryProfile?.fullSourceBytes) {
          displayBytes = unpackedInfo.metadata.telemetryProfile.fullSourceBytes;
        } else if (unpackedInfo.metadata?.isSeed || unpackedInfo.metadata?.dehydrated || unpackedInfo.metadata?.autoHydratedToFull || file.size < 150000) {
          displayBytes = 3.2 * 1024 * 1024;
        }
      } catch (err) {
        console.warn('[AssetBrowser] Header unpack check note:', err);
      }

      // Check if file already exists in library
      const existing = assetLibrary.find(a => a.name === file.name);
      if (existing) {
        console.log(`[AssetBrowser] File ${file.name} already in library, updating.`);
        existing.buffer = buf;
        existing.sizeStr = formatFileSize(displayBytes);
        existing.icon = './assets/logo-icon-mark.webp';
        renderPy3sFileList();

        continue;
      }

      const id = 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

      const asset = {
        id,
        name: file.name,
        displayName: file.name.replace(/\.py3s$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        sizeStr: formatFileSize(displayBytes),
        buffer: buf,
        icon: './assets/logo-icon-mark.webp',
        isDefault: false
      };
      assetLibrary.push(asset);
      renderPy3sFileList();
    }
  } finally {
    setTimeout(() => {
      isProcessingFiles = false;
    }, 350);
  }
}

export function processLoadedFile(file) {
  processLoadedFiles([file]);
}

export async function activatePy3sFile(id) {
  if (onSpawnFromAssetCallback) {
    await onSpawnFromAssetCallback(id);
  } else if (window.spawnModelFromAsset) {
    await window.spawnModelFromAsset(id);
  }
}

/**
 * Configures drag & drop listeners on left panel dropzone and 3D canvas viewport.
 */
export function setupDropZone({
  canvas = null,
  threeLayer = null,
  camera = null,
  terrainHeightFn = () => 0,
  placementPreview: preview = null,
  onSpawnInstanceAt = null
} = {}) {
  placementPreview = preview;
  const dz = document.getElementById('drop-zone');
  const fileContainer = document.getElementById('py3s-file-list-container');
  const leftPanel = document.getElementById('v3d-leftpanel');

  const attachDropEvents = (el) => {
    if (!el) return;
    el.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('dragover');
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      el.classList.add('dragover');
    });
    el.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('dragover');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processLoadedFiles(Array.from(e.dataTransfer.files));
      }
    });
  };

  attachDropEvents(dz);
  attachDropEvents(fileContainer);
  attachDropEvents(leftPanel);

  // Viewport Drop Target for Drag & Drop onto 3D Ground
  const targetCanvas = canvas || document.getElementById('threejs-canvas');
  const targetLayer = threeLayer || document.getElementById('threejs-layer');

  const onViewportDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (targetLayer) targetLayer.classList.add('drag-over');
    if (draggedAssetId) placementPreview?.move(e.clientX, e.clientY);
  };

  const onViewportDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetLayer) targetLayer.classList.remove('drag-over');
    placementPreview?.hide();
  };

  let isViewportDropping = false;
  const onViewportDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (targetLayer) targetLayer.classList.remove('drag-over');

    if (isViewportDropping) {
      console.warn('[AssetBrowser] Suppressed duplicate viewport drop call');
      return;
    }
    isViewportDropping = true;

    try {
      const assetId = draggedAssetId || e.dataTransfer.getData('text/plain');
      if (assetId && assetLibrary.some(a => a.id === assetId)) {
        if (placementPreview) {
          await placementPreview.drop(assetId, e.clientX, e.clientY);
          return;
        }
        const rect = targetCanvas ? targetCanvas.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        if (camera) {
          raycaster.setFromCamera(mouse, camera);
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const targetPoint = new THREE.Vector3();
          const hit = raycaster.ray.intersectPlane(groundPlane, targetPoint);
          const x = hit ? Math.max(-14, Math.min(14, targetPoint.x)) : (Math.random() * 4 - 2);
          const z = hit ? Math.max(-14, Math.min(14, targetPoint.z)) : (Math.random() * 4 - 2);
          const y = terrainHeightFn(x, z);
          const pos = new THREE.Vector3(x, y, z);

          if (onSpawnInstanceAt) {
            await onSpawnInstanceAt(assetId, pos);
          } else if (window.spawnModelInstance) {
            await window.spawnModelInstance(assetId, pos);
          }
        } else {
          if (onSpawnFromAssetCallback) {
            await onSpawnFromAssetCallback(assetId);
          } else if (window.spawnModelFromAsset) {
            await window.spawnModelFromAsset(assetId);
          }
        }
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await processLoadedFiles(Array.from(e.dataTransfer.files));
      }
    } finally {
      placementPreview?.cancel();
      draggedAssetId = null;
      setTimeout(() => {
        isViewportDropping = false;
      }, 400);
    }
  };

  // Attach listener ONLY to targetCanvas (or targetLayer if canvas missing) to prevent duplicate event triggers
  const viewportDropTarget = targetCanvas || targetLayer;
  if (viewportDropTarget) {
    viewportDropTarget.addEventListener('dragover', onViewportDragOver);
    viewportDropTarget.addEventListener('dragleave', onViewportDragLeave);
    viewportDropTarget.addEventListener('drop', onViewportDrop);
  }

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.target !== viewportDropTarget) {
      placementPreview?.hide();
      targetLayer?.classList.remove('drag-over');
    }
  });
  window.addEventListener('dragend', () => { placementPreview?.cancel(); draggedAssetId = null; });
  window.addEventListener('blur', () => placementPreview?.cancel());
  document.addEventListener('visibilitychange', () => { if (document.hidden) placementPreview?.cancel(); });
  window.addEventListener('keydown', event => { if (event.key === 'Escape') placementPreview?.cancel(); }, true);
  window.addEventListener('drop', (e) => {
    // If dropped inside left panel or viewport element, let their own handlers handle it
    if (leftPanel && leftPanel.contains(e.target)) return;
    if (viewportDropTarget && viewportDropTarget.contains(e.target)) return;
    placementPreview?.cancel();
    draggedAssetId = null;

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const hasPy3s = files.some(f => f.name.toLowerCase().endsWith('.py3s'));
      if (hasPy3s) {
        e.preventDefault();
        e.stopPropagation();
        processLoadedFiles(files);
      }
    }
  });
}

// Window bindings for inline HTML onclick attributes
if (typeof window !== 'undefined') {
  window.assetLibrary = assetLibrary;
  window.py3sFileList = py3sFileList;
  window.handleAssetDragStart = handleAssetDragStart;
  window.handleAssetDragEnd = handleAssetDragEnd;
  window.handleAssetCardClick = handleAssetCardClick;
  window.handleDeleteAsset = handleDeleteAsset;
  window.handleDeletePy3s = handleDeletePy3s;
  window.renderPy3sFileList = renderPy3sFileList;
  window.processLoadedFiles = processLoadedFiles;
  window.processLoadedFile = processLoadedFile;
  window.activatePy3sFile = activatePy3sFile;
}
