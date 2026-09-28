import React, { useState } from 'react';
import { Box, Button, Spinner, Switch, Text, color, config } from 'folds';
import { useQueryClient } from '@tanstack/react-query';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { deleteServerData, setPrivateMode } from '../../../utils/privateMode';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { userXpQueryKey } from '../../../hooks/useUserXp';

const TURNS_OFF = [
  'XP, levels and the XP bot',
  'Ban appeal checks through the appeal bot',
  'GitHub linking in Developer Tools',
  'Crash reports and bug reports',
];

// Wipes your data from Angaara's servers, then turns private mode on so none is made again.
function DeleteServerData({ onDeleted }: { onDeleted: () => void }) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const [, setEarnXp] = useSetting(settingsAtom, 'earnXp');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  const remove = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      await deleteServerData(mx);
      setEarnXp(false);
      onDeleted();
      queryClient.removeQueries({ queryKey: userXpQueryKey(mx.getSafeUserId()) });
      setMessage({ ok: true, text: 'Your data was deleted, and private mode is now on.' });
      setConfirming(false);
    } catch (e) {
      setMessage({
        ok: false,
        text: e instanceof Error ? e.message : "Couldn't delete your data.",
      });
    }
    setBusy(false);
  };

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Delete My Data"
        description="Deletes everything Angaara's servers keep about your account: your XP, level, member number and Early Ember badge, and the XP bot leaves its chat with you. Your Matrix account and messages aren't touched."
        after={
          !confirming && (
            <Button
              size="300"
              variant="Critical"
              fill="Soft"
              radii="300"
              outlined
              onClick={() => setConfirming(true)}
            >
              <Text size="B300">Delete</Text>
            </Button>
          )
        }
      />
      {confirming && (
        <Box direction="Column" gap="200" style={{ paddingTop: config.space.S200 }}>
          <Text size="T300">
            This can&apos;t be undone. If you earn XP again later, you&apos;ll start from zero with
            a new member number. Private mode turns on afterwards.
          </Text>
          <Box gap="200">
            <Button
              size="300"
              variant="Critical"
              radii="300"
              disabled={busy}
              onClick={remove}
              before={busy && <Spinner size="100" variant="Critical" fill="Solid" />}
            >
              <Text size="B300">Delete Everything</Text>
            </Button>
            <Button
              size="300"
              variant="Secondary"
              fill="Soft"
              radii="300"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              <Text size="B300">Cancel</Text>
            </Button>
          </Box>
        </Box>
      )}
      {message && (
        <Text
          size="T200"
          style={{
            paddingTop: config.space.S200,
            color: message.ok ? color.Success.Main : color.Critical.Main,
          }}
        >
          {message.text}
        </Text>
      )}
    </SequenceCard>
  );
}

// Cuts the app off from Angaara's Worker; chat, calls and encryption only need the homeserver.
export function PrivateMode() {
  const [privateMode, setSetting] = useSetting(settingsAtom, 'privateMode');
  const change = (on: boolean) => {
    setPrivateMode(on);
    setSetting(on);
  };

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Privacy</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Disable pinging our Cloudflare Workers"
          description="Full private mode: the app only talks to your Matrix homeserver. Messages, calls and end-to-end encryption all keep working."
          after={<Switch variant="Primary" value={privateMode} onChange={change} />}
        />
        {privateMode && (
          <Box direction="Column" gap="100" style={{ paddingTop: config.space.S200 }}>
            <Text size="T200" priority="300">
              Turned off while this is on:
            </Text>
            <Box as="ul" direction="Column" gap="100" style={{ margin: 0, paddingLeft: '1.2em' }}>
              {TURNS_OFF.map((item) => (
                <Text as="li" key={item} size="T200" priority="300">
                  {item}
                </Text>
              ))}
            </Box>
            <Text size="T200" style={{ color: color.Warning.Main }}>
              The app&apos;s own files still load from our site when you open it, but no features
              send anything back. This only applies on this device.
            </Text>
          </Box>
        )}
      </SequenceCard>
      <DeleteServerData onDeleted={() => change(true)} />
    </Box>
  );
}
