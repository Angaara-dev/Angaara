import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const CallViewContent = style({
  padding: config.space.S400,
  paddingRight: 0,
  minHeight: '100%',
});

export const ControlCard = style({
  padding: config.space.S300,
});

export const ControlDivider = style({
  height: toRem(24),
});

export const CallMemberCard = style({
  padding: config.space.S300,
});

export const CallControlContainer = style({
  padding: config.space.S400,
});

export const PrescreenMessage = style({
  padding: config.space.S200,
});

export const CallOverlay = style({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  // Above the call frame, which is drawn on top of the page.
  zIndex: 1,
  paddingTop: config.space.S700,
  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent)',
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 160ms ease',
  selectors: {
    '&[data-shown=true], &:focus-within': { opacity: 1, pointerEvents: 'auto' },
  },
  '@media': {
    '(hover: none)': { opacity: 1, pointerEvents: 'auto' },
  },
});
