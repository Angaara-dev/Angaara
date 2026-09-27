import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

// Content softly fades out at an edge while there's more to scroll that way.
export const ScrollFade = style({
  vars: { '--fade-top': '0px', '--fade-bottom': '0px' },
  maskImage:
    'linear-gradient(to bottom, transparent 0, #000 var(--fade-top), #000 calc(100% - var(--fade-bottom)), transparent 100%)',
  WebkitMaskImage:
    'linear-gradient(to bottom, transparent 0, #000 var(--fade-top), #000 calc(100% - var(--fade-bottom)), transparent 100%)',
  selectors: {
    '&[data-fade-top=true]': { vars: { '--fade-top': toRem(28) } },
    '&[data-fade-bottom=true]': { vars: { '--fade-bottom': toRem(44) } },
  },
});
