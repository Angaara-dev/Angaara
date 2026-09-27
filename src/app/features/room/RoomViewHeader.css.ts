import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const HeaderTopic = style({
  ':hover': {
    cursor: 'pointer',
    opacity: config.opacity.P500,
    textDecoration: 'underline',
  },
});

// PC: the room name opens the room info window.
export const HeaderName = style({
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  ':hover': { textDecoration: 'underline' },
});

// Phones: the room name is one big tap target that opens room info and members.
export const HeaderInfoButton = style({
  minWidth: 0,
  height: toRem(64),
  padding: `0 ${config.space.S200}`,
  border: 'none',
  borderRadius: config.radii.R400,
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:active': { backgroundColor: color.Surface.ContainerActive },
  },
});

// Phones: a taller header, so the room name is easy to tap.
export const PhoneHeader = style({
  height: toRem(76),
  paddingTop: config.space.S100,
  paddingBottom: config.space.S100,
});
