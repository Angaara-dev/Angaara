import React, { MouseEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  config,
  Icon,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  toRem,
} from 'folds';
import { CallEmbed } from '../../plugins/call/CallEmbed';
import {
  AudioDeviceKind,
  getAudioDevice,
  listAudioDevices,
  outputSelectable,
  setAudioDevice,
} from '../../plugins/call/devices';
import { stopPropagation } from '../../utils/keyboard';
import { ShareFpsPicker, ShareResolutionPicker } from './ShareQualityPicker';

type DeviceListProps = {
  title: string;
  kind: AudioDeviceKind;
  devices: MediaDeviceInfo[];
  selected?: string;
  onSelect: (kind: AudioDeviceKind, id: string) => void;
};
function DeviceList({ title, kind, devices, selected, onSelect }: DeviceListProps) {
  // Nothing saved yet means the system default is in use.
  const current = devices.some((d) => d.deviceId === selected)
    ? selected
    : (devices.find((d) => d.deviceId === 'default') ?? devices[0])?.deviceId;
  return (
    <Box direction="Column" gap="100">
      <Text size="L400" priority="300" style={{ padding: `0 ${config.space.S200}` }}>
        {title}
      </Text>
      {devices.length === 0 && (
        <Text size="T200" priority="300" style={{ padding: `0 ${config.space.S200}` }}>
          No devices found
        </Text>
      )}
      {devices.map((d, i) => (
        <MenuItem
          key={d.deviceId}
          size="300"
          radii="300"
          aria-pressed={d.deviceId === current}
          after={d.deviceId === current ? <Icon size="100" src={Icons.Check} /> : undefined}
          onClick={() => onSelect(kind, d.deviceId)}
        >
          <Text size="T300" truncate>
            {d.label || `${kind === 'input' ? 'Microphone' : 'Speaker'} ${i + 1}`}
          </Text>
        </MenuItem>
      ))}
    </Box>
  );
}

function AudioDevicesMenu({ embed }: { embed?: CallEmbed }) {
  const [devices, setDevices] = useState<Record<AudioDeviceKind, MediaDeviceInfo[]>>();
  const [selected, setSelected] = useState(() => ({
    input: getAudioDevice('input', embed),
    output: getAudioDevice('output', embed),
  }));

  const [reload, setReload] = useState(0);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      listAudioDevices(embed).then((list) => {
        if (alive) setDevices(list);
      });
    load();
    navigator.mediaDevices?.addEventListener('devicechange', load);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener('devicechange', load);
    };
  }, [embed, reload]);

  // Browsers hide device names until the mic is allowed, so the list comes back empty.
  const allowMic = () =>
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        setReload((n) => n + 1);
      })
      .catch(() => setDenied(true));
  const hidden = devices !== undefined && devices.input.length === 0;

  const select = useCallback(
    (kind: AudioDeviceKind, id: string) => {
      setAudioDevice(kind, id, embed);
      setSelected((s) => ({ ...s, [kind]: id }));
    },
    [embed]
  );

  return (
    <Menu style={{ width: toRem(280), maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto' }}>
      <Box direction="Column" gap="300" style={{ padding: config.space.S200 }}>
        {hidden && (
          <Box direction="Column" gap="200" style={{ padding: `0 ${config.space.S200}` }}>
            <Text size="T200" priority="300">
              {denied
                ? "Microphone access is blocked or no microphone is plugged in. Allow it in your browser's site settings."
                : 'Allow microphone access to see your devices.'}
            </Text>
            {!denied && (
              <Button type="button" size="300" radii="300" variant="Primary" onClick={allowMic}>
                <Text size="B300">Allow Microphone</Text>
              </Button>
            )}
          </Box>
        )}
        <DeviceList
          title="Input Device"
          kind="input"
          devices={devices?.input ?? []}
          selected={selected.input}
          onSelect={select}
        />
        {outputSelectable() ? (
          <DeviceList
            title="Output Device"
            kind="output"
            devices={devices?.output ?? []}
            selected={selected.output}
            onSelect={select}
          />
        ) : (
          <Text size="T200" priority="300" style={{ padding: `0 ${config.space.S200}` }}>
            This browser picks the output device itself.
          </Text>
        )}
        <Box direction="Column" gap="200" style={{ padding: `0 ${config.space.S200}` }}>
          <Text size="L400" priority="300">
            Screen Share Resolution
          </Text>
          <ShareResolutionPicker />
          <Text size="L400" priority="300">
            Screen Share Frame Rate
          </Text>
          <ShareFpsPicker />
          <Text size="T200" priority="300">
            Changes apply the next time you share.
          </Text>
        </Box>
      </Box>
    </Menu>
  );
}

type AudioDevicesPopoutProps = {
  embed?: CallEmbed;
  position?: 'Top' | 'Bottom';
  children: (toggle: (evt: MouseEvent<HTMLElement>) => void, open: boolean) => ReactNode;
};
export function AudioDevicesPopout({ embed, position = 'Top', children }: AudioDevicesPopoutProps) {
  const [cords, setCords] = useState<RectCords>();
  const toggle = (evt: MouseEvent<HTMLElement>) =>
    setCords(cords ? undefined : evt.currentTarget.getBoundingClientRect());

  return (
    <PopOut
      anchor={cords}
      position={position}
      align="Center"
      offset={8}
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setCords(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
            fallbackFocus: () => document.body,
          }}
        >
          <div>
            <AudioDevicesMenu embed={embed} />
          </div>
        </FocusTrap>
      }
    >
      {children(toggle, !!cords)}
    </PopOut>
  );
}
