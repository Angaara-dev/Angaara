import { globalStyle, style } from '@vanilla-extract/css';
import { color, config, DefaultReset, toRem } from 'folds';
// Real phones: a taller message box that follows the Message Size setting.
import { PHONE, phoneSize } from '../../styles/phone';
import { varName } from '../../utils/accent';

const EditorLift = `0 ${toRem(4)} ${toRem(16)} rgba(0, 0, 0, 0.14)`;
const AccentRing = `0 0 0 ${toRem(3)} color-mix(in srgb, ${color.Primary.Main} 22%, transparent)`;

export const Editor = style([
  DefaultReset,
  {
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    boxShadow: `inset 0 0 0 ${config.borderWidth.B300} ${color.SurfaceVariant.ContainerLine}, ${EditorLift}`,
    borderRadius: config.radii.R500,
    overflow: 'hidden',
    transition: 'box-shadow 150ms ease',
    selectors: {
      // Accent ring while typing, so the composer follows the chosen accent color.
      '&:focus-within': {
        boxShadow: `inset 0 0 0 ${config.borderWidth.B300} ${color.Primary.Main}, ${AccentRing}, ${EditorLift}`,
      },
    },
  },
]);

export const EditorOptions = style([
  DefaultReset,
  {
    padding: config.space.S200,
    '@media': { [PHONE]: { padding: `${phoneSize(10)} 8px` } },
  },
]);

globalStyle(`${EditorOptions} button`, {
  '@media': { [PHONE]: { width: phoneSize(40), height: phoneSize(40) } },
});
globalStyle(`${EditorOptions} svg`, {
  '@media': { [PHONE]: { width: phoneSize(24), height: phoneSize(24) } },
});

export const EditorTextareaScroll = style({});

export const EditorTextarea = style([
  DefaultReset,
  {
    flexGrow: 1,
    height: '100%',
    padding: `${toRem(13)} ${toRem(1)}`,
    '@media': {
      [PHONE]: { fontSize: phoneSize(17), paddingTop: phoneSize(19), paddingBottom: phoneSize(19) },
    },
    selectors: {
      [`${EditorTextareaScroll}:first-child &`]: {
        paddingLeft: toRem(13),
      },
      [`${EditorTextareaScroll}:last-child &`]: {
        paddingRight: toRem(13),
      },
      '&:focus': {
        outline: 'none',
      },
    },
  },
]);

export const EditorPlaceholderContainer = style([
  DefaultReset,
  {
    opacity: config.opacity.Placeholder,
    pointerEvents: 'none',
    userSelect: 'none',
  },
]);

export const EditorPlaceholderTextVisual = style([
  DefaultReset,
  {
    display: 'block',
    paddingTop: toRem(13),
    paddingLeft: toRem(1),
    '@media': {
      [PHONE]: { selectors: { '&&': { fontSize: phoneSize(17), paddingTop: phoneSize(19) } } },
    },
  },
]);

export const EditorToolbarBase = style({
  padding: `0 ${config.borderWidth.B300}`,
});

export const EditorToolbar = style({
  padding: config.space.S100,
});

export const MarkdownBtnBox = style({
  paddingRight: config.space.S100,
});

// Phones: lines (and mentions in them) follow the box's Message Size instead of the default text size.
globalStyle(`${EditorTextarea} > *`, {
  '@media': { [PHONE]: { fontSize: 'inherit', lineHeight: 1.45 } },
});

// Buttons inside the box sit on its own colour; clear so see-through themes don't stack washes.
globalStyle(`${Editor} button`, {
  vars: { [varName(color.SurfaceVariant.Container) ?? '--unused']: 'transparent' },
});
