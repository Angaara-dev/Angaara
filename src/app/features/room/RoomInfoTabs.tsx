import React, { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { IEvent, IPreviewUrlResponse, MatrixEvent, Method, Room } from 'matrix-js-sdk';
import { Avatar, Box, Button, color, config, Icon, Icons, Spinner, Text, toRem } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { UserAvatar } from '../../components/user-avatar';
import { RoomPinMenu } from './room-pin-menu';
import { decryptFile, downloadEncryptedMedia, mxcUrlToHttp } from '../../utils/matrix';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { bytesToSize } from '../../utils/common';
import { IEncryptedFile } from '../../../types/matrix/common';

export type InfoTab = 'members' | 'media' | 'pins' | 'threads' | 'links' | 'files';
const TABS: { id: InfoTab; label: string }[] = [
  { id: 'members', label: 'Members' },
  { id: 'media', label: 'Media' },
  { id: 'pins', label: 'Pins' },
  { id: 'threads', label: 'Threads' },
  { id: 'links', label: 'Links' },
  { id: 'files', label: 'Files' },
];

export function InfoTabBar({
  value,
  onChange,
}: {
  value: InfoTab;
  onChange: (tab: InfoTab) => void;
}) {
  return (
    <Box
      role="tablist"
      shrink="No"
      gap="500"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        padding: `0 ${config.space.S400}`,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        backgroundColor: color.Background.Container,
        borderBottom: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}`,
      }}
    >
      {TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <Text
            key={tab.id}
            as="button"
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            size="H6"
            style={{
              flexShrink: 0,
              padding: `${config.space.S300} 0`,
              border: 'none',
              borderBottom: `${toRem(3)} solid ${active ? color.Primary.Main : 'transparent'}`,
              background: 'transparent',
              color: active ? color.Primary.Main : color.Background.OnContainer,
              opacity: active ? 1 : 0.7,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </Text>
        );
      })}
    </Box>
  );
}

type TabProps = { room: Room; onJump: (eventId: string) => void };

type ScanKind = 'media' | 'files' | 'links';
const URL_REGEX = /https?:\/\/[^\s<>"'`)\]]+/g;
const PAGE_LIMIT = 5;
const WANT = 24;

const linksOf = (ev: MatrixEvent): string[] => {
  const { body } = ev.getContent();
  return typeof body === 'string' ? Array.from(new Set(body.match(URL_REGEX) ?? [])) : [];
};
const matches = (kind: ScanKind, ev: MatrixEvent): boolean => {
  if (ev.getType() !== 'm.room.message' || ev.isRedacted()) return false;
  const content = ev.getContent();
  if (content['m.relates_to']?.rel_type === 'm.replace') return false;
  const type = content.msgtype;
  if (kind === 'media') return type === 'm.image' || type === 'm.video';
  if (kind === 'files') return ['m.file', 'm.audio', 'm.image', 'm.video'].includes(type);
  return ['m.text', 'm.notice', 'm.emote'].includes(type) && linksOf(ev).length > 0;
};

type Scan = {
  events: MatrixEvent[];
  loading: boolean;
  done: boolean;
  failed: boolean;
  loadMore: () => void;
};
const useRoomScan = (room: Room, kind: ScanKind): Scan => {
  const mx = useMatrixClient();
  const [events, setEvents] = useState<MatrixEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const token = useRef<string>();
  const busy = useRef(false);

  const loadMore = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const encrypted = room.hasEncryptionStateEvent();
    const filter = encrypted
      ? { types: ['m.room.encrypted'] }
      : { types: ['m.room.message'], ...(kind !== 'links' && { contains_url: true }) };
    const mapper = mx.getEventMapper({ decrypt: false });

    const fetchPage = async (page: number, found: MatrixEvent[]): Promise<MatrixEvent[]> => {
      const res = await mx.http.authedRequest<{ chunk: Partial<IEvent>[]; end?: string }>(
        Method.Get,
        `/rooms/${encodeURIComponent(room.roomId)}/messages`,
        {
          dir: 'b',
          limit: '100',
          filter: JSON.stringify(filter),
          ...(token.current && { from: token.current }),
        }
      );
      const evs = res.chunk.map(mapper);
      await Promise.all(evs.map((ev) => mx.decryptEventIfNeeded(ev).catch(() => undefined)));
      const next = [...found, ...evs.filter((ev) => matches(kind, ev))];
      token.current = res.end;
      if (!res.end || res.chunk.length === 0) {
        setDone(true);
        return next;
      }
      return page + 1 < PAGE_LIMIT && next.length < WANT ? fetchPage(page + 1, next) : next;
    };

    fetchPage(0, [])
      .then((found) => setEvents((prev) => [...prev, ...found]))
      .catch(() => setFailed(true))
      .finally(() => {
        busy.current = false;
        setLoading(false);
      });
  }, [mx, room, kind]);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  return { events, loading, done, failed, loadMore };
};

function ScanFooter({ scan, empty }: { scan: Scan; empty: string }) {
  if (scan.loading) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
        <Spinner />
      </Box>
    );
  }
  if (scan.failed) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
        <Text size="T300" priority="300">
          Couldn&apos;t load this. Try again later.
        </Text>
      </Box>
    );
  }
  if (scan.done) {
    return scan.events.length === 0 ? (
      <Text size="T300" priority="300" align="Center" style={{ padding: config.space.S700 }}>
        {empty}
      </Text>
    ) : null;
  }
  return (
    <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
      <Button size="300" variant="Secondary" fill="Soft" radii="Pill" onClick={scan.loadMore}>
        <Text size="B300">Load more</Text>
      </Button>
    </Box>
  );
}

function SenderAvatar({ room, userId, size }: { room: Room; userId: string; size: '50' | '200' }) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const mxc = getMemberAvatarMxc(room, userId);
  const src = mxc ? mxcUrlToHttp(mx, mxc, useAuthentication, 48, 48, 'crop') : undefined;
  return (
    <Avatar size={size === '50' ? '200' : '300'} style={{ flexShrink: 0 }}>
      <UserAvatar
        userId={userId}
        src={src ?? undefined}
        alt={getMemberDisplayName(room, userId) ?? userId}
        renderFallback={() => <Icon size="50" src={Icons.User} filled />}
      />
    </Avatar>
  );
}

const dateOf = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const useThumbnail = (ev: MatrixEvent): string | undefined => {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const content = ev.getContent();
  const info = content.info ?? {};
  // Only images can stand in for their own thumbnail.
  const image = content.msgtype === 'm.image';
  const encFile: IEncryptedFile | undefined =
    info.thumbnail_file ?? (image ? content.file : undefined);
  const encMime: string =
    (info.thumbnail_file ? info.thumbnail_info?.mimetype : info.mimetype) ?? 'image/jpeg';
  const plainUrl: string | undefined = info.thumbnail_url ?? (image ? content.url : undefined);
  const [blobUrl, setBlobUrl] = useState<string>();

  useEffect(() => {
    const http = encFile && mxcUrlToHttp(mx, encFile.url, useAuthentication);
    if (!encFile || !http) return undefined;
    let alive = true;
    let made: string | undefined;
    downloadEncryptedMedia(http, (buf) => decryptFile(buf, encMime, encFile))
      .then((blob) => {
        made = URL.createObjectURL(blob);
        if (alive) setBlobUrl(made);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [mx, useAuthentication, encFile, encMime]);

  if (encFile) return blobUrl;
  return plainUrl
    ? mxcUrlToHttp(mx, plainUrl, useAuthentication, 320, 320, 'crop') ?? undefined
    : undefined;
};

function MediaTile({ room, ev, onJump }: { room: Room; ev: MatrixEvent; onJump: () => void }) {
  const src = useThumbnail(ev);
  const video = ev.getContent().msgtype === 'm.video';
  const sender = ev.getSender() ?? '';
  return (
    <button
      type="button"
      onClick={onJump}
      aria-label={`${video ? 'Video' : 'Image'} from ${
        getMemberDisplayName(room, sender) ?? sender
      }`}
      style={{
        position: 'relative',
        aspectRatio: '1',
        padding: 0,
        border: 'none',
        borderRadius: config.radii.R300,
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: color.SurfaceVariant.Container,
        color: color.SurfaceVariant.OnContainer,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Icon size="400" src={video ? Icons.Play : Icons.Photo} />
      )}
      {video && src && (
        <Box
          alignItems="Center"
          justifyContent="Center"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <Icon size="400" src={Icons.Play} filled style={{ color: 'white' }} />
        </Box>
      )}
      <Box
        style={{
          position: 'absolute',
          top: toRem(6),
          right: toRem(6),
          borderRadius: '50%',
          boxShadow: '0 0 0 2px rgba(0,0,0,0.35)',
        }}
      >
        <SenderAvatar room={room} userId={sender} size="50" />
      </Box>
    </button>
  );
}

function MediaTab({ room, onJump, wide }: TabProps & { wide?: boolean }) {
  const scan = useRoomScan(room, 'media');
  return (
    <>
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${wide ? 5 : 3}, minmax(0, 1fr))`,
          gap: toRem(4),
        }}
      >
        {scan.events.map((ev) => (
          <MediaTile key={ev.getId()} room={room} ev={ev} onJump={() => onJump(ev.getId()!)} />
        ))}
      </Box>
      <ScanFooter scan={scan} empty="No photos or videos here yet." />
    </>
  );
}

type InfoCardProps = {
  room: Room;
  sender: string;
  preview: ReactNode;
  title: string;
  subtitle: ReactNode;
  href?: string;
  onClick?: () => void;
};
function InfoCard({ room, sender, preview, title, subtitle, href, onClick }: InfoCardProps) {
  const style: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    padding: 0,
    borderRadius: config.radii.R400,
    overflow: 'hidden',
    border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
    backgroundColor: color.Surface.Container,
    color: 'inherit',
    textAlign: 'left',
    textDecoration: 'none',
    cursor: 'pointer',
  };
  const body = (
    <>
      <Box
        alignItems="Center"
        justifyContent="Center"
        shrink="No"
        style={{
          aspectRatio: '4 / 3',
          overflow: 'hidden',
          backgroundColor: color.SurfaceVariant.Container,
        }}
      >
        {preview}
      </Box>
      <Box direction="Column" gap="100" style={{ padding: config.space.S300, minWidth: 0 }}>
        <Text size="H6" truncate>
          {title}
        </Text>
        {subtitle}
        <Box alignItems="Center" gap="200" style={{ minWidth: 0, marginTop: config.space.S100 }}>
          <SenderAvatar room={room} userId={sender} size="50" />
          <Text size="T200" priority="300" truncate>
            {getMemberDisplayName(room, sender) ?? sender}
          </Text>
        </Box>
        <Box alignItems="Center" gap="200" style={{ minWidth: 0 }}>
          <Icon size="100" src={Icons.Hash} style={{ opacity: 0.7 }} />
          <Text size="T200" priority="300" truncate>
            {room.name}
          </Text>
        </Box>
      </Box>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" style={style}>
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style}>
      {body}
    </button>
  );
}

const cover = (src: string) => (
  <img
    src={src}
    alt=""
    loading="lazy"
    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
  />
);
const cardGrid = (wide?: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${wide ? 3 : 2}, minmax(0, 1fr))`,
  gap: config.space.S300,
});

function FileCard({ room, ev, onJump }: { room: Room; ev: MatrixEvent; onJump: () => void }) {
  const content = ev.getContent();
  const thumb = useThumbnail(ev);
  const size = content.info?.size;
  let icon = Icons.File;
  if (content.msgtype === 'm.audio') icon = Icons.VolumeHigh;
  if (content.msgtype === 'm.video') icon = Icons.Play;
  return (
    <InfoCard
      room={room}
      sender={ev.getSender() ?? ''}
      preview={thumb ? cover(thumb) : <Icon size="600" src={icon} />}
      title={content.filename ?? content.body ?? 'File'}
      subtitle={
        <Text size="T200" priority="300" truncate>
          {[typeof size === 'number' ? bytesToSize(size) : undefined, dateOf(ev.getTs())]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      }
      onClick={onJump}
    />
  );
}

function FilesTab({ room, onJump, wide }: TabProps & { wide?: boolean }) {
  const scan = useRoomScan(room, 'files');
  return (
    <>
      <Box style={cardGrid(wide)}>
        {scan.events.map((ev) => (
          <FileCard key={ev.getId()} room={room} ev={ev} onJump={() => onJump(ev.getId()!)} />
        ))}
      </Box>
      <ScanFooter scan={scan} empty="No files here yet." />
    </>
  );
}

function LinkCard({ room, ev, url }: { room: Room; ev: MatrixEvent; url: string }) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const allowed = room.hasEncryptionStateEvent() ? encUrlPreview : urlPreview;
  const [preview, setPreview] = useState<IPreviewUrlResponse>();
  const ts = ev.getTs();

  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true;
    mx.getUrlPreview(url, ts)
      .then((res) => alive && setPreview(res))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mx, url, ts, allowed]);

  const image = preview?.['og:image'];
  const thumb = image
    ? mxcUrlToHttp(mx, image, useAuthentication, 320, 320, 'scale', false)
    : undefined;

  return (
    <InfoCard
      room={room}
      sender={ev.getSender() ?? ''}
      preview={thumb ? cover(thumb) : <Icon size="600" src={Icons.Link} />}
      title={preview?.['og:title'] || url}
      subtitle={
        <Text size="T200" truncate style={{ color: color.Primary.Main }}>
          {url}
        </Text>
      }
      href={url}
    />
  );
}

function LinksTab({ room, wide }: { room: Room; wide?: boolean }) {
  const scan = useRoomScan(room, 'links');
  const links = scan.events.flatMap((ev) => linksOf(ev).map((url) => ({ ev, url })));
  return (
    <>
      <Box style={cardGrid(wide)}>
        {links.map(({ ev, url }) => (
          <LinkCard key={`${ev.getId()}-${url}`} room={room} ev={ev} url={url} />
        ))}
      </Box>
      <ScanFooter scan={scan} empty="No links here yet." />
    </>
  );
}

type ThreadRoot = { ev: MatrixEvent; replies: number; latestTs?: number };
function ThreadsTab({ room, onJump }: TabProps) {
  const mx = useMatrixClient();
  const [threads, setThreads] = useState<ThreadRoot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const mapper = mx.getEventMapper({ decrypt: false });
    mx.http
      .authedRequest<{ chunk: Partial<IEvent>[] }>(
        Method.Get,
        `/rooms/${encodeURIComponent(room.roomId)}/threads`,
        { include: 'all', limit: '50' },
        undefined,
        { prefix: '/_matrix/client/v1' }
      )
      .then(async (res) => {
        const roots = res.chunk.map((raw) => {
          const summary = raw.unsigned?.['m.relations']?.['m.thread'] as
            | { count?: number; latest_event?: { origin_server_ts?: number } }
            | undefined;
          return {
            ev: mapper(raw),
            replies: summary?.count ?? 0,
            latestTs: summary?.latest_event?.origin_server_ts,
          };
        });
        await Promise.all(roots.map((r) => mx.decryptEventIfNeeded(r.ev).catch(() => undefined)));
        if (alive) setThreads(roots);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mx, room]);

  if (loading) {
    return (
      <Box justifyContent="Center" style={{ padding: config.space.S400 }}>
        <Spinner />
      </Box>
    );
  }
  if (failed || threads.length === 0) {
    return (
      <Text size="T300" priority="300" align="Center" style={{ padding: config.space.S700 }}>
        {failed ? "Couldn't load threads." : 'No threads here yet.'}
      </Text>
    );
  }
  return (
    <Box direction="Column" gap="100">
      {threads.map(({ ev, replies, latestTs }) => {
        const sender = ev.getSender() ?? '';
        const { body } = ev.getContent();
        return (
          <Box
            as="button"
            type="button"
            key={ev.getId()}
            onClick={() => onJump(ev.getId()!)}
            gap="300"
            style={{
              padding: config.space.S300,
              border: 'none',
              borderRadius: config.radii.R400,
              backgroundColor: color.Surface.Container,
              color: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <SenderAvatar room={room} userId={sender} size="200" />
            <Box direction="Column" grow="Yes" gap="100" style={{ minWidth: 0 }}>
              <Text size="T300" truncate>
                <b>{getMemberDisplayName(room, sender) ?? sender}</b>
              </Text>
              <Text size="T300" style={{ overflowWrap: 'anywhere' }}>
                {typeof body === 'string' ? body.slice(0, 200) : 'Message'}
              </Text>
              <Text size="T200" style={{ color: color.Primary.Main }}>
                {`${replies} ${replies === 1 ? 'reply' : 'replies'}`}
                {latestTs ? ` · ${dateOf(latestTs)}` : ''}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function InfoTabContent({
  room,
  tab,
  onJump,
  onClose,
  wide,
}: TabProps & { tab: Exclude<InfoTab, 'members'>; onClose: () => void; wide?: boolean }) {
  let content: ReactNode;
  if (tab === 'media') content = <MediaTab room={room} onJump={onJump} wide={wide} />;
  else if (tab === 'files') content = <FilesTab room={room} onJump={onJump} wide={wide} />;
  else if (tab === 'links') content = <LinksTab room={room} wide={wide} />;
  else if (tab === 'threads') content = <ThreadsTab room={room} onJump={onJump} />;
  else content = <RoomPinMenu room={room} requestClose={onClose} embedded />;
  return (
    <Box direction="Column" style={{ padding: config.space.S400 }}>
      {content}
    </Box>
  );
}
