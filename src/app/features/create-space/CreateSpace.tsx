import React, { FormEventHandler, useCallback, useEffect, useRef, useState } from 'react';
import { MatrixError, Room } from 'matrix-js-sdk';
import {
  Box,
  Button,
  Chip,
  color,
  config,
  Icon,
  Icons,
  Input,
  Spinner,
  Switch,
  Text,
  TextArea,
} from 'folds';
import { useAtomValue } from 'jotai';
import { SettingTile } from '../../components/setting-tile';
import { SequenceCard } from '../../components/sequence-card';
import {
  creatorsSupported,
  knockRestrictedSupported,
  knockSupported,
  restrictedSupported,
} from '../../utils/matrix';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { millisecondsToMinutes, replaceSpaceWithDash } from '../../utils/common';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useCapabilities } from '../../hooks/useCapabilities';
import { useAlive } from '../../hooks/useAlive';
import { ErrorCode } from '../../cs-errorcode';
import {
  AdditionalCreatorInput,
  createRoom,
  CreateRoomAliasInput,
  CreateRoomData,
  CreateRoomAccess,
  CreateRoomAccessSelector,
  RoomVersionSelector,
  useAdditionalCreators,
} from '../../components/create-room';
import { RoomType, StateEvent } from '../../../types/matrix/room';
import { ImageDropZone } from '../../components/image-drop-zone';
import { useObjectURL } from '../../hooks/useObjectURL';
import { MAX_BANNER_BYTES, MAX_BANNER_LABEL } from '../../hooks/useUserBanner';
import {
  cropSizeLabel,
  SPACE_BANNER_CROP,
  SPACE_BANNER_PREVIEW,
  useImageCropper,
} from '../../components/image-cropper';
import { TOGGLEABLE_COMMANDS } from '../../hooks/useDisabledCommands';
import { EmojiInsertButton } from '../../components/EmojiInsertButton';
import { addBotToNewRoom } from '../automod/bot';
import { useClientConfig } from '../../hooks/useClientConfig';
import { roomToParentsAtom } from '../../state/room/roomToParents';

const getCreateSpaceAccessToIcon = (access: CreateRoomAccess) => {
  if (access === CreateRoomAccess.Private) return Icons.SpaceLock;
  if (access === CreateRoomAccess.Restricted) return Icons.Space;
  return Icons.SpaceGlobe;
};

type CreateSpaceFormProps = {
  defaultAccess?: CreateRoomAccess;
  space?: Room;
  onCreate?: (roomId: string) => void;
};
export function CreateSpaceForm({ defaultAccess, space, onCreate }: CreateSpaceFormProps) {
  const mx = useMatrixClient();
  const botUrl = useClientConfig().angaaraBot;
  const roomToParents = useAtomValue(roomToParentsAtom);
  const alive = useAlive();

  const capabilities = useCapabilities();
  const roomVersions = capabilities['m.room_versions'];
  const [selectedRoomVersion, selectRoomVersion] = useState(roomVersions?.default ?? '1');
  useEffect(() => {
    // capabilities load async
    selectRoomVersion(roomVersions?.default ?? '1');
  }, [roomVersions?.default]);

  const allowRestricted = space && restrictedSupported(selectedRoomVersion);

  const [access, setAccess] = useState(
    defaultAccess ?? (allowRestricted ? CreateRoomAccess.Restricted : CreateRoomAccess.Private)
  );

  const allowAdditionalCreators = creatorsSupported(selectedRoomVersion);
  const { additionalCreators, addAdditionalCreator, removeAdditionalCreator } =
    useAdditionalCreators();
  const [federation, setFederation] = useState(true);
  const [knock, setKnock] = useState(false);
  const [advance, setAdvance] = useState(false);
  const [bannerFile, setBannerFile] = useState<File>();
  const bannerPreview = useObjectURL(bannerFile);
  const [bannerError, setBannerError] = useState<string>();
  const [disabledCommands, setDisabledCommands] = useState<Set<string>>(new Set());
  const toggleCommand = (command: string, enabled: boolean) =>
    setDisabledCommands((prev) => {
      const next = new Set(prev);
      if (enabled) next.delete(command);
      else next.add(command);
      return next;
    });

  const pickBanner = (file: File) => {
    if (!file.type.startsWith('image/') || file.size > MAX_BANNER_BYTES) {
      setBannerError(`Pick an image under ${MAX_BANNER_LABEL}.`);
      return;
    }
    setBannerError(undefined);
    setBannerFile(file);
  };
  const { open: cropBanner, cropper } = useImageCropper(SPACE_BANNER_CROP, pickBanner);

  const allowKnock = access === CreateRoomAccess.Private && knockSupported(selectedRoomVersion);
  const allowKnockRestricted =
    access === CreateRoomAccess.Restricted && knockRestrictedSupported(selectedRoomVersion);

  const handleRoomVersionChange = (version: string) => {
    if (!restrictedSupported(version)) {
      setAccess(CreateRoomAccess.Private);
    }
    selectRoomVersion(version);
  };

  const [createState, create] = useAsyncCallback<string, Error | MatrixError, [CreateRoomData]>(
    useCallback(
      async (data) => {
        const roomId = await createRoom(mx, data);
        if (data.parent) {
          addBotToNewRoom(mx, botUrl, roomId, data.parent, roomToParents, true).catch(
            () => undefined
          );
        }
        // Best effort: the space exists even if the banner upload fails; it can be set in settings.
        if (bannerFile) {
          try {
            const { content_uri: url } = await mx.uploadContent(bannerFile);
            await mx.sendStateEvent(roomId, StateEvent.AngaaraRoomBanner as any, { url });
          } catch {
            // ignore
          }
        }
        if (disabledCommands.size > 0) {
          try {
            await mx.sendStateEvent(roomId, StateEvent.AngaaraDisabledCommands as any, {
              commands: Array.from(disabledCommands),
            });
          } catch {
            // Can be set again in the space's settings.
          }
        }
        return roomId;
      },
      [mx, bannerFile, disabledCommands, botUrl, roomToParents]
    )
  );
  const loading = createState.status === AsyncStatus.Loading;
  const error = createState.status === AsyncStatus.Error ? createState.error : undefined;
  const disabled = createState.status === AsyncStatus.Loading;

  const nameInputRef = useRef<HTMLInputElement>(null);
  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (disabled) return;
    const form = evt.currentTarget;

    const nameInput = form.nameInput as HTMLInputElement | undefined;
    const topicTextArea = form.topicTextAria as HTMLTextAreaElement | undefined;
    const aliasInput = form.aliasInput as HTMLInputElement | undefined;
    const roomName = nameInput?.value.trim();
    const roomTopic = topicTextArea?.value.trim();
    const aliasLocalPart =
      aliasInput && aliasInput.value ? replaceSpaceWithDash(aliasInput.value) : undefined;

    if (!roomName) return;
    const publicRoom = access === CreateRoomAccess.Public;
    let roomKnock = false;
    if (allowKnock && access === CreateRoomAccess.Private) {
      roomKnock = knock;
    }
    if (allowKnockRestricted && access === CreateRoomAccess.Restricted) {
      roomKnock = knock;
    }

    create({
      version: selectedRoomVersion,
      type: RoomType.Space,
      parent: space,
      access,
      name: roomName,
      topic: roomTopic || undefined,
      aliasLocalPart: publicRoom ? aliasLocalPart : undefined,
      knock: roomKnock,
      allowFederation: federation,
      additionalCreators: allowAdditionalCreators ? additionalCreators : undefined,
    }).then((roomId) => {
      if (alive()) {
        onCreate?.(roomId);
      }
    });
  };

  return (
    <Box as="form" onSubmit={handleSubmit} grow="Yes" direction="Column" gap="500">
      <Box direction="Column" gap="100">
        <Text size="L400">Access</Text>
        <CreateRoomAccessSelector
          value={access}
          onSelect={setAccess}
          canRestrict={allowRestricted}
          disabled={disabled}
          getIcon={getCreateSpaceAccessToIcon}
        />
      </Box>
      <Box shrink="No" direction="Column" gap="100">
        <Text size="L400">Name</Text>
        <Input
          required
          before={<Icon size="100" src={getCreateSpaceAccessToIcon(access)} />}
          ref={nameInputRef}
          name="nameInput"
          autoFocus
          size="500"
          variant="SurfaceVariant"
          radii="400"
          autoComplete="off"
          disabled={disabled}
          after={<EmojiInsertButton inputRef={nameInputRef} disabled={disabled} />}
        />
      </Box>
      <Box shrink="No" direction="Column" gap="100">
        <Text size="L400">Topic (Optional)</Text>
        <TextArea
          name="topicTextAria"
          size="500"
          variant="SurfaceVariant"
          radii="400"
          disabled={disabled}
        />
      </Box>

      <Box shrink="No" direction="Column" gap="100">
        <Text size="L400">Banner (Optional)</Text>
        <Text size="T200" priority="300">
          {`Best at ${cropSizeLabel(
            SPACE_BANNER_CROP
          )}. GIFs animate once the server reaches Level 1.`}
        </Text>
        <ImageDropZone
          imageUrl={bannerPreview}
          width={SPACE_BANNER_PREVIEW.width}
          height={SPACE_BANNER_PREVIEW.height}
          label="space banner"
          onFile={cropBanner}
          disabled={disabled}
        />
        {cropper}
        {bannerFile && (
          <Box>
            <Chip type="button" radii="Pill" onClick={() => setBannerFile(undefined)}>
              <Text size="T200">Remove banner</Text>
            </Chip>
          </Box>
        )}
        {bannerError && (
          <Text size="T200" style={{ color: color.Critical.Main }}>
            {bannerError}
          </Text>
        )}
      </Box>

      <Box shrink="No" direction="Column" gap="100">
        <Text size="L400">Commands</Text>
        <SequenceCard
          style={{ padding: config.space.S300 }}
          variant="SurfaceVariant"
          direction="Column"
          gap="300"
        >
          <Text size="T200" priority="300">
            Turn off fun commands in every room of this space. Only Angaara follows this.
          </Text>
          {TOGGLEABLE_COMMANDS.map(({ command, label }) => (
            <Box key={command} alignItems="Center" gap="300">
              <Box direction="Column" grow="Yes">
                <Text size="T300">/{command}</Text>
                <Text size="T200" priority="300">
                  {label}
                </Text>
              </Box>
              <Switch
                value={!disabledCommands.has(command)}
                onChange={(enabled: boolean) => toggleCommand(command, enabled)}
                disabled={disabled}
              />
            </Box>
          ))}
        </SequenceCard>
      </Box>

      {access === CreateRoomAccess.Public && <CreateRoomAliasInput disabled={disabled} />}

      <Box shrink="No" direction="Column" gap="100">
        <Box gap="200" alignItems="End">
          <Text size="L400">Options</Text>
          <Box grow="Yes" justifyContent="End">
            <Chip
              radii="Pill"
              before={<Icon src={advance ? Icons.ChevronTop : Icons.ChevronBottom} size="50" />}
              onClick={() => setAdvance(!advance)}
              type="button"
            >
              <Text size="T200">Advanced Options</Text>
            </Chip>
          </Box>
        </Box>
        {allowAdditionalCreators && (
          <SequenceCard
            style={{ padding: config.space.S300 }}
            variant="SurfaceVariant"
            direction="Column"
            gap="500"
          >
            <AdditionalCreatorInput
              additionalCreators={additionalCreators}
              onSelect={addAdditionalCreator}
              onRemove={removeAdditionalCreator}
            />
          </SequenceCard>
        )}
        {access !== CreateRoomAccess.Public && advance && (allowKnock || allowKnockRestricted) && (
          <SequenceCard
            style={{ padding: config.space.S300 }}
            variant="SurfaceVariant"
            direction="Column"
            gap="500"
          >
            <SettingTile
              title="Knock to Join"
              description="Anyone can send request to join this space."
              after={
                <Switch variant="Primary" value={knock} onChange={setKnock} disabled={disabled} />
              }
            />
          </SequenceCard>
        )}

        <SequenceCard
          style={{ padding: config.space.S300 }}
          variant="SurfaceVariant"
          direction="Column"
          gap="500"
        >
          <SettingTile
            title="Allow Federation"
            description="Users from other servers can join."
            after={
              <Switch
                variant="Primary"
                value={federation}
                onChange={setFederation}
                disabled={disabled}
              />
            }
          />
        </SequenceCard>
        {advance && (
          <RoomVersionSelector
            versions={roomVersions?.available ? Object.keys(roomVersions.available) : ['1']}
            value={selectedRoomVersion}
            onChange={handleRoomVersionChange}
            disabled={disabled}
          />
        )}
      </Box>

      {error && (
        <Box style={{ color: color.Critical.Main }} alignItems="Center" gap="200">
          <Icon src={Icons.Warning} filled size="100" />
          <Text size="T300" style={{ color: color.Critical.Main }}>
            <b>
              {error instanceof MatrixError && error.name === ErrorCode.M_LIMIT_EXCEEDED
                ? `Server rate-limited your request for ${millisecondsToMinutes(
                    (error.data.retry_after_ms as number | undefined) ?? 0
                  )} minutes!`
                : error.message}
            </b>
          </Text>
        </Box>
      )}
      <Box shrink="No" direction="Column" gap="200">
        <Button
          type="submit"
          size="500"
          variant="Primary"
          radii="400"
          disabled={disabled}
          before={loading && <Spinner variant="Primary" fill="Solid" size="200" />}
        >
          <Text size="B500">Create</Text>
        </Button>
      </Box>
    </Box>
  );
}
