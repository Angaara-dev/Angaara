import React, { FormEventHandler, ReactNode, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Input,
  Scroll,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useUserProfile } from '../../hooks/useUserProfile';
import { Presence, useUserPresence } from '../../hooks/useUserPresence';
import { useIgnoredUsers } from '../../hooks/useIgnoredUsers';
import { useFriendsData, useIncomingRequests, useVaultStatus } from '../../hooks/useFriends';
import {
  useSecretStorageDefaultKeyId,
  useSecretStorageKeyContent,
} from '../../hooks/useSecretStorage';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  IncomingRequest,
  removeFriend,
  sendFriendRequest,
  unblockUser,
} from '../../../client/friends';
import { unlockVault } from '../../../client/vault';
import { storePrivateKey } from '../../../client/secretStorageKeys';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { UserAvatar } from '../../components/user-avatar';
import { Page, PageContent, PageHeader } from '../../components/page';
import { BackRouteHandler } from '../../components/BackRouteHandler';
import { SequenceCard } from '../../components/sequence-card';
import { SecretStorageRecoveryKey } from '../../components/SecretStorage';
import { getDirectCreatePath, getDirectRoomPath, withSearchParam } from '../../pages/pathUtils';
import { DirectCreateSearchParams } from '../../pages/paths';

type Tab = 'online' | 'all' | 'pending' | 'blocked';

function ActionButton({
  label,
  icon,
  critical,
  onClick,
}: {
  label: string;
  icon: IconSrc;
  critical?: boolean;
  onClick: () => void;
}) {
  return (
    <TooltipProvider
      position="Top"
      tooltip={
        <Tooltip>
          <Text size="T200">{label}</Text>
        </Tooltip>
      }
    >
      {(ref) => (
        <IconButton
          ref={ref}
          aria-label={label}
          variant={critical ? 'Critical' : 'SurfaceVariant'}
          fill="Soft"
          radii="Pill"
          size="300"
          onClick={onClick}
        >
          <Icon size="100" src={icon} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

function PersonRow({
  userId,
  subtitle,
  children,
}: {
  userId: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const profile = useUserProfile(userId);
  const name = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  return (
    <Box
      alignItems="Center"
      gap="300"
      style={{ padding: `${config.space.S200} ${config.space.S300}` }}
    >
      <Avatar size="300">
        <UserAvatar
          userId={userId}
          src={avatarUrl}
          alt={name}
          renderFallback={() => <Text size="H6">{nameInitials(name)}</Text>}
        />
      </Avatar>
      <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
        <Text size="T400" truncate>
          <b>{name}</b>
        </Text>
        <Text size="T200" priority="300" truncate>
          {subtitle ?? userId}
        </Text>
      </Box>
      <Box shrink="No" gap="200">
        {children}
      </Box>
    </Box>
  );
}

const PRESENCE_LABEL: Record<Presence, string> = {
  [Presence.Online]: 'Online',
  [Presence.Unavailable]: 'Away',
  [Presence.Offline]: 'Offline',
};

function FriendRow({
  userId,
  roomId,
  onRemove,
}: {
  userId: string;
  roomId?: string;
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const presence = useUserPresence(userId);
  const openChat = () =>
    navigate(
      roomId
        ? getDirectRoomPath(roomId)
        : withSearchParam<DirectCreateSearchParams>(getDirectCreatePath(), { userId })
    );
  const status = presence?.status || (presence ? PRESENCE_LABEL[presence.presence] : undefined);

  return (
    <PersonRow userId={userId} subtitle={status}>
      <ActionButton label="Message" icon={Icons.Message} onClick={openChat} />
      <ActionButton label="Remove Friend" icon={Icons.Cross} critical onClick={onRemove} />
    </PersonRow>
  );
}

function OnlineFilter({ userId, children }: { userId: string; children: ReactNode }) {
  const presence = useUserPresence(userId);
  if (presence?.presence !== Presence.Online && !presence?.active) return null;
  return children as JSX.Element;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400" priority="300">
        {title}
      </Text>
      <SequenceCard variant="SurfaceVariant" direction="Column">
        {children}
      </SequenceCard>
    </Box>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Text size="T300" priority="300" align="Center" style={{ padding: config.space.S700 }}>
      {children}
    </Text>
  );
}

function AddFriend() {
  const mx = useMatrixClient();
  const [value, setValue] = useState('');
  const [sendState, send] = useAsyncCallback<void, Error, [string]>(
    useCallback((userId: string) => sendFriendRequest(mx, userId), [mx])
  );
  const sending = sendState.status === AsyncStatus.Loading;

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    const userId = value.trim();
    if (!userId || sending) return;
    send(userId).then(() => setValue(''));
  };

  return (
    <Box as="form" direction="Column" gap="100" onSubmit={handleSubmit}>
      <Text size="L400">Add Friend</Text>
      <Box gap="200">
        <Input
          style={{ flexGrow: 1 }}
          variant="SurfaceVariant"
          radii="400"
          size="500"
          placeholder="@username:server"
          value={value}
          onChange={(evt: React.ChangeEvent<HTMLInputElement>) => setValue(evt.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          outlined
        />
        <Button
          type="submit"
          size="500"
          radii="400"
          disabled={!value.trim() || sending}
          before={sending ? <Spinner size="200" variant="Primary" fill="Solid" /> : undefined}
        >
          <Text size="B400">Send Request</Text>
        </Button>
      </Box>
      {sendState.status === AsyncStatus.Error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {sendState.error.message || "Couldn't send the request."}
        </Text>
      )}
      {sendState.status === AsyncStatus.Success && (
        <Text size="T200" style={{ color: color.Success.Main }}>
          Friend request sent.
        </Text>
      )}
    </Box>
  );
}

function RecoveryKeyUnlock() {
  const mx = useMatrixClient();
  const keyId = useSecretStorageDefaultKeyId();
  const keyContent = useSecretStorageKeyContent(keyId ?? '');
  const [unlockState, unlock] = useAsyncCallback<void, Error, [Uint8Array]>(
    useCallback(
      async (recoveryKey: Uint8Array) => {
        if (!keyId) return;
        storePrivateKey(keyId, recoveryKey);
        await mx.getCrypto()?.loadSessionBackupPrivateKeyFromSecretStorage();
        await unlockVault();
      },
      [mx, keyId]
    )
  );
  if (!keyId || !keyContent) return null;
  return (
    <SecretStorageRecoveryKey
      keyContent={keyContent}
      processing={unlockState.status === AsyncStatus.Loading}
      onDecodedRecoveryKey={unlock}
    />
  );
}

// Friends and your DM list are encrypted, so they need your key backup open on this device.
function VaultNotice() {
  const status = useVaultStatus();
  if (status === 'ready') return null;
  if (status === 'loading') {
    return (
      <Box alignItems="Center" gap="200">
        <Spinner size="200" variant="Secondary" />
        <Text size="T300">Unlocking your encrypted friends list…</Text>
      </Box>
    );
  }
  return (
    <SequenceCard
      variant="SurfaceVariant"
      direction="Column"
      gap="300"
      style={{ padding: config.space.S400 }}
    >
      <Box gap="200" alignItems="Center">
        <Icon src={Icons.ShieldLock} size="200" />
        <Text size="H6">Your friends list is locked</Text>
      </Box>
      {status === 'no-backup' ? (
        <Text size="T300">
          Friends and your DM list are end-to-end encrypted with your key backup. Verify this device
          or turn on backup in Settings, under Devices, to use them.
        </Text>
      ) : (
        <>
          <Text size="T300">
            Friends and your DM list are end-to-end encrypted. Enter your recovery key to open them
            on this device.
          </Text>
          <RecoveryKeyUnlock />
        </>
      )}
    </SequenceCard>
  );
}

export function Friends() {
  const mx = useMatrixClient();
  const screenSize = useScreenSizeContext();
  const status = useVaultStatus();
  const data = useFriendsData();
  const incoming = useIncomingRequests();
  const ignored = useIgnoredUsers();
  const [tab, setTab] = useState<Tab>(() => (incoming.length > 0 ? 'pending' : 'online'));
  const [actionError, setActionError] = useState<string>();
  const run = (action: Promise<unknown>) => {
    setActionError(undefined);
    action.catch((err: Error) => setActionError(err.message || 'Something went wrong.'));
  };

  const friends = Object.entries(data.friends).sort(([a], [b]) => a.localeCompare(b));
  const outgoing = Object.keys(data.outgoing);
  const pendingCount = incoming.length + outgoing.length;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'online', label: 'Online' },
    { id: 'all', label: 'All' },
    { id: 'pending', label: pendingCount > 0 ? `Pending (${pendingCount})` : 'Pending' },
    { id: 'blocked', label: 'Blocked' },
  ];

  const respond = (request: IncomingRequest, action: 'accept' | 'decline' | 'block') => {
    if (action === 'accept') run(acceptFriendRequest(mx, request));
    else if (action === 'decline') run(declineFriendRequest(mx, request));
    else run(blockUser(mx, request.userId));
  };

  return (
    <Page>
      <PageHeader balance={false}>
        <Box grow="Yes" alignItems="Center" gap="200" style={{ minWidth: 0 }}>
          {screenSize === ScreenSize.Mobile && (
            <BackRouteHandler>
              {(onBack) => (
                <IconButton onClick={onBack} aria-label="Back">
                  <Icon src={Icons.ArrowLeft} />
                </IconButton>
              )}
            </BackRouteHandler>
          )}
          <Icon src={Icons.User} size="200" />
          <Text size="H4" truncate>
            Friends
          </Text>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="500">
              <VaultNotice />
              {status === 'ready' && <AddFriend />}
              {actionError && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  {actionError}
                </Text>
              )}
              <Box gap="200" wrap="Wrap">
                {tabs.map((t) => (
                  <Chip
                    key={t.id}
                    radii="Pill"
                    variant={tab === t.id ? 'Primary' : 'SurfaceVariant'}
                    aria-pressed={tab === t.id}
                    onClick={() => setTab(t.id)}
                  >
                    <Text size="B300">{t.label}</Text>
                  </Chip>
                ))}
              </Box>

              {(tab === 'online' || tab === 'all') &&
                (friends.length === 0 ? (
                  <Empty>
                    {status === 'ready'
                      ? 'No friends yet. Add someone with their user ID above.'
                      : 'Unlock your friends list to see your friends.'}
                  </Empty>
                ) : (
                  <Section title={tab === 'online' ? 'Online' : `All Friends — ${friends.length}`}>
                    {friends.map(([userId, friend]) =>
                      tab === 'online' ? (
                        <OnlineFilter key={userId} userId={userId}>
                          <FriendRow
                            userId={userId}
                            roomId={friend.roomId}
                            onRemove={() => run(removeFriend(userId))}
                          />
                        </OnlineFilter>
                      ) : (
                        <FriendRow
                          key={userId}
                          userId={userId}
                          roomId={friend.roomId}
                          onRemove={() => run(removeFriend(userId))}
                        />
                      )
                    )}
                  </Section>
                ))}

              {tab === 'pending' && (
                <>
                  {incoming.length > 0 && (
                    <Section title={`Incoming — ${incoming.length}`}>
                      {incoming.map((request) => (
                        <PersonRow
                          key={request.roomId}
                          userId={request.userId}
                          subtitle="Incoming friend request"
                        >
                          <ActionButton
                            label="Accept"
                            icon={Icons.Check}
                            onClick={() => respond(request, 'accept')}
                          />
                          <ActionButton
                            label="Ignore"
                            icon={Icons.Cross}
                            onClick={() => respond(request, 'decline')}
                          />
                          <ActionButton
                            label="Block"
                            icon={Icons.Shield}
                            critical
                            onClick={() => respond(request, 'block')}
                          />
                        </PersonRow>
                      ))}
                    </Section>
                  )}
                  {outgoing.length > 0 && (
                    <Section title={`Sent — ${outgoing.length}`}>
                      {outgoing.map((userId) => (
                        <PersonRow key={userId} userId={userId} subtitle="Friend request sent">
                          <ActionButton
                            label="Cancel Request"
                            icon={Icons.Cross}
                            onClick={() => run(cancelFriendRequest(mx, userId))}
                          />
                        </PersonRow>
                      ))}
                    </Section>
                  )}
                  {pendingCount === 0 && <Empty>No pending friend requests.</Empty>}
                </>
              )}

              {tab === 'blocked' &&
                (ignored.length === 0 ? (
                  <Empty>You haven&apos;t blocked anyone.</Empty>
                ) : (
                  <Section title={`Blocked — ${ignored.length}`}>
                    {ignored.map((userId) => (
                      <PersonRow key={userId} userId={userId} subtitle="Blocked">
                        <ActionButton
                          label="Unblock"
                          icon={Icons.Check}
                          onClick={() => run(unblockUser(mx, userId))}
                        />
                      </PersonRow>
                    ))}
                  </Section>
                ))}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
