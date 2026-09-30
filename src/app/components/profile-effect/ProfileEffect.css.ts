import { globalStyle, keyframes, style } from '@vanilla-extract/css';

export const Layer = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  overflow: 'hidden',
  borderRadius: 'inherit',
  pointerEvents: 'none',
  containerType: 'size',
});

const rise = keyframes({
  '0%': { transform: 'translate3d(0, 0, 0)', opacity: 0 },
  '15%': { opacity: 0.85 },
  '100%': { transform: 'translate3d(var(--drift), -110cqh, 0)', opacity: 0 },
});

export const Ember = style({
  position: 'absolute',
  bottom: '-8px',
  borderRadius: '50%',
  background: 'radial-gradient(circle, #FFD2B0 0%, #FF7A3D 60%, transparent 100%)',
  animationName: rise,
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
  willChange: 'transform, opacity',
});

// A still frame instead of motion; the negative delays keep the embers spread out.
globalStyle(`${Layer} *`, {
  '@media': {
    '(prefers-reduced-motion: reduce)': { animationPlayState: 'paused' },
  },
});
