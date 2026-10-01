import { createVar, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const Panel = style({
  width: toRem(340),
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: toRem(440),
  display: 'flex',
  flexDirection: 'column',
  borderRadius: config.radii.R400,
  background: color.Surface.Container,
  border: `1px solid ${color.Surface.ContainerLine}`,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
  overflow: 'hidden',
});

export const PanelHeader = style({
  flexShrink: 0,
  padding: `${config.space.S200} ${config.space.S300}`,
  borderBottom: `1px solid ${color.Surface.ContainerLine}`,
});

export const PanelBody = style({
  padding: config.space.S300,
});

export const VolumeRow = style({
  flexShrink: 0,
  padding: `${config.space.S300} ${config.space.S300} ${config.space.S200}`,
  borderBottom: `1px solid ${color.Surface.ContainerLine}`,
});

export const volumeFill = createVar();

const track = {
  height: toRem(6),
  borderRadius: toRem(3),
  background: `linear-gradient(to right, ${color.Primary.Main} ${volumeFill}, ${color.SurfaceVariant.ContainerActive} ${volumeFill})`,
};
const thumb = {
  width: toRem(16),
  height: toRem(16),
  border: 'none',
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
  cursor: 'pointer',
};

// A filled track with a round white knob, drawn the same in every browser.
export const Volume = style({
  vars: { [volumeFill]: '70%' },
  WebkitAppearance: 'none',
  appearance: 'none',
  width: '100%',
  height: toRem(16),
  margin: 0,
  background: 'transparent',
  cursor: 'pointer',
  selectors: {
    '&::-webkit-slider-runnable-track': track,
    '&::-moz-range-track': track,
    '&::-webkit-slider-thumb': { ...thumb, WebkitAppearance: 'none', marginTop: toRem(-5) },
    '&::-moz-range-thumb': thumb,
    '&:disabled': { opacity: 0.5, cursor: 'default' },
    '&:focus-visible': { outline: `2px solid ${color.Primary.Main}`, outlineOffset: toRem(4) },
  },
});

export const Grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: config.space.S100,
});

export const Tile = style({
  position: 'relative',
  borderRadius: config.radii.R300,
  background: color.SurfaceVariant.Container,
  transition: 'transform 120ms ease, box-shadow 120ms ease',
  selectors: {
    '&:hover': { background: color.SurfaceVariant.ContainerHover },
    '&[data-playing=true]': {
      transform: 'scale(0.96)',
      boxShadow: `0 0 0 2px ${color.Primary.Main}`,
    },
  },
});

export const TileMain = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: toRem(2),
  width: '100%',
  minWidth: 0,
  padding: `${config.space.S200} ${config.space.S100}`,
  border: 'none',
  borderRadius: 'inherit',
  background: 'transparent',
  color: color.SurfaceVariant.OnContainer,
  cursor: 'pointer',
  selectors: {
    '&:disabled': { cursor: 'default', opacity: 0.6 },
  },
});

export const Emoji = style({
  fontSize: toRem(22),
  lineHeight: 1.1,
});

export const TileActions = style({
  position: 'absolute',
  top: toRem(2),
  right: toRem(2),
  display: 'flex',
  gap: toRem(2),
  opacity: 0,
  transition: 'opacity 120ms ease',
  selectors: {
    [`${Tile}:hover &, ${Tile}:focus-within &`]: { opacity: 1 },
  },
});

export const TileAction = style({
  display: 'grid',
  placeItems: 'center',
  width: toRem(18),
  height: toRem(18),
  padding: 0,
  border: 'none',
  borderRadius: config.radii.R300,
  background: color.Surface.Container,
  color: color.Surface.OnContainer,
  cursor: 'pointer',
  selectors: {
    '&:hover': { background: color.Surface.ContainerActive },
  },
});

export const AddTile = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: toRem(2),
  minHeight: toRem(56),
  border: `1px dashed ${color.SurfaceVariant.ContainerLine}`,
  borderRadius: config.radii.R300,
  background: 'transparent',
  color: color.SurfaceVariant.OnContainer,
  cursor: 'pointer',
  selectors: {
    '&:hover': { background: color.SurfaceVariant.ContainerHover },
  },
});
