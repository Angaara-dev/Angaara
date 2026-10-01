import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const TopBar = style({
  position: 'relative',
  height: toRem(28),
  padding: `0 ${config.space.S200}`,
  background: color.Background.Container,
  color: color.Background.OnContainer,
});

export const Title = style({
  minWidth: 0,
  maxWidth: '60%',
});

export const Actions = style({
  position: 'absolute',
  right: config.space.S200,
  top: 0,
  bottom: 0,
});

export const Badge = style({
  position: 'absolute',
  top: toRem(-2),
  right: toRem(-4),
  pointerEvents: 'none',
});

export const InboxPanel = style({
  display: 'flex',
  flexDirection: 'column',
  width: `min(${toRem(520)}, calc(100vw - ${toRem(24)}))`,
  height: `min(${toRem(640)}, calc(100vh - ${toRem(64)}))`,
  borderRadius: config.radii.R400,
  background: color.Surface.Container,
  color: color.Surface.OnContainer,
  border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
  boxShadow: `0 ${toRem(8)} ${toRem(32)} rgba(0, 0, 0, 0.45)`,
  overflow: 'hidden',
});

export const InboxHeader = style({
  flexShrink: 0,
  padding: `${config.space.S300} ${config.space.S300} ${config.space.S200} ${config.space.S400}`,
});

export const Tabs = style({
  flexShrink: 0,
  borderBottom: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});

export const Tab = style({
  flex: 1,
  padding: `${config.space.S200} 0`,
  border: 'none',
  borderBottom: `${toRem(2)} solid transparent`,
  background: 'transparent',
  color: 'inherit',
  opacity: 0.65,
  cursor: 'pointer',
  selectors: {
    '&:hover': { opacity: 0.9 },
    '&[aria-pressed=true]': { opacity: 1, borderBottomColor: color.Primary.Main },
  },
});
