import React, { useEffect, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  color,
  config,
  Dialog,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  TextArea,
  toRem,
} from 'folds';
import {
  ClientEvent,
  MatrixClient,
  MatrixEvent,
  Room,
  RoomEvent,
  RoomStateEvent,
} from 'matrix-js-sdk';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMxIdServer } from '../../utils/matrix';
import { Membership } from '../../../types/matrix/room';
import { getHomeRoomPath } from '../../pages/pathUtils';
import {
  APPEAL_STATE,
  appealsEnabled,
  appealsUsed,
  BAN_NOTICE_EVENT,
  BanNoticeDetail,
  fetchBannedRoom,
  fetchLiveSettings,
  getAppeal,
  getAppellant,
  getMods,
  isBanError,
  appealLimit,
  appealMax,
  DEFAULT_APPEALS,
  Mod,
  openAppealFor,
  pingedSettings,
  receivePing,
  rememberRooms,
  submitAppeal,
} from './appeals';

// Rooms the app has no state for fall back to their ID or a placeholder for a name.
const unnamed = (name: string) => /^[!#]/.test(name) || /^Empty room/i.test(name);

type Notice = {
  // The event behind it, remembered once seen so it only shows once.
  key: string;
  roomId: string;
  name: string;
  space: boolean;
  kind: 'kicked' | 'banned' | 'retry' | 'accepted' | 'denied' | 'closed' | 'archived';
  // Whether the server takes appeals; unknown until its settings are found.
  appealsOn?: boolean;
  maxAppeals?: number;
  by?: string;
  byId?: string;
  reason?: string;
  mods: Mod[];
  // For appeal outcomes: the appeal room, left once the outcome is seen.
  appealRoomId?: string;
  appealsLeft?: number;
  // Opened from a server's Appeal button, so go straight to writing the appeal.
  direct?: boolean;
  // Settings read live from the server by the bot, which beat anything remembered.
  live?: boolean;
};

const SEEN_KEY = 'angaara_seen_removals';
// Anything older was either seen elsewhere or is too stale to bring up.
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const getSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
  } catch {
    return [];
  }
};
const markSeen = (key: string) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...getSeen(), key].slice(-200)));
  } catch {
    // Storage blocked; it may show again next time.
  }
};

// Only trust the setting when the app actually has the server's settings loaded.
const knownAppealsOn = (room: Room | null): boolean | undefined =>
  room?.currentState.getStateEvents('m.room.power_levels', '') ? appealsEnabled(room) : undefined;

// Settings a mod's app sent since the ban beat whatever the app saw at the time.
const withPing = (notice: Notice): Notice => {
  const ping = pingedSettings(notice.roomId);
  if (!ping || notice.live || (notice.kind !== 'banned' && notice.kind !== 'retry')) return notice;
  return { ...notice, appealsOn: ping.enabled, maxAppeals: ping.max };
};

// A kick or ban by someone else, if that's how you left this room.
const removalNotice = (mx: MatrixClient, room: Room): Notice | undefined => {
  const myId = mx.getSafeUserId();
  const membership = room.getMyMembership();
  if (membership !== Membership.Leave && membership !== Membership.Ban) return undefined;
  if (getAppeal(room)) return undefined;
  const event = room.getMember(myId)?.events.member;
  const by = event?.getSender();
  if (!event || !by || by === myId) return undefined;
  if (event.getContent().membership !== membership) return undefined;
  if (Date.now() - event.getTs() > MAX_AGE_MS) return undefined;
  const banned = membership === Membership.Ban;
  return {
    key: event.getId() ?? `${room.roomId}${event.getTs()}`,
    roomId: room.roomId,
    name: room.name,
    space: room.isSpaceRoom(),
    kind: banned ? 'banned' : 'kicked',
    by: room.getMember(by)?.name ?? by,
    byId: by,
    reason: event.getContent().reason,
    mods: banned ? getMods(mx, room) : [],
    appealsOn: banned ? knownAppealsOn(room) : undefined,
    maxAppeals: banned && knownAppealsOn(room) !== undefined ? appealLimit(room) : undefined,
  };
};

// The mods' decision on an appeal you made.
const outcomeNotice = (mx: MatrixClient, room: Room): Notice | undefined => {
  const appeal = getAppeal(room);
  if (!appeal || (appeal.status === 'open' && !appeal.archived)) return undefined;
  if (getAppellant(room) !== mx.getSafeUserId()) return undefined;
  if (room.getMyMembership() !== Membership.Join) return undefined;
  const event = room.currentState.getStateEvents(APPEAL_STATE, '');
  const decider = event?.getSender();
  return {
    key: event?.getId() ?? `${room.roomId}${appeal.status}`,
    roomId: appeal.space,
    name: appeal.space_name,
    space: true,
    kind: appeal.status === 'open' ? 'archived' : appeal.status,
    byId: decider,
    mods: [],
    appealRoomId: room.roomId,
    appealsLeft: Math.max(0, appealMax(appeal) - appeal.attempt),
  };
};

// Tells you when you were kicked or banned, lets you appeal a ban, and shows the result.
export function RemovedNotice() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Notice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [appealText, setAppealText] = useState('');
  const [appealSent, setAppealSent] = useState(false);
  const [appealing, setAppealing] = useState(false);
  const [sentRoomId, setSentRoomId] = useState<string>();
  const [pickedMod, setPickedMod] = useState<string>();

  useEffect(() => {
    const add = (notice?: Notice) => {
      if (!notice || getSeen().includes(notice.key)) return;
      const pinged = withPing(notice);
      setQueue((q) => [...q.filter((n) => n.key !== pinged.key), pinged]);
    };

    rememberRooms(mx);
    // Catch up on anything that happened while you were away.
    mx.getRooms().forEach((room: Room) => add(removalNotice(mx, room) ?? outcomeNotice(mx, room)));

    const onMembership = (room: Room) => {
      if (room.getMyMembership() === Membership.Join) rememberRooms(mx);
      add(removalNotice(mx, room));
    };
    const onState = (event: MatrixEvent) => {
      if (event.getType() !== APPEAL_STATE) return;
      const room = mx.getRoom(event.getRoomId());
      if (room) add(outcomeNotice(mx, room));
    };
    mx.on(RoomEvent.MyMembership, onMembership);
    mx.on(RoomStateEvent.Events, onState);

    const addRetry = (roomIdOrAlias: string, name?: string, direct?: boolean) => {
      // Cards often know a server only by its address, which getRoom can't look up.
      const room =
        mx.getRoom(roomIdOrAlias) ??
        mx
          .getRooms()
          .find(
            (r: Room) =>
              r.getCanonicalAlias() === roomIdOrAlias || r.getAltAliases().includes(roomIdOrAlias)
          ) ??
        null;
      const roomId = room?.roomId ?? roomIdOrAlias;
      setQueue((q) => [
        ...q.filter((n) => n.roomId !== roomId),
        withPing({
          key: `retry${roomId}${Date.now()}`,
          roomId,
          name: name || room?.name || roomIdOrAlias,
          // Unknown rooms are usually servers picked from Explore.
          space: room ? room.isSpaceRoom() : true,
          kind: 'retry',
          direct,
          mods: getMods(mx, room),
          appealsOn: knownAppealsOn(room),
          maxAppeals: knownAppealsOn(room) === undefined ? undefined : appealLimit(room),
        }),
      ]);
    };
    const onBanNotice = (evt: Event) => {
      const { roomIdOrAlias, name } = (evt as CustomEvent<BanNoticeDetail>).detail;
      addRetry(roomIdOrAlias, name, true);
    };
    window.addEventListener(BAN_NOTICE_EVENT, onBanNotice);

    // A mod changed the appeal settings; update any ban notice that's open.
    const onToDevice = (event: MatrixEvent) => {
      if (receivePing(mx, event)) setQueue((q) => q.map(withPing));
    };
    mx.on(ClientEvent.ToDeviceEvent, onToDevice);

    // Every join in the app goes through mx.joinRoom, so catch bans there in one place.
    const { joinRoom } = mx;
    mx.joinRoom = async (...args: Parameters<MatrixClient['joinRoom']>) => {
      try {
        return await joinRoom.apply(mx, args);
      } catch (e) {
        if (isBanError(e)) addRetry(args[0] as string);
        throw e;
      }
    };
    return () => {
      mx.removeListener(RoomEvent.MyMembership, onMembership);
      mx.removeListener(RoomStateEvent.Events, onState);
      window.removeEventListener(BAN_NOTICE_EVENT, onBanNotice);
      mx.removeListener(ClientEvent.ToDeviceEvent, onToDevice);
      mx.joinRoom = joinRoom;
    };
  }, [mx]);

  // Fill in the server's name and who can unban when the app doesn't have it loaded.
  const current = queue[0];
  const currentKey = current?.key;
  const currentRoomId = current?.roomId ?? '';
  const needsInfo =
    !!current &&
    (current.kind === 'banned' || current.kind === 'retry') &&
    (unnamed(current.name) || current.mods.length === 0 || current.appealsOn === undefined);
  const [lookingUp, setLookingUp] = useState<string>();
  useEffect(() => {
    if (!currentKey || !needsInfo) return;
    setLookingUp(currentKey);
    fetchBannedRoom(mx, currentRoomId)
      .then((info) =>
        setQueue((q) =>
          q.map((n) =>
            n.key === currentKey
              ? withPing({
                  ...n,
                  roomId: info.roomId,
                  name: unnamed(n.name) && info.name ? info.name : n.name,
                  mods: n.mods.length > 0 ? n.mods : info.mods,
                  appealsOn: n.appealsOn ?? info.enabled,
                  maxAppeals: n.maxAppeals ?? info.max,
                })
              : n
          )
        )
      )
      .catch(() => undefined)
      .finally(() => setLookingUp((k) => (k === currentKey ? undefined : k)));
  }, [mx, currentKey, currentRoomId, needsInfo]);

  // Asks the bot for the server's current settings, since the app's copy may predate the ban.
  const currentBanned = current?.kind === 'banned' || current?.kind === 'retry';
  const [checkingLive, setCheckingLive] = useState<string>();
  useEffect(() => {
    if (!currentKey || !currentBanned || !currentRoomId.startsWith('!')) return;
    setCheckingLive(currentKey);
    fetchLiveSettings(currentRoomId)
      .then((live) => {
        if (!live) return;
        setQueue((q) =>
          q.map((n) =>
            n.key === currentKey
              ? { ...n, appealsOn: live.enabled, maxAppeals: live.max, live: true }
              : n
          )
        );
      })
      .finally(() => setCheckingLive((k) => (k === currentKey ? undefined : k)));
  }, [currentKey, currentBanned, currentRoomId]);

  // The Appeal button on a server card skips straight to writing the appeal.
  const currentDirect = !!current?.direct;
  useEffect(() => setAppealing(currentDirect), [currentKey, currentDirect]);

  if (!current) return null;

  const place = current.space ? 'server' : 'room';
  const banned = current.kind === 'banned' || current.kind === 'retry';
  const used = banned ? appealsUsed(mx, current.roomId) : 0;
  const limit = current.maxAppeals ?? DEFAULT_APPEALS;
  const pending = banned && !appealSent && !!openAppealFor(mx, current.roomId);
  const canAppeal =
    banned && current.appealsOn === true && current.mods.length > 0 && used < limit && !pending;
  const ticket = sentRoomId ?? (pending ? openAppealFor(mx, current.roomId)?.roomId : undefined);
  // Straight to the appeal, unless there's none to make.
  const showAppeal = appealing && canAppeal && !appealSent;
  const looking = banned && (lookingUp === current.key || checkingLive === current.key);

  const dismiss = () => {
    markSeen(current.key);
    if (current.appealRoomId) mx.leave(current.appealRoomId).catch(() => undefined);
    // Once appeals are over, the server is dropped from the app entirely.
    if (current.kind === 'closed' || (banned && used >= limit && !pending)) {
      mx.forget(current.roomId).catch(() => undefined);
    }
    setError(undefined);
    setAppealText('');
    setAppealSent(false);
    setSentRoomId(undefined);
    setPickedMod(undefined);
    setAppealing(false);
    setQueue((q) => q.slice(1));
  };

  const run = async (task: () => Promise<unknown>, after: (result: unknown) => void) => {
    setBusy(true);
    setError(undefined);
    try {
      after(await task());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  };

  // The remover's server is sure to be in the room, so it can route the join.
  const rejoin = () => {
    const via = current.byId ? getMxIdServer(current.byId) : undefined;
    run(() => mx.joinRoom(current.roomId, via ? { viaServers: [via] } : undefined), dismiss);
  };

  const appeal = () =>
    run(
      () =>
        submitAppeal(
          mx,
          { roomId: current.roomId, name: current.name },
          current.mods.filter((m) => m.id === pickedMod),
          appealText.trim(),
          limit
        ),
      (roomId) => {
        setAppealSent(true);
        setSentRoomId(roomId as string);
        setAppealing(false);
      }
    );

  // The ticket is where the appellant and mods talk it through.
  const openTicket = (roomId: string) => {
    dismiss();
    navigate(getHomeRoomPath(roomId));
  };

  let title = `You were ${current.kind} from ${current.name}`;
  let body = `${current.by} removed you from this ${place}. You may rejoin this ${place} if needed.`;
  if (current.kind === 'banned') {
    body = `${current.by} removed you from this ${place}. You can't rejoin until you're unbanned.`;
  } else if (current.kind === 'retry') {
    title = `You were banned from this ${place}`;
    body = "You can't rejoin until you're unbanned.";
  } else if (current.kind === 'accepted') {
    title = 'Your appeal was accepted';
    body = `You've been unbanned from ${current.name}. You can rejoin now.`;
  } else if (current.kind === 'denied') {
    title = 'Your appeal was denied';
    body = `The mods of ${current.name} turned down your appeal. You have ${
      current.appealsLeft
    } appeal${current.appealsLeft === 1 ? '' : 's'} left.`;
  } else if (current.kind === 'closed') {
    title = 'Appeals closed';
    body = `The mods of ${current.name} turned down your last appeal, so appeals for this server are now closed.`;
  } else if (current.kind === 'archived') {
    title = 'Your appeal was closed';
    body = `The mods of ${current.name} closed your appeal without a decision.`;
  }

  if (showAppeal) {
    title = `Appeal your ban from ${current.name}`;
    body = `Tell the mods why you should be unbanned. This is appeal ${used + 1} of ${limit}.`;
  }

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: dismiss,
            // A stray click shouldn't throw away a half-written appeal.
            clickOutsideDeactivates: false,
            escapeDeactivates: true,
          }}
        >
          <Dialog style={{ maxWidth: toRem(400), maxHeight: '90vh', overflowY: 'auto' }}>
            <Box direction="Column" gap="400" style={{ padding: config.space.S500 }}>
              <Text size="H4">{title}</Text>
              <Text size="T300">{body}</Text>
              {!showAppeal && current.reason && (
                <Box
                  direction="Column"
                  gap="100"
                  style={{
                    padding: config.space.S300,
                    borderRadius: config.radii.R400,
                    background: color.SurfaceVariant.Container,
                  }}
                >
                  <Text size="L400">Reason</Text>
                  <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
                    {current.reason}
                  </Text>
                </Box>
              )}
              {showAppeal && (
                <TextArea
                  value={appealText}
                  onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setAppealText(evt.target.value)
                  }
                  placeholder="Why should you be unbanned?"
                  variant="Background"
                  radii="300"
                  rows={4}
                  maxLength={1000}
                  disabled={busy}
                />
              )}
              {showAppeal && current.mods.length > 0 && (
                <Box direction="Column" gap="200">
                  <Text size="L400">Pick a mod to send it to</Text>
                  {current.mods.map((mod) => {
                    const picked = pickedMod === mod.id;
                    return (
                      <Box
                        key={mod.id}
                        as="button"
                        type="button"
                        alignItems="Center"
                        gap="200"
                        onClick={() => setPickedMod(mod.id)}
                        aria-pressed={picked}
                        style={{
                          padding: config.space.S200,
                          borderRadius: config.radii.R400,
                          border: `${config.borderWidth.B300} solid ${
                            picked ? color.Primary.Main : color.SurfaceVariant.ContainerLine
                          }`,
                          background: picked
                            ? color.Primary.Container
                            : color.SurfaceVariant.Container,
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
                          <Text size="T300" truncate>
                            <b>{mod.name}</b>
                          </Text>
                          <Text size="T200" priority="300" truncate>
                            {mod.id}
                          </Text>
                        </Box>
                      </Box>
                    );
                  })}
                  <Text size="T200" priority="300">
                    Only you and that mod can see the appeal while it&apos;s open.
                  </Text>
                </Box>
              )}
              {banned && appealSent && (
                <Text size="T300" style={{ color: color.Success.Main }}>
                  <b>Appeal sent.</b> You can chat with the mod in it, and you&apos;ll hear back
                  here when they decide.
                </Text>
              )}
              {pending && (
                <Text size="T300">
                  <b>Your appeal is waiting on the mods.</b>
                </Text>
              )}
              {banned && !appealSent && !pending && used >= limit && (
                <Text size="T300" priority="300">
                  You&apos;ve used all {limit} of your appeals for this {place}.
                </Text>
              )}
              {looking && (
                <Box alignItems="Center" gap="200">
                  <Spinner size="100" variant="Secondary" />
                  <Text size="T300">Finding who can unban you…</Text>
                </Box>
              )}
              {banned && !looking && current.appealsOn === false && (
                <Text size="T300" priority="300">
                  This {place} doesn&apos;t take ban appeals.
                </Text>
              )}
              {banned &&
                !looking &&
                current.appealsOn === true &&
                current.mods.length === 0 &&
                used < limit && (
                  <Text size="T300" priority="300">
                    Couldn&apos;t find who can unban you, so you can&apos;t appeal from here.
                  </Text>
                )}
              {error && (
                <Text size="T200" style={{ color: color.Critical.Main }}>
                  <b>{error}</b>
                </Text>
              )}
              {showAppeal ? (
                <Box direction="Column" gap="200">
                  <Button
                    variant="Primary"
                    radii="400"
                    onClick={appeal}
                    disabled={busy || !appealText.trim() || !pickedMod}
                    before={busy && <Spinner size="100" variant="Primary" fill="Solid" />}
                  >
                    <Text size="B400">Send Appeal</Text>
                  </Button>
                  <Button
                    variant="Secondary"
                    fill="Soft"
                    radii="400"
                    onClick={() => setAppealing(false)}
                    disabled={busy}
                  >
                    <Text size="B400">Back</Text>
                  </Button>
                </Box>
              ) : (
                <Box direction="Column" gap="200">
                  {(current.kind === 'kicked' || current.kind === 'accepted') && (
                    <Button
                      variant="Primary"
                      radii="400"
                      onClick={rejoin}
                      disabled={busy}
                      before={busy && <Spinner size="100" variant="Primary" fill="Solid" />}
                    >
                      <Text size="B400">Rejoin</Text>
                    </Button>
                  )}
                  {ticket && (
                    <Button variant="Primary" radii="400" onClick={() => openTicket(ticket)}>
                      <Text size="B400">Open Appeal</Text>
                    </Button>
                  )}
                  <Button
                    variant="Secondary"
                    fill="Soft"
                    radii="400"
                    onClick={dismiss}
                    disabled={busy}
                  >
                    <Text size="B400">Okay</Text>
                  </Button>
                  {canAppeal && !appealSent && (
                    <Button
                      variant="Critical"
                      fill="Soft"
                      radii="400"
                      onClick={() => setAppealing(true)}
                    >
                      <Text size="B400">
                        Appeal ({limit - used} of {limit} left)
                      </Text>
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
