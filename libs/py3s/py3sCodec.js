const PY3S_HEADER_MAGIC = "PY3S";
const PY3S_HEADER_SIZE = 128;
const PY3S_VERSION_MAJOR = 2;
const PY3S_VERSION_MINOR = 0;
const PY3S_FLAG_NONE = 0;
const PY3S_FLAG_SPZ_ZSTD = 1;
const PY3S_FLAG_COLLIDER_GLB = 2;
const PY3S_FLAG_COLLIDER_FBX = 4;
const PY3S_FLAG_PRINT_3MF = 8;
const PY3S_FLAG_SIM_STRESS = 16;
const PY3S_FLAG_SIM_VORONOI_CRACK = 32;
const PY3S_FLAG_SIM_MEGAS_THERMAL = 64;
const PY3S_FLAG_SIM_PLANT_WILTING = 128;
const PY3S_FLAG_SIM_DIFFWIND = 256;
const PY3S_FLAG_SIM_PHYSSKIN = 512;
const PY3S_FLAG_SIM_MAGNETIC_MPM = 1024;
const PY3S_FLAG_SIM_ENLIVENING_GS = 2048;
const PY3S_FLAG_MFG_PRINT3D_READY = 4096;
const PY3S_FLAG_AI_SYSTEM_PROMPT = 8192;
const PY3S_FLAG_STATE_DEHYDRATED_SEED = 16384;
const PY3S_FLAG_AUTO_HYDRATE_ON_MOUNT = 32768;
const PY3S_FLAG_HANUMAN_PARAMETRIC_AI = 65536;
const PY3S_FLAG_INTEGRITY_CRC32 = 131072;
const PY3S_FLAG_COLLIDER_CONVEX = 262144;
const PY3S_FLAG_SECURITY_HMAC = 524288;
const PY3S_MAX_METADATA_BYTES = 8 * 1024 * 1024;
const PY3S_MAX_METADATA_DEPTH = 24;
const PY3S_MAX_ZIP_ARCHIVE_BYTES = 128 * 1024 * 1024;
const PY3S_MAX_ZIP_ENTRIES = 256;
const PY3S_MAX_ZIP_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const PY3S_MAX_ZIP_RATIO = 100;
const CRC32_CHECKSUM_FIELD_OFFSET = 96;
const CRC32_CHECKSUM_FIELD_LENGTH = 8;
const HMAC_TAG_OFFSET = 104;
const HMAC_TAG_LENGTH = 24;
const DANGEROUS_OBJECT_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) !== 0 ? 3988292384 ^ crc >>> 1 : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();
function updateCrc32(crc, bytes, start = 0, end = bytes.byteLength) {
  let current = crc;
  for (let i = start; i < end; i++) {
    current = CRC32_TABLE[(current ^ bytes[i]) & 255] ^ current >>> 8;
  }
  return current;
}
function computePy3sCrc32(bytes) {
  return (updateCrc32(4294967295, bytes) ^ 4294967295) >>> 0;
}
function computeContainerCrc32(bytes) {
  let crc = updateCrc32(4294967295, bytes, 0, CRC32_CHECKSUM_FIELD_OFFSET);
  for (let i = 0; i < CRC32_CHECKSUM_FIELD_LENGTH; i++) {
    crc = CRC32_TABLE[crc & 255] ^ crc >>> 8;
  }
  crc = updateCrc32(crc, bytes, CRC32_CHECKSUM_FIELD_OFFSET + CRC32_CHECKSUM_FIELD_LENGTH, bytes.byteLength);
  return (crc ^ 4294967295) >>> 0;
}
function sanitizeMetadataValue(value, depth = 0) {
  if (depth > PY3S_MAX_METADATA_DEPTH) {
    throw new Error("PY3S metadata exceeds maximum nesting depth");
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item, depth + 1));
  }
  const source = value;
  const clean = {};
  for (const key of Object.keys(source)) {
    if (DANGEROUS_OBJECT_KEYS.has(key)) continue;
    Object.defineProperty(clean, key, {
      value: sanitizeMetadataValue(source[key], depth + 1),
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  return clean;
}
function normalizeSecretKeyBytes(secretKey) {
  const keyBytes = typeof secretKey === "string" ? new TextEncoder().encode(secretKey) : secretKey;
  if (!keyBytes.byteLength) {
    throw new Error("PY3S HMAC secret key cannot be empty");
  }
  return new Uint8Array(keyBytes);
}
async function computeHmacTagBytes(containerBytes, secretKey) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle API is unavailable for PY3S HMAC verification");
  }
  const keyBytes = normalizeSecretKeyBytes(secretKey);
  const keyBuffer = new Uint8Array(keyBytes).buffer;
  const cryptoKey = await subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signingInput = new Uint8Array(containerBytes);
  signingInput.fill(0, CRC32_CHECKSUM_FIELD_OFFSET, PY3S_HEADER_SIZE);
  const sigBuffer = await subtle.sign("HMAC", cryptoKey, signingInput.buffer);
  return new Uint8Array(sigBuffer, 0, HMAC_TAG_LENGTH);
}
function constantTimeEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
function validateSafeZipBytes(bytes) {
  if (bytes.byteLength < 22 || bytes.byteLength > PY3S_MAX_ZIP_ARCHIVE_BYTES) {
    throw new Error(`Invalid or oversized Print 3D ZIP archive (${bytes.byteLength} bytes)`);
  }
  if (bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4) {
    throw new Error("Print 3D payload is not a valid ZIP archive");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const searchFloor = Math.max(0, bytes.byteLength - 22 - 65535);
  let eocdOffset = -1;
  for (let i = bytes.byteLength - 22; i >= searchFloor; i--) {
    if (view.getUint32(i, true) === 101010256) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("Print 3D ZIP missing End of Central Directory record");
  }
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  if (totalEntries === 65535 || cdOffset === 4294967295 || cdSize === 4294967295) {
    throw new Error("ZIP64 Print 3D archives are rejected for security bounds enforcement");
  }
  if (totalEntries > PY3S_MAX_ZIP_ENTRIES) {
    throw new Error(`Print 3D archive exceeds maximum entry limit (${totalEntries} > ${PY3S_MAX_ZIP_ENTRIES})`);
  }
  if (cdOffset > bytes.byteLength || cdSize > bytes.byteLength - cdOffset) {
    throw new Error("Print 3D ZIP Central Directory exceeds buffer bounds");
  }
  const textDecoder = new TextDecoder("utf-8");
  let cursor = cdOffset;
  let totalUncompressed = 0;
  for (let idx = 0; idx < totalEntries; idx++) {
    if (cursor + 46 > cdOffset + cdSize || view.getUint32(cursor, true) !== 33639248) {
      throw new Error("Corrupted Print 3D ZIP Central Directory entry");
    }
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const entrySize = 46 + nameLen + extraLen + commentLen;
    if (cursor + entrySize > cdOffset + cdSize) {
      throw new Error("Truncated Print 3D ZIP entry header");
    }
    const entryName = textDecoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    if (!entryName || entryName.includes("\0") || entryName.startsWith("/") || entryName.startsWith("\\") || /^[A-Za-z]:/.test(entryName) || /(?:^|[\\/])\.\.(?:$|[\\/])/.test(entryName)) {
      throw new Error(`Rejected unsafe path inside Print 3D ZIP: ${entryName}`);
    }
    if (uncompressedSize > 10 * 1024 * 1024 && uncompressedSize / Math.max(1, compressedSize) > PY3S_MAX_ZIP_RATIO) {
      throw new Error(`Rejected suspected Zip Bomb entry inside Print 3D archive: ${entryName}`);
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > PY3S_MAX_ZIP_UNCOMPRESSED_BYTES) {
      throw new Error("Print 3D archive exceeds maximum safe uncompressed byte limit");
    }
    cursor += entrySize;
  }
}
function isPy3sBuffer(buf) {
  if (!buf) return false;
  const byteLength = "byteLength" in buf ? buf.byteLength : 0;
  if (byteLength < 4) return false;
  const uint8 = "buffer" in buf ? new Uint8Array(buf.buffer, buf.byteOffset, Math.min(4, buf.byteLength)) : new Uint8Array(buf.slice(0, 4));
  return uint8[0] === 80 && uint8[1] === 89 && uint8[2] === 51 && uint8[3] === 83;
}
function hasV2FeatureFields(metadata) {
  return Boolean(
    metadata.physSkin || metadata.phys_skin || metadata.magneticMpm || metadata.magnetic_mpm || metadata.enliveningGs || metadata.enlivening_gs || metadata.stress || metadata.stressSimulation || metadata.voronoi || metadata.fractureEngine || metadata.thermal || metadata.megas || metadata.thermalDynamics || metadata.wilting || metadata.biologicalSimulation || metadata.diffwind || metadata.aiAgentContext || metadata.hanumanParametric || metadata.isSeed || metadata.dehydrated || metadata.telemetryProfile
  );
}
function resolveFlags(data, enableIntegrityChecksum) {
  const meta = data.metadata;
  const isFbx = meta.collision?.format?.toLowerCase() === "fbx";
  let flags = PY3S_FLAG_SPZ_ZSTD | (isFbx ? PY3S_FLAG_COLLIDER_FBX : PY3S_FLAG_COLLIDER_GLB);
  const printBytes = data.print3mfData;
  if (printBytes && printBytes.byteLength > 0) {
    flags |= PY3S_FLAG_PRINT_3MF | PY3S_FLAG_MFG_PRINT3D_READY;
  }
  if (meta.collision?.type && /convex|coacd/i.test(meta.collision.type)) {
    flags |= PY3S_FLAG_COLLIDER_CONVEX;
  }
  if (meta.stress || meta.stressSimulation) flags |= PY3S_FLAG_SIM_STRESS;
  if (meta.voronoi || meta.fractureEngine) flags |= PY3S_FLAG_SIM_VORONOI_CRACK;
  if (meta.thermal || meta.megas || meta.thermalDynamics) flags |= PY3S_FLAG_SIM_MEGAS_THERMAL;
  if (meta.wilting || meta.biologicalSimulation) flags |= PY3S_FLAG_SIM_PLANT_WILTING;
  if (meta.diffwind) flags |= PY3S_FLAG_SIM_DIFFWIND;
  if (meta.physSkin || meta.phys_skin) flags |= PY3S_FLAG_SIM_PHYSSKIN;
  if (meta.magneticMpm || meta.magnetic_mpm) flags |= PY3S_FLAG_SIM_MAGNETIC_MPM;
  if (meta.enliveningGs || meta.enlivening_gs) flags |= PY3S_FLAG_SIM_ENLIVENING_GS;
  if (meta.manufacturing || meta.print3d || meta.printing || meta.printProfile) flags |= PY3S_FLAG_MFG_PRINT3D_READY;
  if (meta.systemPrompt || meta.agentPrompt || meta.aiAgentContext) flags |= PY3S_FLAG_AI_SYSTEM_PROMPT;
  if (meta.isSeed || meta.dehydrated || meta.telemetryProfile?.isDehydratedSeed) {
    flags |= PY3S_FLAG_STATE_DEHYDRATED_SEED | PY3S_FLAG_AUTO_HYDRATE_ON_MOUNT;
  }
  if (meta.hanumanParametric || meta.aiAgentContext?.orchestratedBy) {
    flags |= PY3S_FLAG_HANUMAN_PARAMETRIC_AI;
  }
  if (enableIntegrityChecksum) {
    flags |= PY3S_FLAG_INTEGRITY_CRC32;
  }
  return flags >>> 0;
}
class Py3sCodec {
  /**
   * Inspects the 128-byte binary header without decoding JSON metadata.
   */
  static inspectHeader(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.byteLength < PY3S_HEADER_SIZE) {
      throw new Error(`Invalid PY3S buffer: size ${bytes.byteLength} < ${PY3S_HEADER_SIZE}`);
    }
    if (bytes[0] !== 80 || bytes[1] !== 89 || bytes[2] !== 51 || bytes[3] !== 83) {
      throw new Error("Not a valid PY3S container (header magic mismatch)");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const versionMajor = view.getUint16(4, true);
    if (versionMajor > PY3S_VERSION_MAJOR) {
      throw new Error(`Unsupported PY3S version: ${versionMajor} > ${PY3S_VERSION_MAJOR}`);
    }
    const versionMinor = view.getUint16(6, true);
    const sectionCount = view.getUint32(8, true);
    const flags = view.getUint32(12, true);
    const hasPrint = (flags & PY3S_FLAG_PRINT_3MF) !== 0;
    const hasIntegrityChecksum = (flags & PY3S_FLAG_INTEGRITY_CRC32) !== 0;
    const hasSecuritySignature = (flags & PY3S_FLAG_SECURITY_HMAC) !== 0;
    return {
      versionMajor,
      versionMinor,
      sectionCount,
      flags,
      hasIntegrityChecksum,
      hasSecuritySignature,
      containerCrc32: hasIntegrityChecksum ? view.getUint32(CRC32_CHECKSUM_FIELD_OFFSET, true) : 0,
      print3mfCrc32: hasIntegrityChecksum ? view.getUint32(CRC32_CHECKSUM_FIELD_OFFSET + 4, true) : 0,
      sections: {
        spz: { offset: Number(view.getBigUint64(16, true)), size: Number(view.getBigUint64(24, true)) },
        collider: { offset: Number(view.getBigUint64(32, true)), size: Number(view.getBigUint64(40, true)) },
        metadata: { offset: Number(view.getBigUint64(48, true)), size: Number(view.getBigUint64(56, true)) },
        thumbnail: { offset: Number(view.getBigUint64(64, true)), size: Number(view.getBigUint64(72, true)) },
        print3mf: {
          offset: hasPrint ? Number(view.getBigUint64(80, true)) : 0,
          size: hasPrint ? Number(view.getBigUint64(88, true)) : 0
        }
      }
    };
  }
  /**
   * Packs SPZ, Collider, Metadata, optional Thumbnail and optional Print 3MF into a .py3s container.
   * Defaults to v2.0 with CRC-32 integrity checksums when metadata declares v2.x or v2 features;
   * preserves v1.0 / v1.1 header versions when explicitly tagged for legacy compatibility.
   */
  static pack(data, options) {
    const textEncoder = new TextEncoder();
    const metaBytes = textEncoder.encode(JSON.stringify(data.metadata));
    if (metaBytes.byteLength > PY3S_MAX_METADATA_BYTES) {
      throw new Error(`PY3S metadata exceeds maximum limit (${metaBytes.byteLength} > ${PY3S_MAX_METADATA_BYTES})`);
    }
    const spzBytes = data.spzData;
    const colliderBytes = data.colliderData ?? new Uint8Array(0);
    const thumbBytes = data.thumbnailData ?? new Uint8Array(0);
    const printBytes = data.print3mfData ?? new Uint8Array(0);
    const versionString = data.metadata.version || "";
    const isExplicitV1 = /^1\./.test(versionString) && !hasV2FeatureFields(data.metadata) && options?.integrityChecksum !== true;
    const isV2 = !isExplicitV1;
    const versionMajor = isV2 ? PY3S_VERSION_MAJOR : 1;
    const versionMinor = isV2 ? PY3S_VERSION_MINOR : printBytes.byteLength > 0 ? 1 : 0;
    const enableIntegrity = options?.integrityChecksum ?? isV2;
    let currentOffset = PY3S_HEADER_SIZE;
    const spzOffset = BigInt(currentOffset);
    const spzSize = BigInt(spzBytes.byteLength);
    currentOffset += spzBytes.byteLength;
    const colOffset = BigInt(currentOffset);
    const colSize = BigInt(colliderBytes.byteLength);
    currentOffset += colliderBytes.byteLength;
    const metaOffset = BigInt(currentOffset);
    const metaSize = BigInt(metaBytes.byteLength);
    currentOffset += metaBytes.byteLength;
    let thumbOffset = BigInt(0);
    let thumbSize = BigInt(0);
    let sectionCount = 3;
    if (thumbBytes.byteLength > 0) {
      thumbOffset = BigInt(currentOffset);
      thumbSize = BigInt(thumbBytes.byteLength);
      currentOffset += thumbBytes.byteLength;
      sectionCount = 4;
    }
    const printOffset = printBytes.byteLength ? currentOffset : 0;
    currentOffset += printBytes.byteLength;
    if (printBytes.byteLength) sectionCount += 1;
    const totalSize = currentOffset;
    const output = new Uint8Array(totalSize);
    const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
    output[0] = 80;
    output[1] = 89;
    output[2] = 51;
    output[3] = 83;
    view.setUint16(4, versionMajor, true);
    view.setUint16(6, versionMinor, true);
    view.setUint32(8, sectionCount, true);
    const flags = resolveFlags(data, enableIntegrity);
    view.setUint32(12, flags, true);
    view.setBigUint64(16, spzOffset, true);
    view.setBigUint64(24, spzSize, true);
    view.setBigUint64(32, colOffset, true);
    view.setBigUint64(40, colSize, true);
    view.setBigUint64(48, metaOffset, true);
    view.setBigUint64(56, metaSize, true);
    view.setBigUint64(64, thumbOffset, true);
    view.setBigUint64(72, thumbSize, true);
    view.setBigUint64(80, BigInt(printOffset), true);
    view.setBigUint64(88, BigInt(printBytes.byteLength), true);
    if (spzBytes.byteLength > 0) {
      output.set(spzBytes, Number(spzOffset));
    }
    if (colliderBytes.byteLength > 0) {
      output.set(colliderBytes, Number(colOffset));
    }
    if (metaBytes.byteLength > 0) {
      output.set(metaBytes, Number(metaOffset));
    }
    if (thumbBytes.byteLength > 0) {
      output.set(thumbBytes, Number(thumbOffset));
    }
    if (printBytes.byteLength > 0) {
      output.set(printBytes, printOffset);
    }
    if (enableIntegrity) {
      const containerCrc = computeContainerCrc32(output);
      const printCrc = printBytes.byteLength > 0 ? computePy3sCrc32(printBytes) : 0;
      view.setUint32(CRC32_CHECKSUM_FIELD_OFFSET, containerCrc, true);
      view.setUint32(CRC32_CHECKSUM_FIELD_OFFSET + 4, printCrc, true);
    }
    return output;
  }
  /**
   * Unpacks and validates a .py3s container (supports v1.0, v1.1, and v2.0 with CRC-32 verification).
   */
  static unpack(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const header = Py3sCodec.inspectHeader(bytes);
    const {
      flags,
      hasIntegrityChecksum,
      containerCrc32,
      print3mfCrc32,
      sections: { spz, collider, metadata: metaSec, thumbnail, print3mf }
    } = header;
    const sectionPairs = [
      [spz.offset, spz.size],
      [collider.offset, collider.size],
      [metaSec.offset, metaSec.size],
      [thumbnail.offset, thumbnail.size],
      [print3mf.offset, print3mf.size]
    ];
    const occupied = [];
    for (const [offset, size] of sectionPairs) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || size < 0 || size > 0 && (offset < PY3S_HEADER_SIZE || offset > bytes.byteLength - size)) {
        throw new Error("Invalid PY3S section range");
      }
      if (size > 0) occupied.push([offset, offset + size]);
    }
    occupied.sort((a, b) => a[0] - b[0]);
    if (occupied.some((range, i) => i > 0 && range[0] < occupied[i - 1][1])) {
      throw new Error("Overlapping PY3S sections");
    }
    const hasPrint = (flags & PY3S_FLAG_PRINT_3MF) !== 0;
    if (hasPrint && !print3mf.size) throw new Error("Missing PY3S print payload");
    if (hasIntegrityChecksum) {
      const actualContainerCrc = computeContainerCrc32(bytes);
      if (actualContainerCrc !== containerCrc32) {
        throw new Error("PY3S integrity check failed: container CRC32 mismatch");
      }
    }
    const spzData = bytes.slice(spz.offset, spz.offset + spz.size);
    const colliderData = collider.size > 0 ? bytes.slice(collider.offset, collider.offset + collider.size) : void 0;
    let metadata;
    if (metaSec.size > 0) {
      if (metaSec.size > PY3S_MAX_METADATA_BYTES) {
        throw new Error(`PY3S metadata exceeds maximum safe size (${metaSec.size} > ${PY3S_MAX_METADATA_BYTES})`);
      }
      const metaBytes = bytes.slice(metaSec.offset, metaSec.offset + metaSec.size);
      const textDecoder = new TextDecoder("utf-8");
      metadata = sanitizeMetadataValue(JSON.parse(textDecoder.decode(metaBytes)));
    } else {
      metadata = {
        format: "py3s",
        version: "1.0.0",
        asset: { name: "unnamed" }
      };
    }
    const thumbnailData = thumbnail.size > 0 && thumbnail.offset > 0 ? bytes.slice(thumbnail.offset, thumbnail.offset + thumbnail.size) : void 0;
    const print3mfData = print3mf.size ? bytes.slice(print3mf.offset, print3mf.offset + print3mf.size) : void 0;
    if (hasIntegrityChecksum && print3mfData && computePy3sCrc32(print3mfData) !== print3mfCrc32) {
      throw new Error("PY3S integrity check failed: Print 3D payload CRC32 mismatch");
    }
    return {
      spzData,
      colliderData,
      metadata,
      thumbnailData,
      print3mfData
    };
  }
  /**
   * Signs a valid .py3s buffer with a 192-bit HMAC-SHA256 tag (stored at header 0x68..0x7F)
   * and updates its CRC-32 header checksum so unauthenticated readers can still verify CRC-32.
   */
  static async signContainer(buffer, secretKey) {
    const input = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    Py3sCodec.unpack(input);
    const signed = new Uint8Array(input);
    const view = new DataView(signed.buffer, signed.byteOffset, signed.byteLength);
    const updatedFlags = (view.getUint32(12, true) | PY3S_FLAG_SECURITY_HMAC) >>> 0;
    view.setUint32(12, updatedFlags, true);
    const tag = await computeHmacTagBytes(signed, secretKey);
    signed.set(tag, HMAC_TAG_OFFSET);
    if ((updatedFlags & PY3S_FLAG_INTEGRITY_CRC32) !== 0) {
      view.setUint32(CRC32_CHECKSUM_FIELD_OFFSET, computeContainerCrc32(signed), true);
    }
    return signed;
  }
  /**
   * Verifies the 192-bit HMAC-SHA256 signature and header/payload integrity.
   */
  static async verifySignature(buffer, secretKey) {
    try {
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const header = Py3sCodec.inspectHeader(bytes);
      if (!header.hasSecuritySignature) {
        return false;
      }
      Py3sCodec.unpack(bytes);
      const expectedTag = await computeHmacTagBytes(bytes, secretKey);
      const actualTag = bytes.subarray(HMAC_TAG_OFFSET, HMAC_TAG_OFFSET + HMAC_TAG_LENGTH);
      return constantTimeEqual(actualTag, expectedTag);
    } catch {
      return false;
    }
  }
  /**
   * Convenience helper: packs a v2.0 container with CRC-32 enabled and stamps an HMAC-SHA256 signature.
   */
  static async packSigned(data, secretKey, options) {
    const packed = Py3sCodec.pack(data, { integrityChecksum: true, ...options });
    return Py3sCodec.signContainer(packed, secretKey);
  }
  /**
   * Unpacks a .py3s container only after cryptographic HMAC-SHA256 verification succeeds.
   */
  static async unpackVerified(buffer, secretKey) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const isValid = await Py3sCodec.verifySignature(bytes, secretKey);
    if (!isValid) {
      throw new Error("PY3S security verification failed: invalid or missing HMAC signature");
    }
    return Py3sCodec.unpack(bytes);
  }
}
export {
  PY3S_FLAG_AI_SYSTEM_PROMPT,
  PY3S_FLAG_AUTO_HYDRATE_ON_MOUNT,
  PY3S_FLAG_COLLIDER_CONVEX,
  PY3S_FLAG_COLLIDER_FBX,
  PY3S_FLAG_COLLIDER_GLB,
  PY3S_FLAG_HANUMAN_PARAMETRIC_AI,
  PY3S_FLAG_INTEGRITY_CRC32,
  PY3S_FLAG_MFG_PRINT3D_READY,
  PY3S_FLAG_NONE,
  PY3S_FLAG_PRINT_3MF,
  PY3S_FLAG_SECURITY_HMAC,
  PY3S_FLAG_SIM_DIFFWIND,
  PY3S_FLAG_SIM_ENLIVENING_GS,
  PY3S_FLAG_SIM_MAGNETIC_MPM,
  PY3S_FLAG_SIM_MEGAS_THERMAL,
  PY3S_FLAG_SIM_PHYSSKIN,
  PY3S_FLAG_SIM_PLANT_WILTING,
  PY3S_FLAG_SIM_STRESS,
  PY3S_FLAG_SIM_VORONOI_CRACK,
  PY3S_FLAG_SPZ_ZSTD,
  PY3S_FLAG_STATE_DEHYDRATED_SEED,
  PY3S_HEADER_MAGIC,
  PY3S_HEADER_SIZE,
  PY3S_MAX_METADATA_BYTES,
  PY3S_MAX_METADATA_DEPTH,
  PY3S_MAX_ZIP_ARCHIVE_BYTES,
  PY3S_MAX_ZIP_ENTRIES,
  PY3S_MAX_ZIP_RATIO,
  PY3S_MAX_ZIP_UNCOMPRESSED_BYTES,
  PY3S_VERSION_MAJOR,
  PY3S_VERSION_MINOR,
  Py3sCodec,
  computePy3sCrc32,
  isPy3sBuffer,
  validateSafeZipBytes
};
