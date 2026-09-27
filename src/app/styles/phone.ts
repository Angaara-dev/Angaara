// Real phones (touch, narrow).
export const PHONE = 'screen and (max-width: 750px) and (pointer: coarse)';
// Phone chat sizes follow the Message Size setting (--angaara-msg-scale, set by the app).
export const phoneSize = (px: number) => `calc(${px}px * var(--angaara-msg-scale, 1))`;
