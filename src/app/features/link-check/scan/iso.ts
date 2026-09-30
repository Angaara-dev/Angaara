import { latin1, view } from './bytes';

export type IsoFile = { name: string; data: Uint8Array };

export const isIso = (b: Uint8Array) =>
  b.length > 0x8006 && latin1(b.subarray(0x8001, 0x8006)) === 'CD001';

export const isoFiles = (b: Uint8Array): IsoFile[] => {
  const v = view(b);
  const block = v.getUint16(0x8000 + 128, true) || 2048;
  const files: IsoFile[] = [];
  const walk = (extent: number, size: number, path: string, depth: number) => {
    const start = extent * block;
    const end = Math.min(start + size, b.length);
    let pos = start;
    while (pos < end && files.length < 200) {
      const len = b[pos];
      if (len === 0) {
        // Records never cross a block, so skip to the next one.
        pos = (Math.floor((pos - start) / block) + 1) * block + start;
      } else {
        const at = v.getUint32(pos + 2, true);
        const bytes = v.getUint32(pos + 10, true);
        // eslint-disable-next-line no-bitwise
        const dir = (b[pos + 25] & 2) !== 0;
        const nameLen = b[pos + 32];
        const name = latin1(b.subarray(pos + 33, pos + 33 + nameLen)).replace(/;\d+$/, '');
        const special = nameLen === 1 && b[pos + 33] <= 1;
        if (!special && dir && depth < 3) walk(at, bytes, `${path}${name}/`, depth + 1);
        else if (!special && !dir && at * block + bytes <= b.length) {
          files.push({ name: `${path}${name}`, data: b.subarray(at * block, at * block + bytes) });
        }
        pos += len;
      }
    }
  };
  walk(v.getUint32(0x8000 + 156 + 2, true), v.getUint32(0x8000 + 156 + 10, true), '', 0);
  return files;
};
