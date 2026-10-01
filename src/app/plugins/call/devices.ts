import { CallEmbed } from './CallEmbed';

export type AudioDeviceKind = 'input' | 'output';

// Element Call keeps its device choices here; the call frame shares our origin.
const SETTING_KEY: Record<AudioDeviceKind, string> = {
  input: 'matrix-setting-audio-input',
  output: 'matrix-setting-audio-output',
};

type CallSetting = { getValue: () => unknown; setValue: (id: string) => void };
type CallDevices = Partial<Record<AudioDeviceKind, CallSetting>>;

const liveSettings = (embed?: CallEmbed): CallDevices | undefined => {
  try {
    return (embed?.iframe.contentWindow as { __angaaraDevices?: CallDevices } | null)
      ?.__angaaraDevices;
  } catch {
    return undefined;
  }
};

export const outputSelectable = (): boolean => 'setSinkId' in HTMLMediaElement.prototype;

export const getAudioDevice = (kind: AudioDeviceKind, embed?: CallEmbed): string | undefined => {
  const live = liveSettings(embed)?.[kind]?.getValue();
  if (typeof live === 'string') return live;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTING_KEY[kind]) ?? 'null');
    return typeof stored === 'string' ? stored : undefined;
  } catch {
    return undefined;
  }
};

// Switches the running call when there is one, and is remembered for the next call.
export const setAudioDevice = (kind: AudioDeviceKind, id: string, embed?: CallEmbed): void => {
  const live = liveSettings(embed)?.[kind];
  if (live) live.setValue(id);
  else localStorage.setItem(SETTING_KEY[kind], JSON.stringify(id));
};

export const listAudioDevices = async (
  embed?: CallEmbed
): Promise<Record<AudioDeviceKind, MediaDeviceInfo[]>> => {
  let media: MediaDevices | undefined = navigator.mediaDevices;
  try {
    media = embed?.iframe.contentWindow?.navigator.mediaDevices ?? media;
  } catch {
    // Frame not reachable; our own list is the same origin anyway.
  }
  const all = (await media?.enumerateDevices().catch(() => [])) ?? [];
  return {
    input: all.filter((d) => d.kind === 'audioinput' && d.deviceId),
    output: all.filter((d) => d.kind === 'audiooutput' && d.deviceId),
  };
};
