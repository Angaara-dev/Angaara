import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';
import { PHONE } from '../../styles/phone';

// Ring around the avatar; profile colours set it to their top colour.
const ProfileRing = `var(--angaara-profile-ring, ${color.Surface.Container})`;

export const UserHeader = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1,
  padding: config.space.S200,
});

export const UserHero = style({
  position: 'relative',
});

// Tall banner, taller still on phones where the profile opens as a sheet.
export const UserHeroCoverContainer = style({
  height: toRem(140),
  overflow: 'hidden',
  '@media': { [PHONE]: { height: toRem(176) } },
});
export const UserHeroCover = style({
  height: '100%',
  width: '100%',
  objectFit: 'cover',
  filter: 'blur(16px)',
  transform: 'scale(2)',
});

export const UserHeroBanner = style({
  height: '100%',
  width: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
  userSelect: 'none',
});

export const UserHeroAvatarContainer = style({
  position: 'relative',
  height: toRem(40),
});
export const UserAvatarContainer = style({
  position: 'absolute',
  left: config.space.S400,
  top: 0,
  transform: 'translateY(-50%)',
  borderRadius: '50%',
  backgroundColor: ProfileRing,
});
export const UserHeroAvatar = style({
  width: toRem(88),
  height: toRem(88),
  outline: `${toRem(6)} solid ${ProfileRing}`,
  selectors: {
    'button&': {
      cursor: 'pointer',
    },
  },
});
// Smaller hero for the quick card that opens on click.
export const UserHeroCoverCompact = style({ height: toRem(72) });
export const UserHeroAvatarContainerCompact = style({ height: toRem(24) });
export const UserHeroAvatarCompact = style({
  width: toRem(56),
  height: toRem(56),
  outlineWidth: toRem(4),
});

export const UserHeroAvatarImg = style({
  selectors: {
    [`button${UserHeroAvatar}:hover &`]: {
      filter: 'brightness(0.5)',
    },
  },
});
