import { createVar, fallbackVar, style } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { DefaultReset, color, config, toRem } from 'folds';
import { themeBackdrop } from '../../styles/themeBackdrop';

// Set by PageRoot's drag handle, so the room list width is adjustable.
export const NavWidth = createVar();

// Panel styles for PageRoot's framed layout; the resize handle doubles as the gap.
export const Frame = style({
  minWidth: 0,
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S200} 0`,
  backgroundColor: color.Background.Container,
  ...themeBackdrop('bg'),
});

export const FramePanel = style({
  minWidth: 0,
  overflow: 'hidden',
  borderRadius: config.radii.R500,
  border: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}`,
  boxShadow: `0 ${toRem(2)} ${toRem(12)} rgba(0, 0, 0, 0.18)`,
});

export const PageNav = recipe({
  variants: {
    size: {
      '400': {
        width: fallbackVar(NavWidth, toRem(256)),
      },
      '300': {
        width: toRem(222),
      },
    },
  },
  defaultVariants: {
    size: '400',
  },
});
export type PageNavVariants = RecipeVariants<typeof PageNav>;

// The rail's color behind the card, so its rounded corner never shows the bare page.
export const PageNavMobileBackdrop = style({
  backgroundColor: color.Background.Container,
  ...themeBackdrop('bg'),
});
// Phones: the room list is a lighter rounded card beside the rail. Background
// tokens are pointed at the surface ones, so headers and rows inside follow along.
export const PageNavMobile = style({
  vars: {
    // A server theme turns this see-through, so rows sit on its gradient.
    [color.Background.Container]: `var(--angaara-theme-row, ${color.Surface.Container})`,
    [color.Background.ContainerHover]: color.Surface.ContainerHover,
    [color.Background.ContainerActive]: color.Surface.ContainerActive,
    [color.Background.ContainerLine]: color.Surface.ContainerLine,
    [color.Background.OnContainer]: color.Surface.OnContainer,
  },
  backgroundColor: color.Surface.Container,
  ...themeBackdrop('surface'),
  borderTopLeftRadius: config.radii.R500,
  overflow: 'hidden',
});

export const PageNavHeader = recipe({
  base: {
    padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
    flexShrink: 0,
    selectors: {
      'button&': {
        cursor: 'pointer',
      },
      'button&[aria-pressed=true]': {
        backgroundColor: color.Background.ContainerActive,
      },
      'button&:hover, button&:focus-visible': {
        backgroundColor: color.Background.ContainerHover,
      },
      'button&:active': {
        backgroundColor: color.Background.ContainerActive,
      },
    },
  },

  variants: {
    outlined: {
      true: {
        borderBottomWidth: 1,
      },
    },
  },
  defaultVariants: {
    outlined: true,
  },
});
export type PageNavHeaderVariants = RecipeVariants<typeof PageNavHeader>;

export const PageNavContent = style({
  minHeight: '100%',
  padding: config.space.S200,
  paddingRight: 0,
  paddingBottom: config.space.S700,
});

export const PageHeader = recipe({
  base: {
    paddingLeft: config.space.S400,
    paddingRight: config.space.S200,
  },
  variants: {
    balance: {
      true: {
        paddingLeft: config.space.S200,
      },
    },
    outlined: {
      true: {
        borderBottomWidth: config.borderWidth.B300,
      },
    },
  },
  defaultVariants: {
    outlined: true,
  },
});
export type PageHeaderVariants = RecipeVariants<typeof PageHeader>;

export const PageContent = style([
  DefaultReset,
  {
    paddingTop: config.space.S400,
    paddingLeft: config.space.S400,
    paddingRight: 0,
    paddingBottom: toRem(100),
  },
]);

export const PageHeroEmpty = style([
  DefaultReset,
  {
    padding: config.space.S400,
    borderRadius: config.radii.R400,
    minHeight: toRem(450),
  },
]);

export const PageHeroSection = style([
  DefaultReset,
  {
    padding: '40px 0',
    maxWidth: toRem(466),
    width: '100%',
    margin: 'auto',
  },
]);

export const PageContentCenter = style([
  DefaultReset,
  {
    maxWidth: toRem(964),
    width: '100%',
    margin: 'auto',
  },
]);
