import React, { useEffect, useRef, useState } from 'react';
import { Box, Icon, IconButton, Icons, IconSrc, Text, color, config } from 'folds';
import { Room } from 'matrix-js-sdk';
import millify from 'millify';
import { Modal500 } from '../../components/Modal500';
import { SPACE_LEVELS, SpaceLevel, useSpaceLevel } from '../../hooks/useSpaceLevel';
import { usePhone } from '../../hooks/useScreenSize';
import { BRAND_NAME } from '../../brand';
import * as css from './styles.css';

const LEVEL_PERKS: { icon: IconSrc; label: string }[][] = [
  [{ icon: Icons.Photo, label: 'Animated server banner' }],
  [
    { icon: Icons.Bookmark, label: 'Server tag members can wear' },
    { icon: Icons.Star, label: 'Role badges next to names' },
  ],
  [
    { icon: Icons.Space, label: 'Animated server icon' },
    { icon: Icons.User, label: 'Two-colour role names' },
  ],
  [
    { icon: Icons.Sun, label: 'Server colour gradient' },
    { icon: Icons.Pencil, label: 'Server accent colour' },
  ],
];

// How far along a level is, 0 to 1: the slower of its member and age goals.
const progressTo = (info: SpaceLevel, index: number) => {
  if (info.level > index) return 1;
  const goal = SPACE_LEVELS[index];
  return Math.min(1, info.members / goal.members, info.days / goal.days);
};

function Goal({ label, value, goal }: { label: string; value: number; goal: number }) {
  return (
    <Box direction="Column" gap="100">
      <Box justifyContent="SpaceBetween" gap="200">
        <Text size="T200">{label}</Text>
        <Text size="T200" priority="300">
          {`${millify(Math.min(value, goal))} / ${millify(goal)}`}
        </Text>
      </Box>
      <div className={css.Bar}>
        <div className={css.BarFill} style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
      </div>
    </Box>
  );
}

function LevelCard({ info, index }: { info: SpaceLevel; index: number }) {
  const goal = SPACE_LEVELS[index];
  const unlocked = info.level > index;
  const current = info.level === index + 1;
  const pct = Math.round(progressTo(info, index) * 100);
  let state = 'locked';
  if (current) state = 'current';
  else if (unlocked) state = 'unlocked';

  return (
    <div className={css.Card} data-state={state} data-level-card={index}>
      <div className={css.Track}>
        <span className={css.Node} data-on={unlocked || pct > 0}>
          <Icon size="100" src={unlocked ? Icons.Star : Icons.Lock} filled={unlocked} />
        </span>
        <div className={css.Bar}>
          <div className={css.BarFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Text size="H3">{`Level ${index + 1}`}</Text>
      <Box direction="Column" gap="300" grow="Yes">
        {LEVEL_PERKS[index].map((perk) => (
          <Box key={perk.label} alignItems="Center" gap="300">
            <Icon size="200" src={perk.icon} />
            <Text size="T400">{perk.label}</Text>
          </Box>
        ))}
      </Box>
      {info.level === index && (
        <Box direction="Column" gap="200">
          <Goal label="Members" value={info.members} goal={goal.members} />
          <Goal label="Days old" value={info.days} goal={goal.days} />
        </Box>
      )}
      <Box alignItems="Center" justifyContent="SpaceBetween" gap="200" wrap="Wrap">
        <Box alignItems="Center" gap="100">
          <Icon size="100" src={Icons.User} />
          <Text size="T300" priority="300">
            {`${millify(goal.members)} · ${goal.days} days`}
          </Text>
        </Box>
        {unlocked ? (
          <Box alignItems="Center" gap="100" style={{ color: color.Success.Main }}>
            <Icon size="100" src={Icons.Check} />
            <Text size="L400">Unlocked</Text>
          </Box>
        ) : (
          <Text size="L400" priority="300">{`${pct}%`}</Text>
        )}
      </Box>
    </div>
  );
}

// Fixed pseudo-random sparks, so re-renders don't reshuffle them.
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return {
    left: 4 + r(1) * 92,
    size: 1.5 + r(2) * 2,
    dur: 3.5 + r(3) * 3.5,
    delay: -r(4) * 7,
    drift: (r(5) - 0.5) * 60,
    rise: 0.45 + r(6) * 0.45,
  };
});

function Embers({ sparks, height }: { sparks: number; height: number }) {
  return (
    <div className={css.EmberLayer} aria-hidden>
      <div className={css.EmberGlow} />
      {SPARKS.slice(0, sparks).map((spark) => (
        <span
          key={spark.left}
          className={css.Spark}
          style={
            {
              left: `${spark.left}%`,
              '--ember-size': `${spark.size}px`,
              '--ember-dur': `${spark.dur}s`,
              '--ember-delay': `${spark.delay}s`,
              '--ember-drift': `${spark.drift}px`,
              '--ember-rise': `${Math.round(spark.rise * height)}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={css.Stat}>
      <Text size="H3">{value}</Text>
      <Text size="T300" priority="300">
        {label}
      </Text>
    </div>
  );
}

type ServerLevelDialogProps = { room: Room; requestClose: () => void };
export function ServerLevelDialog({ room, requestClose }: ServerLevelDialogProps) {
  const info = useSpaceLevel(room);
  const phone = usePhone();
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = Math.min(info.level, SPACE_LEVELS.length - 1);
    const el = cardsRef.current;
    const card = el?.querySelector<HTMLElement>(`[data-level-card="${target}"]`);
    if (el && card) el.scrollLeft = card.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft);
    // Only on open; later member changes shouldn't yank the cards around.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = (dir: number) => {
    const el = cardsRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <Modal500 requestClose={requestClose}>
      <Box direction="Column" style={{ position: 'relative', height: '100%', minHeight: 0 }}>
        {!info.next && <Embers sparks={18} height={420} />}
        <Box
          className={css.AboveEmbers}
          shrink="No"
          alignItems="Center"
          gap="200"
          style={{ padding: `${config.space.S300} ${config.space.S200}` }}
        >
          <IconButton onClick={requestClose} variant="Background" aria-label="Close">
            <Icon src={Icons.Cross} />
          </IconButton>
          <Text size="H4" style={{ flexGrow: 1, textAlign: 'center', marginRight: '40px' }}>
            Server Level
          </Text>
        </Box>
        <Box
          className={css.AboveEmbers}
          direction="Column"
          grow="Yes"
          style={{ minHeight: 0, overflowY: 'auto' }}
        >
          <div className={css.Stats}>
            <Stat value={millify(info.members)} label="Members" />
            <Stat value={String(info.days)} label="Days old" />
            <Stat value={String(info.level)} label="Level" />
          </div>
          <Box
            direction="Column"
            gap="100"
            style={{ padding: `${config.space.S500} ${config.space.S400} ${config.space.S300}` }}
          >
            <Text size="H4">Levels</Text>
            <Text size="T300" priority="300">
              {info.granted
                ? `This server has full access from the ${BRAND_NAME} team, so every level is unlocked.`
                : 'Your server levels up by itself once it has enough members and has been around long enough.'}
            </Text>
          </Box>
          <Box style={{ position: 'relative' }}>
            {!phone && (
              <IconButton
                className={css.ArrowButton}
                style={{ left: config.space.S100 }}
                variant="SurfaceVariant"
                radii="Pill"
                onClick={() => page(-1)}
                aria-label="Previous levels"
              >
                <Icon src={Icons.ChevronLeft} />
              </IconButton>
            )}
            <div className={css.Cards} data-arrows={!phone} ref={cardsRef}>
              {SPACE_LEVELS.map((level, i) => (
                <LevelCard key={level.unlocks} info={info} index={i} />
              ))}
            </div>
            {!phone && (
              <IconButton
                className={css.ArrowButton}
                style={{ right: config.space.S100 }}
                variant="SurfaceVariant"
                radii="Pill"
                onClick={() => page(1)}
                aria-label="Next levels"
              >
                <Icon src={Icons.ChevronRight} />
              </IconButton>
            )}
          </Box>
          {info.next && (
            <Box
              direction="Column"
              gap="100"
              style={{ padding: `${config.space.S300} ${config.space.S400} ${config.space.S500}` }}
            >
              <Text size="H5">{`Next up: Level ${info.next.level}`}</Text>
              <Text size="T300" priority="300">
                {`Needs ${millify(info.next.members)} members and a server at least ${
                  info.next.days
                } days old. Right now: ${millify(info.members)} members, ${info.days} days.`}
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Modal500>
  );
}

export function ServerLevelPill({ room }: { room: Room }) {
  const info = useSpaceLevel(room);
  const [open, setOpen] = useState(false);
  const pct = info.next ? progressTo(info, info.next.level - 1) * 100 : 100;

  return (
    <>
      <button type="button" className={css.LevelPill} onClick={() => setOpen(true)}>
        <span className={css.LevelPillFill} style={{ width: `${Math.max(pct, 12)}%` }} />
        {!info.next && <Embers sparks={7} height={40} />}
        <Box grow="Yes" alignItems="Center" gap="200" style={{ position: 'relative', minWidth: 0 }}>
          <Icon size="100" src={Icons.Star} filled={info.level > 0} />
          <Text as="span" size="T300" truncate>
            {info.level > 0 ? `Server Level ${info.level}` : 'Server Level'}
          </Text>
        </Box>
        <Box shrink="No" alignItems="Center" gap="100" style={{ position: 'relative' }}>
          <Icon size="100" src={Icons.ChevronRight} />
        </Box>
      </button>
      {open && <ServerLevelDialog room={room} requestClose={() => setOpen(false)} />}
    </>
  );
}
