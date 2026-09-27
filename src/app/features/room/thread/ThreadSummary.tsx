import React from 'react';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { Chip, Icon, Icons, Text, config } from 'folds';
import { openThreadAtom } from '../../../state/room/openThread';
import { getMemberDisplayName, getServerThreadSummary, isThreadReply } from '../../../utils/room';
import { getMxIdLocalPart } from '../../../utils/matrix';
import { timeDayMonYear, timeHourMinute, today } from '../../../utils/time';

type ThreadSummaryProps = {
  room: Room;
  mEvent: MatrixEvent;
  hour24Clock: boolean;
  dateFormatString: string;
};

// Group live-timeline thread replies by root once per timeline length, shared by all chips.
let repliesCache: { events: MatrixEvent[]; length: number; byRoot: Map<string, MatrixEvent[]> };
const getLiveRepliesByRoot = (room: Room): Map<string, MatrixEvent[]> => {
  const events = room.getLiveTimeline().getEvents();
  if (repliesCache?.events === events && repliesCache.length === events.length) {
    return repliesCache.byRoot;
  }
  const byRoot = new Map<string, MatrixEvent[]>();
  events.forEach((e) => {
    const rootId = e.threadRootId;
    if (!rootId || !isThreadReply(e) || e.isRedacted()) return;
    const list = byRoot.get(rootId) ?? [];
    list.push(e);
    byRoot.set(rootId, list);
  });
  repliesCache = { events, length: events.length, byRoot };
  return byRoot;
};

// Server count is a snapshot from sync; add live replies that arrived after it.
const getThreadStats = (room: Room, rootId: string, mEvent: MatrixEvent) => {
  const server = getServerThreadSummary(mEvent);
  const serverTs = server?.latestEvent?.origin_server_ts ?? 0;
  const newer = (getLiveRepliesByRoot(room).get(rootId) ?? []).filter((e) => e.getTs() > serverTs);
  const latest = newer[newer.length - 1];

  return {
    count: (server?.count ?? 0) + newer.length,
    latestSender: latest?.getSender() ?? server?.latestEvent?.sender,
    latestTs: latest?.getTs() ?? server?.latestEvent?.origin_server_ts,
  };
};

export function ThreadSummary({ room, mEvent, hour24Clock, dateFormatString }: ThreadSummaryProps) {
  const rootId = mEvent.getId() ?? '';
  const setOpenThread = useSetAtom(openThreadAtom);
  const { count, latestSender, latestTs } = getThreadStats(room, rootId, mEvent);

  if (count === 0 || !rootId) return null;

  const senderName =
    latestSender &&
    (getMemberDisplayName(room, latestSender) ?? getMxIdLocalPart(latestSender) ?? latestSender);
  let when: string | undefined;
  if (latestTs) {
    when = today(latestTs)
      ? timeHourMinute(latestTs, hour24Clock)
      : timeDayMonYear(latestTs, dateFormatString);
  }

  return (
    <Chip
      style={{ marginTop: config.space.S200, alignSelf: 'Start' }}
      variant="SurfaceVariant"
      radii="Pill"
      before={<Icon size="50" src={Icons.Thread} />}
      onClick={() => setOpenThread({ roomId: room.roomId, rootId })}
      aria-label={`Open thread with ${count} replies`}
    >
      <Text size="T200">
        <b>{count === 1 ? '1 reply' : `${count} replies`}</b>
        {senderName && ` · ${senderName}`}
        {when && ` · ${when}`}
      </Text>
    </Chip>
  );
}
