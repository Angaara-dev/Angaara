import React, { useCallback, useState } from 'react';
import { Box, Chip, Spinner, Text, color, toRem } from 'folds';
import { useQueryClient } from '@tanstack/react-query';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useSpaces } from '../../../state/hooks/roomList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { getSpaceTag, parseServerTag, SERVER_TAG_PROFILE_KEY } from '../../../hooks/useServerTag';
import {
  extendedProfileQueryKey,
  readProfileString,
  useExtendedProfile,
  useExtendedProfileSupport,
} from '../../../hooks/useUserBanner';
import { getRoomAvatarUrl } from '../../../utils/room';

// Pick one server's tag to wear next to your name everywhere.
export function ProfileServerTag({ userId }: { userId: string }) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const useAuthentication = useMediaAuthentication();
  const supported = useExtendedProfileSupport();
  const current = parseServerTag(
    readProfileString(useExtendedProfile(userId), [SERVER_TAG_PROFILE_KEY])
  );
  const spaces = useSpaces(mx, allRoomsAtom)
    .map((id) => mx.getRoom(id))
    .flatMap((space) => {
      const tag = space && getSpaceTag(space);
      return space && tag ? [{ space, tag }] : [];
    });
  const [error, setError] = useState<string>();

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (value?: string) => {
        if (value) await mx.setExtendedProfileProperty(SERVER_TAG_PROFILE_KEY, value);
        else await mx.deleteExtendedProfileProperty(SERVER_TAG_PROFILE_KEY);
        await queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) });
      },
      [mx, queryClient, userId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  const pick = (value?: string) => {
    setError(undefined);
    save(value).catch(() => setError("Couldn't save your server tag. Please try again."));
  };

  let description = 'Show a server tag next to your name. Servers unlock tags at Level 2.';
  if (supported === false) description = "Your server doesn't support server tags yet.";
  else if (spaces.length === 0) {
    description = 'None of your servers have a tag yet. Servers unlock tags at Level 2.';
  }

  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          Server Tag
        </Text>
      }
      description={description}
    >
      {spaces.length > 0 && supported !== false && (
        <Box gap="200" wrap="Wrap" alignItems="Center">
          <Chip
            variant={current ? 'SurfaceVariant' : 'Primary'}
            radii="Pill"
            aria-pressed={!current}
            disabled={saving}
            onClick={() => pick()}
          >
            <Text size="T200">None</Text>
          </Chip>
          {spaces.map(({ space, tag }) => {
            const selected = current?.spaceId === space.roomId;
            const icon = getRoomAvatarUrl(mx, space, 32, useAuthentication);
            return (
              <Chip
                key={space.roomId}
                variant={selected ? 'Primary' : 'SurfaceVariant'}
                radii="Pill"
                aria-pressed={selected}
                disabled={saving}
                title={space.name}
                onClick={() => pick(`${tag}|${space.roomId}`)}
                before={
                  icon && (
                    <img
                      src={icon}
                      alt=""
                      style={{ width: toRem(16), height: toRem(16), borderRadius: toRem(4) }}
                    />
                  )
                }
              >
                <Text size="T200">
                  <b>{tag}</b> · {space.name}
                </Text>
              </Chip>
            );
          })}
          {saving && <Spinner size="100" variant="Secondary" />}
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
