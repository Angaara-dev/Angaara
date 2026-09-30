import React from 'react';
import { Box, Icon, Icons, Text, color, config, toRem } from 'folds';
import millify from 'millify';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../../room-settings/styles.css';
import { useRoom } from '../../../hooks/useRoom';
import { SPACE_LEVELS, useSpaceLevel } from '../../../hooks/useSpaceLevel';
import { BRAND_NAME } from '../../../brand';

function Progress({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = Math.min(100, (value / goal) * 100);
  return (
    <Box direction="Column" gap="100" grow="Yes" style={{ minWidth: toRem(160) }}>
      <Box justifyContent="SpaceBetween" gap="200">
        <Text size="T200">{label}</Text>
        <Text size="T200" priority="300">
          {`${millify(Math.min(value, goal))} / ${millify(goal)}`}
        </Text>
      </Box>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(pct)}
        style={{
          height: toRem(8),
          borderRadius: config.radii.Pill,
          background: color.SurfaceVariant.ContainerActive,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: config.radii.Pill,
            background: pct >= 100 ? color.Success.Main : color.Primary.Main,
          }}
        />
      </div>
    </Box>
  );
}

export function SpaceLevelCard() {
  const room = useRoom();
  const { level, members, days, next, granted } = useSpaceLevel(room);

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <Box direction="Column" gap="400">
        <Box alignItems="Center" gap="300">
          <Box
            shrink="No"
            alignItems="Center"
            justifyContent="Center"
            style={{
              width: toRem(44),
              height: toRem(44),
              borderRadius: config.radii.R400,
              background: level > 0 ? color.Primary.Main : color.SurfaceVariant.ContainerActive,
              color: level > 0 ? color.Primary.OnMain : color.SurfaceVariant.OnContainer,
            }}
          >
            <Text size="H3">{level}</Text>
          </Box>
          <Box direction="Column" grow="Yes">
            <Text size="H5">{level > 0 ? `Server Level ${level}` : 'No level yet'}</Text>
            <Text size="T200" priority="300">
              {next
                ? `Level ${next.level} needs ${millify(
                    next.members
                  )} members and a server at least ${next.days} days old.`
                : `${
                    granted ? `Full access from the ${BRAND_NAME} team` : 'Maxed out'
                  }. Every perk is unlocked.`}
            </Text>
          </Box>
        </Box>
        {next && (
          <Box gap="400" wrap="Wrap">
            <Progress label="Members" value={members} goal={next.members} />
            <Progress label="Days old" value={days} goal={next.days} />
          </Box>
        )}
        <Box direction="Column" gap="200">
          {SPACE_LEVELS.map((l, i) => {
            const unlocked = level > i;
            return (
              <Box key={l.unlocks} alignItems="Center" gap="200">
                <Icon
                  size="100"
                  src={unlocked ? Icons.Check : Icons.Lock}
                  style={{
                    color: unlocked ? color.Success.Main : undefined,
                    opacity: unlocked ? 1 : 0.6,
                  }}
                />
                <Text size="T300" priority={unlocked ? '400' : '300'} style={{ flexGrow: 1 }}>
                  <b>{`Level ${i + 1}`}</b>
                  {` · ${l.unlocks}`}
                </Text>
                <Text size="T200" priority="300">
                  {`${millify(l.members)} members · ${l.days} days`}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>
    </SequenceCard>
  );
}
