import React, { ReactNode, useRef, useState } from 'react';
import {
  Box,
  Button,
  color,
  config,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Input,
  Line,
  Menu,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  RectCords,
  Spinner,
  Text,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { Room } from 'matrix-js-sdk';
import { isKeyHotkey } from 'is-hotkey';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { useGetMemberPowerLevel, usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { getPowers, usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useMemberPowerCompare } from '../../hooks/useMemberPowerCompare';
import { useIgnoredUsers } from '../../hooks/useIgnoredUsers';
import { useFriendsData, useVaultStatus } from '../../hooks/useFriends';
import { blockUser, sendFriendRequest, unblockUser } from '../../../client/friends';
import { PowerColorBadge } from '../../components/power';
import { StateEvent } from '../../../types/matrix/room';
import { stopPropagation } from '../../utils/keyboard';
import { copyToClipboard } from '../../utils/dom';
import { getDirectCreatePath, withSearchParam } from '../../pages/pathUtils';
import { DirectCreateSearchParams } from '../../pages/paths';

export const MENTION_EVENT = 'angaara:mention';
export type MentionEventDetail = { roomId: string; userId: string };

type ItemProps = {
  icon?: IconSrc;
  label: string;
  critical?: boolean;
  after?: ReactNode;
  onClick: () => void;
};
function Item({ icon, label, critical, after, onClick }: ItemProps) {
  return (
    <MenuItem
      size="300"
      radii="300"
      fill="None"
      variant={critical ? 'Critical' : 'Surface'}
      before={icon && <Icon size="100" src={icon} />}
      after={after}
      onClick={onClick}
    >
      <Text size="T300" truncate>
        {label}
      </Text>
    </MenuItem>
  );
}

function Section({ children }: { children: ReactNode }) {
  return (
    <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
      {children}
    </Box>
  );
}

type ModAction = 'kick' | 'ban';
type ModDialogProps = {
  action: ModAction;
  name: string;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<unknown>;
};
function ModDialog({ action, name, onClose, onConfirm }: ModDialogProps) {
  const reasonRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const verb = action === 'kick' ? 'Kick' : 'Ban';

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(reasonRef.current?.value.trim() || undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: () => reasonRef.current ?? false,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: true,
          }}
        >
          <Dialog variant="Surface">
            <Header style={{ padding: `0 ${config.space.S200} 0 ${config.space.S400}` }} size="500">
              <Box grow="Yes">
                <Text size="H4" truncate>
                  {verb} {name}
                </Text>
              </Box>
              <IconButton size="300" radii="300" onClick={onClose}>
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box
              direction="Column"
              gap="300"
              style={{ padding: `0 ${config.space.S400} ${config.space.S400}` }}
            >
              <Text priority="400" size="T300">
                {action === 'kick'
                  ? 'They can rejoin later if they have an invite or the room is public.'
                  : "They'll be removed and can't rejoin until you unban them."}
              </Text>
              <Input
                ref={reasonRef}
                placeholder="Reason (optional)"
                variant="Background"
                radii="300"
                disabled={busy}
                onKeyDown={(evt) => {
                  if (isKeyHotkey('enter', evt)) confirm();
                }}
              />
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  <b>{error}</b>
                </Text>
              )}
              <Button
                variant="Critical"
                radii="300"
                disabled={busy}
                before={busy && <Spinner size="100" variant="Critical" fill="Solid" />}
                onClick={confirm}
              >
                <Text size="B400">{verb}</Text>
              </Button>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

type MemberContextMenuProps = {
  room: Room;
  userId: string;
  name: string;
  anchor: RectCords;
  onClose: () => void;
};
export function MemberContextMenu({ room, userId, name, anchor, onClose }: MemberContextMenuProps) {
  const mx = useMatrixClient();
  const space = useSpaceOptionally();
  const navigate = useNavigate();
  const openUserRoomProfile = useOpenUserRoomProfile();

  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const { hasMorePower } = useMemberPowerCompare(creators, powerLevels);
  const getMemberPowerLevel = useGetMemberPowerLevel(powerLevels);
  const powerLevelTags = usePowerLevelTags(room, powerLevels);

  const ignored = useIgnoredUsers().includes(userId);
  const vaultReady = useVaultStatus() === 'ready';
  const friends = useFriendsData();

  const [view, setView] = useState<'main' | 'roles'>('main');
  const [modAction, setModAction] = useState<ModAction>();
  // Swapping the menu for a dialog deactivates its focus trap, which must not close everything.
  const openingDialog = useRef(false);
  const openModDialog = (action: ModAction) => {
    openingDialog.current = true;
    setModAction(action);
  };

  const myUserId = mx.getSafeUserId();
  const self = userId === myUserId;
  const outranks = !self && hasMorePower(myUserId, userId);
  const joined = room.getMember(userId)?.membership === 'join';
  const canChangeRoles = outranks && permissions.stateEvent(StateEvent.RoomPowerLevels, myUserId);
  const canKick = outranks && joined && permissions.action('kick', myUserId);
  const banned = room.getMember(userId)?.membership === 'ban';
  const canBan = outranks && !banned && permissions.action('ban', myUserId);
  const canUnban = !self && banned && permissions.action('ban', myUserId);
  const myPower = getMemberPowerLevel(myUserId);
  const theirPower = getMemberPowerLevel(userId);

  // Errors here are rare and non-critical, so they're only logged.
  const run = (task: () => Promise<unknown>) => {
    onClose();
    task().catch((e) => console.warn(e));
  };

  const friendItem = () => {
    if (self || ignored || !vaultReady) return null;
    if (friends.friends[userId] || friends.outgoing[userId]) return null;
    return (
      <Item
        icon={Icons.UserPlus}
        label="Add Friend"
        onClick={() => run(() => sendFriendRequest(mx, userId))}
      />
    );
  };

  const mainMenu = (
    <>
      <Section>
        <Item
          icon={Icons.User}
          label="Profile"
          onClick={() => {
            onClose();
            openUserRoomProfile(room.roomId, space?.roomId, userId, anchor, 'Left');
          }}
        />
        {/* Servers' lobbies have no message box to mention into. */}
        {!room.isSpaceRoom() && (
          <Item
            icon={Icons.Mention}
            label="Mention"
            onClick={() => {
              onClose();
              const detail: MentionEventDetail = { roomId: room.roomId, userId };
              window.dispatchEvent(new CustomEvent(MENTION_EVENT, { detail }));
            }}
          />
        )}
        {!self && (
          <Item
            icon={Icons.Message}
            label="Message"
            onClick={() => {
              onClose();
              const params: DirectCreateSearchParams = { userId };
              navigate(withSearchParam(getDirectCreatePath(), params));
            }}
          />
        )}
      </Section>
      {!self && (
        <>
          <Line size="300" />
          <Section>
            {friendItem()}
            <Item
              icon={Icons.Prohibited}
              label={ignored ? 'Unblock' : 'Block'}
              critical={!ignored}
              onClick={() => run(() => (ignored ? unblockUser(mx, userId) : blockUser(mx, userId)))}
            />
          </Section>
        </>
      )}
      {(canChangeRoles || canKick || canBan || canUnban) && (
        <>
          <Line size="300" />
          <Section>
            {canChangeRoles && (
              <Item
                icon={Icons.Shield}
                label="Roles"
                after={<Icon size="50" src={Icons.ChevronRight} />}
                onClick={() => setView('roles')}
              />
            )}
            {canKick && (
              <Item
                icon={Icons.ArrowGoLeft}
                label={`Kick ${name}`}
                critical
                onClick={() => openModDialog('kick')}
              />
            )}
            {canBan && (
              <Item
                icon={Icons.Prohibited}
                label={`Ban ${name}`}
                critical
                onClick={() => openModDialog('ban')}
              />
            )}
            {canUnban && (
              <Item
                icon={Icons.Check}
                label={`Unban ${name}`}
                onClick={() => run(() => mx.unban(room.roomId, userId))}
              />
            )}
          </Section>
        </>
      )}
      <Line size="300" />
      <Section>
        <Item
          icon={Icons.Link}
          label="Copy User ID"
          onClick={() => {
            copyToClipboard(userId);
            onClose();
          }}
        />
      </Section>
    </>
  );

  const rolesMenu = (
    <>
      <Section>
        <Item icon={Icons.ArrowLeft} label="Roles" onClick={() => setView('main')} />
      </Section>
      <Line size="300" />
      <Section>
        {getPowers(powerLevelTags).map((power) => {
          const tag = powerLevelTags[power];
          const selected = theirPower === power;
          // Creators can hand out anything; others only roles below their own.
          const allowed = creators.has(myUserId) || power < myPower;
          return (
            <MenuItem
              key={power}
              size="300"
              radii="300"
              fill="None"
              variant={selected ? 'Primary' : 'Surface'}
              aria-pressed={selected}
              aria-disabled={!allowed}
              before={<PowerColorBadge color={tag.color} />}
              after={selected && <Icon size="50" src={Icons.Check} />}
              onClick={
                allowed && !selected
                  ? () => run(() => mx.setPowerLevel(room.roomId, userId, power))
                  : undefined
              }
            >
              <Text size="T300" truncate>
                {tag.name}
              </Text>
            </MenuItem>
          );
        })}
      </Section>
    </>
  );

  if (modAction) {
    return (
      <ModDialog
        action={modAction}
        name={name}
        onClose={onClose}
        onConfirm={(reason) =>
          modAction === 'kick'
            ? mx.kick(room.roomId, userId, reason)
            : mx.ban(room.roomId, userId, reason)
        }
      />
    );
  }

  return (
    <PopOut
      anchor={anchor}
      offset={0}
      alignOffset={0}
      position="Bottom"
      align="Start"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            returnFocusOnDeactivate: false,
            onDeactivate: () => {
              if (!openingDialog.current) onClose();
            },
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
            isKeyForward: (evt: KeyboardEvent) => isKeyHotkey('arrowdown', evt),
            isKeyBackward: (evt: KeyboardEvent) => isKeyHotkey('arrowup', evt),
          }}
        >
          <Menu style={{ width: toRem(220), maxHeight: '80vh', overflowY: 'auto' }}>
            {view === 'main' ? mainMenu : rolesMenu}
          </Menu>
        </FocusTrap>
      }
    />
  );
}
