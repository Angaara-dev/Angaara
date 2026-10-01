import { globalStyle, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const Panel = style({
  width: toRem(300),
  maxWidth: 'calc(100vw - 24px)',
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S300,
  padding: config.space.S300,
  borderRadius: config.radii.R400,
  background: color.Surface.Container,
  border: `1px solid ${color.Surface.ContainerLine}`,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
});

export const Graph = style({
  position: 'relative',
  height: toRem(72),
  padding: `${toRem(4)} ${toRem(28)} ${toRem(4)} 0`,
  borderRadius: config.radii.R300,
  background: color.Background.Container,
  overflow: 'hidden',
});

globalStyle(`${Graph} svg`, { display: 'block', width: '100%', height: '100%' });

export const Line = style({
  fill: 'none',
  stroke: color.Primary.Main,
  strokeWidth: 2,
  vectorEffect: 'non-scaling-stroke',
  strokeLinejoin: 'round',
});

export const SlowLine = style({
  stroke: color.Warning.Main,
  strokeOpacity: 0.35,
  strokeDasharray: '4 4',
  vectorEffect: 'non-scaling-stroke',
});

const axis = {
  position: 'absolute',
  right: toRem(6),
  fontSize: toRem(10),
  color: color.Background.OnContainer,
  opacity: 0.6,
} as const;

export const AxisTop = style({ ...axis, top: toRem(4) });
export const AxisBottom = style({ ...axis, bottom: toRem(4) });

export const Secure = style({
  padding: `${config.space.S200} ${config.space.S300}`,
  borderRadius: config.radii.R300,
  background: color.SurfaceVariant.Container,
});
