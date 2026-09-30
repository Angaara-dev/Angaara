import { view } from './bytes';

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
  encrypted: boolean;
};

export const zipEntries = (b: Uint8Array): ZipEntry[] | undefined => {
  const v = view(b);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i -= 1) {
    if (v.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return undefined;
  const count = v.getUint16(end + 10, true);
  let pos = v.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count && pos + 46 <= b.length; i += 1) {
    if (v.getUint32(pos, true) !== 0x02014b50) break;
    const nameLen = v.getUint16(pos + 28, true);
    const extraLen = v.getUint16(pos + 30, true);
    const commentLen = v.getUint16(pos + 32, true);
    entries.push({
      name: decoder.decode(b.subarray(pos + 46, pos + 46 + nameLen)),
      // Bit 0 of the flags marks a password-protected entry.
      // eslint-disable-next-line no-bitwise
      encrypted: (v.getUint16(pos + 8, true) & 1) === 1,
      method: v.getUint16(pos + 10, true),
      compressedSize: v.getUint32(pos + 20, true),
      size: v.getUint32(pos + 24, true),
      offset: v.getUint32(pos + 42, true),
    });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
};

const MAX_ENTRY = 20 * 1024 * 1024;

// The project's TS lib predates the compression stream types.
const { DecompressionStream } = globalThis as unknown as {
  DecompressionStream?: new (format: 'deflate-raw') => TransformStream<Uint8Array, Uint8Array>;
};

export const readEntry = async (
  b: Uint8Array,
  entry: ZipEntry
): Promise<Uint8Array | undefined> => {
  if (entry.encrypted || entry.size > MAX_ENTRY || entry.offset + 30 > b.length) return undefined;
  const v = view(b);
  if (v.getUint32(entry.offset, true) !== 0x04034b50) return undefined;
  const start =
    entry.offset + 30 + v.getUint16(entry.offset + 26, true) + v.getUint16(entry.offset + 28, true);
  const data = b.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8 || !DecompressionStream) return undefined;
  try {
    const reader = new Blob([data])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
      .getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_ENTRY) {
        reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    chunks.reduce((at, c) => {
      out.set(c, at);
      return at + c.length;
    }, 0);
    return out;
  } catch {
    return undefined;
  }
};

export const readText = async (b: Uint8Array, entries: ZipEntry[], name: RegExp) => {
  const entry = entries.find((e) => name.test(e.name));
  const data = entry && (await readEntry(b, entry));
  return data ? new TextDecoder().decode(data) : undefined;
};
