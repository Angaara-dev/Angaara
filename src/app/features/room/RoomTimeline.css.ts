import { RecipeVariants, recipe } from '@vanilla-extract/recipes';
import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

export const TimelineFloat = recipe({
  base: [
    DefaultReset,
    {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1,
      minWidth: 'max-content',
    },
  ],
  variants: {
    position: {
      Top: {
        top: config.space.S400,
      },
      Bottom: {
        bottom: config.space.S400,
      },
    },
  },
  defaultVariants: {
    position: 'Top',
  },
});

export type TimelineFloatVariants = RecipeVariants<typeof TimelineFloat>;

export const CallLogSummary = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  width: '100%',
  padding: `${config.space.S100} ${config.space.S200}`,
  border: 'none',
  borderRadius: config.radii.R300,
  background: 'transparent',
  color: color.Surface.OnContainer,
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover': { background: color.Surface.ContainerHover },
  },
});
