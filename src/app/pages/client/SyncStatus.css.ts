import { keyframes, style, styleVariants } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

const drop = keyframes({
  from: { opacity: 0, transform: `translate(-50%, ${toRem(-12)})` },
  to: { opacity: 1, transform: 'translate(-50%, 0)' },
});

export const Toast = style({
  position: 'fixed',
  // Just under the top bar, so the title stays readable.
  top: toRem(36),
  left: '50%',
  transform: 'translate(-50%, 0)',
  zIndex: 9999,
  padding: `${config.space.S100} ${config.space.S400}`,
  borderRadius: config.radii.Pill,
  boxShadow: `0 ${toRem(4)} ${toRem(16)} rgba(0, 0, 0, 0.35)`,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  animation: `${drop} 220ms ease-out`,
  '@media': {
    '(prefers-reduced-motion: reduce)': { animation: 'none' },
  },
});

export const ToastColor = styleVariants({
  lost: { background: color.Critical.Main, color: color.Critical.OnMain },
  back: { background: color.Success.Main, color: color.Success.OnMain },
});
