import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const TopBar = style({
  position: 'relative',
  height: toRem(36),
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
  top: toRem(2),
  right: toRem(-2),
  pointerEvents: 'none',
});
