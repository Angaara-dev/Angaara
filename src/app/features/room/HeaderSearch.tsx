import React, { KeyboardEventHandler, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Room, RoomMember } from 'matrix-js-sdk';
import { Box, Icon, IconButton, IconSrc, Icons, Text, color, config, toRem } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { useRoomName } from '../../hooks/useRoomMeta';
import { getCanonicalAliasOrRoomId } from '../../utils/matrix';
import { getMemberDisplayName } from '../../utils/room';
import {
  encodeSearchParamValueArray,
  getHomeSearchPath,
  getSpaceSearchPath,
  withSearchParam,
} from '../../pages/pathUtils';
import { _SearchPathSearchParams } from '../../pages/paths';

type FilterKind = 'from' | 'in' | 'has';
type Filter = { kind: FilterKind; value: string; label: string };
type HistoryEntry = { text: string; filters: Filter[] };
type Candidate = { m: RoomMember; name: string };
type Option = { key: string; icon: IconSrc; label: string; hint?: string; run: () => void };

const HISTORY_KEY = 'angaara.searchHistory';
const MAX_HISTORY = 8;
const DROPDOWN_WIDTH = 340;
const TOKEN = /(?:^|\s)(from|in|has):(\S*)$/i;

const loadHistory = (): HistoryEntry[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
};
const saveHistory = (items: HistoryEntry[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // History just isn't remembered.
  }
};

const FILTER_ROWS: { kind: FilterKind; icon: IconSrc; label: string; hint: string }[] = [
  { kind: 'from', icon: Icons.User, label: 'From a specific user', hint: 'from: user' },
  { kind: 'in', icon: Icons.Hash, label: 'Sent in a specific channel', hint: 'in: channel' },
  { kind: 'has', icon: Icons.Attachment, label: 'Has a file', hint: 'has: image, video or file' },
];

function OptionRow({
  option,
  active,
  onHover,
}: {
  option: Option;
  active: boolean;
  onHover: () => void;
}) {
  return (
    <Box
      as="button"
      type="button"
      alignItems="Center"
      gap="300"
      onMouseEnter={onHover}
      // Keeps focus in the input, so the dropdown doesn't close before the click lands.
      onMouseDown={(evt: React.MouseEvent) => evt.preventDefault()}
      onClick={option.run}
      style={{
        width: '100%',
        padding: `${config.space.S200} ${config.space.S300}`,
        borderRadius: config.radii.R300,
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
        background: active ? color.SurfaceVariant.Container : 'transparent',
      }}
    >
      <Icon size="100" src={option.icon} style={{ opacity: 0.7, flexShrink: 0 }} />
      <Box direction="Column" style={{ minWidth: 0 }}>
        <Text size="T300" truncate>
          {option.label}
        </Text>
        {option.hint && (
          <Text size="T200" priority="300" truncate>
            {option.hint}
          </Text>
        )}
      </Box>
    </Box>
  );
}

// Search box for the room header, with from:/in:/has: filters and history.
export function HeaderSearch({ room }: { room: Room }) {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const space = useSpaceOptionally();
  const spaceName = useRoomName(space ?? room);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [history, setHistory] = useState(loadHistory);
  const [rect, setRect] = useState<DOMRect>();
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const place = () => setRect(boxRef.current?.getBoundingClientRect());
    place();
    const onDown = (evt: MouseEvent) => {
      const target = evt.target as Node;
      if (!boxRef.current?.contains(target) && !dropRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  // Channels of the current server, or all your rooms outside one.
  const channels = useMemo(() => {
    const children = space
      ? new Set(
          space.currentState
            .getStateEvents('m.space.child')
            .map((ev: { getStateKey: () => string | undefined }) => ev.getStateKey())
        )
      : undefined;
    return mx
      .getRooms()
      .filter(
        (r: Room) =>
          r.getMyMembership() === 'join' &&
          !r.isSpaceRoom() &&
          (!children || children.has(r.roomId))
      )
      .sort((a: Room, b: Room) => a.name.localeCompare(b.name));
  }, [mx, space]);

  const token = text.match(TOKEN);
  const addFilter = (filter: Filter) => {
    setFilters((f) => [
      ...f.filter((x) => !(x.kind === filter.kind && x.value === filter.value)),
      filter,
    ]);
    setText((t) => t.replace(TOKEN, (m) => (m.startsWith(' ') ? ' ' : '')).trimStart());
    setActive(0);
    inputRef.current?.focus();
  };
  const insertToken = (kind: FilterKind) => {
    setText((t) => `${t && !t.endsWith(' ') ? `${t} ` : t}${kind}:`);
    setActive(0);
    inputRef.current?.focus();
  };

  const run = (entryText: string, entryFilters: Filter[]) => {
    const term = entryText.trim();
    if (!term) return;
    const senders = entryFilters.filter((f) => f.kind === 'from').map((f) => f.value);
    const rooms = entryFilters.filter((f) => f.kind === 'in').map((f) => f.value);
    const params: _SearchPathSearchParams = { term };
    if (senders.length > 0) params.senders = encodeSearchParamValueArray(senders);
    // Search the whole server; outside a server, stay in this chat.
    if (rooms.length > 0) params.rooms = encodeSearchParamValueArray(rooms);
    else if (!space) params.rooms = room.roomId;
    if (entryFilters.some((f) => f.kind === 'has')) params.has = 'file';
    const next = [
      { text: term, filters: entryFilters },
      ...history.filter(
        (h) => h.text !== term || JSON.stringify(h.filters) !== JSON.stringify(entryFilters)
      ),
    ].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
    setOpen(false);
    setText('');
    setFilters([]);
    inputRef.current?.blur();
    const path = space
      ? getSpaceSearchPath(getCanonicalAliasOrRoomId(mx, space.roomId))
      : getHomeSearchPath();
    navigate(withSearchParam(path, params as Record<string, string>));
  };

  let options: Option[] = [];
  let heading = 'Filters';
  if (token) {
    const kind = token[1].toLowerCase() as FilterKind;
    const query = token[2].toLowerCase();
    if (kind === 'from') {
      heading = 'From user';
      options = room
        .getJoinedMembers()
        .map(
          (m: RoomMember): Candidate => ({
            m,
            name: getMemberDisplayName(room, m.userId) ?? m.userId,
          })
        )
        .filter(({ m, name }: Candidate) => `${name} ${m.userId}`.toLowerCase().includes(query))
        .sort((a: Candidate, b: Candidate) => a.name.localeCompare(b.name))
        .slice(0, 8)
        .map(({ m, name }: Candidate) => ({
          key: m.userId,
          icon: Icons.User,
          label: name,
          hint: m.userId,
          run: () => addFilter({ kind: 'from', value: m.userId, label: name }),
        }));
    } else if (kind === 'in') {
      heading = 'In channel';
      options = channels
        .filter((r: Room) => r.name.toLowerCase().includes(query))
        .slice(0, 8)
        .map((r: Room) => ({
          key: r.roomId,
          icon: Icons.Hash,
          label: r.name,
          run: () => addFilter({ kind: 'in', value: r.roomId, label: r.name }),
        }));
    } else {
      heading = 'Has';
      options = [
        {
          key: 'file',
          icon: Icons.Attachment,
          label: 'file',
          hint: 'Images, videos and files',
          run: () => addFilter({ kind: 'has', value: 'file', label: 'file' }),
        },
      ];
    }
  } else {
    const typed = text.trim();
    if (typed) {
      options.push({
        key: 'search',
        icon: Icons.Search,
        label: `Search for “${typed}”`,
        run: () => run(text, filters),
      });
    }
    options.push(
      ...FILTER_ROWS.map((row) => ({
        key: row.kind,
        icon: row.icon,
        label: row.label,
        hint: row.hint,
        run: () => insertToken(row.kind),
      }))
    );
  }
  const showHistory = !token && !text.trim() && filters.length === 0 && history.length > 0;
  const historyOptions: Option[] = showHistory
    ? history.map((h, i) => ({
        // eslint-disable-next-line react/no-array-index-key
        key: `history-${i}`,
        icon: Icons.Clock,
        label: [...h.filters.map((f) => `${f.kind}: ${f.label}`), h.text].join('  '),
        run: () => run(h.text, h.filters),
      }))
    : [];
  const all = [...options, ...historyOptions];
  const activeIndex = Math.min(active, Math.max(all.length - 1, 0));

  const handleKey: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      evt.preventDefault();
      setOpen(true);
      const step = evt.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + all.length) % Math.max(all.length, 1));
    } else if (evt.key === 'Enter') {
      evt.preventDefault();
      // Enter searches the typed text unless a suggestion is picked with the arrows.
      if (token || (active > 0 && all[activeIndex])) all[activeIndex]?.run();
      else run(text, filters);
    } else if (evt.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (evt.key === 'Backspace' && !text && filters.length > 0) {
      setFilters((f) => f.slice(0, -1));
    }
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  return (
    <>
      <Box
        ref={boxRef}
        alignItems="Center"
        gap="100"
        onClick={() => inputRef.current?.focus()}
        style={{
          width: toRem(open ? 260 : 200),
          transition: 'width 150ms ease',
          height: toRem(30),
          padding: `0 ${config.space.S200}`,
          borderRadius: config.radii.R300,
          // Themed servers: a darker patch of the server colour, like the member list.
          background: `var(--angaara-theme-shade, ${color.Background.Container})`,
          border: `1px solid ${open ? color.Primary.Main : color.Background.ContainerLine}`,
          cursor: 'text',
          overflow: 'hidden',
        }}
      >
        {filters.map((f) => (
          <Text
            key={`${f.kind}:${f.value}`}
            as="span"
            size="T200"
            truncate
            style={{
              flexShrink: 0,
              maxWidth: toRem(110),
              padding: `0 ${config.space.S100}`,
              borderRadius: config.radii.R300,
              background: color.SurfaceVariant.Container,
            }}
          >
            {`${f.kind}: ${f.label}`}
          </Text>
        ))}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={filters.length > 0 ? '' : `Search ${space ? spaceName : ''}`.trim()}
          role="combobox"
          aria-label="Search messages"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          spellCheck={false}
          style={{
            flexGrow: 1,
            minWidth: toRem(40),
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: color.Background.OnContainer,
            font: 'inherit',
            fontSize: toRem(13),
          }}
        />
        <Icon size="50" src={Icons.Search} style={{ opacity: 0.6, flexShrink: 0 }} />
      </Box>
      {open &&
        rect &&
        createPortal(
          <Box
            ref={dropRef}
            id={listId}
            direction="Column"
            gap="100"
            style={{
              position: 'fixed',
              top: rect.bottom + 6,
              left: Math.max(8, rect.right - DROPDOWN_WIDTH),
              width: toRem(DROPDOWN_WIDTH),
              maxHeight: '70vh',
              overflowY: 'auto',
              zIndex: 1000,
              padding: config.space.S200,
              borderRadius: config.radii.R400,
              background: color.Surface.Container,
              color: color.Surface.OnContainer,
              boxShadow: config.shadow.E300,
              border: `1px solid ${color.Surface.ContainerLine}`,
            }}
          >
            <Text size="L400" priority="300" style={{ padding: `0 ${config.space.S300}` }}>
              {heading}
            </Text>
            {options.map((option, i) => (
              <OptionRow
                key={option.key}
                option={option}
                active={i === activeIndex}
                onHover={() => setActive(i)}
              />
            ))}
            {token && options.length === 0 && (
              <Text size="T200" priority="300" style={{ padding: config.space.S300 }}>
                No matches
              </Text>
            )}
            {showHistory && (
              <>
                <Box
                  alignItems="Center"
                  justifyContent="SpaceBetween"
                  style={{ padding: `${config.space.S200} 0 0 ${config.space.S300}` }}
                >
                  <Text size="L400" priority="300">
                    History
                  </Text>
                  <IconButton
                    size="300"
                    radii="300"
                    variant="Surface"
                    aria-label="Clear search history"
                    onMouseDown={(evt: React.MouseEvent) => evt.preventDefault()}
                    onClick={clearHistory}
                  >
                    <Icon size="50" src={Icons.Delete} />
                  </IconButton>
                </Box>
                {historyOptions.map((option, i) => (
                  <OptionRow
                    key={option.key}
                    option={option}
                    active={options.length + i === activeIndex}
                    onHover={() => setActive(options.length + i)}
                  />
                ))}
              </>
            )}
          </Box>,
          document.body
        )}
    </>
  );
}
