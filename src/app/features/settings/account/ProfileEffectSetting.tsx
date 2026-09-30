import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Icon, Icons, Spinner, Text, color, config, toRem } from 'folds';
import { useQueryClient } from '@tanstack/react-query';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import {
  extendedProfileQueryKey,
  readProfileString,
  useExtendedProfile,
} from '../../../hooks/useUserBanner';
import {
  parseProfileEffect,
  PROFILE_EFFECT_KEY,
  PROFILE_EFFECTS,
  ProfileEffect,
  ProfileEffectId,
} from '../../../components/profile-effect';
import { useXpPerk } from '../../../hooks/useXpPerk';
import { XP_PERKS } from '../../../../client/xp';
import { describeError } from '../../../utils/describeError';

type EffectChoiceProps = {
  effect?: ProfileEffectId;
  label: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};
function EffectChoice({ effect, label, selected, disabled, onSelect }: EffectChoiceProps) {
  return (
    <Box
      as="button"
      type="button"
      direction="Column"
      gap="100"
      alignItems="Center"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
    >
      <div
        style={{
          position: 'relative',
          width: toRem(88),
          height: toRem(112),
          borderRadius: config.radii.R400,
          background: color.Background.Container,
          outline: `${config.borderWidth.B600} solid ${
            selected ? color.Primary.Main : color.Surface.ContainerLine
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {effect ? (
          <ProfileEffect effect={effect} />
        ) : (
          <Icon size="200" src={Icons.Cross} style={{ opacity: 0.5 }} />
        )}
      </div>
      <Text size="T200" priority={selected ? '500' : '300'}>
        {label}
      </Text>
    </Box>
  );
}

export function ProfileEffectSetting({ userId }: { userId: string }) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const unlocked = useXpPerk(userId, 'profileEffect');
  const saved = parseProfileEffect(
    readProfileString(useExtendedProfile(userId), [PROFILE_EFFECT_KEY])
  );
  const [choice, setChoice] = useState<ProfileEffectId | undefined>(saved);
  const [error, setError] = useState<string>();

  useEffect(() => setChoice(saved), [saved]);

  const [saveState, save] = useAsyncCallback(
    useCallback(
      async (value?: ProfileEffectId) => {
        if (value) await mx.setExtendedProfileProperty(PROFILE_EFFECT_KEY, value);
        else await mx.deleteExtendedProfileProperty(PROFILE_EFFECT_KEY);
        await queryClient.invalidateQueries({ queryKey: extendedProfileQueryKey(userId) });
      },
      [mx, queryClient, userId]
    )
  );
  const saving = saveState.status === AsyncStatus.Loading;
  const hasChanges = choice !== saved;

  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          Profile Effect
        </Text>
      }
      description={
        unlocked
          ? 'An animation over your profile card and hover card.'
          : `An animation over your profile card. Unlocks at ${XP_PERKS.profileEffect.toLocaleString()} XP.`
      }
      after={!unlocked && <Icon size="100" src={Icons.Lock} />}
    >
      {unlocked && (
        <Box direction="Column" gap="300">
          <Box gap="300" wrap="Wrap">
            <EffectChoice
              label="None"
              selected={!choice}
              disabled={saving}
              onSelect={() => setChoice(undefined)}
            />
            {PROFILE_EFFECTS.map(({ id, label }) => (
              <EffectChoice
                key={id}
                effect={id}
                label={label}
                selected={choice === id}
                disabled={saving}
                onSelect={() => setChoice(id)}
              />
            ))}
          </Box>
          <Box>
            <Button
              type="button"
              size="300"
              variant={hasChanges ? 'Success' : 'Secondary'}
              fill={hasChanges ? 'Solid' : 'Soft'}
              outlined
              radii="300"
              disabled={!hasChanges || saving}
              onClick={() => {
                setError(undefined);
                save(choice).catch((e) =>
                  setError(describeError(e, "Couldn't save your profile effect."))
                );
              }}
              before={saving && <Spinner variant="Success" fill="Solid" size="100" />}
            >
              <Text size="B300">Save</Text>
            </Button>
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
