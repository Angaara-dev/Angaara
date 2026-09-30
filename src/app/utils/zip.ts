/* eslint-disable no-bitwise */
// Minimal ZIP writer (stored, no compression). Bitwise ops are needed for CRC32 and DOS dates.
export type ZipFile = { path: string; content: string };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  data.forEach((byte) => {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};

// DOS timestamp for 2025-01-01 00:00; zip dates can't be zero.
const DOS_TIME = 0;
const DOS_DATE = ((2025 - 1980) << 9) | (1 << 5) | 1;
const UTF8_FLAG = 0x0800;

export const makeZip = (files: ZipFile[]): Blob => {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, UTF8_FLAG, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, DOS_TIME, true);
    local.setUint16(12, DOS_DATE, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, UTF8_FLAG, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, DOS_TIME, true);
    entry.setUint16(14, DOS_DATE, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + data.length;
  });

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {
    type: 'application/zip',
  });
};

export const readZip = (data: ArrayBuffer): ZipFile[] => {
  const view = new DataView(data);
  const bytes = new Uint8Array(data);
  let end = data.byteLength - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('Not a zip file');

  const count = view.getUint16(end + 10, true);
  let pos = view.getUint32(end + 16, true);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const files: ZipFile[] = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('Broken zip directory');
    const method = view.getUint16(pos + 10, true);
    const size = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const local = view.getUint32(pos + 42, true);
    const path = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    pos += 46 + nameLen + extraLen + commentLen;
    if (!path.endsWith('/')) {
      if (method !== 0) throw new Error(`Compressed zip entries aren't supported: ${path}`);
      const start =
        local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      files.push({ path, content: decoder.decode(bytes.subarray(start, start + size)) });
    }
  }
  return files;
};
