import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const VoicePanel = style({
  flexShrink: 0,
  margin: `0 ${config.space.S200} ${config.space.S100}`,
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S100} ${config.space.S300}`,
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
