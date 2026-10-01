import { CallEmbed } from './CallEmbed';

export type ShareQuality = 720 | 1080 | 1440;
export const SHARE_QUALITIES: ShareQuality[] = [720, 1080, 1440];

const PRESETS: Record<ShareQuality, { width: number; height: number; bitrate: number }> = {
  720: { width: 1280, height: 720, bitrate: 2_500_000 },
  1080: { width: 1920, height: 1080, bitrate: 5_000_000 },
  1440: { width: 2560, height: 1440, bitrate: 9_000_000 },
};
const FRAME_RATE = 30;

// Handed to the call frame, which reads it when a screen share starts.
export const applyShareQuality = (embed: CallEmbed, quality: ShareQuality) => {
  const { width, height, bitrate } = PRESETS[quality] ?? PRESETS[1080];
  try {
    const frame = embed.iframe.contentWindow as (Window & { __angaaraShare?: unknown }) | null;
    if (!frame) return;
    frame.__angaaraShare = {
      capture: { resolution: { width, height, frameRate: FRAME_RATE }, contentHint: 'detail' },
      publish: { screenShareEncoding: { maxBitrate: bitrate, maxFramerate: FRAME_RATE } },
    };
  } catch {
    // Frame not reachable; shares keep the call's own quality.
  }
};
