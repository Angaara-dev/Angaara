import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const UserPanel = style({
  position: 'relative',
  flexShrink: 0,
  margin: config.space.S200,
  marginTop: 0,
  padding: config.space.S200,
  borderRadius: config.radii.R400,
  background: color.SurfaceVariant.Container,
  border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
  overflow: 'hidden',
  isolation: 'isolate',
  selectors: {
    // With a background image: a dark card, like member rows, so the art and name stand out.
    '&[data-has-bg=true]': {
      backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))',
      boxShadow: `0 ${toRem(2)} ${toRem(8)} rgba(0, 0, 0, 0.35)`,
      textShadow: '0 1px 3px rgba(0, 0, 0, 0.85)',
    },
  },
});

// Your panel background image, dimmed a little so the text stays readable.
export const Background = style({
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

export const Me = style({
  flexGrow: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  padding: config.space.S100,
  border: 'none',
  borderRadius: config.radii.R300,
  background: 'transparent',
  outline: 'none',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:focus-visible': {
      boxShadow: `inset 0 0 0 ${config.borderWidth.B600} ${color.Primary.Main}`,
    },
  },
});

// No hover box: the avatar pops and glows in the accent color, and the name slides over.
const Pop = `${Me}:hover &, ${Me}:focus-visible &, ${Me}[aria-expanded="true"] &`;
const Spring = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const NoMotion = { '(prefers-reduced-motion: reduce)': { transition: 'none' } };

export const AvatarWrap = style({
  position: 'relative',
  display: 'flex',
  flexShrink: 0,
  borderRadius: '50%',
  transition: `transform 220ms ${Spring}, box-shadow 220ms ease`,
  '@media': NoMotion,
  selectors: {
    [Pop]: {
      transform: 'scale(1.12)',
      boxShadow: `0 0 0 ${toRem(2)} ${color.Primary.Main}, 0 0 ${toRem(14)} color-mix(in srgb, ${
        color.Primary.Main
      } 55%, transparent)`,
    },
  },
});

export const MeText = style({
  minWidth: 0,
  transition: `transform 220ms ${Spring}`,
  '@media': NoMotion,
  selectors: {
    [Pop]: {
      transform: `translateX(${toRem(3)})`,
    },
  },
});

// Ring around the status icon, cut out of the avatar.
export const OnlineDot = style({
  position: 'absolute',
  right: toRem(-3),
  bottom: toRem(-3),
  display: 'flex',
  borderRadius: '50%',
  background: color.SurfaceVariant.Container,
  padding: toRem(2),
});

export const MenuCard = style({
  width: `min(${toRem(280)}, calc(100vw - ${toRem(24)}))`,
  overflow: 'hidden',
  pointerEvents: 'auto',
});

export const MenuBanner = style({
  height: toRem(104),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
});
