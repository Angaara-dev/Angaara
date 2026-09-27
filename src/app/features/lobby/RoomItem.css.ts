import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const RoomItemCard = style({
  padding: config.space.S400,
  borderRadius: 0,
  position: 'relative',
  selectors: {
    '&[data-dragging=true]': {
      opacity: config.opacity.Disabled,
    },
  },
});
// Clears room for the drag handle pinned to the card's left edge.
export const RoomItemCardReorder = style({
  paddingLeft: `calc(${toRem(20)} + ${config.space.S300})`,
});
export const RoomProfileTopic = style({
  cursor: 'pointer',
  ':hover': {
    textDecoration: 'underline',
  },
});
export const ErrorNameContainer = style({
  gap: toRem(2),
});
