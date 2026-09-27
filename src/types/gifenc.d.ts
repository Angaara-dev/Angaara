declare module 'gifenc' {
  type Palette = number[][];
  type Format = 'rgb565' | 'rgb444' | 'rgba4444';
  type FrameOptions = {
    palette?: Palette;
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
    repeat?: number;
  };
  type Encoder = {
    writeFrame: (index: Uint8Array, width: number, height: number, opts?: FrameOptions) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };
  export function GIFEncoder(): Encoder;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: Format; oneBitAlpha?: boolean | number }
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: Format
  ): Uint8Array;
}
