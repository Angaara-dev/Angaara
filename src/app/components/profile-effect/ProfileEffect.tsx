import React, { CSSProperties } from 'react';
import * as css from './ProfileEffect.css';
import { ProfileEffectId } from './effects';

// [left %, size px, duration s, delay s, drift px]
const EMBERS: [number, number, number, number, number][] = [
  [4, 4, 7, 0, 10],
  [12, 3, 9, 3.5, -8],
  [21, 5, 8, 1.2, 14],
  [30, 3, 10, 6, -12],
  [38, 4, 7.5, 2.4, 8],
  [47, 3, 9.5, 4.8, -6],
  [55, 5, 8.5, 0.6, 12],
  [63, 3, 7, 5.4, -10],
  [71, 4, 9, 1.8, 6],
  [79, 3, 10, 3, -14],
  [87, 5, 8, 4.2, 10],
  [95, 3, 7.5, 2, -8],
];

function Embers() {
  return (
    <>
      {EMBERS.map(([left, size, duration, delay, drift]) => (
        <span
          key={left}
          className={css.Ember}
          style={
            {
              left: `${left}%`,
              width: size,
              height: size,
              animationDuration: `${duration}s`,
              animationDelay: `-${delay}s`,
              '--drift': `${drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

const RENDERERS: Record<ProfileEffectId, () => JSX.Element> = {
  embers: Embers,
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
