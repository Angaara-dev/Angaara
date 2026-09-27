import { color } from 'folds';

// A server theme's gradient, fixed to the screen so every panel lines up into one backdrop.
// Surface panels go clear underneath it, so they look the same while a page slides.
export const themeBackdrop = (layer: 'bg' | 'surface') => ({
  backgroundImage: `var(--angaara-theme-${layer}, none)`,
  backgroundAttachment: 'fixed' as const,
  ...(layer === 'surface' && {
    backgroundColor: `var(--angaara-theme-surface-color, ${color.Surface.Container})`,
  }),
});
