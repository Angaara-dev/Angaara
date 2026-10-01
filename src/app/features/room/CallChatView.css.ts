import { style } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

export const ResizeHandle = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: toRem(-3),
  width: toRem(6),
  zIndex: 2,
  cursor: 'col-resize',
  touchAction: 'none',
  selectors: {
    '&:hover, &:active': { background: color.Primary.Main },
  },
});
