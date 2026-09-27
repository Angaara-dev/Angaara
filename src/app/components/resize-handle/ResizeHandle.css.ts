import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const Handle = style({
  flexShrink: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  touchAction: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  outline: 'none',
});

// Faint at rest, accent-colored and longer while hovered, focused or dragged.
export const Grip = style({
  borderRadius: config.radii.Pill,
  background: color.SurfaceVariant.ContainerLine,
  transition: 'background-color 120ms ease, transform 120ms ease',
  selectors: {
    [`${Handle}:hover &, ${Handle}:focus-visible &, ${Handle}:active &`]: {
      background: color.Primary.Main,
      transform: 'scale(1.5)',
    },
  },
});
