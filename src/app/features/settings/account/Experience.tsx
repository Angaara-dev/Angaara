import React, { useState } from 'react';
import { Box, Button, Icon, Icons, Spinner, Switch, Text, color, config, toRem } from 'folds';
import { useQueryClient } from '@tanstack/react-query';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { userXpQueryKey, useUserXp } from '../../../hooks/useUserXp';
import {
  deleteXp,
  getLastXpReport,
  XP_DAILY_MINUTES,
  XP_LEVEL_REWARDS,
  XP_LEVELS,
} from '../../../../client/xp';

function XpProgress({ xp, level }: { xp: number; level: number }) {
  const next = XP_LEVELS[level];
  const from = XP_LEVELS[level - 1] ?? 0;
  const pct = next ? Math.min(100, ((xp - from) / (next - from)) * 100) : 100;
  return (
    <Box direction="Column" gap="200">
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
          <Text size="H5">{level > 0 ? `Level ${level}` : 'No level yet'}</Text>
          <Text size="T200" priority="300">
            {next
              ? `${xp.toLocaleString()} / ${next.toLocaleString()} XP to Level ${level + 1}`
              : `${xp.toLocaleString()} XP · Full access`}
          </Text>
        </Box>
      </Box>
      <div
        role="progressbar"
        aria-label="XP to next level"
        aria-valuenow={Math.round(pct)}
        style={{
          height: toRem(8),
          borderRadius: config.radii.Pill,
          background: color.SurfaceVariant.ContainerActive,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color.Primary.Main }} />
      </div>
      <Box direction="Column" gap="200" style={{ marginTop: config.space.S100 }}>
        {XP_LEVELS.map((need, i) => {
          const unlocked = xp >= need;
          return (
            <Box key={need} alignItems="Center" gap="200">
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
                {` · ${XP_LEVEL_REWARDS[i]}`}
              </Text>
              <Text size="T200" priority="300">
                {`${need.toLocaleString()} XP`}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// Your level, and the switch that stops Angaara counting XP at all.
export function Experience() {
  const mx = useMatrixClient();
  const userId = mx.getSafeUserId();
  const queryClient = useQueryClient();
  const [earnXp, setEarnXp] = useSetting(settingsAtom, 'earnXp');
  const status = useUserXp(userId);
  const report = getLastXpReport();
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string>();

  const handleDelete = () => {
    setDeleting(true);
    setMessage(undefined);
    deleteXp(mx)
      .then((ok) => {
        setMessage(ok ? 'Your XP was deleted.' : "Couldn't delete your XP. Try again later.");
        if (ok) setEarnXp(false);
        return queryClient.invalidateQueries({ queryKey: userXpQueryKey(userId) });
      })
      .catch(() => setMessage("Couldn't delete your XP. Try again later."))
      .finally(() => setDeleting(false));
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Experience</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        {status === null ? (
          <Text size="T300" priority="300">
            XP isn&apos;t set up on this Angaara server yet.
          </Text>
        ) : (
          <>
            <XpProgress xp={status?.xp ?? 0} level={status?.level ?? 0} />
            <Text size="T200" priority="300">
              {status?.capped
                ? 'Daily limit reached. This is to ensure that you touch grass 🌱'
                : `Today: ${status?.minutesToday ?? 0} / ${XP_DAILY_MINUTES} XP (daily limit)`}
            </Text>
          </>
        )}
        <SettingTile
          title="Earn XP"
          description="Every few minutes, Angaara sends the Angaara server the IDs and times of messages you sent, never what they say. It counts up to 1 XP a minute, at most 300 XP a day, plus a little for each active day. XP unlocks profile perks. It also sends the IDs of the servers you're in, so you count toward their server level. Turning this off stops sending anything, and you won't count toward your servers' levels."
          after={<Switch variant="Primary" value={earnXp} onChange={setEarnXp} />}
        />
        {earnXp && (
          <Text size="T200" priority="300">
            {report
              ? `Last report: ${report.result} (${report.queued} message${
                  report.queued === 1 ? '' : 's'
                }) at ${new Date(report.at).toLocaleTimeString()}`
              : 'Not reporting yet. Reload the app if this stays.'}
          </Text>
        )}
        <SettingTile
          title="Delete My XP"
          description="Erases your XP from the Angaara server and turns Earn XP off."
          after={
            <Button
              size="300"
              variant="Critical"
              fill="Soft"
              radii="300"
              disabled={deleting || status === null}
              onClick={handleDelete}
              before={deleting && <Spinner size="100" variant="Critical" />}
            >
              <Text size="B300">Delete</Text>
            </Button>
          }
        />
        {message && (
          <Text size="T200" priority="300">
            {message}
          </Text>
        )}
      </SequenceCard>
    </Box>
  );
}
