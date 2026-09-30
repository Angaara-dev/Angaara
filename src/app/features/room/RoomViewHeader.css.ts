import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const HeaderTopic = style({
  ':hover': {
    cursor: 'pointer',
    opacity: config.opacity.P500,
    textDecoration: 'underline',
  },
});

export const HeaderName = style({
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  ':hover': { textDecoration: 'underline' },
});

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

export const PhoneHeader = style({
  height: toRem(76),
  paddingTop: config.space.S100,
  paddingBottom: config.space.S100,
});
