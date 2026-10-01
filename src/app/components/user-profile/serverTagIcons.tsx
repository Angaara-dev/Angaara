import React from 'react';

// Pixel-art tag icons: 16 rows of 16 pixels, each row 4 hex digits with the leftmost pixel as the top bit.
type TagIcon = [name: string, pixels: string];
type TagIconGroup = { name: string; icons: Record<string, TagIcon> };

export const TAG_ICON_GROUPS: TagIconGroup[] = [
  {
    name: 'Shapes',
    icons: {
      circle: ['Circle', '000007c01ff03ff83ff87ffc7ffc7ffc7ffc7ffc3ff83ff81ff007c000000000'],
      square: ['Square', '00003ff87ffc7ffc7ffc7ffc7ffc7ffc7ffc7ffc7ffc7ffc7ffc3ff800000000'],
      triangle: ['Triangle', '0000010001000380038007c00fe00fe01ff01ff03ff83ff87ffc7ffc00000000'],
      diamond: ['Diamond', '00000380038007c00fe01ff03ff87ffc3ff81ff00fe007c00380038000000000'],
      pentagon: ['Pentagon', '010003800fe01ff03ff87ffc7ffc7ffc3ff83ff83ff81ff01ff0000000000000'],
      hexagon: ['Hexagon', '010007c00fe03ff87ffc7ffc7ffc7ffc7ffc7ffc7ffc3ff80fe007c001000000'],
      octagon: ['Octagon', '00000fe01ff03ff87ffc7ffc7ffc7ffc7ffc7ffc7ffc3ff81ff00fe000000000'],
      star: ['Star', '000001000380038003807ffc3ff81ff00fe00fe00fe00c601830000000000000'],
      star6: ['Six Star', '01000100038003807ffc3ff81ff01ff01ff03ff87ffc03800380010001000000'],
      burst: ['Burst', '010009200fe01ff07ffc3ff83ff8fffe3ff83ff87ffc1ff00fe0092001000000'],
      sparkle: ['Sparkle', '0000010001000100038003800fe07ffc0fe00380038001000100010000000000'],
      heart: ['Heart', '000000000c603ff83ff87ffc7ffc3ff83ff81ff01ff00fe00380010000000000'],
      plus: ['Plus', '0000038003800380038007c07ffc7ffc7ffc07c0038003800380038000000000'],
      target: ['Target', '00000fe01ff03838739c67cc6eec6c6c6eec67cc739c38381ff00fe000000000'],
      coin: ['Coin', '00000fe01ef03018610c610c67cc47c4638c628c600c30181ef00fe000000000'],
      check: ['Check', '00000fe01ff03ff87ffc7f9c7f3c727c78fc7dfc7ffc3ff81ff00fe000000000'],
    },
  },
  {
    name: 'Nature',
    icons: {
      flame: ['Flame', '02000300070007800f900fd81ff81ff81ff81ff81ff80ff007e003c000000000'],
      bolt: ['Bolt', '000000000100030007000f000ff01fe03fe001c0038003000200020000000000'],
      sun: ['Sun', '010009200d600fe07ffc3ff81ff0fffe1ff03ff87ffc0fe00d60092001000000'],
      moon: ['Moon', '000000000c001c003c003c007c007e007f003ff83ff81ff00fe0038000000000'],
      cloud: ['Cloud', '00000000038007e00fe01ff07ff8fffcfffefffefffc7ffc1ff0000000000000'],
      drop: ['Drop', '00000100038007c007c00fe01ff01ff01ff03ff81ff01ff01ff00fe003800000'],
      snowflake: ['Snowflake', '0000010001000100711c1d700fe003800fe01d70711c01000100010000000000'],
      leaf: ['Leaf', '000000fc03fc0ffc1ffc1fbc3f7c3ef83df83bf037f03fe03f80400000000000'],
      tree: ['Tree', '00000100038007c00fe00fe007c00fe00fe01ff03ff801000100010001000000'],
      mountain: ['Mountain', '000000000000000004000c000e401ee01ff03ff03ff87ffc7ffc000000000000'],
      wave: ['Wave', '000000000000000018303c78fffee7cec3860000000000000000000000000000'],
      mushroom: ['Mushroom', '000007c01ff03ff83ff87ffc7ffc7ffc07c007c007c007c007c0038000000000'],
      globe: ['Globe', '03800fe035582d6849244924d936fffed936492449242d6835580fe003800000'],
    },
  },
  {
    name: 'Creatures',
    icons: {
      cat: ['Cat', '00000000200830183ff83ff83ff83bb83bb83ff83ff81ff00fe007c000000000'],
      paw: ['Paw', '000006c00ee00ee00000701c701c339807c00fe01ff01ff01ff00fe000000000'],
      fish: ['Fish', '00000000000001e087f8dffcffecffeefffcdffc87f801e00000000000000000'],
      butterfly: ['Butterfly', '000018303d787ffc7ffc7ffc7ffc3d781ff03ff83ff83ff81d70000000000000'],
      ghost: ['Ghost', '03800fe01ff01ff01ff03bb839383ff83ff83ff83ff83ff83ff8044000000000'],
      skull: ['Skull', '03800fe01ff03ff83ff83ff8339833983ff81ff00fe00fe00920000000000000'],
      alien: ['Alien', '03800fe01ff03ff83ff83ff837d833983ff83ff01ff00fe00fe007c001000000'],
      robot: ['Robot', '03800100010001003ff83ff83bb833983bb83ff838383ff83ff8000000000000'],
      smile: ['Smile', '000007c01ff03ff83ff87bbc7bbc7ffc6fec77dc38383ff81ff007c000000000'],
    },
  },
  {
    name: 'Things',
    icons: {
      crown: ['Crown', '0000000001000100038047c477dc3ff83ff83ff83ff83ff81ff0000000000000'],
      gem: ['Gem', '00000fe01ff03ff87ffc7ffc3ff83ff81ff00fe007c003800380010000000000'],
      sword: ['Sword', '01000380038003800380038003800380038003800fe001000100010001000000'],
      shield: ['Shield', '01000fe03ff83ff83ff83ff83ff83ff83ff83ff81ff01ff00fe007c001000000'],
      key: ['Key', '000000000000000018007c00660067fe67fc7c18180000000000000000000000'],
      trophy: ['Trophy', '00000fe07ffc6fec6fec3ff81ff007c00100010001000fe00fe00fe000000000'],
      medal: ['Medal', '18301c700ee007c0038007c00fe01ef01c701ef01d700fe007c0000000000000'],
      rocket: ['Rocket', '0100038007c007c006c007c007c00fe01ff03bb8339802800100000000000000'],
      gamepad: ['Gamepad', '0000000000003ff87ffc77fce3fef7eefffefffe783c701c0000000000000000'],
      dice: ['Dice', '00003ff07ff8679867987ff87cf87cf87ff8679867987ff83ff0000000000000'],
      spade: ['Spade', '0000038007c00fe01ff01ff03ff83ff83ff83ff81ff003800380038000000000'],
      club: ['Club', '0000010007c007c007c007c03ff83ef83ff83ff81bf003800380038000000000'],
      music: ['Music', '000801f807f807f8060806080608060806380e781e783e381e00080000000000'],
      headphones: [
        'Headphones',
        '000007c01ff038383018600c600c600c783c783c783c783c783c383800000000',
      ],
      palette: ['Palette', '000007c01ff0393839bc7ffc67cc77fc7ff87ff03f003f001f80070000000000'],
      book: ['Book', '1ff83ff83ff83ff83ff83ff83ff83ff83ff83ff83ff83ff820003ff81ff80000'],
      hourglass: ['Hourglass', '1ff01ff01ff01ff00fe007c003800380038007c00fe01ff01ff01ff01ff00000'],
      umbrella: ['Umbrella', '03800fe03ff83ff87ffc7ffcfffe7ffc010001000100010001001f000e000000'],
      pizza: ['Pizza', '00000fe03ff87ffc39f83ff81f300fe00fe004c007c003800380010000000000'],
      chat: ['Chat', '000000007ffcfffefffefffefffefffefffefffefffe7ffc3800200000000000'],
      code: ['Code', '00000000000000000c6018303018600c301818300c6000000000000000000000'],
      cup: ['Cup', '00007ff87ff87ff87ffe7ffa7ffa7ffa7ffe7ff87ff07ff03fe01fc000000000'],
      bulb: ['Bulb', '03800fe01ff03ff83ff839383c783ef83ef81ff00fe007c007c007c007c00000'],
      ball: ['Ball', '000006c01ef03ef83ef87efc7efc00007efc7efc3ef83ef81ef006c000000000'],
      flag: ['Flag', '00007ffc7ffc7ff87ff07fe07ff07ff87ffc7ffc400040004000400000000000'],
      bell: ['Bell', '000003800fe00fe01ff01ff01ff01ff01ff01ff01ff03ff80000038001000000'],
      terminal: ['Terminal', '00000000fffefffefffef7fefbfef9fefbfef70efffefffefffe000000000000'],
      peace: ['Peace', '02800ee03ef83ef87efc7efcfefefc7ef83e76dc6eec1ef01ef00ee002800000'],
    },
  },
];

export const TAG_ICONS: Record<string, TagIcon> = Object.assign(
  {},
  ...TAG_ICON_GROUPS.map((g) => g.icons)
);

export const isTagIcon = (value: unknown): value is string =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(TAG_ICONS, value);

export const tagIconName = (id: string): string => TAG_ICONS[id]?.[0] ?? id;

export const DEFAULT_TAG_COLOR = '#FF6B3D';

const mix = (hex: string, toward: number, amount: number) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${c.map((v) => Math.round(v + (toward - v) * amount)).join(',')})`;
};

type Layers = { shadow: string; base: string; light: string; dark: string };
const layerCache = new Map<string, Layers>();
// Lit from the top left: those edges get a highlight, the far edges a shade, plus a drop shadow.
const getLayers = (id: string): Layers => {
  const cached = layerCache.get(id);
  if (cached) return cached;
  const hex = TAG_ICONS[id][1];
  const rows = Array.from({ length: 16 }, (_, y) =>
    parseInt(hex.slice(y * 4, y * 4 + 4), 16)
      .toString(2)
      .padStart(16, '0')
  );
  const on = (x: number, y: number) => rows[y]?.[x] === '1';
  const paths: Layers = { shadow: '', base: '', light: '', dark: '' };
  const run = (key: keyof Layers, test: (x: number, y: number) => boolean, shift = 0) => {
    for (let y = 0; y < 16; y += 1) {
      let x = 0;
      while (x < 16) {
        if (test(x, y)) {
          const start = x;
          while (x < 16 && test(x, y)) x += 1;
          paths[key] += `M${start + shift} ${y + shift}h${x - start}v1h${start - x}z`;
        } else x += 1;
      }
    }
  };
  const light = (x: number, y: number) => on(x, y) && (!on(x, y - 1) || !on(x - 1, y));
  run('shadow', on, 1);
  run('base', on);
  run('light', light);
  run('dark', (x, y) => on(x, y) && !light(x, y) && (!on(x, y + 1) || !on(x + 1, y)));
  layerCache.set(id, paths);
  return paths;
};

type TagIconViewProps = { icon?: string; color?: string; fallbackUrl?: string; size: string };
// The pixel icon in its colour, or the server's picture when none is picked.
export function TagIconView({ icon, color, fallbackUrl, size }: TagIconViewProps) {
  if (isTagIcon(icon)) {
    const tint = color ?? DEFAULT_TAG_COLOR;
    const { shadow, base, light, dark } = getLayers(icon);
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        shapeRendering="crispEdges"
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        <path d={shadow} fill="rgba(0,0,0,0.45)" />
        <path d={base} fill={tint} />
        <path d={light} fill={mix(tint, 255, 0.45)} />
        <path d={dark} fill={mix(tint, 0, 0.35)} />
      </svg>
    );
  }
  if (!fallbackUrl) return null;
  return (
    <img
      src={fallbackUrl}
      alt=""
      style={{ width: size, height: size, borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }}
    />
  );
}
