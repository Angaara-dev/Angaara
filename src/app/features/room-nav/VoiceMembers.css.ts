import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const VoiceMembers = style({
  paddingLeft: toRem(8),
  paddingBottom: config.space.S100,
});

export const VoiceMember = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  minWidth: 0,
  padding: `${toRem(3)} ${config.space.S200}`,
  border: 'none',
  borderRadius: config.radii.R300,
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  selectors: {
    '&:hover': { background: color.Background.ContainerHover },
  },
});

export const VoiceAvatar = style({
  width: toRem(22),
  height: toRem(22),
  flexShrink: 0,
  transition: 'box-shadow 120ms ease',
  selectors: {
    '&[data-speaking=true]': {
      boxShadow: `0 0 0 ${toRem(2)} ${color.Success.Main}`,
    },
  },
});

export const VoiceName = style({
  flexGrow: 1,
  minWidth: 0,
  opacity: 0.85,
});
