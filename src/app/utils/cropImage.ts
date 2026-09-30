import { decompressFrames, parseGIF, ParsedFrame } from 'gifuct-js';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';

export type CropRect = { x: number; y: number; width: number; height: number };

const nextTick = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const renamed = (file: File, blob: Blob, ext: string) =>
  new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`, { type: blob.type });

const hasTransparency = (data: Uint8ClampedArray) => {
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) return true;
  return false;
};

const CHANGE_THRESHOLD = 6;

// Pixels that match what's already on screen become transparent, so each frame only stores what
// moved. Without this, long GIFs grow many times bigger than the original.
const changedPixels = (data: Uint8ClampedArray, shown: Uint8ClampedArray) => {
  const count = data.length / 4;
  const changed = new Uint8Array(count);
  const picked: number[] = [];
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const diff =
      Math.abs(data[i] - shown[i]) +
      Math.abs(data[i + 1] - shown[i + 1]) +
      Math.abs(data[i + 2] - shown[i + 2]);
    if (diff > CHANGE_THRESHOLD) {
      changed[p] = 1;
      picked.push(i);
      shown.set(data.subarray(i, i + 4), i);
    }
  }
  const pixels = new Uint8ClampedArray(Math.max(picked.length, 1) * 4);
  picked.forEach((i, n) => pixels.set(data.subarray(i, i + 4), n * 4));
  const palette = quantize(pixels, 255);
  const index = applyPalette(data, palette);
  for (let p = 0; p < count; p += 1) if (!changed[p]) index[p] = palette.length;
  palette.push([0, 0, 0]);
  return { index, palette };
};

// Crops every frame so animated GIFs keep moving. Undefined for single-frame GIFs.
const cropAnimatedGif = async (
  file: File,
  rect: CropRect,
  width: number,
  height: number
): Promise<Blob | undefined> => {
  const gif = parseGIF(await file.arrayBuffer());
  // Re-encoding drops the original's frame-to-frame savings, so an untouched GIF is kept as is.
  const near = (a: number, b: number) => Math.abs(a - b) < 1;
  const { width: w, height: h } = gif.lsd;
  if ([rect.x, rect.y].every((v) => near(v, 0)) && near(rect.width, w) && near(rect.height, h)) {
    if (width === w && height === h) return file;
  }
  const frames = decompressFrames(gif, true);
  if (frames.length < 2) return undefined;

  const full = canvasOf(gif.lsd.width, gif.lsd.height);
  const fullCtx = full.getContext('2d', { willReadFrequently: true })!;
  const patch = canvasOf(1, 1);
  const patchCtx = patch.getContext('2d')!;
  const out = canvasOf(width, height);
  const outCtx = out.getContext('2d', { willReadFrequently: true })!;
  const encoder = GIFEncoder();
  let prev: ParsedFrame | undefined;
  let restore: ImageData | undefined;
  let shown: Uint8ClampedArray | undefined;

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (prev?.disposalType === 2) {
      fullCtx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
    } else if (prev?.disposalType === 3 && restore) {
      fullCtx.putImageData(restore, 0, 0);
    }
    if (frame.disposalType === 3) restore = fullCtx.getImageData(0, 0, full.width, full.height);

    patch.width = frame.dims.width;
    patch.height = frame.dims.height;
    patchCtx.putImageData(
      new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height),
      0,
      0
    );
    fullCtx.drawImage(patch, frame.dims.left, frame.dims.top);

    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(full, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    const { data } = outCtx.getImageData(0, 0, width, height);
    if (hasTransparency(data)) {
      // Transparency costs colour depth, so only pay for it when a frame needs it.
      const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true });
      const transparentIndex = palette.findIndex((c) => c[3] === 0);
      encoder.writeFrame(applyPalette(data, palette, 'rgba4444'), width, height, {
        palette,
        delay: frame.delay,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(transparentIndex, 0),
        dispose: 2,
      });
      shown = undefined;
    } else if (!shown) {
      const palette = quantize(data, 256);
      encoder.writeFrame(applyPalette(data, palette), width, height, {
        palette,
        delay: frame.delay,
        dispose: 1,
      });
      shown = data.slice();
    } else {
      const { index, palette } = changedPixels(data, shown);
      encoder.writeFrame(index, width, height, {
        palette,
        delay: frame.delay,
        transparent: true,
        transparentIndex: palette.length - 1,
        dispose: 1,
      });
    }
    prev = frame;
    // eslint-disable-next-line no-await-in-loop
    if (i % 3 === 2) await nextTick();
  }
  encoder.finish();
  return new Blob([encoder.bytes()], { type: 'image/gif' });
};

const STILL_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const cropImageFile = async (
  file: File,
  rect: CropRect,
  maxWidth: number
): Promise<File> => {
  const scale = Math.min(1, maxWidth / rect.width);
  const width = Math.max(1, Math.round(rect.width * scale));
  const height = Math.max(1, Math.round(rect.height * scale));

  if (file.type === 'image/gif') {
    const gif = await cropAnimatedGif(file, rect, width, height);
    if (gif) return renamed(file, gif, 'gif');
  }

  const bitmap = await createImageBitmap(file);
  const out = canvasOf(width, height);
  out
    .getContext('2d')!
    .drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
  bitmap.close();
  const type = STILL_TYPES.includes(file.type) ? file.type : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) => {
    out.toBlob(resolve, type, 0.92);
  });
  if (!blob) throw new Error('Could not crop image');
  return renamed(file, blob, type.split('/')[1].replace('jpeg', 'jpg'));
};
