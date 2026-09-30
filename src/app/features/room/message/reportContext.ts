// Builds the readable text an encrypted-message report shares with server admins, who can't
// decrypt it themselves. Only what the reporter picks and previews is sent; no keys ever are.
type ReportEvent = {
  getId(): string | undefined;
  getType(): string;
  getSender(): string | undefined;
  getTs(): number;
  getContent(): Record<string, unknown>;
  isRedacted(): boolean;
  isDecryptionFailure(): boolean;
};
type ReportRoom = {
  getTimelineForEvent(eventId: string): { getEvents(): ReportEvent[] } | null;
  getLiveTimeline(): { getEvents(): ReportEvent[] };
  getMember(userId: string): { name: string } | null;
};

const MAX_BODY = 500;

const describe = (event: ReportEvent): string => {
  if (event.isRedacted()) return '[deleted]';
  if (event.isDecryptionFailure()) return '[could not be decrypted]';
  const { msgtype, body } = event.getContent();
  const text = typeof body === 'string' ? body : '';
  const clipped = text.length > MAX_BODY ? `${text.slice(0, MAX_BODY)}…` : text;
  if (
    msgtype === 'm.image' ||
    msgtype === 'm.video' ||
    msgtype === 'm.audio' ||
    msgtype === 'm.file'
  ) {
    return `[${String(msgtype).slice(2)}: ${clipped}]`;
  }
  return clipped;
};

export const reportLine = (room: ReportRoom, event: ReportEvent): string => {
  const sender = event.getSender() ?? 'unknown';
  const name = room.getMember(sender)?.name;
  const time = new Date(event.getTs()).toISOString().replace('T', ' ').slice(0, 16);
  return `[${time} UTC] ${name && name !== sender ? `${name} (${sender})` : sender}: ${describe(
    event
  )}`;
};

export const historyBefore = (room: ReportRoom, eventId: string, count: number): ReportEvent[] => {
  if (count <= 0) return [];
  const events = (room.getTimelineForEvent(eventId) ?? room.getLiveTimeline()).getEvents();
  const index = events.findIndex((e) => e.getId() === eventId);
  const before = index === -1 ? [] : events.slice(0, index);
  return before.filter((e) => e.getType() === 'm.room.message').slice(-count);
};

export const buildReportReason = (
  description: string,
  reportedLine: string,
  historyLines: string[]
): string => {
  const parts = [
    description,
    '',
    '--- Decrypted by the reporter and shared with this report (sent from Angaara) ---',
    `Reported message: ${reportedLine}`,
  ];
  if (historyLines.length > 0) {
    parts.push('', `Earlier messages (${historyLines.length}):`, ...historyLines);
  }
  return parts.join('\n');
};

// Synapse rejects user-report reasons longer than this.
export const USER_REPORT_LIMIT = 1000;
const USER_LINE_MAX = 160;

export const recentMessagesFrom = (
  room: ReportRoom,
  userId: string,
  count: number
): ReportEvent[] => {
  if (count <= 0) return [];
  return room
    .getLiveTimeline()
    .getEvents()
    .filter((e) => e.getSender() === userId && e.getType() === 'm.room.message' && !e.isRedacted())
    .slice(-count);
};

const userReportLine = (event: ReportEvent): string => {
  const time = new Date(event.getTs()).toISOString().replace('T', ' ').slice(0, 16);
  const text = describe(event);
  return `[${time} UTC] ${text.length > USER_LINE_MAX ? `${text.slice(0, USER_LINE_MAX)}…` : text}`;
};

// Fits a user report into the server's limit: the reason always stays, oldest messages drop first.
export const buildUserReportReason = (
  reason: string,
  userId: string,
  roomId: string,
  events: ReportEvent[]
): { text: string; shared: number } => {
  let lines = events.map(userReportLine);
  const build = () =>
    lines.length === 0
      ? reason
      : [
          reason,
          '',
          `--- ${lines.length} message(s) from ${userId} in ${roomId}, shared by the reporter (sent from Angaara) ---`,
          ...lines,
        ].join('\n');
  while (lines.length > 0 && build().length > USER_REPORT_LIMIT) lines = lines.slice(1);
  return { text: build(), shared: lines.length };
};
