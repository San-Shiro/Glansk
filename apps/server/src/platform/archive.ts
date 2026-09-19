import { inflateRawSync, deflateRawSync } from "node:zlib";

// Standard CRC32 table (IEEE 802.3)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ data[i]!) & 0xFF]!;
  }
  return ((c ^ 0xFFFFFFFF) >>> 0);
}

export interface ArchiveOptions {
  maxFiles?: number;
  maxTotalBytes?: number;
  maxFileBytes?: number;
}

const DEFAULT_OPTIONS: Required<ArchiveOptions> = {
  maxFiles: 256,
  maxTotalBytes: 20 * 1024 * 1024, // 20MB
  maxFileBytes: 10 * 1024 * 1024,  // 10MB
};

/**
 * Extracts files from a ZIP archive with strict zip-slip and decompression quota checks.
 */
export function extractZip(
  archiveData: Uint8Array,
  options: ArchiveOptions = {}
): Map<string, Uint8Array> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const view = new DataView(archiveData.buffer as ArrayBuffer, archiveData.byteOffset, archiveData.byteLength);
  const files = new Map<string, Uint8Array>();
  let totalBytes = 0;

  // Find End of Central Directory Record (EOCD) starting from end of archive
  let eocdOffset = -1;
  const minEocdSize = 22;
  const maxSearch = Math.min(archiveData.byteLength, 65557); // 22 + max comment length (65535)

  for (let i = archiveData.byteLength - minEocdSize; i >= archiveData.byteLength - maxSearch; i--) {
    if (view.getUint32(i, true) === 0x06054B50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Invalid ZIP archive: End of Central Directory not found");
  }

  const cdTotalEntries = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (cdTotalEntries > opts.maxFiles) {
    throw new Error(`Package file quota exceeded: contains ${cdTotalEntries} files, max is ${opts.maxFiles}`);
  }

  if (cdOffset + cdSize > archiveData.byteLength) {
    throw new Error("Invalid ZIP archive: corrupt central directory offset");
  }

  let currOffset = cdOffset;
  const textDecoder = new TextDecoder("utf-8");

  for (let entryIdx = 0; entryIdx < cdTotalEntries; entryIdx++) {
    if (currOffset + 46 > archiveData.byteLength) {
      throw new Error("Invalid ZIP archive: truncated central directory header");
    }

    const sig = view.getUint32(currOffset, true);
    if (sig !== 0x02014B50) {
      throw new Error(`Invalid central directory signature at offset ${currOffset}`);
    }

    const compressionMethod = view.getUint16(currOffset + 10, true);
    const expectedCrc = view.getUint32(currOffset + 16, true);
    const compressedSize = view.getUint32(currOffset + 20, true);
    const uncompressedSize = view.getUint32(currOffset + 24, true);
    const fileNameLen = view.getUint16(currOffset + 28, true);
    const extraLen = view.getUint16(currOffset + 30, true);
    const commentLen = view.getUint16(currOffset + 32, true);
    const localHeaderOffset = view.getUint32(currOffset + 42, true);

    const fileNameBytes = archiveData.subarray(currOffset + 46, currOffset + 46 + fileNameLen);
    let rawPath = textDecoder.decode(fileNameBytes).replace(/\\/g, "/");

    // Remove leading slashes if any
    while (rawPath.startsWith("/")) {
      rawPath = rawPath.slice(1);
    }

    currOffset += 46 + fileNameLen + extraLen + commentLen;

    // Skip directories
    if (rawPath.endsWith("/") || rawPath === "") {
      continue;
    }

    // Zip-slip defenses
    if (
      rawPath.includes("..") ||
      rawPath.includes("\0") ||
      /^[a-zA-Z]:/.test(rawPath) ||
      rawPath.startsWith("./")
    ) {
      throw new Error(`Path traversal rejected in archive: ${rawPath}`);
    }

    if (uncompressedSize > opts.maxFileBytes) {
      throw new Error(`File ${rawPath} exceeds single file size limit (${opts.maxFileBytes} bytes)`);
    }

    totalBytes += uncompressedSize;
    if (totalBytes > opts.maxTotalBytes) {
      throw new Error(`Archive exceeds total uncompressed size limit (${opts.maxTotalBytes} bytes)`);
    }

    // Read local file header to locate compressed data payload
    if (localHeaderOffset + 30 > archiveData.byteLength) {
      throw new Error(`Invalid local header offset for ${rawPath}`);
    }

    const localSig = view.getUint32(localHeaderOffset, true);
    if (localSig !== 0x04034B50) {
      throw new Error(`Invalid local header signature for ${rawPath}`);
    }

    const localFileNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFileNameLen + localExtraLen;

    if (dataOffset + compressedSize > archiveData.byteLength) {
      throw new Error(`Compressed payload truncated for ${rawPath}`);
    }

    const rawCompressed = archiveData.subarray(dataOffset, dataOffset + compressedSize);
    let decompressed: Uint8Array;

    if (compressionMethod === 0) {
      // Stored (no compression)
      decompressed = new Uint8Array(rawCompressed);
    } else if (compressionMethod === 8) {
      // Deflate
      decompressed = new Uint8Array(inflateRawSync(rawCompressed));
    } else {
      throw new Error(`Unsupported compression method ${compressionMethod} for ${rawPath}`);
    }

    if (decompressed.byteLength !== uncompressedSize) {
      throw new Error(`Decompressed size mismatch for ${rawPath}: expected ${uncompressedSize}, got ${decompressed.byteLength}`);
    }

    const actualCrc = crc32(decompressed);
    if (actualCrc !== expectedCrc) {
      throw new Error(`CRC-32 checksum mismatch for ${rawPath}`);
    }

    files.set(rawPath, decompressed);
  }

  return files;
}

/**
 * Creates a valid, standard ZIP archive from a map or object of files.
 */
export function createZip(
  files: Map<string, Uint8Array | string> | Record<string, Uint8Array | string>
): Uint8Array {
  const encoder = new TextEncoder();
  const fileEntries: Array<{
    name: string;
    data: Uint8Array;
    crc: number;
    compressed: Uint8Array;
    localHeaderOffset: number;
  }> = [];

  const map = files instanceof Map ? files : new Map(Object.entries(files));

  for (const [rawName, content] of map) {
    const cleanName = rawName.replace(/\\/g, "/").replace(/^\/+/, "");
    if (cleanName.includes("..") || cleanName.includes("\0") || /^[a-zA-Z]:/.test(cleanName)) {
      throw new Error(`Invalid filename in zip creation: ${cleanName}`);
    }
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(data);
    // Deflate compress data
    const deflated = new Uint8Array(deflateRawSync(data));
    // If deflated is larger or equal (tiny files), store uncompressed
    const useCompression = deflated.byteLength < data.byteLength;
    const compressed = useCompression ? deflated : data;

    fileEntries.push({
      name: cleanName,
      data,
      crc,
      compressed,
      localHeaderOffset: 0,
    });
  }

  // Calculate total size needed
  let totalLocalSize = 0;
  for (const entry of fileEntries) {
    const nameBytes = encoder.encode(entry.name);
    totalLocalSize += 30 + nameBytes.byteLength + entry.compressed.byteLength;
  }

  let totalCdSize = 0;
  for (const entry of fileEntries) {
    const nameBytes = encoder.encode(entry.name);
    totalCdSize += 46 + nameBytes.byteLength;
  }

  const totalSize = totalLocalSize + totalCdSize + 22; // 22 for EOCD
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  let currentOffset = 0;

  // 1. Write Local File Headers and Data
  for (const entry of fileEntries) {
    entry.localHeaderOffset = currentOffset;
    const nameBytes = encoder.encode(entry.name);
    const isDeflated = entry.compressed !== entry.data;

    view.setUint32(currentOffset, 0x04034B50, true);      // Signature
    view.setUint16(currentOffset + 4, 20, true);           // Version needed (2.0)
    view.setUint16(currentOffset + 6, 0, true);            // Bit flag
    view.setUint16(currentOffset + 8, isDeflated ? 8 : 0, true); // Method
    view.setUint16(currentOffset + 10, 0, true);           // Time
    view.setUint16(currentOffset + 12, 0, true);           // Date
    view.setUint32(currentOffset + 14, entry.crc, true);   // CRC32
    view.setUint32(currentOffset + 18, entry.compressed.byteLength, true); // Compressed size
    view.setUint32(currentOffset + 22, entry.data.byteLength, true);       // Uncompressed size
    view.setUint16(currentOffset + 26, nameBytes.byteLength, true);        // Filename length
    view.setUint16(currentOffset + 28, 0, true);                           // Extra field length

    buffer.set(nameBytes, currentOffset + 30);
    buffer.set(entry.compressed, currentOffset + 30 + nameBytes.byteLength);

    currentOffset += 30 + nameBytes.byteLength + entry.compressed.byteLength;
  }

  // 2. Write Central Directory Headers
  const cdStartOffset = currentOffset;
  for (const entry of fileEntries) {
    const nameBytes = encoder.encode(entry.name);
    const isDeflated = entry.compressed !== entry.data;

    view.setUint32(currentOffset, 0x02014B50, true);       // Central header signature
    view.setUint16(currentOffset + 4, 20, true);            // Version made by
    view.setUint16(currentOffset + 6, 20, true);            // Version needed
    view.setUint16(currentOffset + 8, 0, true);             // Bit flag
    view.setUint16(currentOffset + 10, isDeflated ? 8 : 0, true); // Method
    view.setUint16(currentOffset + 12, 0, true);            // Time
    view.setUint16(currentOffset + 14, 0, true);            // Date
    view.setUint32(currentOffset + 16, entry.crc, true);    // CRC32
    view.setUint32(currentOffset + 20, entry.compressed.byteLength, true); // Compressed size
    view.setUint32(currentOffset + 24, entry.data.byteLength, true);       // Uncompressed size
    view.setUint16(currentOffset + 28, nameBytes.byteLength, true);        // Filename length
    view.setUint16(currentOffset + 30, 0, true);            // Extra field length
    view.setUint16(currentOffset + 32, 0, true);            // File comment length
    view.setUint16(currentOffset + 34, 0, true);            // Disk number start
    view.setUint16(currentOffset + 36, 0, true);            // Internal file attributes
    view.setUint32(currentOffset + 38, 0, true);            // External file attributes
    view.setUint32(currentOffset + 42, entry.localHeaderOffset, true); // Local header offset

    buffer.set(nameBytes, currentOffset + 46);
    currentOffset += 46 + nameBytes.byteLength;
  }

  // 3. Write End of Central Directory (EOCD)
  const cdSize = currentOffset - cdStartOffset;
  view.setUint32(currentOffset, 0x06054B50, true);         // EOCD signature
  view.setUint16(currentOffset + 4, 0, true);              // Disk number
  view.setUint16(currentOffset + 6, 0, true);              // Disk with CD
  view.setUint16(currentOffset + 8, fileEntries.length, true);  // Disk entries
  view.setUint16(currentOffset + 10, fileEntries.length, true); // Total entries
  view.setUint32(currentOffset + 12, cdSize, true);        // Size of CD
  view.setUint32(currentOffset + 16, cdStartOffset, true); // Offset of CD
  view.setUint16(currentOffset + 20, 0, true);             // Comment length

  return buffer;
}
