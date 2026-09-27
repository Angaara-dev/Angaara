import { createVar, style } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { color, config, DefaultReset, toRem } from 'folds';

export const PowerColorBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: toRem(16),
  height: toRem(16),
  borderRadius: config.radii.Pill,
  border: `${config.borderWidth.B300} solid ${color.Secondary.ContainerLine}`,
  position: 'relative',
  // A glossy bead: soft highlight top-left, darker rim at the bottom.
  boxShadow: 'inset 0 -1px 2px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
});

// Role chips take their role's colour, with a light top edge and a soft drop for some depth.
export const RoleChipColor = createVar();
export const RoleChipColorEnd = createVar();
export const RoleChip = style({
  vars: { [RoleChipColorEnd]: RoleChipColor },
  backgroundColor: 'transparent',
  backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${RoleChipColor} 34%, transparent), color-mix(in srgb, ${RoleChipColorEnd} 16%, transparent))`,
  borderColor: `color-mix(in srgb, ${RoleChipColor} 55%, transparent)`,
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 1px 3px rgba(0, 0, 0, 0.3)',
  color: RoleChipColor,
  selectors: {
    '&:hover, &:focus-visible, &[aria-pressed=true]': {
      backgroundColor: 'transparent',
      filter: 'brightness(1.15)',
    },
  },
});

export const PowerColorBadgeNone = style({
  selectors: {
    '&::before': {
      content: '',
      display: 'inline-block',
      width: '100%',
      height: config.borderWidth.B300,
      backgroundColor: color.Critical.Main,

      position: 'absolute',
      transform: `rotateZ(-45deg)`,
    },
  },
});

const PowerIconSize = createVar();
export const PowerIcon = recipe({
  base: [
    DefaultReset,
    {
      display: 'inline-flex',
      height: PowerIconSize,
      minWidth: PowerIconSize,
      fontSize: PowerIconSize,
      lineHeight: PowerIconSize,
      borderRadius: config.radii.R300,
      cursor: 'default',
    },
  ],
  variants: {
    size: {
      '50': {
        vars: {
          [PowerIconSize]: config.size.X50,
        },
      },
      '100': {
        vars: {
          [PowerIconSize]: config.size.X100,
        },
      },
      '200': {
        vars: {
          [PowerIconSize]: config.size.X200,
        },
      },
      '300': {
        vars: {
          [PowerIconSize]: config.size.X300,
        },
      },
      '400': {
        vars: {
          [PowerIconSize]: config.size.X400,
        },
      },
      '500': {
        vars: {
          [PowerIconSize]: config.size.X500,
        },
      },
      '600': {
        vars: {
          [PowerIconSize]: config.size.X600,
        },
      },
    },
  },
  defaultVariants: {
    size: '400',
  },
});

export type PowerIconVariants = RecipeVariants<typeof PowerIcon>;
