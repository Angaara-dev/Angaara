import { createVar, globalStyle, style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';
import { PHONE, phoneSize } from '../../../styles/phone';

export const MessageBase = style({
  position: 'relative',
});
export const MessageBaseBubbleCollapsed = style({
  paddingTop: 0,
});

// Read on the wrapper, before the bar blanks the surface color for its buttons.
const optionsBg = createVar();

export const MessageOptionsBase = style([
  DefaultReset,
  {
    vars: { [optionsBg]: color.SurfaceVariant.Container },
    position: 'absolute',
    top: toRem(-30),
    right: 0,
    zIndex: 1,
  },
]);
export const MessageOptionsBar = style([
  DefaultReset,
  {
    padding: config.space.S100,
    borderRadius: config.radii.R400,
    boxShadow: `0 ${toRem(4)} ${toRem(14)} rgba(0, 0, 0, 0.24)`,
    selectors: {
      // Solid on themed servers, so timestamps don't show through.
      '&&': {
        backgroundColor: `var(--angaara-theme-menu, ${optionsBg})`,
        // Buttons blend into the bar until hovered.
        vars: { [color.SurfaceVariant.Container]: 'transparent' },
      },
    },
  },
]);

export const BubbleAvatarBase = style({
  paddingTop: 0,
});

// A soft ring and glow in the accent colour, which inside a server is that server's accent.
const avatarGlow = (ring: number, glow: number) =>
  `0 0 0 ${toRem(2)} color-mix(in srgb, ${color.Primary.Main} ${ring}%, transparent), 0 0 ${toRem(
    12
  )} color-mix(in srgb, ${color.Primary.Main} ${glow}%, transparent)`;

export const MessageAvatar = style({
  cursor: 'pointer',
  boxShadow: avatarGlow(45, 25),
  transition: 'box-shadow 160ms ease',
  selectors: {
    '&:hover, &:focus-visible': { boxShadow: avatarGlow(80, 45) },
  },
  '@media': {
    [PHONE]: { selectors: { '&&': { width: phoneSize(44), height: phoneSize(44) } } },
  },
});

export const MessageQuickReaction = style({
  minWidth: toRem(32),
});

export const MessageMenuGroup = style({
  padding: config.space.S100,
});

export const MessageMenuItemText = style({
  flexGrow: 1,
});

export const ReactionsContainer = style({
  selectors: {
    '&:empty': {
      display: 'none',
    },
  },
});

export const ReactionsTooltipText = style({
  wordBreak: 'break-word',
});

// Phones: text can't be selected by accident, since long-press opens the message sheet.
export const PhoneNoSelect = style({
  '@media': {
    [PHONE]: { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' },
  },
});

// Long-press sheet on phones: quick reactions, then grouped actions.
export const SheetBody = style({
  overflowY: 'auto',
  padding: `${config.space.S100} ${config.space.S400} ${config.space.S500}`,
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S400,
});

export const SheetReactions = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: config.space.S200,
});

export const SheetReaction = style({
  height: '52px',
  border: 'none',
  borderRadius: '14px',
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  fontSize: '26px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  ':active': { backgroundColor: color.SurfaceVariant.ContainerActive },
});

export const SheetGroup = style({
  display: 'flex',
  flexDirection: 'column',
  borderRadius: '16px',
  overflow: 'hidden',
  backgroundColor: color.SurfaceVariant.Container,
});
globalStyle(`${SheetGroup} > button`, {
  backgroundColor: 'transparent',
  minHeight: '54px',
  padding: `0 ${config.space.S400}`,
  borderRadius: 0,
});
globalStyle(`${SheetGroup} > button + button`, {
  boxShadow: `inset 0 1px 0 ${color.SurfaceVariant.ContainerLine}`,
});
globalStyle(`${SheetGroup} > button span`, {
  fontSize: '17px',
});
globalStyle(`${SheetGroup} > button svg`, {
  width: '22px',
  height: '22px',
});
