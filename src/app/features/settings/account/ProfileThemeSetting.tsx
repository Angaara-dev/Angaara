import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, color } from 'folds';
import { useQueryClient } from '@tanstack/react-query';
import { SettingTile } from '../../../components/setting-tile';
import { GradientEditor } from '../../../components/gradient-editor';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import {
  extendedProfileQueryKey,
  readProfileString,
  useExtendedProfile,
} from '../../../hooks/useUserBanner';
import { parseProfileTheme, PROFILE_THEME_KEY } from '../../../hooks/useProfileTheme';
import { useXpPerk } from '../../../hooks/useXpPerk';
import { XP_PERKS } from '../../../../client/xp';

const DEFAULT_TOP = '#000000';
const DEFAULT_BOTTOM = '#662a00';

// Profile colours: a gradient behind your profile card, unlocked with XP.
export function ProfileThemeSetting({ userId }: { userId: string }) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const unlocked = useXpPerk(userId, 'profileTheme');
  const saved = parseProfileTheme(
    readProfileString(useExtendedProfile(userId), [PROFILE_THEME_KEY])
  );
  const savedTop = saved?.top ?? DEFAULT_TOP;
  const savedBottom = saved?.bottom ?? DEFAULT_BOTTOM;
  const [top, setTop] = useState(savedTop);
  const [bottom, setBottom] = useState(savedBottom);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setTop(savedTop);
    setBottom(savedBottom);
  }, [savedTop, savedBottom]);

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (value?: string) => {
        if (value) await mx.setExtendedProfileProperty(PROFILE_THEME_KEY, value);
        else await mx.deleteExtendedProfileProperty(PROFILE_THEME_KEY);
        await queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) });
      },
      [mx, queryClient, userId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;
  const hasChanges = !saved || top !== savedTop || bottom !== savedBottom;
  const run = (value?: string) => {
    setError(undefined);
    save(value).catch(() => setError("Couldn't save your profile colours."));
  };

  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          Profile Colours
        </Text>
      }
      description={
        unlocked
          ? 'A gradient behind your profile card and hover card.'
          : `A gradient behind your profile card. Unlocks at ${XP_PERKS.profileTheme.toLocaleString()} XP.`
      }
      after={!unlocked && <Icon size="100" src={Icons.Lock} />}
    >
      {unlocked && (
        <Box direction="Column" gap="300">
          <GradientEditor
            top={top}
            bottom={bottom}
            disabled={saving}
            onChange={(t, b) => {
              setTop(t);
              setBottom(b);
            }}
          />
          <Box gap="200">
            <Button
              type="button"
              size="300"
              variant={hasChanges ? 'Success' : 'Secondary'}
              fill={hasChanges ? 'Solid' : 'Soft'}
              outlined
              radii="300"
              disabled={!hasChanges || saving}
              onClick={() => run(`${top},${bottom}`)}
              before={saving && <Spinner variant="Success" fill="Solid" size="100" />}
            >
              <Text size="B300">Save</Text>
            </Button>
            {saved && (
              <Button
                type="button"
                size="300"
                variant="Critical"
                fill="None"
                radii="300"
                disabled={saving}
                onClick={() => run()}
              >
                <Text size="B300">Remove</Text>
              </Button>
            )}
          </Box>
        </Box>
      )}
      {error && (
        <Text size="T200" style={{ color: color.Critical.Main }}>
          {error}
        </Text>
      )}
    </SettingTile>
  );
}
