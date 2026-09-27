import { keyframes, style } from '@vanilla-extract/css';

const flicker = keyframes({
  '0%, 100%': { transform: 'scale(1, 1) skewX(0deg)' },
  '25%': { transform: 'scale(0.97, 1.04) skewX(-1.5deg)' },
  '50%': { transform: 'scale(1.02, 0.97) skewX(1deg)' },
  '75%': { transform: 'scale(0.98, 1.03) skewX(-0.5deg)' },
});

const glow = keyframes({
  '0%, 100%': { filter: 'drop-shadow(0 0 12px rgba(255, 107, 61, 0.45))' },
  '50%': { filter: 'drop-shadow(0 0 22px rgba(255, 122, 69, 0.7))' },
});

export const Logo = style({
  display: 'block',
  flexShrink: 0,
});

export const Animated = style({
  animation: `${glow} 3s ease-in-out infinite`,
  '@media': {
    '(prefers-reduced-motion: reduce)': { animation: 'none' },
  },
});

// Flame shapes flicker from their base, like a real fire.
export const Flame = style({
  transformOrigin: '50% 78%',
  transformBox: 'fill-box',
  selectors: {
    [`${Animated} &`]: { animation: `${flicker} 1.8s ease-in-out infinite` },
  },
  '@media': {
    '(prefers-reduced-motion: reduce)': { animation: 'none' },
  },
});
