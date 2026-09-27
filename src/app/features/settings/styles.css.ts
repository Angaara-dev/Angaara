import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const SequenceCardStyle = style({
  padding: config.space.S300,
});

// Phone settings home: grouped rows in rounded cards, like a native app.
export const MobileGroup = style({
  borderRadius: config.radii.R500,
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  overflow: 'hidden',
});

export const MobileRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S400,
  width: '100%',
  minHeight: toRem(56),
  padding: `0 ${config.space.S400}`,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover, &:focus-visible': { backgroundColor: color.Surface.ContainerHover },
    '&:active': { backgroundColor: color.Surface.ContainerActive },
  },
});

// Divider starts after the icon, like native app lists.
export const MobileRowDivider = style({
  height: config.borderWidth.B300,
  marginLeft: toRem(56),
  backgroundColor: color.Surface.ContainerLine,
});

export const MobileProfileBanner = style({
  height: toRem(110),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  borderRadius: `${config.radii.R500} ${config.radii.R500} 0 0`,
});

export const MobileProfileAvatar = style({
  marginTop: `-${toRem(44)}`,
  width: 'fit-content',
  borderRadius: '50%',
  outline: `${toRem(5)} solid ${color.Surface.Container}`,
});
