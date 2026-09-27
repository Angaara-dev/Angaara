import { keyframes, style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

// A warm glow rising from the bottom of the page, like sitting by a fire.
export const AuthLayout = style({
  minHeight: '100%',
  backgroundColor: color.Background.Container,
  backgroundImage: [
    'radial-gradient(ellipse 70% 45% at 50% 110%, rgba(255, 107, 61, 0.32), transparent 70%)',
    'radial-gradient(ellipse 40% 30% at 50% 100%, rgba(255, 154, 92, 0.22), transparent 70%)',
    'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255, 107, 61, 0.06), transparent 70%)',
  ].join(', '),
  color: color.Background.OnContainer,
  padding: config.space.S400,
  paddingBottom: 0,
  position: 'relative',
  overflow: 'hidden',
  isolation: 'isolate',
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

export const AuthHero = style({
  marginTop: '4vh',
  textAlign: 'center',
});

export const AuthTitle = style({
  fontSize: toRem(40),
  lineHeight: 1.1,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  background: 'linear-gradient(180deg, #FFFFFF 30%, #FFC8A3 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

export const AuthCard = style({
  maxWidth: toRem(440),
  width: '100%',
  backgroundColor: 'rgba(21, 21, 23, 0.82)',
  backdropFilter: 'blur(12px)',
  color: color.Surface.OnContainer,
  borderRadius: config.radii.R500,
  boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04)',
  border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
  overflow: 'hidden',
  position: 'relative',
  selectors: {
    // Fiery top edge.
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
  maxWidth: toRem(402),
  width: '100%',
  margin: 'auto',
  padding: config.space.S400,
  paddingTop: config.space.S600,
  paddingBottom: toRem(40),
  gap: toRem(36),
});

export const AuthFooter = style({
  padding: config.space.S400,
  opacity: 0.8,
});
