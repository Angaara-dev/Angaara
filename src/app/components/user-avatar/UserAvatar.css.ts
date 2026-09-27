import { style } from '@vanilla-extract/css';
import { color } from 'folds';

export const UserAvatar = style({
  backgroundColor: color.Secondary.Container,
  color: color.Secondary.OnContainer,
  textTransform: 'capitalize',

  selectors: {
    // Every user avatar is a circle, whatever shape its container uses.
    '&&': {
      borderRadius: '50%',
    },
    '&[data-image-loaded="true"]': {
      backgroundColor: 'transparent',
    },
  },
});
