import { ComplexStyleRule, createVar, globalStyle, style } from '@vanilla-extract/css';
import { RecipeVariants, recipe } from '@vanilla-extract/recipes';
import { ContainerColor, DefaultReset, Disabled, RadiiVariant, color, config, toRem } from 'folds';

const PHONE = 'screen and (max-width: 750px) and (pointer: coarse)';

export const NavCategory = style([
  DefaultReset,
  {
    position: 'relative',
  },
]);

export const NavCategoryHeader = style({
  gap: config.space.S100,
});

export const NavLink = style({
  color: 'inherit',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  flexGrow: 1,
  ':hover': {
    textDecoration: 'unset',
  },
  ':focus': {
    outline: 'none',
  },
});

const Container = createVar();
const ContainerHover = createVar();
const ContainerActive = createVar();
const ContainerLine = createVar();
const OnContainer = createVar();

const getVariant = (variant: ContainerColor): ComplexStyleRule => ({
  vars: {
    [Container]: color[variant].Container,
    [ContainerHover]: color[variant].ContainerHover,
    [ContainerActive]: color[variant].ContainerActive,
    [ContainerLine]: color[variant].ContainerLine,
    [OnContainer]: color[variant].OnContainer,
  },
});

const NavItemBase = style({
  position: 'relative',
  width: '100%',
  display: 'flex',
  justifyContent: 'start',
  cursor: 'pointer',
  backgroundColor: Container,
  color: OnContainer,
  outline: 'none',
  minHeight: toRem(36),
  transition: 'background-color 120ms ease',
  '@media': {
    [PHONE]: { minHeight: '40px' },
  },

  '::before': {
    content: '""',
    position: 'absolute',
    left: `calc(-1 * ${config.space.S200})`,
    top: '50%',
    width: toRem(4),
    height: 0,
    borderRadius: `0 ${toRem(4)} ${toRem(4)} 0`,
    backgroundColor: OnContainer,
    transform: 'translateY(-50%)',
    transition: 'height 150ms ease, background-color 150ms ease',
  },

  selectors: {
    '&[data-highlight=true]::before': {
      height: toRem(8),
    },
    '&[aria-selected=true]::before': {
      height: toRem(20),
      backgroundColor: color.Primary.Main,
    },
    '&:hover, &:focus-visible': {
      backgroundColor: ContainerHover,
    },
    '&[data-hover=true]': {
      backgroundColor: ContainerHover,
    },
    [`&:has(.${NavLink}:active)`]: {
      backgroundColor: ContainerActive,
    },
    '&[aria-selected=true]': {
      backgroundColor: `color-mix(in srgb, ${color.Primary.Main} 12%, ${ContainerActive})`,
    },
    [`&:has(.${NavLink}:focus-visible)`]: {
      outline: `${config.borderWidth.B600} solid ${ContainerLine}`,
      outlineOffset: `calc(-1 * ${config.borderWidth.B600})`,
    },
  },
  '@supports': {
    [`not selector(:has(.${NavLink}:focus-visible))`]: {
      ':focus-within': {
        outline: `${config.borderWidth.B600} solid ${ContainerLine}`,
        outlineOffset: `calc(-1 * ${config.borderWidth.B600})`,
      },
    },
  },
});
export const NavItem = recipe({
  base: [DefaultReset, NavItemBase, Disabled],
  variants: {
    variant: {
      Background: getVariant('Background'),
      Surface: getVariant('Surface'),
      SurfaceVariant: getVariant('SurfaceVariant'),
      Primary: getVariant('Primary'),
      Secondary: getVariant('Secondary'),
      Success: getVariant('Success'),
      Warning: getVariant('Warning'),
      Critical: getVariant('Critical'),
    },
    radii: RadiiVariant,
  },
  defaultVariants: {
    variant: 'Surface',
    radii: '400',
  },
});

export type RoomSelectorVariants = RecipeVariants<typeof NavItem>;
export const NavItemContent = style({
  paddingLeft: config.space.S200,
  paddingRight: config.space.S300,
  height: 'inherit',
  minWidth: 0,
  flexGrow: 1,
  display: 'flex',
  alignItems: 'center',
  fontWeight: config.fontWeight.W500,
  '@media': {
    [PHONE]: { fontSize: '15px', gap: config.space.S100 },
  },

  selectors: {
    '&:hover': {
      textDecoration: 'unset',
    },
    [`.${NavItemBase}[data-highlight=true] &, .${NavItemBase}[aria-selected=true] &`]: {
      fontWeight: config.fontWeight.W600,
    },
  },
});

globalStyle(`${NavItemContent} svg`, {
  '@media': { [PHONE]: { width: '18px', height: '18px' } },
});

export const NavItemOptions = style({
  paddingRight: config.space.S200,
});

export const NavSearchPill = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: config.space.S200,
  height: toRem(40),
  marginBottom: config.space.S200,
  borderRadius: config.radii.Pill,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  textDecoration: 'none',
  selectors: {
    '&:active, &[aria-current=page]': {
      backgroundColor: color.SurfaceVariant.ContainerActive,
    },
  },
});
