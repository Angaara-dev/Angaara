import React, { FormEventHandler, useCallback, useEffect, useState } from 'react';
import { Box, Button, Icon, Icons, Input, Spinner, Text, color, config, toRem } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoom } from '../../../hooks/useRoom';
import { useStateEvent } from '../../../hooks/useStateEvent';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { LEVEL_SERVER_COLORS, LEVEL_SERVER_TAG, useSpaceLevel } from '../../../hooks/useSpaceLevel';
import { cleanServerTag, cleanTagLook, MAX_SERVER_TAG_LENGTH } from '../../../hooks/useServerTag';
import {
  DEFAULT_TAG_COLOR,
  TAG_ICON_GROUPS,
  TagIconView,
} from '../../../components/user-profile/serverTagIcons';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { getRoomAvatarUrl } from '../../../utils/room';
import { ACCENT_PRESETS, isHexColor } from '../../../utils/accent';
import { StateEvent } from '../../../../types/matrix/room';
import { GradientEditor } from '../../../components/gradient-editor';
import { describeError } from '../../../utils/describeError';

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

// Tag look: a preset icon in a colour, or the server's own picture.
function TagIconPicker({
  icon,
  tagColor,
  avatarUrl,
  disabled,
  onIcon,
  onColor,
}: {
  icon: string;
  tagColor: string;
  avatarUrl?: string;
  disabled: boolean;
  onIcon: (icon: string) => void;
  onColor: (color: string) => void;
}) {
  const isPreset = ACCENT_PRESETS.some((p) => p.value.toLowerCase() === tagColor.toLowerCase());
  const pickStyle = (selected: boolean): React.CSSProperties => ({
    display: 'grid',
    placeItems: 'center',
    width: toRem(40),
    height: toRem(40),
    padding: 0,
    borderRadius: config.radii.R300,
    border: `1px solid ${selected ? color.Surface.OnContainer : 'transparent'}`,
    background: selected ? color.SurfaceVariant.ContainerActive : color.SurfaceVariant.Container,
    cursor: disabled ? 'default' : 'pointer',
  });
  return (
    <Box direction="Column" gap="300">
      <Box
        direction="Column"
        gap="200"
        style={{ maxHeight: toRem(260), overflowY: 'auto', paddingRight: config.space.S100 }}
      >
        <Box direction="Column" gap="100">
          <Text size="L400" priority="300">
            Server Picture
          </Text>
          <button
            type="button"
            title="Server picture"
            aria-label="Use the server picture"
            aria-pressed={!icon}
            disabled={disabled}
            style={pickStyle(!icon)}
            onClick={() => onIcon('')}
          >
            {avatarUrl ? (
              <TagIconView fallbackUrl={avatarUrl} size={toRem(18)} />
            ) : (
              <Icon size="100" src={Icons.Photo} />
            )}
          </button>
        </Box>
        {TAG_ICON_GROUPS.map((group) => (
          <Box key={group.name} direction="Column" gap="100">
            <Text size="L400" priority="300">
              {group.name}
            </Text>
            <Box gap="100" wrap="Wrap">
              {Object.entries(group.icons).map(([id, [name]]) => (
                <button
                  key={id}
                  type="button"
                  title={name}
                  aria-label={`${name} tag icon`}
                  aria-pressed={icon === id}
                  disabled={disabled}
                  style={pickStyle(icon === id)}
                  onClick={() => onIcon(id)}
                >
                  <TagIconView icon={id} color={tagColor} size={toRem(32)} />
                </button>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
      {icon && (
        <Box gap="200" alignItems="Center" wrap="Wrap">
          {ACCENT_PRESETS.map((preset) => {
            const selected = preset.value.toLowerCase() === tagColor.toLowerCase();
            return (
              <button
                key={preset.value}
                type="button"
                title={preset.name}
                aria-label={`${preset.name} tag colour`}
                aria-pressed={selected}
                disabled={disabled}
                style={swatch(preset.value, selected)}
                onClick={() => onColor(preset.value)}
              />
            );
          })}
          <Box
            as="label"
            title="Custom colour"
            alignItems="Center"
            justifyContent="Center"
            style={{
              ...swatch(isPreset ? color.SurfaceVariant.ContainerActive : tagColor, !isPreset),
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {isPreset && <Icon size="100" src={Icons.Plus} />}
            <input
              type="color"
              aria-label="Custom tag colour"
              value={tagColor}
              disabled={disabled}
              onChange={(evt) => onColor(evt.currentTarget.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function SpaceTagSetting({ permissions }: PerkProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const useAuthentication = useMediaAuthentication();
  const { level } = useSpaceLevel(room);
  const content = useStateEvent(room, StateEvent.AngaaraSpaceTag)?.getContent() ?? {};
  const saved = cleanServerTag(content.tag);
  const savedLook = cleanTagLook(content.icon, content.color);
  const savedIcon = savedLook.icon ?? '';
  const savedColor = savedLook.color ?? DEFAULT_TAG_COLOR;
  const [tag, setTag] = useState(saved ?? '');
  const [icon, setIcon] = useState(savedIcon);
  const [tagColor, setTagColor] = useState(savedColor);
  const [error, setError] = useState<string>();
  const canEdit = permissions.stateEvent(StateEvent.AngaaraSpaceTag, mx.getSafeUserId());
  const locked = level < LEVEL_SERVER_TAG;
  const [saveState, save] = useSaveState(StateEvent.AngaaraSpaceTag);
  const saving = saveState.status === AsyncStatus.Loading;

  useEffect(() => setTag(saved ?? ''), [saved]);
  useEffect(() => setIcon(savedIcon), [savedIcon]);
  useEffect(() => setTagColor(savedColor), [savedColor]);

  const hasChanges =
    tag.trim() !== (saved ?? '') ||
    icon !== savedIcon ||
    (!!icon && tagColor.toLowerCase() !== savedColor.toLowerCase());
  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (!hasChanges || saving) return;
    setError(undefined);
    const clean = cleanServerTag(tag);
    const look = icon ? { icon, color: tagColor } : {};
    save(clean ? { tag: clean, ...look } : {}).catch((e) =>
      setError(describeError(e, "Couldn't save the tag."))
    );
  };

  let description = `A short tag of up to ${MAX_SERVER_TAG_LENGTH} characters that members can show next to their name, with an icon and colour.`;
  if (locked) description = `${description} ${lockedText(LEVEL_SERVER_TAG)}`;
  else if (!canEdit) description = 'Only members who can change space settings can edit the tag.';

  const avatarUrl = getRoomAvatarUrl(mx, room, 32, useAuthentication);

  return (
    <SettingTile
      title="Server Tag"
      description={description}
      after={locked && <Icon size="100" src={Icons.Lock} />}
    >
      {!locked && (
        <Box as="form" onSubmit={handleSubmit} direction="Column" gap="300">
          <Box gap="200" alignItems="Center" wrap="Wrap">
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
            {tag.trim() && (
              <Box
                alignItems="Center"
                gap="100"
                aria-label="Tag preview"
                style={{
                  padding: `0 ${config.space.S100}`,
                  height: toRem(24),
                  borderRadius: config.radii.R300,
                  background: color.SurfaceVariant.Container,
                  border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
                }}
              >
                <TagIconView
                  icon={icon || undefined}
                  color={tagColor}
                  fallbackUrl={avatarUrl}
                  size={toRem(16)}
                />
                <Text as="span" size="T200" style={{ fontWeight: 700 }}>
                  {tag.trim()}
                </Text>
              </Box>
            )}
          </Box>
          {canEdit && (
            <TagIconPicker
              icon={icon}
              tagColor={tagColor}
              avatarUrl={avatarUrl}
              disabled={saving}
              onIcon={setIcon}
              onColor={setTagColor}
            />
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
    update(patch).catch((e) => setError(describeError(e, "Couldn't save the theme.")));
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
              update({ accent: accent || undefined }).catch((e) =>
                setError(describeError(e, "Couldn't save the accent."))
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
