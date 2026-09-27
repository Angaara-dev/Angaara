import { keyframes, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';
import { themeBackdrop } from '../../styles/themeBackdrop';

const SHADE = 'var(--angaara-theme-shade, transparent)';

// On themed servers: the server gradient, shaded darker so member names stand out.
export const MembersDrawer = style({
  width: toRem(266),
  selectors: {
    // Doubled so it beats the Background container's own gradient.
    '&&': {
      backgroundImage: `linear-gradient(${SHADE}, ${SHADE}), var(--angaara-theme-bg, none)`,
      backgroundAttachment: 'fixed',
    },
  },
});

export const MembersDrawerHeader = style({
  flexShrink: 0,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const MemberDrawerContentBase = style({
  position: 'relative',
  overflow: 'hidden',
  minHeight: 0,
});

export const MemberDrawerContent = style({
  padding: `${config.space.S200} 0`,
});

const ScrollBtnAnime = keyframes({
  '0%': {
    transform: `translate(-50%, -100%) scale(0)`,
  },
  '100%': {
    transform: `translate(-50%, 0) scale(1)`,
  },
});

export const DrawerScrollTop = style({
  position: 'absolute',
  top: config.space.S200,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1,
  animation: `${ScrollBtnAnime} 100ms`,
});

export const DrawerGroup = style({
  paddingLeft: config.space.S200,
});

// Even space on both sides, so rows with a user-bar background don't run into the edges.
export const MembersGroup = style({
  padding: `0 ${config.space.S200}`,
});
export const MembersGroupLabel = style({
  padding: config.space.S200,
  selectors: {
    '&:not(:first-child)': {
      paddingTop: config.space.S500,
    },
  },
});

export const DrawerVirtualItem = style({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  // A small gap, so neighbouring rows' backgrounds don't merge into one block.
  paddingBottom: toRem(2),
});

// Phone page mode: full width, each role group drawn as one rounded card.
// Fills the phone page so only the list scrolls and the room header stays put.
export const MembersPage = style({
  width: '100%',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
});

export const PageGroupLabel = style({
  padding: `${config.space.S500} ${config.space.S100} ${config.space.S200}`,
});

export const PageRow = style({
  backgroundColor: color.Surface.Container,
  ...themeBackdrop('surface'),
  overflow: 'hidden',
  selectors: {
    '&[data-first=true]': {
      borderTopLeftRadius: config.radii.R500,
      borderTopRightRadius: config.radii.R500,
    },
    '&[data-last=true]': {
      borderBottomLeftRadius: config.radii.R500,
      borderBottomRightRadius: config.radii.R500,
    },
    '&:not([data-first=true])': {
      borderTop: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
    },
  },
});

export const MemberRow = style({
  position: 'relative',
  isolation: 'isolate',
  overflow: 'hidden',
  selectors: {
    // Rows with a user-bar background become dark cards, so the art and name stand out.
    '&[data-has-bg=true]': {
      backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))',
      boxShadow: `inset 0 0 0 1px rgba(255, 255, 255, 0.07), 0 ${toRem(2)} ${toRem(
        6
      )} rgba(0, 0, 0, 0.3)`,
      textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
    },
  },
});

// The member's own user-bar background, faded like on the user panel.
export const MemberBg = style({
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  opacity: 0.85,
  filter: 'brightness(0.8) saturate(1.15)',
  maskImage: 'linear-gradient(90deg, black 45%, transparent 100%)',
  pointerEvents: 'none',
});
