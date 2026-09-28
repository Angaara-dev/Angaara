import React, { useState } from 'react';
import { Box, Button, Input, Spinner, Switch, Text, color, config } from 'folds';
import { useQueryClient } from '@tanstack/react-query';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  DeleteCheck,
  deleteServerData,
  getDeleteCheck,
  setPrivateMode,
} from '../../../utils/privateMode';
import { cancelled } from '../../angaara-id/angaaraId';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { userXpQueryKey } from '../../../hooks/useUserXp';

const TURNS_OFF = [
  'XP, levels and the XP bot',
  'Ban appeal checks through the appeal bot',
  'GitHub linking in Developer Tools',
  'Crash reports and bug reports',
];

const DELETES = [
  'Your Angaara account, its username and all its passkeys',
  'Supporter status and every perk that comes with it',
  'The links to all your Matrix accounts, on every server',
  'XP, levels, member number and the Early Ember badge, for every linked account',
  'The XP bot’s chats with you',
];

// Wipes your data from Angaara's servers, then turns private mode on so none is made again.
function DeleteServerData({ onDeleted }: { onDeleted: () => void }) {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const [, setEarnXp] = useSetting(settingsAtom, 'earnXp');
  const [check, setCheck] = useState<DeleteCheck>();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const confirming = !!check;
  const matches = !!check && typed.trim().replace(/^@/, '').toLowerCase() === check.username;

  const start = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      setTyped('');
      setCheck(await getDeleteCheck(mx));
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn't start." });
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!check || !matches) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await deleteServerData(mx, typed, check);
      setEarnXp(false);
      onDeleted();
      queryClient.removeQueries({ queryKey: userXpQueryKey(mx.getSafeUserId()) });
      queryClient.removeQueries({ queryKey: ['angaara-account'] });
      setMessage({ ok: true, text: 'Your data was deleted, and private mode is now on.' });
      setCheck(undefined);
    } catch (e) {
      // A closed passkey prompt just leaves everything as it was.
      if (cancelled(e)) {
        setBusy(false);
        return;
      }
      // Each passkey challenge works once, so a new one is needed to try again.
      setCheck(undefined);
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
        description="Deletes everything Angaara's servers keep about you, including your Angaara account and Supporter status. Your Matrix account and messages aren't touched."
        after={
          !confirming && (
            <Button
              size="300"
              variant="Critical"
              fill="Soft"
              radii="300"
              outlined
              disabled={busy}
              onClick={start}
            >
              <Text size="B300">Delete</Text>
            </Button>
          )
        }
      />
      {confirming && (
        <Box direction="Column" gap="200" style={{ paddingTop: config.space.S200 }}>
          <Box
            direction="Column"
            gap="200"
            style={{
              padding: config.space.S300,
              borderRadius: config.radii.R400,
              border: `1px solid ${color.Critical.Main}`,
              background: `color-mix(in srgb, ${color.Critical.Main} 12%, transparent)`,
            }}
          >
            <Text size="H5" style={{ color: color.Critical.Main }}>
              ⚠️ This permanently deletes:
            </Text>
            <Box as="ul" direction="Column" gap="100" style={{ margin: 0, paddingLeft: '1.2em' }}>
              {DELETES.map((item) => (
                <Text as="li" key={item} size="T300">
                  {item}
                </Text>
              ))}
            </Box>
            <Text size="T300">
              <b>It can&apos;t be undone, and we can&apos;t restore it.</b> Supporter status paid
              for isn&apos;t refunded or moved. If you come back, you start from zero with a new
              member number. Private mode turns on afterwards.
            </Text>
          </Box>
          <Box direction="Column" gap="100">
            <Text size="T300">
              Type <b>{check.username}</b> to confirm
              {check.options ? ', then confirm with your passkey' : ''}.
            </Text>
            <Input
              variant="Background"
              radii="300"
              size="400"
              value={typed}
              placeholder={check.username}
              autoComplete="off"
              spellCheck={false}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTyped(e.target.value)}
            />
          </Box>
          <Box gap="200" wrap="Wrap">
            <Button
              size="300"
              variant="Critical"
              radii="300"
              disabled={busy || !matches}
              onClick={remove}
              before={busy && <Spinner size="100" variant="Critical" fill="Solid" />}
            >
              <Text size="B300">
                {check.options ? 'Confirm with Passkey and Delete' : 'Delete Everything'}
              </Text>
            </Button>
            <Button
              size="300"
              variant="Secondary"
              fill="Soft"
              radii="300"
              disabled={busy}
              onClick={() => setCheck(undefined)}
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
