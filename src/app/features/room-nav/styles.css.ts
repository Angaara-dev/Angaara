import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const CategoryButton = style({
  flexGrow: 1,
});
export const CategoryButtonIcon = style({
  opacity: config.opacity.P400,
});

// Rows nested under a channel or DM, with a guide line tying them to it.
export const Children = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  paddingLeft: toRem(20),
  '::before': {
    content: '""',
    position: 'absolute',
    left: toRem(19),
    top: 0,
    bottom: toRem(4),
    width: toRem(1),
    background: color.Background.ContainerLine,
  },
});
