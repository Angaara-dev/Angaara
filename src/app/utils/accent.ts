import { color } from 'folds';

export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: 'Ember', value: '#FF6B3D' },
  { name: 'Blurple', value: '#5865F2' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Gold', value: '#F59E0B' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Violet', value: '#8B5CF6' },
];

export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

export type Hsl = { h: number; s: number; l: number };

export const hexToHsl = (hex: string): Hsl => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
};

export const hslToHex = ({ h, s, l }: Hsl): string => {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};

// folds exposes theme colors as var(--name); we need the bare --name to override it.
export const varName = (cssVar: string) => cssVar.match(/var\((--[^)]+)\)/)?.[1];

const luminanceOf = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const readableOn = (hex: string): string => (luminanceOf(hex) > 0.55 ? '#141414' : '#FFFFFF');

// Near-black on a dark theme (or near-white on a light one) would make buttons vanish.
// A server's accent lives in its own variable, so it never replaces the accent you picked.
export const SERVER_ACCENT_VAR = '--angaara-server-accent';
export const serverAccent = `var(${SERVER_ACCENT_VAR}, ${color.Primary.Main})`;
export const applyServerAccent = (accent: string | undefined) => {
  const { style } = document.body;
  if (accent && isHexColor(accent)) style.setProperty(SERVER_ACCENT_VAR, accent);
  else style.removeProperty(SERVER_ACCENT_VAR);
};

export const usableAsAccent = (hex: string, dark: boolean): boolean =>
  isHexColor(hex) && (dark ? luminanceOf(hex) > 0.08 : luminanceOf(hex) < 0.85);

// Overrides the theme's primary colors on <body>; hover shades mix toward white on dark themes.
export const applyAccent = (accent: string | undefined, dark: boolean) => {
  const shade = dark ? 'white' : 'black';
  const mix = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, ${shade})`;
  const tint = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`;
  const values: [string, string][] = accent
    ? [
        [color.Primary.Main, accent],
        [color.Primary.MainHover, mix(88)],
        [color.Primary.MainActive, mix(80)],
        [color.Primary.MainLine, mix(72)],
        [color.Primary.OnMain, readableOn(accent)],
        [color.Other.FocusRing, `color-mix(in srgb, ${accent} 60%, transparent)`],
        // Soft accent tints (like highlighted menu items) instead of the theme's grey.
        [color.Primary.Container, tint(14)],
        [color.Primary.ContainerHover, tint(20)],
        [color.Primary.ContainerActive, tint(26)],
        [color.Primary.ContainerLine, tint(32)],
      ]
    : [];
  const { style } = document.body;
  [
    color.Primary.Main,
    color.Primary.MainHover,
    color.Primary.MainActive,
    color.Primary.MainLine,
    color.Primary.OnMain,
    color.Other.FocusRing,
    color.Primary.Container,
    color.Primary.ContainerHover,
    color.Primary.ContainerActive,
    color.Primary.ContainerLine,
  ].forEach((cssVar) => {
    const name = varName(cssVar);
    if (name) style.removeProperty(name);
  });
  style.removeProperty('--tc-link');
  if (!accent || !isHexColor(accent)) return;
  values.forEach(([cssVar, value]) => {
    const name = varName(cssVar);
    if (name) style.setProperty(name, value);
  });
  style.setProperty('--tc-link', dark ? mix(75) : accent);
};

const TINT_GROUPS = [color.Background, color.Surface, color.SurfaceVariant];
// How strongly each group takes the server colour, then its hover, active and line shades.
const TINT_STRENGTH = [60, 55, 50];
const STATE_FALLOFF = [1, 0.85, 0.75, 0.6];

export const THEME_BG_VAR = '--angaara-theme-bg';
export const THEME_SURFACE_VAR = '--angaara-theme-surface';

export type ServerTheme = { top?: string; bottom?: string };

// Darkest a theme colour may get to on a dark theme, so white text stays readable.
export const MAX_THEME_SHADE = 40;

// One gradient stop as a viewer sees it: capped shade on dark themes, a pale wash on light ones.
export const themeStop = (hex: string, dark: boolean): string => {
  if (!dark) return `color-mix(in srgb, ${hex} 25%, white)`;
  const hsl = hexToHsl(hex);
  return hsl.l > MAX_THEME_SHADE ? hslToHex({ ...hsl, l: MAX_THEME_SHADE }) : hex;
};

// Server theme: a top-to-bottom gradient behind the app, and matching solid tints.
// In-page panels (cards, rows, inputs, chips) become see-through washes over the gradient.
// Only inside the app and pages marked data-theme-wash; menus and popups stay solid.
const WASH_STYLE_ID = 'angaara-theme-wash';
// Elements marked data-plain-theme (like profile cards) keep the normal colours under a server theme.
const PLAIN_STYLE_ID = 'angaara-plain-theme';
const THEME_EXTRA_VARS = [
  '--angaara-theme-bg',
  '--angaara-theme-surface',
  '--angaara-theme-row',
  '--angaara-theme-surface-color',
  '--angaara-theme-shade',
  '--angaara-theme-menu',
];
const WASH_GROUPS = [color.Surface, color.SurfaceVariant, color.Secondary];
// The see-through panel colours, as CSS variable name → value.
export const themeWashVars = (dark: boolean): Record<string, string> => {
  const [base, hover, active, line] = dark
    ? ['0.06', '0.1', '0.14', 'rgba(255, 255, 255, 0.08)']
    : ['0.4', '0.5', '0.6', 'rgba(0, 0, 0, 0.08)'];
  const white = (a: string) => `rgba(255, 255, 255, ${a})`;
  const rules = WASH_GROUPS.flatMap((group) => [
    [group.Container, white(base)],
    [group.ContainerHover, white(hover)],
    [group.ContainerActive, white(active)],
    [group.ContainerLine, line],
  ]).concat([
    [color.Background.ContainerHover, white(base)],
    [color.Background.ContainerActive, white(hover)],
    [color.Background.ContainerLine, line],
  ]);
  const vars: Record<string, string> = {};
  rules.forEach(([token, value]) => {
    const name = varName(token);
    if (name) vars[name] = value;
  });
  return vars;
};

const setThemeWash = (dark: boolean | undefined) => {
  document.getElementById(WASH_STYLE_ID)?.remove();
  if (dark === undefined) return;
  const body = Object.entries(themeWashVars(dark))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  const el = document.createElement('style');
  el.id = WASH_STYLE_ID;
  // Avatar placeholders get a stronger whitish wash than panels, so they read as tiles, not holes.
  const tile = dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.6)';
  const tileName = varName(color.Secondary.Container);
  const solid = tileName ? `${tileName}: ${tile};` : '';
  el.textContent = `#root, [data-theme-wash] { ${body} } [data-solid-tint] { ${solid} }`;
  document.head.appendChild(el);
};

// Colour transitions (like nav rows fading on hover) would otherwise fade every row from the
// old colours to the new ones; switch instantly, then bring transitions back two frames later.
const pauseTransitions = () => {
  const el = document.createElement('style');
  el.textContent = '*, *::before, *::after { transition: none !important; }';
  document.head.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.remove()));
};

export const applyServerTheme = (theme: ServerTheme | undefined, dark: boolean) => {
  const { style } = document.body;
  pauseTransitions();
  setThemeWash(undefined);
  document.getElementById(PLAIN_STYLE_ID)?.remove();
  const names = TINT_GROUPS.flatMap((group) =>
    [group.Container, group.ContainerHover, group.ContainerActive, group.ContainerLine].map(varName)
  );
  names.forEach((name) => name && style.removeProperty(name));
  style.removeProperty(THEME_BG_VAR);
  style.removeProperty(THEME_SURFACE_VAR);
  style.removeProperty('--angaara-theme-row');
  style.removeProperty('--angaara-theme-surface-color');
  style.removeProperty('--angaara-theme-shade');
  style.removeProperty('--angaara-theme-menu');
  style.removeProperty('background-image');
  style.removeProperty('background-attachment');

  const top = theme?.top && isHexColor(theme.top) ? theme.top : undefined;
  const bottom = theme?.bottom && isHexColor(theme.bottom) ? theme.bottom : undefined;
  if (!top && !bottom) return;

  const from = themeStop((top ?? bottom)!, dark);
  const to = themeStop((bottom ?? top)!, dark);
  const gradient = `linear-gradient(180deg, ${from}, ${to})`;
  const lift = dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
  style.setProperty(THEME_BG_VAR, gradient);
  style.setProperty(THEME_SURFACE_VAR, `linear-gradient(${lift}, ${lift}), ${gradient}`);
  style.setProperty('--angaara-theme-row', 'transparent');
  style.setProperty('--angaara-theme-surface-color', 'transparent');
  // Side panels (like the member list) sit a shade darker than the page.
  style.setProperty('--angaara-theme-shade', dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.08)');
  // The page behind the app shows at phone edges (under the composer, around the nav bar).
  style.setProperty('background-image', gradient);
  style.setProperty('background-attachment', 'fixed');

  // Solid pieces (headers, rows, inputs) take the midpoint so they sit well on the gradient.
  const mid = `color-mix(in srgb, ${from}, ${to})`;
  const computed = window.getComputedStyle(document.body);
  const plainNames = [...new Set([...names, ...Object.keys(themeWashVars(dark))])];
  const plain = plainNames
    .filter((name): name is string => !!name)
    .map((name) => `${name}: ${computed.getPropertyValue(name).trim()};`)
    .concat(THEME_EXTRA_VARS.map((name) => `${name}: initial;`))
    .join(' ');
  const plainEl = document.createElement('style');
  plainEl.id = PLAIN_STYLE_ID;
  plainEl.textContent = `[data-plain-theme] { ${plain} }`;
  document.head.appendChild(plainEl);
  setThemeWash(dark);
  names.forEach((name, i) => {
    if (!name) return;
    const original = computed.getPropertyValue(name).trim();
    if (!original) return;
    // Background containers go see-through so rows and cards sit on the gradient itself.
    if (i === 0) {
      style.setProperty(name, 'transparent');
      return;
    }
    const pct = TINT_STRENGTH[Math.floor(i / 4)] * STATE_FALLOFF[i % 4];
    style.setProperty(name, `color-mix(in srgb, ${mid} ${Math.round(pct / 0.6)}%, ${original})`);
  });
  // Floating bars inside the app (like message options) stay solid, like popup menus.
  const menu = varName(color.SurfaceVariant.Container);
  if (menu) style.setProperty('--angaara-theme-menu', style.getPropertyValue(menu));
};
