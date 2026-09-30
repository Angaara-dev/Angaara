import React, { useSyncExternalStore } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  color,
  config,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Switch,
  Text,
} from 'folds';
import { Room } from 'matrix-js-sdk';
import { stopPropagation } from '../../utils/keyboard';
import { SettingTile } from '../../components/setting-tile';
import { SequenceCard } from '../../components/sequence-card';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useVaultStatus } from '../../hooks/useFriends';
import { getVaultItem, subscribeVault } from '../../../client/vault';
import {
  CommunityPrivacy,
  readCommunityPrivacy,
  setCommunityPrivacy,
} from '../../../client/communityPrivacy';

const getRawPrivacy = () => getVaultItem('privacy');

type CommunityPrivacyDialogProps = {
  space: Room;
  onClose: () => void;
};
export function CommunityPrivacyDialog({ space, onClose }: CommunityPrivacyDialogProps) {
  const name = useRoomName(space);
  const status = useVaultStatus();
  const raw = useSyncExternalStore(subscribeVault, getRawPrivacy);
  const privacy = readCommunityPrivacy(raw, space.roomId);
  const ready = status === 'ready';

  const toggle = (key: keyof CommunityPrivacy) => (value: boolean) => {
    setCommunityPrivacy(space.roomId, { [key]: value }).catch(() => undefined);
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog
            variant="Surface"
            role="dialog"
            aria-label="Privacy Settings"
            style={{ width: 'min(94vw, 30rem)' }}
          >
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4" truncate>
                  Privacy Settings
                </Text>
              </Box>
              <IconButton size="300" onClick={onClose} radii="300" aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box direction="Column" gap="300" style={{ padding: config.space.S400 }}>
              <Text size="T300" priority="300">
                {name}
              </Text>
              <SequenceCard
                variant="SurfaceVariant"
                direction="Column"
                gap="400"
                style={{ padding: config.space.S400 }}
              >
                <SettingTile
                  title="Direct Messages"
                  description="Allow DMs from members of this community."
                  after={
                    <Switch
                      variant="Primary"
                      value={privacy.allowDms}
                      onChange={toggle('allowDms')}
                      disabled={!ready}
                    />
                  }
                />
                <SettingTile
                  title="Friend Requests"
                  description="Allow friend requests from members of this community."
                  after={
                    <Switch
                      variant="Primary"
                      value={privacy.allowFriendRequests}
                      onChange={toggle('allowFriendRequests')}
                      disabled={!ready}
                    />
                  }
                />
              </SequenceCard>
              <Text size="T200" priority="300">
                Blocked ones are declined automatically, and your friends can always message you.
                These settings are end-to-end encrypted.
              </Text>
              {!ready && (
                <Text size="T200" style={{ color: color.Warning.Main }}>
                  Unlock your encrypted data on the Friends page to change these.
                </Text>
              )}
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
