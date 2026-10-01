import { useEffect } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import { CallEmbed } from '../plugins/call';
import { settingsAtom } from '../state/settings';
import { useMatrixClient } from './useMatrixClient';
import { useMediaAuthentication } from './useMediaAuthentication';
import { useCallJoined } from './useCallEmbed';
import { mxcUrlToHttp } from '../utils/matrix';
import { cssColorMXID } from '../../util/colorMXID';

const TILE = '[data-angaara-user]';
const tints = new Map<string, Promise<string | undefined>>();

// The colour most of the avatar is, like the plain background of a cartoon fox.
const mainColor = async (blob: Blob): Promise<string | undefined> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(bitmap, 0, 0, 24, 24);
  const { data } = ctx.getImageData(0, 0, 24, 24);
  const buckets = new Map<number, [number, number, number, number]>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 200) {
      const key =
        Math.floor(data[i] / 32) * 64 +
        Math.floor(data[i + 1] / 32) * 8 +
        Math.floor(data[i + 2] / 32);
      const b = buckets.get(key) ?? [0, 0, 0, 0];
      buckets.set(key, [b[0] + 1, b[1] + data[i], b[2] + data[i + 1], b[3] + data[i + 2]]);
    }
  }
  const top = [...buckets.values()].sort((a, b) => b[0] - a[0])[0];
  if (!top) return undefined;
  return `rgb(${top
    .slice(1)
    .map((v) => Math.round(v / top[0]))
    .join(',')})`;
};

// No avatar: their name colour, darkened so the name tag still reads.
const nameColor = (userId: string) => {
  const value = getComputedStyle(document.body).getPropertyValue(cssColorMXID(userId)).trim();
  return value ? `color-mix(in srgb, ${value} 45%, #18181b)` : undefined;
};

const tintFor = (mx: MatrixClient, userId: string, room: CallEmbed['room'], auth: boolean) => {
  const mxc = room.getMember(userId)?.getMxcAvatarUrl() ?? mx.getUser(userId)?.avatarUrl;
  const key = `${userId}|${mxc ?? ''}`;
  let tint = tints.get(key);
  if (!tint) {
    const url = mxc ? mxcUrlToHttp(mx, mxc, auth, 48, 48, 'crop') : undefined;
    const token = mx.getAccessToken();
    tint = (
      url
        ? fetch(url, auth && token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
            .then((res) => (res.ok ? res.blob() : Promise.reject()))
            .then(mainColor)
        : Promise.resolve(undefined)
    )
      .catch(() => undefined)
      .then((c) => c ?? nameColor(userId));
    tints.set(key, tint);
  }
  return tint;
};

const STYLE = `${TILE}[style*="--angaara-tint"] { background: var(--angaara-tint) !important; }
  ${TILE}[style*="--angaara-tint"] [class*="_bg_"] { background: transparent !important; }
  ${TILE}:fullscreen { border-radius: 0 !important; }
  ${TILE}:fullscreen [class*="_avatar_"] { width: var(--cpd-avatar-size) !important;
    height: var(--cpd-avatar-size) !important; }
  .angaara-focus { position: absolute; top: 10px; right: 10px; z-index: 5; width: 32px; height: 32px;
    border: none; border-radius: 8px; background: rgba(0,0,0,0.55); color: #fff; cursor: pointer;
    display: grid; place-items: center; opacity: 0; transition: opacity 120ms; }
  ${TILE}:hover .angaara-focus, .angaara-focus:focus-visible { opacity: 1; }`;
const FOCUS_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

// Call tiles: each person's in a colour from their avatar (or grey), and any tile can be made
// full screen, just for you, from its corner button or a double click.
export const useCallTileLook = (embed: CallEmbed) => {
  const mx = useMatrixClient();
  const auth = useMediaAuthentication();
  const colored = useAtomValue(settingsAtom).callTileColors;
  const joined = useCallJoined(embed);

  useEffect(() => {
    const doc = embed.document;
    if (!joined || !doc?.body) return undefined;
    const style = doc.getElementById('angaara-tiles') ?? doc.createElement('style');
    style.id = 'angaara-tiles';
    style.textContent = STYLE;
    doc.head.append(style);

    const toggleFull = (tile: Element) => {
      if (doc.fullscreenElement) doc.exitFullscreen().catch(() => undefined);
      else tile.requestFullscreen().catch(() => undefined);
    };
    const dress = () => {
      doc.querySelectorAll<HTMLElement>(TILE).forEach((tile) => {
        if (!tile.querySelector('.angaara-focus')) {
          const button = doc.createElement('button');
          button.className = 'angaara-focus';
          button.type = 'button';
          button.title = 'Full screen';
          button.setAttribute('aria-label', 'Full screen');
          button.innerHTML = FOCUS_ICON;
          button.addEventListener('click', (evt) => {
            evt.stopPropagation();
            toggleFull(tile);
          });
          tile.append(button);
        }
        const userId = tile.dataset.angaaraUser;
        if (!colored || !userId) {
          tile.style.removeProperty('--angaara-tint');
          return;
        }
        tintFor(mx, userId, embed.room, auth).then((tint) => {
          if (tint && colored) tile.style.setProperty('--angaara-tint', tint);
        });
      });
    };
    const onDouble = (evt: MouseEvent) => {
      const tile = (evt.target as Element | null)?.closest?.(TILE);
      if (tile) toggleFull(tile);
    };

    let timer = 0;
    const observer = new MutationObserver(() => {
      if (!timer) {
        timer = window.setTimeout(() => {
          timer = 0;
          dress();
        }, 150);
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    doc.addEventListener('dblclick', onDouble);
    dress();
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      doc.removeEventListener('dblclick', onDouble);
    };
  }, [mx, embed, auth, colored, joined]);
};
