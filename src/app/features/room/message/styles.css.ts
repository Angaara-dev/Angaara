import { createVar, globalStyle, style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';
import { PHONE, phoneSize } from '../../../styles/phone';
import { serverAccent } from '../../../utils/accent';

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
      '&&': {
        backgroundColor: `var(--angaara-theme-menu, ${optionsBg})`,
        vars: { [color.SurfaceVariant.Container]: 'transparent' },
      },
    },
  },
]);

export const BubbleAvatarBase = style({
  paddingTop: 0,
});

const avatarTop = createVar();

export const MessageAvatarGlow = style({
  vars: { [avatarTop]: toRem(4) },
  position: 'relative',
  selectors: {
    '&::after': {
      content: '""',
      position: 'absolute',
      top: avatarTop,
      left: 0,
      right: 0,
      aspectRatio: '1 / 1',
      borderRadius: '50%',
      boxShadow: `0 0 0 ${toRem(2)} ${serverAccent}, 0 0 ${toRem(
        12
      )} color-mix(in srgb, ${serverAccent} 50%, transparent)`,
      opacity: 0,
      pointerEvents: 'none',
      transition: 'opacity 160ms ease',
    },
    '&:hover::after, &:focus-within::after': { opacity: 1 },
  },
});

globalStyle(`${MessageAvatarGlow}${BubbleAvatarBase}`, { vars: { [avatarTop]: '0px' } });

export const MessageAvatar = style({
  cursor: 'pointer',
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
