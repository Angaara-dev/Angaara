import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const SpaceHeader = style({
  position: 'relative',
  flexShrink: 0,
  height: toRem(56),
  overflow: 'hidden',
  isolation: 'isolate',
  borderBottom: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}`,
  selectors: {
    '&[data-art=true]': {
      height: toRem(112),
    },
  },
  '@media': {
    // Phones: a 2:1 banner of the panel width (screen minus the 74px rail), so it isn't squashed.
    '(max-width: 750px) and (pointer: coarse)': {
      selectors: {
        '&[data-art=true]': {
          height: `clamp(${toRem(112)}, calc((100vw - 74px) / 2), 220px)`,
        },
      },
    },
  },
});

// The space avatar, blurred and stretched into a banner.
export const Art = style({
  position: 'absolute',
  inset: toRem(-24),
  zIndex: -2,
  width: `calc(100% + ${toRem(48)})`,
  height: `calc(100% + ${toRem(48)})`,
  objectFit: 'cover',
  filter: 'blur(18px) saturate(1.4)',
  opacity: 0.7,
  pointerEvents: 'none',
});

// A real banner set in space settings, shown sharp.
export const Banner = style({
  position: 'absolute',
  inset: 0,
  zIndex: -2,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
});

export const ArtShade = style({
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  background: `linear-gradient(180deg, transparent 20%, ${color.Background.Container} 100%)`,
  pointerEvents: 'none',
});

export const HeaderButton = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'flex-end',
  gap: config.space.S200,
  padding: `0 ${config.space.S300} ${config.space.S300}`,
  border: 'none',
  background: 'transparent',
  color: color.Background.OnContainer,
  textAlign: 'left',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 120ms ease',
  selectors: {
    [`${SpaceHeader}:not([data-art=true]) &`]: {
      alignItems: 'center',
      paddingBottom: 0,
    },
    '&:hover, &:focus-visible, &[aria-expanded=true]': {
      backgroundColor: `color-mix(in srgb, ${color.Background.ContainerHover} 60%, transparent)`,
    },
    '&:focus-visible': {
      boxShadow: `inset 0 0 0 ${config.borderWidth.B600} ${color.Primary.Main}`,
    },
  },
});

export const Name = style({
  textShadow: `0 1px 8px ${color.Background.Container}`,
});
