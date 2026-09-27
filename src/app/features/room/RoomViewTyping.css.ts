import { keyframes, style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';
import { themeBackdrop } from '../../styles/themeBackdrop';

const SlideUpAnime = keyframes({
  from: {
    transform: 'translateY(100%)',
  },
  to: {
    transform: 'translateY(0)',
  },
});

export const RoomViewTyping = style([
  DefaultReset,
  {
    padding: `0 ${config.space.S500}`,
    width: '100%',
    backgroundColor: color.Surface.Container,
    ...themeBackdrop('surface'),
    color: color.Surface.OnContainer,
    position: 'absolute',
    bottom: 0,
    animation: `${SlideUpAnime} 100ms ease-in-out`,
  },
]);
export const TypingText = style({
  flexGrow: 1,
});
