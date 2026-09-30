import React, { FormEventHandler, useCallback, useEffect, useState } from 'react';
import { Box, Button, Icon, Icons, Input, Spinner, Text, color, toRem } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoom } from '../../../hooks/useRoom';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { LEVEL_SERVER_COLORS, LEVEL_SERVER_TAG, useSpaceLevel } from '../../../hooks/useSpaceLevel';
import { cleanServerTag, MAX_SERVER_TAG_LENGTH } from '../../../hooks/useServerTag';
import { ACCENT_PRESETS, isHexColor } from '../../../utils/accent';
import { StateEvent } from '../../../../types/matrix/room';
import { GradientEditor } from '../../../components/gradient-editor';

type PerkProps = {
  permissions: RoomPermissionsAPI;
};

const useSaveState = (type: StateEvent) => {
  const mx = useMatrixClient();
  const room = useRoom();
  return useAsyncCallback(
    useCallback(
      (content: Record<string, unknown>) => mx.sendStateEvent(room.roomId, type as any, content),
      [mx, room.roomId, type]
    )
  );
};

const lockedText = (level: number) => `Unlocks at Server Level ${level}.`;

export function SpaceTagSetting({ permissions }: PerkProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const { level } = useSpaceLevel(room);
  const saved = cleanServerTag(useStateEvent(room, StateEvent.AngaaraSpaceTag)?.getContent().tag);
  const [tag, setTag] = useState(saved ?? '');
  const [error, setError] = useState<string>();
  const canEdit = permissions.stateEvent(StateEvent.AngaaraSpaceTag, mx.getSafeUserId());
  const locked = level < LEVEL_SERVER_TAG;
  const [saveState, save] = useSaveState(StateEvent.AngaaraSpaceTag);
  const saving = saveState.status === AsyncStatus.Loading;

  useEffect(() => setTag(saved ?? ''), [saved]);

  const hasChanges = tag.trim() !== (saved ?? '');
  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (!hasChanges || saving) return;
    setError(undefined);
    const clean = cleanServerTag(tag);
    save(clean ? { tag: clean } : {}).catch(() => setError('Failed to save the tag.'));
  };

  let description = `A short tag of up to ${MAX_SERVER_TAG_LENGTH} characters that members can show next to their name.`;
  if (locked) description = `${description} ${lockedText(LEVEL_SERVER_TAG)}`;
  else if (!canEdit) description = 'Only members who can change space settings can edit the tag.';

  return (
    <SettingTile
      title="Server Tag"
      description={description}
      after={locked && <Icon size="100" src={Icons.Lock} />}
    >
      {!locked && (
        <Box as="form" onSubmit={handleSubmit} gap="200" alignItems="Center">
          <Input
            value={tag}
            onChange={(evt) => setTag(evt.currentTarget.value.slice(0, MAX_SERVER_TAG_LENGTH))}
            maxLength={MAX_SERVER_TAG_LENGTH}
            placeholder="TAG"
            variant="Secondary"
            radii="300"
            size="400"
            readOnly={!canEdit || saving}
            style={{ width: toRem(120), fontWeight: 700 }}
            aria-label="Server tag"
          />
          {canEdit && (
            <Button
              type="submit"
              size="400"
              variant={hasChanges ? 'Success' : 'Secondary'}
              fill={hasChanges ? 'Solid' : 'Soft'}
              outlined
              radii="300"
              disabled={!hasChanges || saving}
              before={saving && <Spinner variant="Success" fill="Solid" size="100" />}
            >
              <Text size="B400">Save</Text>
            </Button>
          )}
        </Box>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </SettingTile>
  );
}

const swatch = (value: string, selected: boolean): React.CSSProperties => ({
  width: toRem(28),
  height: toRem(28),
  borderRadius: '50%',
  background: value,
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  outline: selected ? `2px solid ${color.Surface.OnContainer}` : 'none',
  outlineOffset: toRem(2),
});

const hexOr = (value: unknown, fallback: string) =>
  typeof value === 'string' && isHexColor(value) ? value : fallback;

// Theme content is shared by both tiles, so each save keeps the other's fields.
const useSpaceTheme = () => {
  const room = useRoom();
  const content = useStateEvent(room, StateEvent.AngaaraSpaceTheme)?.getContent() ?? {};
  const [saveState, save] = useSaveState(StateEvent.AngaaraSpaceTheme);
  const update = (patch: Record<string, string | undefined>) => {
    const next: Record<string, unknown> = { ...content, ...patch };
    Object.keys(next).forEach((key) => next[key] === undefined && delete next[key]);
    return save(next);
  };
  return { content, update, saving: saveState.status === AsyncStatus.Loading };
};

const DEFAULT_TOP = '#000000';
const DEFAULT_BOTTOM = '#662a00';

type ColorTileProps = PerkProps & { title: string; about: string };
function useColorTile({ permissions, title, about }: ColorTileProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const { level } = useSpaceLevel(room);
  const locked = level < LEVEL_SERVER_COLORS;
  const canEdit = permissions.stateEvent(StateEvent.AngaaraSpaceTheme, mx.getSafeUserId());
  let description = about;
  if (locked) description = `${about} ${lockedText(LEVEL_SERVER_COLORS)}`;
  else if (!canEdit) description = 'Only members who can change space settings can edit colours.';
  return { locked, canEdit, tileProps: { title, description } };
}

function SaveRow({
  show,
  hasChanges,
  saving,
  onSave,
  onClear,
  clearLabel,
}: {
  show: boolean;
  hasChanges: boolean;
  saving: boolean;
  onSave: () => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  if (!show) return null;
  return (
    <Box gap="200">
      <Button
        type="button"
        size="300"
        variant={hasChanges ? 'Success' : 'Secondary'}
        fill={hasChanges ? 'Solid' : 'Soft'}
        outlined
        radii="300"
        disabled={!hasChanges || saving}
        onClick={onSave}
        before={saving && <Spinner variant="Success" fill="Solid" size="100" />}
      >
        <Text size="B300">Save</Text>
      </Button>
      {onClear && (
        <Button
          type="button"
          size="300"
          variant="Critical"
          fill="None"
          radii="300"
          disabled={saving}
          onClick={onClear}
        >
          <Text size="B300">{clearLabel}</Text>
        </Button>
      )}
    </Box>
  );
}

export function SpaceThemeSetting({ permissions }: PerkProps) {
  const { content, update, saving } = useSpaceTheme();
  const { locked, canEdit, tileProps } = useColorTile({
    permissions,
    title: 'Server Theme',
    about:
      'A top-to-bottom gradient behind the whole app while people are in the server. Everyone keeps their own accent colour.',
  });
  const saved = !!(content.top || content.bottom);
  const savedTop = hexOr(content.top, DEFAULT_TOP);
  const savedBottom = hexOr(content.bottom, DEFAULT_BOTTOM);
  const [top, setTop] = useState(savedTop);
  const [bottom, setBottom] = useState(savedBottom);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setTop(savedTop);
    setBottom(savedBottom);
  }, [savedTop, savedBottom]);

  const hasChanges = !saved || top !== savedTop || bottom !== savedBottom;
  const run = (patch: Record<string, string | undefined>) => {
    setError(undefined);
    update(patch).catch(() => setError('Failed to save the theme.'));
  };

  return (
    <SettingTile {...tileProps} after={locked && <Icon size="100" src={Icons.Lock} />}>
      {!locked && (
        <Box direction="Column" gap="300">
          <GradientEditor
            top={top}
            bottom={bottom}
            disabled={!canEdit || saving}
            onChange={(t, b) => {
              setTop(t);
              setBottom(b);
            }}
          />
          <SaveRow
            show={canEdit}
            hasChanges={hasChanges}
            saving={saving}
            onSave={() => run({ top, bottom })}
            onClear={saved ? () => run({ top: undefined, bottom: undefined }) : undefined}
            clearLabel="Remove Theme"
          />
        </Box>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </SettingTile>
  );
}

export function SpaceAccentSetting({ permissions }: PerkProps) {
  const { content, update, saving } = useSpaceTheme();
  const { locked, canEdit, tileProps } = useColorTile({
    permissions,
    title: 'Server Accent',
    about:
      "Optional. Colours the server's own touches, like the glow on members' avatars. Everyone keeps their own accent for buttons and links.",
  });
  const saved = hexOr(content.accent, '');
  const [accent, setAccent] = useState(saved);
  const [error, setError] = useState<string>();

  useEffect(() => setAccent(saved), [saved]);

  const hasChanges = accent.toLowerCase() !== saved.toLowerCase();
  const isPreset = ACCENT_PRESETS.some((p) => p.value.toLowerCase() === accent.toLowerCase());

  return (
    <SettingTile {...tileProps} after={locked && <Icon size="100" src={Icons.Lock} />}>
      {!locked && (
        <Box direction="Column" gap="300">
          <Box gap="200" alignItems="Center" wrap="Wrap">
            <Button
              type="button"
              size="300"
              variant={accent ? 'Secondary' : 'Primary'}
              fill="Soft"
              radii="Pill"
              aria-pressed={!accent}
              disabled={!canEdit || saving}
              onClick={() => setAccent('')}
            >
              <Text size="B300">Their Own</Text>
            </Button>
            {ACCENT_PRESETS.map((preset) => {
              const selected = preset.value.toLowerCase() === accent.toLowerCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.name}
                  aria-label={`${preset.name} server accent`}
                  aria-pressed={selected}
                  disabled={!canEdit || saving}
                  style={swatch(preset.value, selected)}
                  onClick={() => setAccent(preset.value)}
                />
              );
            })}
            <Box
              as="label"
              title="Custom colour"
              alignItems="Center"
              justifyContent="Center"
              style={{
                ...swatch(
                  !accent || isPreset ? color.SurfaceVariant.ContainerActive : accent,
                  !!accent && !isPreset
                ),
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {(!accent || isPreset) && <Icon size="100" src={Icons.Plus} />}
              <input
                type="color"
                aria-label="Custom server accent"
                value={accent || '#ff6b3d'}
                disabled={!canEdit || saving}
                onChange={(evt) => setAccent(evt.currentTarget.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
              />
            </Box>
          </Box>
          <SaveRow
            show={canEdit}
            hasChanges={hasChanges}
            saving={saving}
            onSave={() => {
              setError(undefined);
              update({ accent: accent || undefined }).catch(() =>
                setError('Failed to save the accent.')
              );
            }}
          />
        </Box>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </SettingTile>
  );
}

export function SpacePerks({ permissions }: PerkProps) {
  const me = useMatrixClient().getSafeUserId();
  const canTag = permissions.stateEvent(StateEvent.AngaaraSpaceTag, me);
  const canTheme = permissions.stateEvent(StateEvent.AngaaraSpaceTheme, me);
  if (!canTag && !canTheme) return null;
  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="SurfaceVariant"
      direction="Column"
      gap="400"
    >
      {canTag && <SpaceTagSetting permissions={permissions} />}
      {canTheme && <SpaceThemeSetting permissions={permissions} />}
      {canTheme && <SpaceAccentSetting permissions={permissions} />}
    </SequenceCard>
  );
}
