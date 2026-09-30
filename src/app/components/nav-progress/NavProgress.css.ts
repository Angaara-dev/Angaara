import { keyframes, style } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

const appear = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const slide = keyframes({
  from: { transform: 'translateX(-100%)' },
  to: { transform: 'translateX(250%)' },
});

export const Bar = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: toRem(3),
  zIndex: 10000,
  overflow: 'hidden',
  pointerEvents: 'none',
  opacity: 0,
  animation: `${appear} 150ms ease-out 60ms forwards`,
  '::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    width: '40%',
    borderRadius: toRem(3),
    background: color.Primary.Main,
    animation: `${slide} 900ms ease-in-out infinite`,
  },
});
