import React, { useCallback, useState } from 'react';
import { Box, Button, Text, color } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { ImageDropZone } from '../../../components/image-drop-zone';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoom } from '../../../hooks/useRoom';
import { useRoomBannerUrl } from '../../../hooks/useRoomBanner';
import {
  cropSizeLabel,
  SPACE_BANNER_CROP,
  SPACE_BANNER_PREVIEW,
  useImageCropper,
} from '../../../components/image-cropper';
import { MAX_BANNER_BYTES, MAX_BANNER_LABEL } from '../../../hooks/useUserBanner';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { RoomPermissionsAPI } from '../../../hooks/useRoomPermissions';
import { StateEvent } from '../../../../types/matrix/room';
import { LEVEL_ANIMATED_BANNER, useSpaceLevel } from '../../../hooks/useSpaceLevel';
import { useStillImage } from '../../../hooks/useStillImage';

type SpaceBannerProps = {
  permissions: RoomPermissionsAPI;
};
export function SpaceBanner({ permissions }: SpaceBannerProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const { level } = useSpaceLevel(room);
  const locked = level < LEVEL_ANIMATED_BANNER;
  const bannerUrl = useRoomBannerUrl(room);
  const previewUrl = useStillImage(bannerUrl, locked);
  const canEdit = permissions.stateEvent(StateEvent.AngaaraRoomBanner, mx.getSafeUserId());
  const [error, setError] = useState<string>();

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (file?: File) => {
        const content = file ? { url: (await mx.uploadContent(file)).content_uri } : {};
        await mx.sendStateEvent(room.roomId, StateEvent.AngaaraRoomBanner as any, content);
      },
      [mx, room.roomId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.');
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      setError(`Banner must be under ${MAX_BANNER_LABEL}.`);
      return;
    }
    setError(undefined);
    save(file).catch(() => setError('Failed to save banner. Please try again.'));
  };
  const { open: cropBanner, cropper } = useImageCropper(SPACE_BANNER_CROP, handleFile);

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Banner"
        description={
          canEdit
            ? `Shown at the top of the space's room list. Best at ${cropSizeLabel(
                SPACE_BANNER_CROP
              )}. ${
                locked
                  ? `GIFs stay still until Server Level ${LEVEL_ANIMATED_BANNER}`
                  : 'GIFs work too'
              }, up to ${MAX_BANNER_LABEL}.`
            : 'Only members who can change the space avatar can change the banner.'
        }
      >
        <ImageDropZone
          imageUrl={previewUrl}
          width={SPACE_BANNER_PREVIEW.width}
          height={SPACE_BANNER_PREVIEW.height}
          label="space banner"
          onFile={cropBanner}
          disabled={!canEdit || saving}
          busy={saving}
        />
        {cropper}
        {bannerUrl && canEdit && (
          <Box>
            <Button
              size="300"
              variant="Critical"
              fill="None"
              radii="300"
              disabled={saving}
              onClick={() =>
                save().catch(() => setError('Failed to remove banner. Please try again.'))
              }
            >
              <Text size="B300">Remove</Text>
            </Button>
          </Box>
        )}
        {error && (
          <Text size="T200" style={{ color: color.Critical.Main }}>
            {error}
          </Text>
        )}
      </SettingTile>
    </SequenceCard>
  );
}
