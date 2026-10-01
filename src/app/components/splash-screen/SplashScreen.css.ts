import { globalStyle, keyframes, style } from '@vanilla-extract/css';
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
    // Loading screens show the embers from index.html behind them instead.
    '&:has([data-splash-loading])': { backgroundColor: 'transparent' },
    '&:has([data-splash-loading])::before, &:has([data-splash-loading])::after': {
      display: 'none',
    },
  },
});

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'none' },
});

const halo = keyframes({
  '0%, 100%': { transform: 'scale(0.9)', opacity: 0.6 },
  '50%': { transform: 'scale(1.08)', opacity: 1 },
});

// The background is always dark here, whatever the theme.
export const SplashStatus = style({
  maxWidth: `min(${toRem(520)}, calc(100vw - ${toRem(32)}))`,
  // Room for two lines, so the logo stays put when a tip wraps.
  minHeight: toRem(44),
  color: '#b8b1ab',
  animation: `${fadeIn} 400ms ease-out`,
  '@media': {
    '(prefers-reduced-motion: reduce)': { animation: 'none' },
  },
});

globalStyle(`${SplashStatus} b`, { color: '#ede7e1', fontWeight: 600 });

export const Tip = style({
  display: 'inline-block',
  marginRight: toRem(8),
  padding: `0 ${toRem(8)}`,
  borderRadius: toRem(999),
  background: 'rgba(255, 107, 61, 0.16)',
  color: '#ff9a6b',
  fontSize: toRem(11),
  fontWeight: 700,
  letterSpacing: '0.06em',
  verticalAlign: 'middle',
});

export const Halo = style({
  position: 'relative',
  selectors: {
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: toRem(-50),
      borderRadius: '50%',
      background:
        'radial-gradient(circle, rgba(255, 120, 60, 0.5), rgba(255, 90, 40, 0.12) 45%, transparent 68%)',
      animation: `${halo} 3s ease-in-out infinite`,
    },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      selectors: { '&::before': { animation: 'none' } },
    },
  },
});
