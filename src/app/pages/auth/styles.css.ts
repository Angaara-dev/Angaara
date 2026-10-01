import { globalStyle, keyframes, style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const AuthLayout = style({
  minHeight: '100%',
  backgroundColor: '#120c1f',
  backgroundImage: [
    'radial-gradient(ellipse 70% 50% at 70% 110%, rgba(240, 68, 30, 0.5), transparent 70%)',
    'radial-gradient(ellipse 50% 40% at 0% 0%, rgba(126, 58, 242, 0.3), transparent 70%)',
    'linear-gradient(180deg, #120c1f 0%, #2b1347 70%, #4a1730 100%)',
  ].join(', '),
  color: color.Background.OnContainer,
  padding: config.space.S400,
  paddingBottom: 0,
  position: 'relative',
  overflow: 'hidden',
  isolation: 'isolate',
  // Squarer corners on sign-in screens read as sturdier and more trustworthy.
  vars: {
    [config.radii.R300]: toRem(4),
    [config.radii.R400]: toRem(6),
    [config.radii.R500]: toRem(8),
  },
  '@media': {
    'screen and (max-width: 600px)': { padding: config.space.S200, paddingBottom: 0 },
  },
});

const rise = keyframes({
  '0%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 0 },
  '10%': { opacity: 1 },
  '70%': { opacity: 0.8 },
  '100%': { transform: 'translate3d(var(--drift), -85vh, 0) scale(0.3)', opacity: 0 },
});

export const Embers = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: -1,
  '@media': {
    '(prefers-reduced-motion: reduce)': { display: 'none' },
  },
});

export const Ember = style({
  position: 'absolute',
  bottom: toRem(-10),
  borderRadius: '50%',
  background: 'radial-gradient(circle, #FFD2A6 0%, #FF7A45 45%, rgba(240, 68, 30, 0) 70%)',
  boxShadow: '0 0 8px 2px rgba(255, 107, 61, 0.55)',
  opacity: 0,
  animationName: rise,
  animationTimingFunction: 'ease-out',
  animationIterationCount: 'infinite',
});

export const AuthTopBar = style({
  width: '100%',
  maxWidth: toRem(1200),
  padding: `${config.space.S200} ${config.space.S300}`,
});

export const AuthBrand = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: config.space.S200,
  textDecoration: 'none',
});

export const AuthTitle = style({
  fontSize: toRem(24),
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  color: '#FFFFFF',
});

export const AuthMain = style({
  width: '100%',
  flexGrow: 1,
});

export const AuthCard = style({
  maxWidth: toRem(860),
  width: '100%',
  display: 'grid',
  gridTemplateColumns: `minmax(0, 1fr) ${toRem(320)}`,
  backgroundColor: 'rgba(21, 18, 28, 0.86)',
  backdropFilter: 'blur(14px)',
  color: color.Surface.OnContainer,
  borderRadius: toRem(12),
  boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  border: `${config.borderWidth.B300} solid rgba(255, 255, 255, 0.08)`,
  overflow: 'hidden',
  position: 'relative',
  selectors: {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: toRem(2),
      background: 'linear-gradient(90deg, transparent, #FF9A5C, #F0441E, transparent)',
    },
  },
  '@media': {
    'screen and (max-width: 860px)': { gridTemplateColumns: '1fr', maxWidth: toRem(480) },
  },
});

export const AuthSide = style({
  padding: toRem(36),
  textAlign: 'center',
  alignItems: 'center',
  color: '#FFF7F2',
  background: [
    'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(255, 154, 92, 0.28), transparent 70%)',
    'linear-gradient(160deg, #3a1a2e, #24122f)',
  ].join(', '),
  borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
  '@media': {
    'screen and (max-width: 860px)': { display: 'none' },
  },
});

export const AuthSideTitle = style({
  fontSize: toRem(24),
  lineHeight: 1.15,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  margin: 0,
});

export const AuthSideList = style({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S200,
  textAlign: 'left',
  fontSize: toRem(14),
});
globalStyle(`${AuthSideList} li::before`, {
  content: '"✓  "',
  color: '#3CCF7A',
  fontWeight: 700,
});

export const AuthSideLink = style({
  color: '#FF9A5C',
  fontWeight: 600,
});

export const AuthHeadingTitle = style({
  fontSize: toRem(28),
  lineHeight: 1.2,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  textAlign: 'center',
  margin: 0,
});

export const AuthLogo = style([
  DefaultReset,
  {
    width: toRem(26),
    height: toRem(26),
    borderRadius: '50%',
  },
]);

export const AuthCardContent = style({
  width: '100%',
  padding: toRem(36),
  gap: toRem(28),
  '@media': {
    'screen and (max-width: 600px)': { padding: config.space.S400 },
  },
});

export const AuthFooter = style({
  padding: config.space.S400,
  opacity: 0.8,
});
