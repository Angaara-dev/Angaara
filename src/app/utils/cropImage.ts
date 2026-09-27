import { decompressFrames, parseGIF, ParsedFrame } from 'gifuct-js';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';

// A crop in the image's own pixels.
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

// Crops every frame so animated GIFs keep moving. Undefined for single-frame GIFs.
const cropAnimatedGif = async (
  file: File,
  rect: CropRect,
  width: number,
  height: number
): Promise<Blob | undefined> => {
  const gif = parseGIF(await file.arrayBuffer());
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
    // Transparency costs colour depth, so only pay for it when a frame needs it.
    const format = hasTransparency(data) ? 'rgba4444' : 'rgb565';
    const palette = quantize(data, 256, { format, oneBitAlpha: true });
    const transparentIndex = format === 'rgba4444' ? palette.findIndex((c) => c[3] === 0) : -1;
    encoder.writeFrame(applyPalette(data, palette, format), width, height, {
      palette,
      delay: frame.delay,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(transparentIndex, 0),
      dispose: transparentIndex >= 0 ? 2 : 1,
    });
    prev = frame;
    // Let the page breathe on long GIFs.
    // eslint-disable-next-line no-await-in-loop
    if (i % 3 === 2) await nextTick();
  }
  encoder.finish();
  return new Blob([encoder.bytes()], { type: 'image/gif' });
};

const STILL_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// Crops and scales down to at most maxWidth wide. Stills keep their format where possible.
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
