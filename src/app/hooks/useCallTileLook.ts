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
const STREAM = '[data-angaara-spotlight="screen share"]';
const SIZES = [2160, 1440, 1080, 720, 480, 360];
// Focus view (Element Call's landscape spotlight): stream on top, everyone in a row under it.
// The class is from this Element Call build; a newer one just falls back to its side column.
const FOCUS_LAYER = '[class*="_layer_jsvx2_"]';
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
  ${TILE}:hover .angaara-focus, .angaara-focus:focus-visible { opacity: 1; }
  ${STREAM} { cursor: pointer; }
  ${FOCUS_LAYER} { grid-template-columns: 1fr !important; grid-template-rows: minmax(0, 1fr) auto !important;
    padding-block: 12px; box-sizing: border-box; }
  ${FOCUS_LAYER.replace(
    'layer',
    'grid'
  )} { flex-wrap: nowrap !important; overflow-x: auto; min-block-size: 124px;
    justify-content: center; }
  [class*="_fixedGrid_"] > ${FOCUS_LAYER} [class*="_grid_"] {
    min-block-size: var(--angaara-strip-row, 124px) !important; }
  ${FOCUS_LAYER.replace('layer', 'grid')} > [class*="_slot_"] { flex: none;
    block-size: 124px !important; inline-size: 220px !important; }
  .angaara-live { position: absolute; top: 10px; left: 10px; z-index: 6; display: flex;
    border-radius: 6px; overflow: hidden; font: 700 11px/1 sans-serif; pointer-events: none; }
  .angaara-live > span { padding: 4px 6px; }
  .angaara-live .q { background: rgba(0,0,0,0.6); color: #fff; }
  .angaara-live .l { background: #e5484d; color: #fff; }
  .angaara-grid-back { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
    z-index: 6; border: none; border-radius: 8px; padding: 6px 12px; cursor: pointer;
    background: rgba(0,0,0,0.6); color: #fff; font: 600 13px sans-serif; }`;
// Like "720P 30FPS", from what the stream is really sending; frame counts come a second apart.
const lastFrames = new WeakMap<HTMLVideoElement, number>();
const streamQuality = (video: HTMLVideoElement | null): string => {
  if (!video?.videoHeight) return '';
  const size = SIZES.find((s) => video.videoHeight >= s * 0.9) ?? video.videoHeight;
  const frames = video.getVideoPlaybackQuality?.().totalVideoFrames;
  const before = lastFrames.get(video);
  if (frames !== undefined) lastFrames.set(video, frames);
  const fps = frames !== undefined && before !== undefined ? frames - before : undefined;
  return fps ? `${size}P ${fps}FPS` : `${size}P`;
};

const FOCUS_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';

// Call tiles: each person's in a colour from their avatar (or grey), any tile can go full screen
// just for you, and a screen share is a LIVE tile in the grid that opens big when clicked.
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
      doc.querySelectorAll<HTMLElement>(STREAM).forEach((stream) => {
        if (!stream.querySelector('.angaara-live')) {
          const badge = doc.createElement('div');
          badge.className = 'angaara-live';
          badge.innerHTML = '<span class="q" hidden></span><span class="l">LIVE</span>';
          stream.append(badge);
        }
        const back = stream.querySelector('.angaara-grid-back');
        if (embed.control.spotlight && !back) {
          const button = doc.createElement('button');
          button.className = 'angaara-grid-back';
          button.type = 'button';
          button.textContent = 'Back to Grid';
          button.addEventListener('click', (evt) => {
            evt.stopPropagation();
            embed.control.toggleSpotlight();
          });
          stream.append(button);
        } else if (!embed.control.spotlight) back?.remove();
      });
    };
    // The stream's layer leaves room for the call's own (hidden) footer and the strip's doesn't.
    // Measured all the time, so focus view is laid out right the moment it opens.
    const alignFocus = () => {
      const fixed = doc.querySelector<HTMLElement>('[class*="_fixedGrid_"]');
      const scrolling = doc.querySelector<HTMLElement>('[class*="_scrollingGrid_"]');
      if (!fixed || !scrolling) return;
      const row = `${Math.max(0, 124 - (scrolling.clientHeight - fixed.clientHeight))}px`;
      doc.documentElement.style.setProperty('--angaara-strip-row', row);
    };
    const showQuality = () =>
      doc.querySelectorAll<HTMLElement>(STREAM).forEach((stream) => {
        const label = stream.querySelector<HTMLElement>('.angaara-live .q');
        if (!label) return;
        label.textContent = streamQuality(stream.querySelector('video'));
        label.hidden = !label.textContent;
      });
    // Clicking a stream in the grid opens it big, with everyone else alongside.
    const onClick = (evt: MouseEvent) => {
      const target = evt.target as Element | null;
      if (target?.closest?.('button') || !target?.closest?.(STREAM)) return;
      if (!embed.control.spotlight) embed.control.toggleSpotlight();
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
          alignFocus();
        }, 150);
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    doc.addEventListener('dblclick', onDouble);
    doc.addEventListener('click', onClick);
    doc.defaultView?.addEventListener('resize', alignFocus);
    const qualityTimer = window.setInterval(showQuality, 1000);
    dress();
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      window.clearInterval(qualityTimer);
      doc.removeEventListener('dblclick', onDouble);
      doc.removeEventListener('click', onClick);
      doc.defaultView?.removeEventListener('resize', alignFocus);
    };
  }, [mx, embed, auth, colored, joined]);
};
