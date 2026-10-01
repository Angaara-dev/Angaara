import { style } from '@vanilla-extract/css';

const SHADE = 'var(--angaara-theme-shade, transparent)';

// The same server gradient the members list paints, so every tab has a solid backdrop.
export const Panel = style({
  selectors: {
    '&&': {
      backgroundImage: `linear-gradient(${SHADE}, ${SHADE}), var(--angaara-theme-bg, none)`,
      backgroundAttachment: 'fixed',
    },
  },
});
