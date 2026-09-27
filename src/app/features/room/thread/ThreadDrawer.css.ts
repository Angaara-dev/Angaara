import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const ThreadDrawer = style({
  width: toRem(420),
  maxWidth: '100%',
});

export const ThreadDrawerMobile = style({
  width: '100%',
});

export const ThreadDrawerHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const ThreadContentBase = style({
  position: 'relative',
  overflow: 'hidden',
});

export const ThreadContent = style({
  padding: `${config.space.S300} 0`,
});

export const ThreadRepliesDivider = style({
  padding: `${config.space.S200} ${config.space.S400}`,
});

export const ThreadStatus = style({
  padding: config.space.S400,
});

export const ThreadInput = style({
  padding: `0 ${config.space.S300} ${config.space.S300}`,
});
