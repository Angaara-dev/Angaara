import React, {
  ChangeEventHandler,
  FormEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Box,
  Text,
  IconButton,
  Icon,
  Icons,
  Input,
  Avatar,
  Button,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Modal,
  Dialog,
  Header,
  config,
  Spinner,
  TextArea,
  color,
  toRem,
} from 'folds';
import { HexColorPicker } from 'react-colorful';
import FocusTrap from 'focus-trap-react';
import { useQueryClient } from '@tanstack/react-query';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { ProfileServerTag } from './ProfileServerTag';
import { ProfileThemeSetting } from './ProfileThemeSetting';
import { ProfileEffectSetting } from './ProfileEffectSetting';
import { XP_PERKS, XpPerk } from '../../../../client/xp';
import { useXpPerk } from '../../../hooks/useXpPerk';
import { BRAND_NAME } from '../../../brand';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { UserProfile, useUserProfile } from '../../../hooks/useUserProfile';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../../utils/matrix';
import { UserAvatar } from '../../../components/user-avatar';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { nameInitials } from '../../../utils/common';
import { describeError, tooBigMessage } from '../../../utils/describeError';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { useFilePicker } from '../../../hooks/useFilePicker';
import { useObjectURL } from '../../../hooks/useObjectURL';
import { stopPropagation } from '../../../utils/keyboard';
import { ImageEditor } from '../../../components/image-editor';
import { ImageDropZone } from '../../../components/image-drop-zone';
import {
  AVATAR_CROP,
  cropSizeLabel,
  CropPreset,
  PANEL_BG_CROP,
  PANEL_BG_PREVIEW,
  PROFILE_BANNER_CROP,
  PROFILE_BANNER_PREVIEW,
  useImageCropper,
} from '../../../components/image-cropper';
import { ModalWide } from '../../../styles/Modal.css';
import { createUploadAtom, UploadSuccess } from '../../../state/upload';
import { CompactUploadCardRenderer } from '../../../components/upload-card';
import { useCapabilities } from '../../../hooks/useCapabilities';
import {
  BANNER_PROFILE_KEY,
  LEGACY_BANNER_KEYS,
  MAX_BANNER_BYTES,
  MAX_BANNER_LABEL,
  extendedProfileQueryKey,
  useExtendedProfileSupport,
  useUserBannerUrl,
  useUserPanelBgUrl,
  PANEL_BG_PROFILE_KEY,
  LEGACY_PANEL_BG_KEYS,
  readProfileString,
  useExtendedProfile,
  BANNER_COLOR_PROFILE_KEY,
  useUserBannerColor,
} from '../../../hooks/useUserBanner';
import { HexColorPickerPopOut } from '../../../components/HexColorPickerPopOut';
import { bannerFallback } from '../../../components/user-profile/bannerFallback';
import { BIO_PROFILE_KEY, LEGACY_BIO_KEY, MAX_BIO_LENGTH } from '../../../hooks/useUserBio';

type ProfileProps = {
  profile: UserProfile;
  userId: string;
};
function ProfileAvatar({ profile, userId }: ProfileProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const capabilities = useCapabilities();
  const [alertRemove, setAlertRemove] = useState(false);
  const [avatarError, setAvatarError] = useState<string>();
  const disableSetAvatar = capabilities['m.set_avatar_url']?.enabled === false;

  const defaultDisplayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const [imageFile, setImageFile] = useState<File>();
  const imageFileURL = useObjectURL(imageFile);
  const uploadAtom = useMemo(() => {
    if (imageFile) return createUploadAtom(imageFile);
    return undefined;
  }, [imageFile]);

  const { open: cropAvatar, cropper } = useImageCropper(AVATAR_CROP, setImageFile);
  const pickFile = useFilePicker(cropAvatar, false);

  const handleRemoveUpload = useCallback(() => {
    setImageFile(undefined);
  }, []);

  const handleUploaded = useCallback(
    (upload: UploadSuccess) => {
      const { mxc } = upload;
      setAvatarError(undefined);
      mx.setAvatarUrl(mxc).catch((e: unknown) =>
        setAvatarError(describeError(e, "Couldn't set your avatar."))
      );
      handleRemoveUpload();
    },
    [mx, handleRemoveUpload]
  );

  const handleRemoveAvatar = () => {
    setAvatarError(undefined);
    mx.setAvatarUrl('').catch((e: unknown) =>
      setAvatarError(describeError(e, "Couldn't remove your avatar."))
    );
    setAlertRemove(false);
  };

  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          Avatar
        </Text>
      }
      after={
        <Avatar size="500" radii="300">
          <UserAvatar
            userId={userId}
            src={avatarUrl}
            renderFallback={() => <Text size="H4">{nameInitials(defaultDisplayName)}</Text>}
          />
        </Avatar>
      }
    >
      {uploadAtom ? (
        <Box gap="200" direction="Column">
          <CompactUploadCardRenderer
            uploadAtom={uploadAtom}
            onRemove={handleRemoveUpload}
            onComplete={handleUploaded}
          />
        </Box>
      ) : (
        <Box gap="200">
          <Button
            onClick={() => pickFile('image/*')}
            size="300"
            variant="Secondary"
            fill="Soft"
            outlined
            radii="300"
            disabled={disableSetAvatar}
          >
            <Text size="B300">Upload</Text>
          </Button>
          {avatarUrl && (
            <Button
              size="300"
              variant="Critical"
              fill="None"
              radii="300"
              disabled={disableSetAvatar}
              onClick={() => setAlertRemove(true)}
            >
              <Text size="B300">Remove</Text>
            </Button>
          )}
        </Box>
      )}
      {avatarError && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {avatarError}
        </Text>
      )}

      {imageFileURL && (
        <Overlay open={false} backdrop={<OverlayBackdrop />}>
          <OverlayCenter>
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                onDeactivate: handleRemoveUpload,
                clickOutsideDeactivates: true,
                escapeDeactivates: stopPropagation,
              }}
            >
              <Modal className={ModalWide} variant="Surface" size="500">
                <ImageEditor
                  name={imageFile?.name ?? 'Unnamed'}
                  url={imageFileURL}
                  requestClose={handleRemoveUpload}
                />
              </Modal>
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}

      {cropper}
      <Overlay open={alertRemove} backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setAlertRemove(false),
              clickOutsideDeactivates: true,
              escapeDeactivates: stopPropagation,
            }}
          >
            <Dialog variant="Surface">
              <Header
                style={{
                  padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                  borderBottomWidth: config.borderWidth.B300,
                }}
                variant="Surface"
                size="500"
              >
                <Box grow="Yes">
                  <Text size="H4">Remove Avatar</Text>
                </Box>
                <IconButton size="300" onClick={() => setAlertRemove(false)} radii="300">
                  <Icon src={Icons.Cross} />
                </IconButton>
              </Header>
              <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                <Box direction="Column" gap="200">
                  <Text priority="400">Are you sure you want to remove profile avatar?</Text>
                </Box>
                <Button variant="Critical" onClick={handleRemoveAvatar}>
                  <Text size="B400">Remove</Text>
                </Button>
              </Box>
            </Dialog>
          </FocusTrap>
        </OverlayCenter>
      </Overlay>
    </SettingTile>
  );
}

type ProfileImageProps = {
  title: string;
  description: string;
  imageUrl?: string;
  // Key written on upload, plus older keys cleared so they can't shadow it.
  profileKey: string;
  clearKeys?: string[];
  crop: CropPreset;
  preview: { width: number; height: number };
  userId: string;
  gifPerk: XpPerk;
};
function ProfileImage({
  title,
  description,
  imageUrl,
  profileKey,
  clearKeys = [],
  crop,
  preview,
  userId,
  gifPerk,
}: ProfileImageProps) {
  const mx = useMatrixClient();
  const gifUnlocked = useXpPerk(userId, gifPerk);
  const queryClient = useQueryClient();
  const supported = useExtendedProfileSupport();
  const [error, setError] = useState<string>();
  const label = title.toLowerCase();

  const [saveState, saveImage] = useAsyncCallback(
    useCallback(
      async (file?: File) => {
        if (file) {
          const { content_uri: mxc } = await mx.uploadContent(file);
          await mx.setExtendedProfileProperty(profileKey, mxc);
        } else {
          await mx.deleteExtendedProfileProperty(profileKey);
        }
        await Promise.all(
          clearKeys.map((key) => mx.deleteExtendedProfileProperty(key).catch(() => undefined))
        );
        await queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) });
      },
      [mx, queryClient, userId, profileKey, clearKeys]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;
  const disabled = !supported || saving;

  const handleFile = useCallback(
    (file?: File) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setError('That file is not an image.');
        return;
      }
      if (file.size > MAX_BANNER_BYTES) {
        setError(tooBigMessage(title, file.size, MAX_BANNER_BYTES));
        return;
      }
      setError(undefined);
      saveImage(file).catch((e) => setError(describeError(e, `Couldn't save your ${label}.`)));
    },
    [saveImage, title, label]
  );
  const { open: cropImage, cropper } = useImageCropper(crop, handleFile);
  // Downloads the linked image and re-uploads it, so viewers never load it from the GIF site.
  const [linkState, loadLink] = useAsyncCallback(
    useCallback(async (link: string) => {
      const res = await fetch(link.trim());
      if (!res.ok) throw new Error('Bad response');
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Not an image');
      return new File([blob], 'image', { type: blob.type });
    }, [])
  );
  const loadingLink = linkState.status === AsyncStatus.Loading;

  const handleLinkSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const input = (evt.target as HTMLFormElement).imageLinkInput as HTMLInputElement;
    if (!input.value.trim() || loadingLink) return;
    setError(undefined);
    loadLink(input.value)
      .then((file) => {
        cropImage(file);
        input.value = '';
      })
      .catch(() =>
        setError("Couldn't load that link. Some sites block this, so save the GIF and upload it.")
      );
  };

  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          {title}
        </Text>
      }
      description={
        supported === false ? "Your server doesn't support profile images yet." : description
      }
    >
      <ImageDropZone
        imageUrl={imageUrl}
        width={preview.width}
        height={preview.height}
        label={label}
        onFile={cropImage}
        disabled={disabled || loadingLink}
        busy={saving}
      />
      {cropper}
      <Box as="form" onSubmit={handleLinkSubmit} gap="200" alignItems="Center">
        <Box grow="Yes" direction="Column">
          <Input
            name="imageLinkInput"
            size="300"
            variant="Secondary"
            radii="300"
            placeholder="Or paste an image address (right-click GIF, Copy image address)"
            disabled={disabled || loadingLink}
          />
        </Box>
        <Button
          type="submit"
          size="300"
          variant="Secondary"
          fill="Soft"
          outlined
          radii="300"
          disabled={disabled || loadingLink}
          before={loadingLink && <Spinner size="100" variant="Secondary" />}
        >
          <Text size="B300">Use Link</Text>
        </Button>
        {imageUrl && (
          <Button
            size="300"
            variant="Critical"
            fill="None"
            radii="300"
            disabled={saving}
            onClick={() =>
              saveImage().catch((e) => setError(describeError(e, `Couldn't remove your ${label}.`)))
            }
          >
            <Text size="B300">Remove</Text>
          </Button>
        )}
      </Box>
      {!gifUnlocked && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          You can add a GIF here, but other people using {BRAND_NAME} won&apos;t see it animate
          until you reach the required level ({XP_PERKS[gifPerk].toLocaleString()} XP).
        </Text>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </SettingTile>
  );
}

const BANNER_CLEAR_KEYS = ['m.banner_url', ...LEGACY_BANNER_KEYS];
function ProfileBanner({ userId }: { userId: string }) {
  return (
    <ProfileImage
      title="Banner"
      description={`Shown at the top of your profile. Best at ${cropSizeLabel(
        PROFILE_BANNER_CROP
      )}. GIFs animate at ${XP_PERKS.bannerGif.toLocaleString()} XP, up to ${MAX_BANNER_LABEL}.`}
      imageUrl={useUserBannerUrl(userId)}
      profileKey={BANNER_PROFILE_KEY}
      clearKeys={BANNER_CLEAR_KEYS}
      crop={PROFILE_BANNER_CROP}
      preview={PROFILE_BANNER_PREVIEW}
      userId={userId}
      gifPerk="bannerGif"
    />
  );
}

function ProfileBannerColor({ userId }: { userId: string }) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const supported = useExtendedProfileSupport();
  const saved = useUserBannerColor(userId);
  const [picked, setPicked] = useState<string | null>();
  const [error, setError] = useState<string>();
  const shown = picked === undefined ? saved : picked ?? undefined;

  // The picker fires on every drag, so only save once it settles.
  useEffect(() => {
    if (picked === undefined) return undefined;
    const timer = window.setTimeout(async () => {
      try {
        if (picked) await mx.setExtendedProfileProperty(BANNER_COLOR_PROFILE_KEY, picked);
        else await mx.deleteExtendedProfileProperty(BANNER_COLOR_PROFILE_KEY);
        setError(undefined);
      } catch (e) {
        setError(describeError(e, "Couldn't save your banner colour."));
      }
      await queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [picked, mx, queryClient, userId]);

  return (
    <SettingTile
      title="Banner Colour"
      description="Shown at the top of your profile when you don't have a banner image."
      after={
        <HexColorPickerPopOut
          picker={<HexColorPicker color={shown ?? '#3a3a40'} onChange={setPicked} />}
          onRemove={shown ? () => setPicked(null) : undefined}
        >
          {(openPicker, opened) => (
            <Button
              aria-pressed={opened}
              onClick={openPicker}
              size="300"
              variant="Secondary"
              fill="Soft"
              outlined
              radii="300"
              disabled={!supported}
              before={
                <span
                  style={{
                    width: toRem(16),
                    height: toRem(16),
                    borderRadius: toRem(4),
                    background: shown ?? bannerFallback(userId),
                  }}
                />
              }
            >
              <Text size="B300">Pick</Text>
            </Button>
          )}
        </HexColorPickerPopOut>
      }
    >
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </SettingTile>
  );
}

function ProfilePanelBackground({ userId }: { userId: string }) {
  return (
    <ProfileImage
      title="Panel Background"
      description={`Behind your name at the bottom of the sidebar. Best at ${cropSizeLabel(
        PANEL_BG_CROP
      )}. GIFs animate at ${XP_PERKS.panelGif.toLocaleString()} XP.`}
      imageUrl={useUserPanelBgUrl(userId)}
      profileKey={PANEL_BG_PROFILE_KEY}
      clearKeys={LEGACY_PANEL_BG_KEYS}
      crop={PANEL_BG_CROP}
      preview={PANEL_BG_PREVIEW}
      userId={userId}
      gifPerk="panelGif"
    />
  );
}

function ProfileDisplayName({ profile, userId }: ProfileProps) {
  const mx = useMatrixClient();
  const capabilities = useCapabilities();
  const disableSetDisplayname = capabilities['m.set_displayname']?.enabled === false;

  const defaultDisplayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const [displayName, setDisplayName] = useState<string>(defaultDisplayName);

  const [changeState, changeDisplayName] = useAsyncCallback(
    useCallback((name: string) => mx.setDisplayName(name), [mx])
  );
  const changingDisplayName = changeState.status === AsyncStatus.Loading;

  useEffect(() => {
    setDisplayName(defaultDisplayName);
  }, [defaultDisplayName]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    const name = evt.currentTarget.value;
    setDisplayName(name);
  };

  const handleReset = () => {
    setDisplayName(defaultDisplayName);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (changingDisplayName) return;

    const target = evt.target as HTMLFormElement | undefined;
    const displayNameInput = target?.displayNameInput as HTMLInputElement | undefined;
    const name = displayNameInput?.value;
    if (!name) return;

    changeDisplayName(name);
  };

  const hasChanges = displayName !== defaultDisplayName;
  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          Display Name
        </Text>
      }
    >
      <Box direction="Column" grow="Yes" gap="100">
        <Box
          as="form"
          onSubmit={handleSubmit}
          gap="200"
          aria-disabled={changingDisplayName || disableSetDisplayname}
        >
          <Box grow="Yes" direction="Column">
            <Input
              required
              name="displayNameInput"
              value={displayName}
              onChange={handleChange}
              variant="Secondary"
              radii="300"
              style={{ paddingRight: config.space.S200 }}
              readOnly={changingDisplayName || disableSetDisplayname}
              after={
                hasChanges &&
                !changingDisplayName && (
                  <IconButton
                    type="reset"
                    onClick={handleReset}
                    size="300"
                    radii="300"
                    variant="Secondary"
                  >
                    <Icon src={Icons.Cross} size="100" />
                  </IconButton>
                )
              }
            />
          </Box>
          <Button
            size="400"
            variant={hasChanges ? 'Success' : 'Secondary'}
            fill={hasChanges ? 'Solid' : 'Soft'}
            outlined
            radii="300"
            disabled={!hasChanges || changingDisplayName}
            type="submit"
          >
            {changingDisplayName && <Spinner variant="Success" fill="Solid" size="300" />}
            <Text size="B400">Save</Text>
          </Button>
        </Box>
      </Box>
      {changeState.status === AsyncStatus.Error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {describeError(changeState.error, "Couldn't change your display name.")}
        </Text>
      )}
    </SettingTile>
  );
}

function ProfileBio({ userId }: { userId: string }) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const supported = useExtendedProfileSupport();
  const profile = useExtendedProfile(userId);
  const saved = readProfileString(profile, [BIO_PROFILE_KEY, LEGACY_BIO_KEY]) ?? '';
  const [bio, setBio] = useState(saved);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setBio(saved);
  }, [saved]);

  const [saveState, saveBio] = useAsyncCallback(
    useCallback(
      async (value: string) => {
        if (value) await mx.setExtendedProfileProperty(BIO_PROFILE_KEY, value);
        else await mx.deleteExtendedProfileProperty(BIO_PROFILE_KEY);
        await mx.deleteExtendedProfileProperty(LEGACY_BIO_KEY).catch(() => undefined);
        await queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) });
      },
      [mx, queryClient, userId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;
  const hasChanges = bio.trim() !== saved.trim();

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (!hasChanges || saving) return;
    setError(undefined);
    saveBio(bio.trim()).catch((e) => setError(describeError(e, "Couldn't save your bio.")));
  };

  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          About Me
        </Text>
      }
      description={
        supported === false
          ? "Your server doesn't support profile bios yet."
          : 'Shown on your profile when people click your name. Links work.'
      }
    >
      <Box as="form" onSubmit={handleSubmit} direction="Column" gap="200">
        <TextArea
          value={bio}
          onChange={(evt) => setBio(evt.currentTarget.value.slice(0, MAX_BIO_LENGTH))}
          maxLength={MAX_BIO_LENGTH}
          rows={3}
          resize="Vertical"
          variant="Secondary"
          radii="300"
          placeholder="Tell people a bit about yourself"
          readOnly={saving || supported === false}
        />
        <Box alignItems="Center" gap="200">
          <Text size="T200" priority="300" style={{ flexGrow: 1 }}>
            {bio.length}/{MAX_BIO_LENGTH}
          </Text>
          <Button
            type="submit"
            size="300"
            variant={hasChanges ? 'Success' : 'Secondary'}
            fill={hasChanges ? 'Solid' : 'Soft'}
            outlined
            radii="300"
            disabled={!hasChanges || saving}
            before={saving && <Spinner variant="Success" fill="Solid" size="100" />}
          >
            <Text size="B300">Save</Text>
          </Button>
        </Box>
      </Box>
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </SettingTile>
  );
}

export function Profile() {
  const mx = useMatrixClient();
  const userId = mx.getUserId()!;
  const profile = useUserProfile(userId);

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Profile</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <ProfileAvatar userId={userId} profile={profile} />
        <ProfileBanner userId={userId} />
        <ProfileBannerColor userId={userId} />
        <ProfilePanelBackground userId={userId} />
        <ProfileThemeSetting userId={userId} />
        <ProfileEffectSetting userId={userId} />
        <ProfileDisplayName userId={userId} profile={profile} />
        <ProfileBio userId={userId} />
        <ProfileServerTag userId={userId} />
      </SequenceCard>
    </Box>
  );
}
