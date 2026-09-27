import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const Inline = style({
  fontSize: '1.05em',
});

export const Display = style({
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  padding: `${config.space.S100} 0`,
});

export const Fallback = style({
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
});
