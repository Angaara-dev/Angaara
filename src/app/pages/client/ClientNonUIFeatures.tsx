import { useAtomValue } from 'jotai';
import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RoomEvent, RoomEventHandlerMap, RoomStateEvent } from 'matrix-js-sdk';
import { roomToUnreadAtom, unreadEqual, unreadInfoToUnread } from '../../state/room/roomToUnread';
import LogoSVG from '../../../../public/res/svg/angaara.svg';
import LogoUnreadSVG from '../../../../public/res/svg/angaara-unread.svg';
import LogoHighlightSVG from '../../../../public/res/svg/angaara-highlight.svg';
import NotificationSound from '../../../../public/sound/notification.ogg';
import InviteSound from '../../../../public/sound/invite.ogg';
import { notificationPermission, setFavicon } from '../../utils/dom';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { usePreviousValue } from '../../hooks/usePreviousValue';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getInboxInvitesPath, getInboxNotificationsPath } from '../pathUtils';
import {
  getMemberDisplayName,
  getNotificationType,
  getUnreadInfo,
  isNotificationEvent,
} from '../../utils/room';
import { NotificationType, UnreadInfo } from '../../../types/matrix/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import { useInboxNotificationsSelected } from '../../hooks/router/useInbox';
import { chosenStatusAtom } from '../../hooks/useActivityStatus';
import { ActivityPublisher } from './ActivityPublisher';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { trimClosedRooms } from '../../utils/timelineTrim';
import { installTouchScroll, PHONE_SCROLL_NATIVE, scrollCapFor } from '../../utils/touchScroll';
import { usePhone } from '../../hooks/useScreenSize';
import { startXpReporter } from '../../../client/xp';
import { loadEmojiData } from '../../plugins/emoji';
import { startVault, subscribeVault, vaultReady } from '../../../client/vault';
import { reconcileFriends } from '../../../client/friends';
import { declineBlockedInvites } from '../../../client/communityPrivacy';

function SystemEmojiFeature() {
  const [twitterEmoji] = useSetting(settingsAtom, 'twitterEmoji');

  if (twitterEmoji) {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji');
  } else {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji_DISABLED');
  }

  return null;
}

function PageZoomFeature() {
  const [pageZoom] = useSetting(settingsAtom, 'pageZoom');

  if (pageZoom === 100) {
    document.documentElement.style.removeProperty('font-size');
  } else {
    document.documentElement.style.setProperty('font-size', `calc(1em * ${pageZoom / 100})`);
  }

  return null;
}

// Read by the phone message and composer styles.
function PhoneMessageScaleFeature() {
  const [scale] = useSetting(settingsAtom, 'phoneMessageScale');

  useEffect(() => {
    document.documentElement.style.setProperty('--angaara-msg-scale', `${scale / 100}`);
  }, [scale]);

  return null;
}

function PhoneScrollFeature() {
  const [speed] = useSetting(settingsAtom, 'phoneScrollSpeed');
  const phone = usePhone();

  useEffect(() => {
    if (!phone || speed >= PHONE_SCROLL_NATIVE) return undefined;
    return installTouchScroll(scrollCapFor(speed));
  }, [phone, speed]);

  return null;
}

function XpReporter() {
  const mx = useMatrixClient();
  const [earnXp] = useSetting(settingsAtom, 'earnXp');
  const [privateMode] = useSetting(settingsAtom, 'privateMode');
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!earnXp || privateMode || unavailable) return undefined;
    return startXpReporter(mx, () => setUnavailable(true));
  }, [mx, earnXp, privateMode, unavailable]);

  return null;
}

function FaviconUpdater() {
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  useEffect(() => {
    let notification = false;
    let highlight = false;
    roomToUnread.forEach((unread) => {
      if (unread.total > 0) {
        notification = true;
      }
      if (unread.highlight > 0) {
        highlight = true;
      }
    });

    if (notification) {
      setFavicon(highlight ? LogoHighlightSVG : LogoUnreadSVG);
    } else {
      setFavicon(LogoSVG);
    }
  }, [roomToUnread]);

  return null;
}

function InviteNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const invites = useAtomValue(allInvitesAtom);
  const perviousInviteLen = usePreviousValue(invites.length, 0);
  const mx = useMatrixClient();

  const navigate = useNavigate();
  const [showNotificationsSetting] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSoundSetting] = useSetting(settingsAtom, 'notificationSounds');
  // Do Not Disturb mutes desktop notifications and sounds.
  const dnd = useAtomValue(chosenStatusAtom) === 'dnd';
  const showNotifications = showNotificationsSetting && !dnd;
  const notificationSound = notificationSoundSetting && !dnd;

  const notify = useCallback(
    (count: number) => {
      const noti = new window.Notification('Invitation', {
        icon: LogoSVG,
        badge: LogoSVG,
        body: `You have ${count} new invitation request.`,
        silent: true,
      });

      noti.onclick = () => {
        if (!window.closed) navigate(getInboxInvitesPath());
        noti.close();
      };
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    if (invites.length > perviousInviteLen && mx.getSyncState() === 'SYNCING') {
      if (showNotifications && notificationPermission('granted')) {
        notify(invites.length - perviousInviteLen);
      }

      if (notificationSound) {
        playSound();
      }
    }
  }, [mx, invites, perviousInviteLen, showNotifications, notificationSound, notify, playSound]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={InviteSound} type="audio/ogg" />
    </audio>
  );
}

function MessageNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const notifRef = useRef<Notification>();
  const unreadCacheRef = useRef<Map<string, UnreadInfo>>(new Map());
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [showNotificationsSetting] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSoundSetting] = useSetting(settingsAtom, 'notificationSounds');
  // Do Not Disturb mutes desktop notifications and sounds.
  const dnd = useAtomValue(chosenStatusAtom) === 'dnd';
  const showNotifications = showNotificationsSetting && !dnd;
  const notificationSound = notificationSoundSetting && !dnd;

  const navigate = useNavigate();
  const notificationSelected = useInboxNotificationsSelected();
  const selectedRoomId = useSelectedRoom();

  const notify = useCallback(
    ({
      roomName,
      roomAvatar,
      username,
    }: {
      roomName: string;
      roomAvatar?: string;
      username: string;
      roomId: string;
      eventId: string;
    }) => {
      const noti = new window.Notification(roomName, {
        icon: roomAvatar,
        badge: roomAvatar,
        body: `New inbox notification from ${username}`,
        silent: true,
      });

      noti.onclick = () => {
        if (!window.closed) navigate(getInboxNotificationsPath());
        noti.close();
        notifRef.current = undefined;
      };

      notifRef.current?.close();
      notifRef.current = noti;
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      room,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (mx.getSyncState() !== 'SYNCING') return;
      if (document.hasFocus() && (selectedRoomId === room?.roomId || notificationSelected)) return;
      if (
        !room ||
        !data.liveEvent ||
        room.isSpaceRoom() ||
        !isNotificationEvent(mEvent) ||
        getNotificationType(mx, room.roomId) === NotificationType.Mute
      ) {
        return;
      }

      const sender = mEvent.getSender();
      const eventId = mEvent.getId();
      if (!sender || !eventId || mEvent.getSender() === mx.getUserId()) return;
      const unreadInfo = getUnreadInfo(room);
      const cachedUnreadInfo = unreadCacheRef.current.get(room.roomId);
      unreadCacheRef.current.set(room.roomId, unreadInfo);

      if (unreadInfo.total === 0) return;
      if (
        cachedUnreadInfo &&
        unreadEqual(unreadInfoToUnread(cachedUnreadInfo), unreadInfoToUnread(unreadInfo))
      ) {
        return;
      }

      if (showNotifications && notificationPermission('granted')) {
        const avatarMxc =
          room.getAvatarFallbackMember()?.getMxcAvatarUrl() ?? room.getMxcAvatarUrl();
        notify({
          roomName: room.name ?? 'Unknown',
          roomAvatar: avatarMxc
            ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
            : undefined,
          username: getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender) ?? sender,
          roomId: room.roomId,
          eventId,
        });
      }

      if (notificationSound) {
        playSound();
      }
    };
    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [
    mx,
    notificationSound,
    notificationSelected,
    showNotifications,
    playSound,
    notify,
    selectedRoomId,
    useAuthentication,
  ]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={NotificationSound} type="audio/ogg" />
    </audio>
  );
}

type ClientNonUIFeaturesProps = {
  children: ReactNode;
};

// Frees old history of rooms you're not viewing so memory doesn't grow all session.
function TimelineTrimmer() {
  const mx = useMatrixClient();
  useEffect(() => {
    const interval = window.setInterval(() => trimClosedRooms(mx), 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [mx]);
  return null;
}

// Fetches the emoji tables after startup so the picker is ready without slowing first load.
function EmojiDataPreloader() {
  useEffect(() => {
    const timeout = window.setTimeout(loadEmojiData, 3000);
    return () => window.clearTimeout(timeout);
  }, []);
  return null;
}

// Opens the encrypted vault (friends, DM list, privacy), keeps friends in step with rooms,
// and declines DMs and friend requests your community privacy settings block.
function VaultFeature() {
  const mx = useMatrixClient();

  useEffect(() => startVault(mx), [mx]);

  useEffect(() => {
    let timer: number | undefined;
    const reconcile = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!vaultReady()) return;
        reconcileFriends(mx).catch(() => undefined);
        declineBlockedInvites(mx).catch(() => undefined);
      }, 1000);
    };
    const unsubscribe = subscribeVault(reconcile);
    mx.on(RoomStateEvent.Members, reconcile);
    mx.on(RoomEvent.MyMembership, reconcile);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      mx.removeListener(RoomStateEvent.Members, reconcile);
      mx.removeListener(RoomEvent.MyMembership, reconcile);
    };
  }, [mx]);

  return null;
}

export function ClientNonUIFeatures({ children }: ClientNonUIFeaturesProps) {
  return (
    <>
      <SystemEmojiFeature />
      <PageZoomFeature />
      <PhoneMessageScaleFeature />
      <PhoneScrollFeature />
      <XpReporter />
      <FaviconUpdater />
      <InviteNotifications />
      <MessageNotifications />
      <TimelineTrimmer />
      <EmojiDataPreloader />
      <VaultFeature />
      <ActivityPublisher />
      {children}
    </>
  );
}
