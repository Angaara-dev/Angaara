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
const SAMPLE_PIXELS = 400000;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DITHER_STRENGTH = 10;

// Ordered dithering depends only on position, so pixels that don't change never shimmer.
const dither = (data: Uint8ClampedArray, width: number) => {
  const out = new Uint8ClampedArray(data.length);
  for (let p = 0, i = 0; i < data.length; p += 1, i += 4) {
    const cell = (Math.floor(p / width) % 4) * 4 + ((p % width) % 4);
    const d = (BAYER[cell] / 16 - 0.5) * DITHER_STRENGTH;
    out[i] = data[i] + d;
    out[i + 1] = data[i + 1] + d;
    out[i + 2] = data[i + 2] + d;
    out[i + 3] = data[i + 3];
  }
  return out;
};

type CropFrame = (data: Uint8ClampedArray, frame: ParsedFrame) => void;

const compositeFrames = async (
  gif: ReturnType<typeof parseGIF>,
  frames: ParsedFrame[],
  rect: CropRect,
  width: number,
  height: number,
  onFrame: CropFrame
) => {
  const full = canvasOf(gif.lsd.width, gif.lsd.height);
  const fullCtx = full.getContext('2d', { willReadFrequently: true })!;
  const patch = canvasOf(1, 1);
  const patchCtx = patch.getContext('2d')!;
  const out = canvasOf(width, height);
  const outCtx = out.getContext('2d', { willReadFrequently: true })!;
  let prev: ParsedFrame | undefined;
  let restore: ImageData | undefined;

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
    onFrame(outCtx.getImageData(0, 0, width, height).data, frame);
    prev = frame;
    // eslint-disable-next-line no-await-in-loop
    if (i % 3 === 2) await nextTick();
  }
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

  // One palette for every frame, so a pixel returns to exactly the same colour once something
  // moves off it. Per-frame palettes left ghostly patches behind moving parts.
  const step = Math.max(1, Math.floor((width * height * frames.length) / SAMPLE_PIXELS));
  const sample: number[] = [];
  let seen = 0;
  await compositeFrames(gif, frames, rect, width, height, (data) => {
    for (let i = 0; i < data.length; i += 4, seen += 1) {
      if (seen % step === 0 && data[i + 3] >= 128)
        sample.push(data[i], data[i + 1], data[i + 2], 255);
    }
  });
  const colours = quantize(new Uint8ClampedArray(sample.length ? sample : [0, 0, 0, 255]), 255);
  // The extra slot means "keep the last frame"; colours are matched without it, or dark pixels
  // would land on it and turn see-through.
  const clear = colours.length;
  const palette = [...colours, [0, 0, 0]];

  const encoder = GIFEncoder();
  let shown: Uint8ClampedArray | undefined;
  // Whether the file's global palette is the shared one; unset until the first frame.
  let globalIsShared: boolean | undefined;
  await compositeFrames(gif, frames, rect, width, height, (data, frame) => {
    if (hasTransparency(data)) {
      // Transparency costs colour depth, so only pay for it when a frame needs it.
      const own = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true });
      const transparentIndex = own.findIndex((c) => c[3] === 0);
      encoder.writeFrame(applyPalette(data, own, 'rgba4444'), width, height, {
        palette: own,
        delay: frame.delay,
        transparent: transparentIndex >= 0,
        transparentIndex: Math.max(transparentIndex, 0),
        dispose: 2,
      });
      globalIsShared ??= false;
      shown = undefined;
      return;
    }
    const index = applyPalette(dither(data, width), colours);
    if (shown) {
      for (let p = 0, i = 0; i < data.length; p += 1, i += 4) {
        const diff =
          Math.abs(data[i] - shown[i]) +
          Math.abs(data[i + 1] - shown[i + 1]) +
          Math.abs(data[i + 2] - shown[i + 2]);
        if (diff > CHANGE_THRESHOLD) shown.set(data.subarray(i, i + 4), i);
        else index[p] = clear;
      }
    } else {
      shown = data.slice();
    }
    const withPalette = globalIsShared !== true;
    globalIsShared ??= true;
    encoder.writeFrame(index, width, height, {
      palette: withPalette ? palette : undefined,
      delay: frame.delay,
      transparent: true,
      transparentIndex: clear,
      dispose: 1,
    });
  });
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
