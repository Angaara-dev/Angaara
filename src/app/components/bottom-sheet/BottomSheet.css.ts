import { keyframes, style } from '@vanilla-extract/css';
import { color } from 'folds';

const slideUp = keyframes({
  from: { transform: 'translateY(100%)' },
  to: { transform: 'translateY(0)' },
});

export const Sheet = style({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  maxHeight: 'calc(100% - 48px)',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  borderRadius: '20px 20px 0 0',
  boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.35)',
  paddingBottom: 'env(safe-area-inset-bottom)',
  animation: `${slideUp} 200ms ease-out`,
  willChange: 'transform',
  outline: 'none',
});

export const SheetHandle = style({
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
  padding: '10px 0 6px',
  touchAction: 'none',
  cursor: 'grab',
  '::before': {
    content: '""',
    width: '40px',
    height: '5px',
    borderRadius: '3px',
    backgroundColor: color.Surface.ContainerLine,
  },
});

export const SheetHandleFloating = style([
  SheetHandle,
  {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    '::before': {
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
    },
  },
]);
