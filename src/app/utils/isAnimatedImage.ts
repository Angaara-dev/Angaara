const HEAD_BYTES = 4096;
const results = new Map<string, Promise<boolean | undefined>>();

const text = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

const animatedHeader = (head: Uint8Array): boolean => {
  if (text(head, 0, 4) === 'GIF8') return true;
  // Animated WebP sets the animation flag in its VP8X header.
  if (text(head, 0, 4) === 'RIFF' && text(head, 8, 4) === 'WEBP' && text(head, 12, 4) === 'VP8X') {
    return (head[20] & 0b10) !== 0; // eslint-disable-line no-bitwise
  }
  // Animated PNGs have an acTL chunk before their image data.
  if (text(head, 1, 3) === 'PNG') {
    const all = text(head, 0, head.length);
    const actl = all.indexOf('acTL');
    const idat = all.indexOf('IDAT');
    return actl >= 0 && (idat < 0 || actl < idat);
  }
  return false;
};

const readHead = async (url: string): Promise<Uint8Array> => {
  const res = await fetch(url, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` } });
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const head = new Uint8Array(HEAD_BYTES);
  let size = 0;
  while (size < HEAD_BYTES) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done || !value) break;
    const take = value.subarray(0, HEAD_BYTES - size);
    head.set(take, size);
    size += take.length;
  }
  reader.cancel().catch(() => undefined);
  return head.subarray(0, size);
};

// Reads only the start of the file, since every animated format says so in its header.
// Undefined when the check fails, so callers don't treat an unknown file as a still one.
export const isAnimatedImage = (url: string): Promise<boolean | undefined> => {
  let result = results.get(url);
  if (!result) {
    result = readHead(url)
      .then(animatedHeader)
      .catch(() => {
        results.delete(url);
        return undefined;
      });
    results.set(url, result);
  }
  return result;
};
