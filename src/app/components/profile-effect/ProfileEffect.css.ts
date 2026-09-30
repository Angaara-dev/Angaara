import { globalStyle, keyframes, style } from '@vanilla-extract/css';

export const Layer = style({
  position: 'absolute',
  inset: 0,
  zIndex: 1,
  overflow: 'hidden',
  borderRadius: 'inherit',
  pointerEvents: 'none',
  containerType: 'size',
});

const abs = { position: 'absolute' } as const;
const dot = { display: 'block', borderRadius: '50%' } as const;

const rise = keyframes({
  '0%': { transform: 'translateY(0)', opacity: 0 },
  '10%': { opacity: 1 },
  '75%': { opacity: 0.85 },
  '100%': { transform: 'translateY(-104cqh)', opacity: 0 },
});
const sway = keyframes({
  from: { transform: 'translateX(calc(var(--dx) * -1))' },
  to: { transform: 'translateX(var(--dx))' },
});
const flicker = keyframes({ from: { opacity: 1 }, to: { opacity: 0.55 } });
const pulse = keyframes({ from: { opacity: 0.55 }, to: { opacity: 1 } });
const twinkle = keyframes({
  from: { opacity: 0.15, transform: 'scale(0.6)' },
  to: { opacity: 1, transform: 'scale(1)' },
});

/* Embers */
export const EmberGlow = style({
  ...abs,
  left: 0,
  right: 0,
  bottom: 0,
  height: '38%',
  background:
    'radial-gradient(ellipse 70% 100% at 50% 120%, rgba(255, 106, 46, 0.32), transparent 70%)',
  animation: `${pulse} 3.2s ease-in-out infinite alternate`,
});
export const Ember = style({
  ...abs,
  bottom: -8,
  animation: `${rise} linear infinite`,
});
export const EmberSpark = style({
  ...dot,
  width: 'var(--s)',
  height: 'var(--s)',
  background: 'radial-gradient(circle, #fff4e6 0%, #ffb27a 38%, #ff6a2e 70%, transparent 72%)',
  boxShadow: '0 0 6px 1px rgba(255, 110, 40, 0.55)',
  animation: `${sway} var(--sw) ease-in-out infinite alternate, ${flicker} 0.9s ease-in-out infinite alternate`,
});

/* Cosmos */
export const Star = style({
  ...abs,
  borderRadius: '50%',
  width: 'var(--s)',
  height: 'var(--s)',
  background: '#fff',
  boxShadow: '0 0 4px rgba(200, 220, 255, 0.8)',
  animation: `${twinkle} ease-in-out infinite alternate`,
});
export const Nebula = style({
  ...abs,
  width: '70%',
  height: '34%',
  right: '-12%',
  top: '-8%',
  borderRadius: '50%',
  background:
    'radial-gradient(ellipse at center, rgba(160, 110, 255, 0.35), rgba(80, 60, 200, 0.12) 45%, transparent 70%)',
  filter: 'blur(6px)',
  animation: `${pulse} 6s ease-in-out infinite alternate`,
});
const shoot = keyframes({
  '0%, 78%': { opacity: 0, transform: 'translateX(-64px)' },
  '80%': { opacity: 1 },
  '90%': { opacity: 0.9 },
  '95%, 100%': { opacity: 0, transform: 'translateX(170px)' },
});
export const Shoot = style({
  ...abs,
  left: '6%',
  top: -6,
  transform: 'rotate(33deg)',
  transformOrigin: 'left center',
});
export const ShootTrail = style({
  display: 'block',
  position: 'relative',
  width: 64,
  height: 2,
  opacity: 0,
  borderRadius: 2,
  background: 'linear-gradient(90deg, transparent, rgba(200, 220, 255, 0.5) 60%, #fff)',
  animation: `${shoot} 7s ease-in infinite`,
  selectors: {
    '&::after': {
      content: '',
      position: 'absolute',
      right: -2,
      top: -2,
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 0 8px 2px rgba(190, 215, 255, 0.9)',
    },
  },
});
const bob = keyframes({
  from: { transform: 'translateY(-3px) rotate(-2deg)' },
  to: { transform: 'translateY(4px) rotate(2deg)' },
});
export const System = style({
  ...abs,
  right: 18,
  top: 10,
  width: 92,
  height: 70,
  animation: `${bob} 7s ease-in-out infinite alternate`,
});
export const Planet = style({
  ...abs,
  left: 23,
  top: 12,
  width: 46,
  height: 46,
  borderRadius: '50%',
  zIndex: 2,
  background: [
    'radial-gradient(circle at 32% 30%, rgba(255, 255, 255, 0.55), transparent 38%)',
    'repeating-linear-gradient(-18deg, rgba(255, 255, 255, 0.07) 0 4px, transparent 4px 9px)',
    'radial-gradient(circle at 40% 40%, #b38cff, #6a45d6 55%, #2a1760 100%)',
  ].join(', '),
  boxShadow: '0 0 18px rgba(150, 110, 255, 0.55), inset -8px -6px 14px rgba(10, 0, 40, 0.6)',
});
const ring = {
  ...abs,
  left: 4,
  top: 27,
  width: 84,
  height: 18,
  borderRadius: '50%',
  border: '2.5px solid rgba(255, 214, 170, 0.8)',
  boxShadow: '0 0 6px rgba(255, 190, 140, 0.45)',
  transform: 'rotate(-16deg)',
} as const;
export const RingBack = style({ ...ring, zIndex: 1, clipPath: 'inset(0 0 50% 0)' });
export const RingFront = style({ ...ring, zIndex: 3, clipPath: 'inset(50% 0 0 0)' });
const orbit = keyframes({
  '0%': { offsetDistance: '0%', zIndex: 4 },
  '50%': { offsetDistance: '50%', zIndex: 4 },
  '50.1%': { zIndex: 0 },
  '100%': { offsetDistance: '100%', zIndex: 0 },
});
export const Moon = style({
  ...abs,
  left: 0,
  top: 0,
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 35%, #fff, #c9d4ff 60%, #8a93c8)',
  boxShadow: '0 0 6px rgba(200, 215, 255, 0.7)',
  offsetPath: "path('M -2 48.8 A 50 14 -16 1 0 94 21.2 A 50 14 -16 1 0 -2 48.8')",
  animation: `${orbit} 9s linear infinite`,
});

/* Lanterns */
const lanternRise = keyframes({
  from: { transform: 'translateY(0)' },
  to: { transform: 'translateY(calc(-100cqh - 70px))' },
});
const lanternSway = keyframes({
  from: { transform: 'translateX(-4px) rotate(-5deg)' },
  to: { transform: 'translateX(4px) rotate(5deg)' },
});
const lanternGlow = keyframes({
  from: { filter: 'brightness(0.88)' },
  to: { filter: 'brightness(1.15)' },
});
export const Lantern = style({
  ...abs,
  bottom: -44,
  opacity: 'var(--o)',
  filter: 'blur(var(--b))',
  animation: `${lanternRise} linear infinite`,
});
export const LanternSway = style({
  display: 'block',
  animation: `${lanternSway} ease-in-out infinite alternate`,
});
export const LanternBody = style({
  display: 'block',
  position: 'relative',
  width: 'var(--s)',
  height: 'calc(var(--s) * 1.25)',
  borderRadius: '42% 42% 30% 30% / 40% 40% 32% 32%',
  background:
    'radial-gradient(ellipse 62% 58% at 50% 72%, #fff7d6 0%, #ffd06a 28%, #ff8a2e 64%, #c2410c 100%)',
  boxShadow: [
    '0 0 calc(var(--s) * 0.9) calc(var(--s) * 0.25) rgba(255, 150, 60, 0.45)',
    'inset 0 2px 0 rgba(90, 30, 5, 0.55)',
    'inset 0 -2px 0 rgba(90, 30, 5, 0.45)',
  ].join(', '),
  animation: `${lanternGlow} 2.2s ease-in-out infinite alternate`,
  selectors: {
    '&::before': {
      content: '',
      position: 'absolute',
      inset: '2px 30%',
      borderLeft: '1px solid rgba(150, 55, 10, 0.35)',
      borderRight: '1px solid rgba(150, 55, 10, 0.35)',
      borderRadius: '40%',
    },
  },
});

/* Fireflies */
const wander = keyframes({
  '0%, 100%': { transform: 'translate(0, 0)' },
  '25%': { transform: 'translate(var(--ax), var(--ay))' },
  '50%': { transform: 'translate(var(--bx), var(--by))' },
  '75%': { transform: 'translate(var(--cx), var(--cy))' },
});
const blink = keyframes({
  '0%, 30%': { opacity: 0.06 },
  '45%': { opacity: 1 },
  '62%': { opacity: 0.85 },
  '80%, 100%': { opacity: 0.06 },
});
export const FlyHaze = style({
  ...abs,
  left: 0,
  right: 0,
  bottom: 0,
  height: '50%',
  background:
    'radial-gradient(ellipse 85% 100% at 50% 115%, rgba(150, 220, 90, 0.12), transparent 70%)',
});
export const Fly = style({ ...abs, animation: `${wander} ease-in-out infinite` });
export const FlyLight = style({
  ...dot,
  width: 3,
  height: 3,
  background: '#fbffd6',
  boxShadow: '0 0 5px 2px rgba(214, 255, 120, 0.85), 0 0 16px 6px rgba(170, 255, 80, 0.3)',
  animation: `${blink} ease-in-out infinite`,
});

/* Jellyfish */
const jellyRise = keyframes({
  from: { transform: 'translate(0, 0)' },
  '50%': { transform: 'translate(10px, calc(-50cqh - 40px))' },
  to: { transform: 'translate(0, calc(-100cqh - 80px))' },
});
const bellPulse = keyframes({
  '0%, 100%': { transform: 'scale(1, 1)' },
  '45%': { transform: 'scale(0.82, 1.12)' },
});
const tentacleSway = keyframes({
  from: { transform: 'rotate(-9deg) skewX(6deg)' },
  to: { transform: 'rotate(9deg) skewX(-6deg)' },
});
export const Speck = style({
  ...abs,
  bottom: -4,
  width: 2,
  height: 2,
  borderRadius: '50%',
  background: 'rgba(200, 225, 255, 0.5)',
  animation: `${rise} linear infinite`,
});
export const Jelly = style({
  ...abs,
  bottom: -80,
  width: 28,
  height: 64,
  opacity: 'var(--o)',
  filter: 'blur(var(--b))',
  animation: `${jellyRise} linear infinite`,
});
export const JellyBody = style({
  display: 'block',
  position: 'relative',
  width: 28,
  height: 64,
  transform: 'scale(var(--js))',
  transformOrigin: 'top center',
});
export const Bell = style({
  ...abs,
  left: 0,
  top: 0,
  width: 28,
  height: 20,
  zIndex: 1,
  borderRadius: '50% 50% 45% 45% / 80% 80% 25% 25%',
  background: [
    'radial-gradient(ellipse 70% 80% at 50% 25%, rgba(255, 255, 255, 0.85)',
    'color-mix(in srgb, var(--c) 70%, transparent) 45%',
    'color-mix(in srgb, var(--c) 25%, transparent) 80%',
    'transparent)',
  ].join(', '),
  boxShadow: '0 0 14px 2px color-mix(in srgb, var(--c) 55%, transparent)',
  transformOrigin: '50% 20%',
  animation: `${bellPulse} 1.8s ease-in-out infinite`,
  selectors: {
    '&::after': {
      content: '',
      position: 'absolute',
      left: '14%',
      right: '14%',
      bottom: 1,
      height: 4,
      borderRadius: '50%',
      background: 'color-mix(in srgb, var(--c) 80%, white)',
      opacity: 0.55,
    },
  },
});
export const Tentacle = style({
  ...abs,
  top: 16,
  width: 1.5,
  height: 'var(--h)',
  borderRadius: 2,
  background: 'linear-gradient(to bottom, color-mix(in srgb, var(--c) 70%, white), transparent)',
  transformOrigin: 'top center',
  animation: `${tentacleSway} 1.8s ease-in-out infinite alternate`,
});
export const TentacleArm = style({ width: 3, opacity: 0.75 });

// A still frame instead of motion; the negative delays keep things spread out.
globalStyle(`${Layer} *`, {
  '@media': {
    '(prefers-reduced-motion: reduce)': { animationPlayState: 'paused' },
  },
});
