import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const VoicePanel = style({
  flexShrink: 0,
  margin: `0 ${config.space.S200} ${config.space.S100}`,
  padding: config.space.S200,
  borderRadius: config.radii.R400,
  background: color.SurfaceVariant.Container,
  border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
});

export const Channel = style({
  display: 'block',
  minWidth: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover': { textDecoration: 'underline' },
  },
});

export const Badge = style({
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  width: toRem(32),
  height: toRem(32),
  borderRadius: config.radii.R300,
  background: color.SurfaceVariant.ContainerActive,
});

export const Tiles = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: config.space.S100,
});

export const Tile = style({
  display: 'grid',
  placeItems: 'center',
  height: toRem(32),
  padding: 0,
  border: 'none',
  borderRadius: config.radii.R300,
  background: color.SurfaceVariant.ContainerHover,
  color: color.SurfaceVariant.OnContainer,
  cursor: 'pointer',
  selectors: {
    '&:hover:not(:disabled)': { background: color.SurfaceVariant.ContainerActive },
    '&[data-tone=off]': { color: color.Critical.Main },
    '&[data-tone=on]': { color: color.Success.Main },
    '&:disabled': { opacity: 0.5, cursor: 'default' },
  },
});
