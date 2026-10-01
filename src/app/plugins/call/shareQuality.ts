import { CallEmbed } from './CallEmbed';

export type ShareQuality = 720 | 1080 | 1440;
export type ShareFps = 15 | 30 | 60;
export const SHARE_QUALITIES: ShareQuality[] = [720, 1080, 1440];
export const SHARE_FPS: ShareFps[] = [15, 30, 60];

// Bitrates are for 30fps; 60 gets more, 15 less.
const PRESETS: Record<ShareQuality, { width: number; height: number; bitrate: number }> = {
  720: { width: 1280, height: 720, bitrate: 2_500_000 },
  1080: { width: 1920, height: 1080, bitrate: 5_000_000 },
  1440: { width: 2560, height: 1440, bitrate: 9_000_000 },
};
const FPS_BITRATE: Record<ShareFps, number> = { 15: 0.6, 30: 1, 60: 1.6 };

// Handed to the call frame, which reads it when a screen share starts.
export const applyShareQuality = (embed: CallEmbed, quality: ShareQuality, fps: ShareFps) => {
  const { width, height, bitrate } = PRESETS[quality] ?? PRESETS[1080];
  const frameRate = SHARE_FPS.includes(fps) ? fps : 30;
  const maxBitrate = Math.round(bitrate * FPS_BITRATE[frameRate]);
  try {
    const frame = embed.iframe.contentWindow as (Window & { __angaaraShare?: unknown }) | null;
    if (!frame) return;
    // One full-quality layer, so everyone watching gets what was picked.
    frame.__angaaraShare = {
      capture: {
        resolution: { width, height, frameRate },
        contentHint: frameRate === 60 ? 'motion' : 'detail',
      },
      publish: { simulcast: false, screenShareEncoding: { maxBitrate, maxFramerate: frameRate } },
    };
  } catch {
    // Frame not reachable; shares keep the call's own quality.
  }
};
