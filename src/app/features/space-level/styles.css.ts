import { keyframes, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const LevelPill = style({
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  width: '100%',
  height: toRem(40),
  marginBottom: config.space.S200,
  padding: `0 ${config.space.S300} 0 ${config.space.S400}`,
  border: 'none',
  borderRadius: config.radii.Pill,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  cursor: 'pointer',
  selectors: {
    '&:hover': { backgroundColor: color.SurfaceVariant.ContainerHover },
    '&:active': { backgroundColor: color.SurfaceVariant.ContainerActive },
  },
  '@media': {
    '(hover: hover) and (pointer: fine)': {
      height: toRem(32),
      gap: config.space.S100,
      padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
    },
  },
});

export const LevelPillFill = style({
  position: 'absolute',
  inset: 0,
  right: 'auto',
  borderRadius: config.radii.Pill,
  background: `linear-gradient(90deg, color-mix(in srgb, ${color.Primary.Main} 15%, transparent), color-mix(in srgb, ${color.Primary.Main} 45%, transparent))`,
  pointerEvents: 'none',
});

export const Stats = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  borderTop: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}`,
  borderBottom: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}`,
});

export const Stat = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: config.space.S100,
  padding: `${config.space.S400} ${config.space.S200}`,
  selectors: {
    '& + &': { borderLeft: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}` },
  },
});

export const Cards = style({
  display: 'flex',
  gap: config.space.S300,
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  scrollPadding: `0 ${config.space.S400}`,
  padding: `${config.space.S100} ${config.space.S400} ${config.space.S300}`,
  scrollbarWidth: 'none',
  maskImage: `linear-gradient(90deg, transparent, #000 ${toRem(16)}, #000 calc(100% - ${toRem(
    16
  )}), transparent)`,
  WebkitMaskImage: `linear-gradient(90deg, transparent, #000 ${toRem(16)}, #000 calc(100% - ${toRem(
    16
  )}), transparent)`,
  selectors: {
    '&::-webkit-scrollbar': { display: 'none' },
    '&[data-arrows=true]': {
      paddingLeft: toRem(56),
      paddingRight: toRem(56),
      scrollPadding: `0 ${toRem(56)}`,
      maskImage: `linear-gradient(90deg, transparent ${toRem(40)}, #000 ${toRem(
        64
      )}, #000 calc(100% - ${toRem(64)}), transparent calc(100% - ${toRem(40)}))`,
      WebkitMaskImage: `linear-gradient(90deg, transparent ${toRem(40)}, #000 ${toRem(
        64
      )}, #000 calc(100% - ${toRem(64)}), transparent calc(100% - ${toRem(40)}))`,
    },
  },
});

export const Card = style({
  flex: `0 0 min(82%, ${toRem(300)})`,
  scrollSnapAlign: 'start',
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S400,
  minHeight: toRem(230),
  padding: config.space.S400,
  borderRadius: config.radii.R500,
  backgroundColor: color.SurfaceVariant.Container,
  border: `${config.borderWidth.B300} solid transparent`,
  selectors: {
    '&[data-state=current]': { borderColor: color.Success.Main },
  },
});

export const Track = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
});

export const Node = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: toRem(32),
  height: toRem(32),
  borderRadius: '50%',
  backgroundColor: color.SurfaceVariant.ContainerActive,
  color: color.SurfaceVariant.OnContainer,
  selectors: {
    '&[data-on=true]': { backgroundColor: color.Primary.Main, color: color.Primary.OnMain },
  },
});

export const Bar = style({
  flexGrow: 1,
  height: toRem(4),
  borderRadius: config.radii.Pill,
  backgroundColor: color.SurfaceVariant.ContainerActive,
  overflow: 'hidden',
});

export const BarFill = style({
  height: '100%',
  borderRadius: config.radii.Pill,
  background: `linear-gradient(90deg, ${color.Primary.Main}, color-mix(in srgb, ${color.Primary.Main} 35%, transparent))`,
});

export const ArrowButton = style({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 1,
});

const flicker = keyframes({
  '0%': { opacity: 0.65, transform: 'scaleX(1)' },
  '40%': { opacity: 0.9, transform: 'scaleX(1.04)' },
  '70%': { opacity: 0.75, transform: 'scaleX(0.98)' },
  '100%': { opacity: 1, transform: 'scaleX(1.02)' },
});

const rise = keyframes({
  '0%': { transform: 'translate(0, 0) scale(1)', opacity: 0 },
  '12%': { opacity: 1 },
  '100%': {
    transform: 'translate(var(--ember-drift), calc(-1 * var(--ember-rise))) scale(0.3)',
    opacity: 0,
  },
});

export const EmberLayer = style({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: 0,
  borderRadius: 'inherit',
});

export const EmberGlow = style({
  position: 'absolute',
  left: '-15%',
  right: '-15%',
  bottom: '-45%',
  height: '80%',
  transformOrigin: '50% 100%',
  background:
    'radial-gradient(ellipse at 50% 100%, rgba(255, 122, 40, 0.34), rgba(255, 84, 20, 0.12) 42%, transparent 70%)',
  animation: `${flicker} 3.6s ease-in-out infinite alternate`,
});

export const Spark = style({
  position: 'absolute',
  bottom: 0,
  width: 'var(--ember-size)',
  height: 'var(--ember-size)',
  borderRadius: '50%',
  background: '#ffc070',
  boxShadow: '0 0 4px 1px rgba(255, 140, 50, 0.7)',
  opacity: 0,
  animation: `${rise} var(--ember-dur) linear var(--ember-delay) infinite`,
});

export const AboveEmbers = style({
  position: 'relative',
  zIndex: 1,
});
