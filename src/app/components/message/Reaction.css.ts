import { createVar, globalStyle, style } from '@vanilla-extract/css';
import { DefaultReset, FocusOutline, color, config, toRem } from 'folds';
import { PHONE, phoneSize } from '../../styles/phone';

const Container = createVar();
const ContainerHover = createVar();
const ContainerActive = createVar();
const ContainerLine = createVar();
const OnContainer = createVar();

export const Reaction = style([
  FocusOutline,
  {
    vars: {
      [Container]: color.SurfaceVariant.Container,
      [ContainerHover]: color.SurfaceVariant.ContainerHover,
      [ContainerActive]: color.SurfaceVariant.ContainerActive,
      [ContainerLine]: color.SurfaceVariant.ContainerLine,
      [OnContainer]: color.SurfaceVariant.OnContainer,
    },
    padding: `${toRem(4)} ${toRem(10)} ${toRem(4)} ${toRem(8)}`,
    backgroundColor: Container,
    border: `${config.borderWidth.B300} solid ${ContainerLine}`,
    borderRadius: toRem(10),
    '@media': {
      [PHONE]: {
        padding: `${phoneSize(3)} ${phoneSize(9)} ${phoneSize(3)} ${phoneSize(7)}`,
        borderRadius: phoneSize(9),
      },
    },

    selectors: {
      'button&': {
        cursor: 'pointer',
      },
      // Your own reaction: a wash of the accent, which themes leave grey as Primary.Container.
      '&[aria-pressed=true]': {
        vars: {
          [Container]: `color-mix(in srgb, ${color.Primary.Main} 18%, ${color.SurfaceVariant.Container})`,
          [ContainerHover]: `color-mix(in srgb, ${color.Primary.Main} 26%, ${color.SurfaceVariant.Container})`,
          [ContainerActive]: `color-mix(in srgb, ${color.Primary.Main} 32%, ${color.SurfaceVariant.Container})`,
          [ContainerLine]: `color-mix(in srgb, ${color.Primary.Main} 60%, transparent)`,
          [OnContainer]: color.SurfaceVariant.OnContainer,
        },
        backgroundColor: Container,
      },
      '&[aria-selected=true]': {
        borderColor: color.Secondary.Main,
        borderWidth: config.borderWidth.B400,
      },
      '&:hover, &:focus-visible': {
        backgroundColor: ContainerHover,
      },
      '&:active': {
        backgroundColor: ContainerActive,
      },
      '&[aria-disabled=true], &:disabled': {
        cursor: 'not-allowed',
      },
    },
  },
]);

export const ReactionText = style([
  DefaultReset,
  {
    minWidth: 0,
    maxWidth: toRem(150),
    display: 'inline-flex',
    alignItems: 'center',
    // Doubled class so it wins over the Text size class on the same element.
    selectors: { '&&': { fontSize: toRem(18), lineHeight: toRem(24) } },
    '@media': {
      [PHONE]: { selectors: { '&&': { fontSize: phoneSize(16), lineHeight: phoneSize(20) } } },
    },
  },
]);

globalStyle(`${Reaction} > span:last-child`, {
  '@media': { [PHONE]: { fontSize: phoneSize(13) } },
});

export const ReactionImg = style([
  DefaultReset,
  {
    height: '1em',
    minWidth: 0,
    maxWidth: toRem(150),
    objectFit: 'contain',
  },
]);
