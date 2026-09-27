import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const Embed = style({
  maxWidth: toRem(520),
  marginTop: config.space.S100,
  padding: `${config.space.S300} ${config.space.S400}`,
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S200,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
  borderLeft: `${toRem(4)} solid ${color.Primary.Main}`,
  borderRadius: config.radii.R400,
});

export const Title = style({
  fontWeight: config.fontWeight.W600,
  overflowWrap: 'anywhere',
});

export const Text = style({
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});

export const Fields = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: `${config.space.S200} ${config.space.S300}`,
});

export const Field = style({
  gridColumn: '1 / -1',
  minWidth: 0,
  selectors: {
    '&[data-inline=true]': {
      gridColumn: 'auto',
    },
  },
});
