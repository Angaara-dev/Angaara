import React, { CSSProperties } from 'react';
import * as css from './ProfileEffect.css';
import { ProfileEffectId } from './effects';

const vars = (values: Record<string, string | number>) => values as CSSProperties;
const secs = (s: number) => `${s}s`;

// [left %, size px, sway px, sway s, duration s, delay s]
const EMBERS = [
  [88.6, 2.5, 6.3, 1.9, 7.9, 4.8],
  [72.7, 3.5, 10, 2.4, 7.7, 5.7],
  [24.7, 5, 7, 2.6, 7.8, 0.5],
  [46, 4.6, 11.4, 2.7, 5.5, 4.6],
  [66.7, 5.3, 9.2, 2.4, 8.6, 8.2],
  [33.5, 3.6, 10.7, 2.1, 5.6, 2.7],
  [29.7, 3.8, 11.5, 2.4, 7.9, 7.9],
  [27.7, 2.7, 8.5, 2.3, 6.7, 1.7],
  [7.2, 5.2, 6.9, 2.1, 7.7, 8.3],
  [17.6, 4, 7.2, 2, 6.5, 3.8],
  [52, 3.5, 8.9, 1.9, 8.6, 4.1],
  [61.7, 5.1, 9.1, 2.3, 7, 6.2],
  [39.3, 5.3, 9.7, 2, 7.3, 3.2],
  [38.8, 3.5, 10.4, 2.8, 5.4, 7.4],
  [40.2, 2.7, 5.2, 1.7, 9, 2],
  [15.6, 4.4, 7.7, 2.4, 5.6, 8.3],
];

function Embers() {
  return (
    <>
      <span className={css.EmberGlow} />
      {EMBERS.map(([left, size, dx, sw, duration, delay]) => (
        <span
          key={left}
          className={css.Ember}
          style={{
            left: `${left}%`,
            animationDuration: secs(duration),
            animationDelay: secs(-delay),
          }}
        >
          <i
            className={css.EmberSpark}
            style={vars({ '--s': `${size}px`, '--dx': `${dx}px`, '--sw': secs(sw) })}
          />
        </span>
      ))}
    </>
  );
}

type StarSpec = [left: number, top: number, size: number, duration: number, delay: number];

function Stars({ stars }: { stars: StarSpec[] }) {
  return (
    <>
      {stars.map(([left, top, size, duration, delay]) => (
        <span
          key={`${left}-${top}`}
          className={css.Star}
          style={vars({
            left: `${left}%`,
            top: `${top}%`,
            '--s': `${size}px`,
            animationDuration: secs(duration),
            animationDelay: secs(-delay),
          })}
        />
      ))}
    </>
  );
}

const COSMOS_STARS: StarSpec[] = [
  [87.6, 30.3, 1.9, 3.8, 3],
  [27.3, 0.4, 1.2, 1.8, 0],
  [61.1, 7.9, 1.7, 2.8, 2.8],
  [23.6, 30, 1.2, 2.5, 3.6],
  [11.7, 16.6, 1, 3.8, 2.5],
  [91.3, 0.7, 1.9, 2.1, 3.9],
  [56, 23.1, 1.3, 2.1, 0.8],
  [55.9, 1.8, 1.8, 3.3, 2.9],
  [49.3, 1.1, 1.1, 3.8, 0.5],
  [68.1, 30.4, 1, 3.7, 3.4],
  [98.3, 32.4, 1.8, 2.6, 1],
  [72, 30, 1.4, 2.2, 1.6],
  [87.8, 19, 1.4, 3.1, 2.9],
  [33.2, 24.7, 1.4, 2.1, 1.2],
  [97.6, 33.8, 1.6, 3.7, 3.7],
  [19.8, 21.9, 1.1, 2.8, 2.2],
];

function Cosmos() {
  return (
    <>
      <span className={css.Nebula} />
      <Stars stars={COSMOS_STARS} />
      <span className={css.Shoot}>
        <i className={css.ShootTrail} />
      </span>
      <span className={css.System}>
        <span className={css.RingBack} />
        <span className={css.Planet} />
        <span className={css.RingFront} />
        <span className={css.Moon} />
      </span>
    </>
  );
}

// [left %, size px, opacity, blur px, duration s, delay s, sway s]
const LANTERNS = [
  [10, 20, 0.95, 0, 17, 13.1, 4.9],
  [34, 13, 0.6, 0.6, 24, 11.6, 3.4],
  [58, 24, 0.95, 0, 20, 8.9, 3.3],
  [80, 15, 0.7, 0.4, 22, 14.6, 4],
  [92, 11, 0.5, 0.8, 27, 15.2, 4],
];

function Lanterns() {
  return (
    <>
      {LANTERNS.map(([left, size, opacity, blur, duration, delay, sway]) => (
        <span
          key={left}
          className={css.Lantern}
          style={vars({
            left: `${left}%`,
            '--s': `${size}px`,
            '--o': opacity,
            '--b': `${blur}px`,
            animationDuration: secs(duration),
            animationDelay: secs(-delay),
          })}
        >
          <span className={css.LanternSway} style={{ animationDuration: secs(sway) }}>
            <i className={css.LanternBody} />
          </span>
        </span>
      ))}
    </>
  );
}

// [left %, top %, three wander offsets (x, y) px, duration s, delay s, blink s, blink delay s]
const FIREFLIES = [
  [73, 41, 13, -25, -10, 2, -15, 12, 11, 4, 4, 2],
  [10, 74, 17, 22, 21, 9, 24, -25, 14, 10, 4, 4],
  [6, 23, -22, -20, -22, -26, 5, 23, 10, 2, 3, 3],
  [25, 49, 26, -4, 9, 14, -5, -4, 9, 4, 4, 4],
  [17, 86, 0, -20, -15, 5, -17, -22, 11, 10, 4, 2],
  [94, 18, -5, -10, -26, -26, -4, -21, 11, 15, 4, 3],
  [43, 80, 24, 16, 8, 4, -8, -5, 12, 8, 4, 3],
  [64, 63, 12, 20, 18, 25, -3, -1, 16, 16, 3, 0],
  [35, 83, 11, 12, 24, 15, -15, -14, 15, 2, 4, 3],
  [61, 69, 2, -3, 19, 3, 19, -12, 14, 7, 3, 1],
  [57, 31, 21, 17, -8, 10, 20, -20, 11, 15, 3, 1],
  [40, 14, 10, 21, -17, -15, 23, 10, 10, 2, 4, 0],
  [78, 59, 13, -19, -9, 11, 24, 2, 13, 12, 4, 3],
  [58, 20, -24, 6, -14, 4, -13, -14, 13, 10, 4, 1],
  [86, 16, 10, -5, 15, 8, 16, -21, 15, 8, 4, 2],
  [83, 75, 12, 21, 19, -16, 11, -18, 10, 15, 5, 0],
];

function Fireflies() {
  return (
    <>
      <span className={css.FlyHaze} />
      {FIREFLIES.map(([left, top, ax, ay, bx, by, cx, cy, duration, delay, blink, blinkDelay]) => (
        <span
          key={`${left}-${top}`}
          className={css.Fly}
          style={vars({
            left: `${left}%`,
            top: `${top}%`,
            '--ax': `${ax}px`,
            '--ay': `${ay}px`,
            '--bx': `${bx}px`,
            '--by': `${by}px`,
            '--cx': `${cx}px`,
            '--cy': `${cy}px`,
            animationDuration: secs(duration),
            animationDelay: secs(-delay),
          })}
        >
          <i
            className={css.FlyLight}
            style={{ animationDuration: secs(blink), animationDelay: secs(-blinkDelay) }}
          />
        </span>
      ))}
    </>
  );
}

// [left %, colour, scale, opacity, blur px, duration s, delay s]
const JELLIES: [number, string, number, number, number, number, number][] = [
  [10, '#8fd8ff', 0.8, 0.95, 0, 19, 14.8],
  [55, '#ff9ad5', 1, 0.95, 0, 23, 4.3],
  [80, '#b9a2ff', 0.62, 0.65, 0.5, 28, 22.7],
];
// [left px, length px, delay s]; the middle two are the thicker arms
const TENTACLES = [
  [5, 30, 0],
  [10, 38, 0.3],
  [12.5, 26, 0.15],
  [15, 24, 0.45],
  [18, 36, 0.6],
  [22, 30, 0.2],
];
// [left %, duration s, delay s]
const SPECKS = [
  [26.9, 10.8, 1.8],
  [19.9, 11.6, 3],
  [59.5, 12.5, 11.3],
  [76.9, 12, 13],
  [67.1, 9.7, 9.4],
  [72.2, 14.3, 8.7],
  [94.8, 10.7, 14.9],
  [3.7, 9.6, 4.6],
  [83.9, 14.4, 10.9],
  [53.6, 10.4, 8],
];

function Jellyfish() {
  return (
    <>
      {SPECKS.map(([left, duration, delay]) => (
        <span
          key={left}
          className={css.Speck}
          style={{
            left: `${left}%`,
            animationDuration: secs(duration),
            animationDelay: secs(-delay),
          }}
        />
      ))}
      {JELLIES.map(([left, colour, scale, opacity, blur, duration, delay]) => (
        <span
          key={left}
          className={css.Jelly}
          style={vars({
            left: `${left}%`,
            '--c': colour,
            '--js': scale,
            '--o': opacity,
            '--b': `${blur}px`,
            animationDuration: secs(duration),
            animationDelay: secs(-delay),
          })}
        >
          <span className={css.JellyBody}>
            <span className={css.Bell} />
            {TENTACLES.map(([x, length, sway], k) => (
              <span
                key={x}
                className={k === 2 || k === 3 ? `${css.Tentacle} ${css.TentacleArm}` : css.Tentacle}
                style={vars({ left: `${x}px`, '--h': `${length}px`, animationDelay: secs(-sway) })}
              />
            ))}
          </span>
        </span>
      ))}
    </>
  );
}

const RENDERERS: Record<ProfileEffectId, () => JSX.Element> = {
  embers: Embers,
  cosmos: Cosmos,
  lanterns: Lanterns,
  fireflies: Fireflies,
  jellyfish: Jellyfish,
};

// Sits over the whole card; the parent needs position: relative.
export function ProfileEffect({ effect }: { effect: ProfileEffectId }) {
  const Render = RENDERERS[effect];
  return (
    <div className={css.Layer} aria-hidden="true">
      <Render />
    </div>
  );
}
