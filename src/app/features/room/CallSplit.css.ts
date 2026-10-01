import { style } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

export const CallArea = style({
  flexShrink: 0,
  height: '45%',
  minHeight: toRem(160),
  display: 'flex',
});

export const Handle = style({
  flexShrink: 0,
  height: toRem(6),
  cursor: 'row-resize',
  background: color.Surface.ContainerLine,
  touchAction: 'none',
  selectors: {
    '&:hover, &:active': { background: color.Primary.Main },
  },
});
