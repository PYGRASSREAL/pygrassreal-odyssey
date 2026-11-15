// SplatPhysics.js - 3DGS Physical Simulation and FEA Analysis Kernel
import * as THREE from '../libs/three/three.module.js';
export const SPLAT_PHYSICS_MODES = [
    'stress-analysis', 'megas-thermal', 'voronoi-fracture', 'plant-wilting',
    'diffwind-aerodynamics', 'physskin-deformation', 'magnetic-mpm', 'enlivening-gs',
];
export const isSplatPhysicsMode = (mode) => SPLAT_PHYSICS_MODES.some(value => value === mode);
const GRID = 12;
const clamp = THREE.MathUtils.clamp;
export const isSplatFieldMode = (mode) => mode === 'stress-analysis' || mode === 'megas-thermal';
const FIELD_COLORS = [
    [0, 64, 255], [0, 220, 255], [40, 220, 70], [255, 220, 0], [255, 40, 24],
];
export const SPLAT_FIELD_GRADIENT = `linear-gradient(to right, ${FIELD_COLORS.map(color => `rgb(${color.join(',')})`).join(', ')})`;
/** Write display RGB directly; preserve each Gaussian's original alpha. */
export function writeSplatFieldColor(value, colors, offset) {
    const scaled = clamp(value, 0, 1) * (FIELD_COLORS.length - 1);
    const index = Math.min(Math.floor(scaled), FIELD_COLORS.length - 2);
    const mix = scaled - index;
    for (let channel = 0; channel < 3; channel++) {
        colors[offset + channel] = Math.round(FIELD_COLORS[index][channel] * (1 - mix) + FIELD_COLORS[index + 1][channel] * mix);
    }
}
/** Browser deformation previews, not the upstream CUDA solvers or learned models.
 * Shared transport follows PhysStudio: mu'=phi(mu), Sigma'=F Sigma F^T.
 * See MARKDOWN_PLAN/PhysStudio-3DGS-research.md for source paths and limitations.
 */
export function evaluateSplatField(mode, point, bounds, seconds, strength, out) {
    const size = bounds.getSize(new THREE.Vector3());
    const h = Math.max(size.y, 0.001);
    const cx = (bounds.min.x + bounds.max.x) / 2;
    const cz = (bounds.min.z + bounds.max.z) / 2;
    const x = (point.x - cx) / h, z = (point.z - cz) / h;
    const y = clamp((point.y - bounds.min.y) / h, 0, 1);
    const ramp = strength * (1 - Math.exp(-seconds * 1.3));
    // In 3DGS local space (Math.PI X-rotation): y=0 is physical ROOF, y=1 is physical FEET (ground base)
    const roofRatio = clamp(1 - y, 0, 1);
    const roofFactor = roofRatio * roofRatio; // 0 at feet (pinned base), 1 at roof
    let dx = 0, dy = 0, dz = 0, field = 0;
    switch (mode) {
        case 'stress-analysis': {
            const load = ramp * (0.85 + 0.15 * Math.sin(seconds * 1.8));
            dx = x * load * 0.12 * roofRatio;
            dz = z * load * 0.12 * roofRatio;
            // Downward compression: positive dy in local space pushes DOWN on screen from top roof, base pinned (y=1 -> roofFactor=0)
            dy = load * 0.38 * roofFactor;
            field = roofRatio * (load / (ramp || 1));
            break;
        }
        case 'megas-thermal': {
            const heat = ramp * (0.75 + 0.25 * Math.sin(seconds * 1.5));
            dx = x * heat * 0.15 * roofRatio;
            dz = z * heat * 0.15 * roofRatio;
            // Solar thermal load from above pushing downward on screen into structure, base pinned:
            dy = heat * 0.28 * roofFactor;
            field = roofRatio;
            break;
        }
        case 'plant-wilting': {
            dx = ramp * 0.2 * roofFactor;
            // Wilts downward on screen from top under gravity load, base pinned:
            dy = ramp * (0.35 * roofFactor + (x * x + z * z) * roofRatio * 0.15);
            dz = ramp * 0.04 * roofFactor;
            field = roofRatio * ramp;
            break;
        }
        case 'diffwind-aerodynamics': {
            const wind = Math.sin(seconds * 2.1) + 0.3 * Math.sin(seconds * 4.7 + y * 3);
            dx = ramp * 0.18 * roofFactor * wind;
            dz = ramp * 0.04 * roofFactor * Math.sin(seconds * 2.8 + y * 4);
            // Downward aerodynamic downforce from above:
            dy = Math.abs(wind) * ramp * 0.18 * roofFactor;
            field = roofRatio * Math.abs(wind) * ramp;
            break;
        }
        case 'physskin-deformation': {
            const angle = ramp * roofRatio * 0.4 * Math.sin(seconds * 1.7);
            dx = (x * (Math.cos(angle) - 1) - z * Math.sin(angle)) * roofRatio;
            dz = (x * Math.sin(angle) + z * (Math.cos(angle) - 1)) * roofRatio;
            // Elastic compression from top down:
            dy = ramp * 0.22 * roofFactor * Math.abs(Math.sin(seconds * 1.7));
            field = roofRatio * ramp;
            break;
        }
        case 'magnetic-mpm': {
            const mx = 0.55 * Math.cos(seconds * 0.65), mz = 0.55 * Math.sin(seconds * 0.65);
            const falloff = 1 / (1 + 6 * ((x - mx) ** 2 + (z - mz) ** 2 + (y - 0.2) ** 2));
            dx = ramp * roofFactor * falloff * (mx - x) * 0.35;
            dz = ramp * roofFactor * falloff * (mz - z) * 0.35;
            // Magnetic pressure pressing downward on screen from top:
            dy = ramp * roofFactor * falloff * 0.3;
            field = roofRatio * falloff * ramp;
            break;
        }
        case 'enlivening-gs': {
            const phase = seconds * 3;
            const press = Math.max(0, Math.sin(phase));
            // Cyclic downward compression from top:
            dy = ramp * press * 0.25 * roofFactor;
            dx = ramp * x * 0.08 * press * roofRatio;
            dz = ramp * z * 0.08 * press * roofRatio;
            field = roofRatio * ramp;
            break;
        }
        // Fracture uses persistent rest-space Voronoi membership, handled below.
        case 'voronoi-fracture': break;
    }
    out.set(point.x + dx * h, point.y + dy * h, point.z + dz * h);
    return clamp(field, 0, 1);
}
/** Packed symmetric covariance order: xx, xy, xz, yy, yz, zz. */
export function transportSplatCovariance(rest, offset, f, output) {
    const xx = rest[offset], xy = rest[offset + 1], xz = rest[offset + 2];
    const yy = rest[offset + 3], yz = rest[offset + 4], zz = rest[offset + 5];
    const a = f[0], b = f[1], c = f[2], d = f[4], e = f[5], g = f[6];
    const j = f[8], k = f[9], l = f[10];
    const ax = a * xx + b * xy + c * xz, ay = a * xy + b * yy + c * yz, az = a * xz + b * yz + c * zz;
    const bx = d * xx + e * xy + g * xz, by = d * xy + e * yy + g * yz, bz = d * xz + e * yz + g * zz;
    const cx = j * xx + k * xy + l * xz, cy = j * xy + k * yy + l * yz, cz = j * xz + k * yz + l * zz;
    output[offset] = ax * a + ay * b + az * c;
    output[offset + 1] = ax * d + ay * e + az * g;
    output[offset + 2] = ax * j + ay * k + az * l;
    output[offset + 3] = bx * d + by * e + bz * g;
    output[offset + 4] = bx * j + by * k + bz * l;
    output[offset + 5] = cx * j + cy * k + cz * l;
}
export function createSplatPhysicsSession(viewer, mode, worldTransform = new THREE.Matrix4()) {
    const mesh = viewer.splatMesh, textures = mesh.splatDataTextures;
    const count = mesh.getSplatCount();
    if (!textures || !count || textures.covariances?.compressionLevel !== 0
        || !(textures.baseData?.centers instanceof Float32Array)
        || textures.baseData.centers.length < count * 3
        || textures.baseData.covariances.length < count * 6)
        return null;
    const base = textures.baseData;
    const rest = base.centers.slice(0, count * 3);
    const restCov = base.covariances.slice(0, count * 6);
    const restColors = base.colors.slice(0, count * 4);
    const originalCenterTexture = textures.centerColors.data.slice();
    const originalCovTexture = textures.covariances.data.slice();
    const sceneIndexes = new Uint32Array(count);
    const sceneMatrices = new Map();
    const inverseMatrices = new Map();
    const world = new Float32Array(count * 3);
    const point = new THREE.Vector3();
    const bounds = new THREE.Box3();
    const samples = [[], [], []];
    const stride = Math.max(1, Math.floor(count / 12000));
    for (let i = 0; i < count; i++) {
        const si = mesh.getSceneIndexForSplat?.(i) ?? 0;
        sceneIndexes[i] = si;
        if (!sceneMatrices.has(si)) {
            const matrix = worldTransform.clone().multiply(mesh.getScene?.(si)?.transform ?? new THREE.Matrix4());
            sceneMatrices.set(si, matrix);
            inverseMatrices.set(si, matrix.clone().invert());
        }
        point.fromArray(rest, i * 3).applyMatrix4(sceneMatrices.get(si));
        point.toArray(world, i * 3);
        if (i % stride === 0 && restColors[i * 4 + 3] > 8 && Number.isFinite(point.lengthSq())) {
            samples[0].push(point.x);
            samples[1].push(point.y);
            samples[2].push(point.z);
        }
    }
    if (!samples[0].length)
        return null;
    // Robust bounds keep distant faint floaters from setting the effect scale.
    samples.forEach(values => values.sort((a, b) => a - b));
    bounds.min.set(...samples.map(values => values[Math.floor((values.length - 1) * 0.01)]));
    bounds.max.set(...samples.map(values => values[Math.floor((values.length - 1) * 0.99)]));
    const size = bounds.getSize(new THREE.Vector3()).max(new THREE.Vector3(0.001, 0.001, 0.001));
    const center = bounds.getCenter(new THREE.Vector3());
    const normalizedHeights = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        normalizedHeights[i] = clamp((world[i * 3 + 1] - bounds.min.y) / size.y, 0, 1);
    }
    const seeds = Array.from({ length: 24 }, (_, i) => new THREE.Vector3(bounds.min.x + size.x * ((i * 0.61803398875 + 0.13) % 1), bounds.min.y + size.y * ((i * 0.41421356237 + 0.31) % 1), bounds.min.z + size.z * ((i * 0.73205080757 + 0.47) % 1)));
    const bindings = [];
    const cells = new Map();
    const ids = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
        point.fromArray(world, i * 3);
        const coords = [point.x, point.y, point.z].map((v, axis) => clamp(Math.floor((v - bounds.min.getComponent(axis)) / size.getComponent(axis) * GRID), 0, GRID - 1));
        let seed = 0;
        if (mode === 'voronoi-fracture') {
            let nearest = Infinity;
            seeds.forEach((s, index) => { const d = s.distanceToSquared(point); if (d < nearest) {
                nearest = d;
                seed = index;
            } });
        }
        const key = `${sceneIndexes[i]}:${mode === 'voronoi-fracture' ? seed : coords.join(':')}`;
        let id = cells.get(key);
        if (id === undefined) {
            id = bindings.length;
            cells.set(key, id);
            const p = mode === 'voronoi-fracture' ? seeds[seed].clone() : new THREE.Vector3(bounds.min.x + (coords[0] + 0.5) / GRID * size.x, bounds.min.y + (coords[1] + 0.5) / GRID * size.y, bounds.min.z + (coords[2] + 0.5) / GRID * size.z);
            bindings.push({ point: p, sceneIndex: sceneIndexes[i], affine: new Float32Array(12), field: 0 });
        }
        ids[i] = id;
    }
    const packedCenterBits = new Uint32Array(base.centers.buffer, base.centers.byteOffset, base.centers.length);
    const integerSort = viewer.integerBasedSort === true;
    const sortCenters = integerSort ? new Int32Array(count * 4) : new Float32Array(count * 4);
    const originalTree = mesh.getSplatTree;
    mesh.getSplatTree = () => null; // Rest-space culling is invalid after deformation.
    const affineWorld = new THREE.Matrix4(), local = new THREE.Matrix4();
    const f = new THREE.Matrix3(), phi = new THREE.Vector3(), shifted = new THREE.Vector3(), derivative = new THREE.Vector3();
    const delta = Math.max(size.length() * 0.0001, 1e-6);
    const isField = isSplatFieldMode(mode);
    const upload = () => {
        for (let i = 0; i < count; i++) {
            const offset = i * 4;
            for (let axis = 0; axis < 3; axis++) {
                textures.centerColors.data[offset + 1 + axis] = packedCenterBits[i * 3 + axis];
                const value = base.centers[i * 3 + axis];
                sortCenters[offset + axis] = integerSort ? Math.round(value * 1000) : value;
            }
            sortCenters[offset + 3] = integerSort ? 1000 : 1;
            textures.centerColors.data[offset] = (base.colors[offset] | (base.colors[offset + 1] << 8)
                | (base.colors[offset + 2] << 16) | (base.colors[offset + 3] << 24)) >>> 0;
        }
        if (!isField) {
            textures.covariances.data.set(base.covariances.subarray(0, count * 6));
            textures.covariances.texture.needsUpdate = true;
        }
        textures.centerColors.texture.needsUpdate = true;
        // Match the renderer's integer/float worker protocol and preserve layer IDs.
        viewer.sortWorker?.postMessage({ centers: sortCenters.buffer, sceneIndexes: sceneIndexes.buffer, range: { from: 0, count } });
        void viewer.runSplatSort?.(true, true);
        viewer.forceRenderNextFrame?.();
    };
    let disposed = false;
    return {
        count,
        update(seconds, strength, showHeatmap = true) {
            if (disposed || mesh.splatDataTextures !== textures || mesh.getSplatCount() !== count)
                return false;
            const amount = clamp(Number.isFinite(strength) ? strength : 0, 0, 1);
            for (const binding of bindings) {
                const q = binding.point;
                if (mode === 'voronoi-fracture') {
                    const separation = amount * (1 - Math.exp(-seconds * 0.7)) * 0.4;
                    phi.copy(q).addScaledVector(shifted.copy(q).sub(center), separation);
                    f.identity();
                    binding.field = separation;
                }
                else {
                    binding.field = evaluateSplatField(mode, q, bounds, seconds, amount, phi);
                    for (let axis = 0; axis < 3; axis++) {
                        shifted.copy(q).setComponent(axis, q.getComponent(axis) + delta);
                        evaluateSplatField(mode, shifted, bounds, seconds, amount, derivative);
                        derivative.sub(phi).multiplyScalar(1 / delta);
                        derivative.toArray(f.elements, axis * 3);
                    }
                }
                shifted.copy(q).applyMatrix3(f);
                const e = f.elements;
                affineWorld.set(e[0], e[3], e[6], phi.x - shifted.x, e[1], e[4], e[7], phi.y - shifted.y, e[2], e[5], e[8], phi.z - shifted.z, 0, 0, 0, 1);
                local.copy(inverseMatrices.get(binding.sceneIndex)).multiply(affineWorld).multiply(sceneMatrices.get(binding.sceneIndex));
                const m = local.elements;
                binding.affine.set([m[0], m[4], m[8], m[12], m[1], m[5], m[9], m[13], m[2], m[6], m[10], m[14]]);
            }
            const fieldRamp = amount * (1 - Math.exp(-seconds * 1.3));
            const compressionLoad = fieldRamp * (0.8 + 0.2 * Math.sin(seconds * 1.8));
            const useFieldColors = showHeatmap && isField;
            for (let i = 0; i < count; i++) {
                const binding = bindings[ids[i]], a = binding.affine, offset = i * 3;
                const x = rest[offset], y = rest[offset + 1], z = rest[offset + 2];
                base.centers[offset] = a[0] * x + a[1] * y + a[2] * z + a[3];
                base.centers[offset + 1] = a[4] * x + a[5] * y + a[6] * z + a[7];
                base.centers[offset + 2] = a[8] * x + a[9] * y + a[10] * z + a[11];
                if (!isField) {
                    transportSplatCovariance(restCov, i * 6, a, base.covariances);
                }
                const colorOffset = i * 4;
                if (useFieldColors) {
                    // In 3DGS local space (Math.PI X-rotation): normalizedHeights = 0.0 is ROOF (top), 1.0 is FEET (bottom)
                    // roofRatio: 1.0 at physical ROOF (RED), transitioning down through YELLOW, GREEN, CYAN to 0.0 at FEET (BLUE)
                    const roofRatio = clamp(1.0 - normalizedHeights[i], 0, 1);
                    const intensity = fieldRamp > 0.01 ? clamp(fieldRamp / Math.max(strength, 0.01), 0, 1) : 0;
                    let value;
                    if (mode === 'stress-analysis') {
                        const normalizedLoad = fieldRamp > 0.01 ? (compressionLoad / 0.8) : 0;
                        value = clamp(Math.pow(roofRatio, 0.85) * (normalizedLoad || 0.95), 0, 1);
                    } else {
                        // Thermal or other field mode: Top roof is hottest (Red), diffusing down through yellow and cyan to cool blue at base
                        const shimmer = 0.95 + 0.05 * Math.sin(seconds * 1.5);
                        value = clamp(Math.pow(roofRatio, 0.85) * (intensity || 1.0) * shimmer, 0, 1);
                    }
                    writeSplatFieldColor(value, base.colors, colorOffset);
                }
                else {
                    base.colors[colorOffset] = restColors[colorOffset];
                    base.colors[colorOffset + 1] = restColors[colorOffset + 1];
                    base.colors[colorOffset + 2] = restColors[colorOffset + 2];
                }
            }
            upload();
            return true;
        },
        dispose() {
            if (disposed)
                return;
            disposed = true;
            mesh.getSplatTree = originalTree;
            if (mesh.splatDataTextures !== textures || mesh.getSplatCount() !== count)
                return;
            base.centers.set(rest);
            base.covariances.set(restCov);
            base.colors.set(restColors);
            upload();
            textures.centerColors.data.set(originalCenterTexture);
            textures.covariances.data.set(originalCovTexture);
        },
    };
}
