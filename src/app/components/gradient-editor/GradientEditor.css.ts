import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

const thumb = {
  width: toRem(20),
  height: toRem(20),
  borderRadius: '50%',
  background: 'white',
  border: 'none',
  boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.35), 0 1px 4px rgba(0, 0, 0, 0.4)',
  cursor: 'pointer',
};

export const TrackSlider = style({
  width: '100%',
  height: toRem(10),
  margin: `${toRem(6)} 0`,
  borderRadius: config.radii.Pill,
  appearance: 'none',
  WebkitAppearance: 'none',
  outline: 'none',
  selectors: {
    '&::-webkit-slider-thumb': { ...thumb, WebkitAppearance: 'none' },
    '&::-moz-range-thumb': thumb,
    '&:disabled': { opacity: 0.5 },
  },
});
