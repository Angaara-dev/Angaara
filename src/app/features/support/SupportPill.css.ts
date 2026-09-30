import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const SupportPill = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  width: '100%',
  height: toRem(32),
  marginBottom: config.space.S100,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  border: '1px solid rgba(255, 110, 50, 0.22)',
  borderRadius: config.radii.Pill,
  background: 'linear-gradient(135deg, #3a140a, #24100b)',
  boxShadow: 'inset 0 1px 0 rgba(255, 140, 80, 0.08)',
  color: '#FFB48A',
  cursor: 'pointer',
  transition: 'filter 120ms ease, border-color 120ms ease',
  selectors: {
    '&:hover, &:focus-visible': {
      filter: 'brightness(1.2)',
      borderColor: 'rgba(255, 110, 50, 0.4)',
    },
    '&:active': { filter: 'brightness(0.95)' },
  },
});
