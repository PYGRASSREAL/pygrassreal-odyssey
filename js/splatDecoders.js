import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import createSpzModule from '../libs/spz/spz.js';

// Soft realistic circular Gaussian Splat billboard texture
let cachedSplatTexture = null;
export function createSplatTexture() {
  if (cachedSplatTexture) return cachedSplatTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.60, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(0.90, 'rgba(255, 255, 255, 0.08)');
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  cachedSplatTexture = new THREE.CanvasTexture(canvas);
  cachedSplatTexture.needsUpdate = true;
  return cachedSplatTexture;
}

export function createSplatPointsObject(geometry, defaultSize = 0.06) {
  const mat = new THREE.PointsMaterial({
    size: defaultSize,
    vertexColors: true,
    map: createSplatTexture(),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.NormalBlending
  });
  return new THREE.Points(geometry, mat);
}

// SPZ WebAssembly Module Loader & Parser
let spzModuleInstance = null;
export async function getSpzModuleInstance() {
  if (!spzModuleInstance) {
    spzModuleInstance = await createSpzModule();
  }
  return spzModuleInstance;
}

export async function parseSpzBuffer(buffer) {
  const spz = await getSpzModuleInstance();
  const cloud = spz.loadSpzFromBuffer(new Uint8Array(buffer), { to: spz.CoordinateSystem.RUB });
  const count = cloud.numPoints;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const SH_C0 = 0.28209479177387814;
  for (let i = 0; i < count; i++) {
    const p3 = i * 3;
    positions[p3 + 0] = cloud.positions[p3 + 0];
    positions[p3 + 1] = cloud.positions[p3 + 1];
    positions[p3 + 2] = cloud.positions[p3 + 2];

    colors[p3 + 0] = Math.max(0, Math.min(1, 0.5 + SH_C0 * cloud.colors[p3 + 0]));
    colors[p3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * cloud.colors[p3 + 1]));
    colors[p3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * cloud.colors[p3 + 2]));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geo, count };
}

// 3DGS .splat (32-byte binary format)
export function parseSplatBuffer(buffer) {
  const count = Math.floor(buffer.byteLength / 32);
  const fView = new Float32Array(buffer);
  const uView = new Uint8Array(buffer);

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = fView[i * 8 + 0];
    positions[i * 3 + 1] = -fView[i * 8 + 1];
    positions[i * 3 + 2] = -fView[i * 8 + 2];

    const colOffset = i * 32 + 24;
    colors[i * 3 + 0] = uView[colOffset + 0] / 255;
    colors[i * 3 + 1] = uView[colOffset + 1] / 255;
    colors[i * 3 + 2] = uView[colOffset + 2] / 255;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geo, count };
}

// PLY (Gaussian Splats or Standard PLY)
export function parsePlyBuffer(buffer) {
  const maxHeaderSize = Math.min(buffer.byteLength, 16384);
  const headerSlice = new Uint8Array(buffer, 0, maxHeaderSize);
  const headerString = new TextDecoder('utf-8').decode(headerSlice);

  if (headerString.includes('property float f_dc_0') || headerString.includes('property float f_dc_1')) {
    const endHeaderMatch = headerString.match(/end_header\r?\n/);
    if (endHeaderMatch && endHeaderMatch.index !== undefined) {
      const headerEndOffset = endHeaderMatch.index + endHeaderMatch[0].length;
      const headerText = headerString.slice(0, headerEndOffset);
      const vertexMatch = headerText.match(/element\s+vertex\s+(\d+)/);
      if (vertexMatch) {
        const count = parseInt(vertexMatch[1], 10);
        const propRegex = /property\s+(\w+)\s+(\w+)/g;
        let pMatch;
        let offset = 0;
        const props = {};
        while ((pMatch = propRegex.exec(headerText)) !== null) {
          const type = pMatch[1];
          const name = pMatch[2];
          const size = type === 'double' ? 8 : (type === 'float' || type === 'int' || type === 'uint') ? 4 : (type === 'short' || type === 'ushort') ? 2 : 1;
          props[name] = { offset, type, size };
          offset += size;
        }
        const stride = offset;
        const dataView = new DataView(buffer, headerEndOffset);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const SH_C0 = 0.28209479177387814;

        const xOff = props['x']?.offset ?? 0;
        const yOff = props['y']?.offset ?? 4;
        const zOff = props['z']?.offset ?? 8;
        const c0Off = props['f_dc_0']?.offset ?? 0;
        const c1Off = props['f_dc_1']?.offset ?? 4;
        const c2Off = props['f_dc_2']?.offset ?? 8;

        for (let i = 0; i < count; i++) {
          const rec = i * stride;
          if (rec + stride > dataView.byteLength) break;
          positions[i * 3 + 0] = dataView.getFloat32(rec + xOff, true);
          positions[i * 3 + 1] = -dataView.getFloat32(rec + yOff, true);
          positions[i * 3 + 2] = -dataView.getFloat32(rec + zOff, true);

          const c0 = dataView.getFloat32(rec + c0Off, true);
          const c1 = dataView.getFloat32(rec + c1Off, true);
          const c2 = dataView.getFloat32(rec + c2Off, true);
          colors[i * 3 + 0] = Math.max(0, Math.min(1, 0.5 + SH_C0 * c0));
          colors[i * 3 + 1] = Math.max(0, Math.min(1, 0.5 + SH_C0 * c1));
          colors[i * 3 + 2] = Math.max(0, Math.min(1, 0.5 + SH_C0 * c2));
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        return { geo, count, isGaussian: true };
      }
    }
  }

  const loader = new PLYLoader();
  const geo = loader.parse(buffer);
  if (!geo.attributes.color) {
    const pCount = geo.attributes.position.count;
    const colors = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      colors[i * 3 + 0] = 0.22;
      colors[i * 3 + 1] = 0.74;
      colors[i * 3 + 2] = 0.97;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  return { geo, count: geo.attributes.position.count, isGaussian: false };
}

// Extract/sample splats from GLB/GLTF geometry
export function generateSplatPointsFromGroup(group) {
  const positions = [];
  const colors = [];

  group.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const geo = child.geometry;
      const posAttr = geo.attributes.position;
      if (!posAttr) return;

      const mat = child.material;
      let r = 0.88, g = 0.92, b = 0.98;
      if (mat && mat.color) {
        r = mat.color.r;
        g = mat.color.g;
        b = mat.color.b;
      }

      const worldMat = child.matrixWorld;
      const v = new THREE.Vector3();
      const step = Math.max(1, Math.floor(posAttr.count / 4000));
      for (let i = 0; i < posAttr.count; i += step) {
        v.fromBufferAttribute(posAttr, i);
        v.applyMatrix4(worldMat);
        positions.push(v.x, v.y, v.z);
        colors.push(r, g, b);
      }
    }
  });

  if (positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }
  return null;
}

// Generate 12,000 dense, authentic colored splats for procedural Mars craft
export function createProceduralLanderSplats() {
  const totalSplats = 12000;
  const sPos = new Float32Array(totalSplats * 3);
  const sCol = new Float32Array(totalSplats * 3);
  let idx = 0;

  function addPoint(x, y, z, r, g, b) {
    if (idx >= totalSplats) return;
    sPos[idx * 3 + 0] = x;
    sPos[idx * 3 + 1] = y;
    sPos[idx * 3 + 2] = z;
    sCol[idx * 3 + 0] = r;
    sCol[idx * 3 + 1] = g;
    sCol[idx * 3 + 2] = b;
    idx++;
  }

  // 1. Hull Body (5,000 points - Metallic White/Silver)
  for (let i = 0; i < 5000; i++) {
    const u = Math.random() * Math.PI * 2;
    const hRatio = Math.random();
    const y = 1.0 + hRatio * 1.2;
    const rBase = 1.8 - hRatio * 0.4 + (Math.random() - 0.5) * 0.08;
    const x = Math.cos(u) * rBase;
    const z = Math.sin(u) * rBase;
    const shade = 0.88 + Math.random() * 0.12;
    addPoint(x, y, z, shade, shade * 0.98, shade * 0.96);
  }

  // 2. Solar Wings (4,000 points - Radiant Solar Gold)
  for (let i = 0; i < 4000; i++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const wx = side * (1.0 + Math.random() * 3.6);
    const wy = 1.6 + (Math.random() - 0.5) * 0.08;
    const wz = (Math.random() - 0.5) * 1.2;
    addPoint(wx, wy, wz, 0.96, 0.64 + Math.random() * 0.15, 0.12);
  }

  // 3. Sensor Dish (1,500 points - Glowing Cyan)
  for (let i = 0; i < 1500; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * (Math.PI / 2.2);
    const r = 0.5 + (Math.random() - 0.5) * 0.04;
    const dx = Math.sin(phi) * Math.cos(theta) * r;
    const dy = Math.cos(phi) * r;
    const dz = Math.sin(phi) * Math.sin(theta) * r;

    // Rotate dish -45 deg around X
    const rotY = dy * Math.cos(-Math.PI / 4) - dz * Math.sin(-Math.PI / 4);
    const rotZ = dy * Math.sin(-Math.PI / 4) + dz * Math.cos(-Math.PI / 4);
    addPoint(dx, 2.5 + rotY, 0.4 + rotZ, 0.22, 0.82, 0.98);
  }

  // 4. Landing Struts & Foot Pads (1,500 points - Dark Carbon/Slate)
  for (let i = 0; i < 1500; i++) {
    const legIdx = Math.floor(Math.random() * 4);
    const angle = (legIdx * Math.PI) / 2 + Math.PI / 4;
    const t = Math.random();
    const lx = Math.cos(angle) * (1.6 + t * 0.4);
    const ly = 0.8 * (1 - t) + 0.05 * t;
    const lz = Math.sin(angle) * (1.6 + t * 0.4);
    addPoint(lx, ly, lz, 0.22, 0.25, 0.32);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}
