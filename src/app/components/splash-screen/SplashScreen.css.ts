import { style } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

const tileColor = `color-mix(in srgb, ${color.Primary.Main} 16%, transparent)`;
const glowColor = `color-mix(in srgb, ${color.Primary.Main} 20%, transparent)`;

const svg = (body: string, extra = '') =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' ${extra}>${body}</svg>`
  )}")`;

// Squircles are superellipses with n = 4: one outline per 44px tile for the background field.
const TILE_PATH =
  'M37 22L36.94 27.42L36.74 29.63L36.42 31.28L35.96 32.61L35.36 33.7L34.61 34.61L33.7 35.36L32.61 35.96L31.28 36.42L29.63 36.74L27.42 36.94L22 37L16.58 36.94L14.37 36.74L12.72 36.42L11.39 35.96L10.3 35.36L9.39 34.61L8.64 33.7L8.04 32.61L7.58 31.28L7.26 29.63L7.06 27.42L7 22L7.06 16.58L7.26 14.37L7.58 12.72L8.04 11.39L8.64 10.3L9.39 9.39L10.3 8.64L11.39 8.04L12.72 7.58L14.37 7.26L16.58 7.06L22 7L27.42 7.06L29.63 7.26L31.28 7.58L32.61 8.04L33.7 8.64L34.61 9.39L35.36 10.3L35.96 11.39L36.42 12.72L36.74 14.37L36.94 16.58Z';
const squircleTile = svg(
  `<path d='${TILE_PATH}' fill='none' stroke='black' stroke-width='1'/>`,
  "width='44' height='44'"
);

const emberShape =
  'radial-gradient(circle closest-side, #000 0%, rgba(0, 0, 0, 0.75) 30%, rgba(0, 0, 0, 0.35) 60%, transparent 100%)';

const everywhere = 'linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35))';

const GLOW_SIZE = 'min(150vw, 120vh) min(150vw, 120vh)';

const emberMask = {
  WebkitMaskImage: emberShape,
  maskImage: emberShape,
  WebkitMaskSize: GLOW_SIZE,
  maskSize: GLOW_SIZE,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
} as const;

export const SplashScreen = style({
  position: 'relative',
  isolation: 'isolate',
  minHeight: '100%',
  backgroundColor: color.Background.Container,
  color: color.Background.OnContainer,
  selectors: {
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: -1,
      pointerEvents: 'none',
      backgroundColor: tileColor,
      WebkitMaskImage: `${squircleTile}, ${emberShape}, ${everywhere}`,
      maskImage: `${squircleTile}, ${emberShape}, ${everywhere}`,
      WebkitMaskSize: `${toRem(44)} ${toRem(44)}, ${GLOW_SIZE}, 100% 100%`,
      maskSize: `${toRem(44)} ${toRem(44)}, ${GLOW_SIZE}, 100% 100%`,
      WebkitMaskRepeat: 'repeat, no-repeat, no-repeat',
      maskRepeat: 'repeat, no-repeat, no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskComposite: 'source-in, source-over',
      maskComposite: 'intersect, add',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      zIndex: -2,
      pointerEvents: 'none',
      backgroundColor: glowColor,
      ...emberMask,
    },
  },
});

export const SplashStatus = style({
  opacity: 0.85,
});
