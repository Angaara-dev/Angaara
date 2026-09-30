import React, { useState } from 'react';
import { Box, Button, Icon, Icons, Input, Spinner, Text, color, config } from 'folds';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { PRIVATE_MODE_MESSAGE } from '../../../utils/privateMode';
import {
  AngaaraAccount as Account,
  cancelled,
  getAngaaraAccount,
  registerPasskey,
  signInWithPasskey,
  unlinkAngaaraAccount,
} from '../../angaara-id/angaaraId';

const QUERY_KEY = ['angaara-account'];

function Linked({
  account,
  run,
}: {
  account: Account;
  run: (task: () => Promise<unknown>) => void;
}) {
  const mx = useMatrixClient();
  return (
    <Box direction="Column" gap="300">
      <SettingTile
        title={`@${account.username}`}
        description={`Your Angaara account${account.supporter ? ' · Supporter ❤️' : ''}. ${
          account.passkeys
        } passkey${account.passkeys === 1 ? '' : 's'} · linked to ${account.linked.length} of ${
          account.maxLinks
        } Matrix accounts.`}
        before={<Icon src={Icons.ShieldUser} size="200" />}
      />
      <Box direction="Column" gap="100">
        {account.linked.map((id) => (
          <Text key={id} size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
            {id}
            {id === mx.getSafeUserId() ? ' (this account)' : ''}
          </Text>
        ))}
      </Box>
      <Text size="T200" priority="300">
        Only you can see which Matrix accounts are linked. Others only see your perks, like the
        Supporter badge.
      </Text>
      <Box gap="200" wrap="Wrap">
        <Button
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          onClick={() => run(() => registerPasskey(mx))}
          before={<Icon src={Icons.Plus} size="100" />}
        >
          <Text size="B300">Add a Backup Passkey</Text>
        </Button>
        <Button
          size="300"
          variant="Critical"
          fill="Soft"
          radii="300"
          onClick={() => run(() => unlinkAngaaraAccount(mx))}
        >
          <Text size="B300">Unlink This Matrix Account</Text>
        </Button>
      </Box>
    </Box>
  );
}

function NotLinked({ run }: { run: (task: () => Promise<unknown>) => void }) {
  const mx = useMatrixClient();
  const [username, setUsername] = useState('');
  return (
    <Box direction="Column" gap="400">
      <Text size="T300" priority="300">
        An Angaara account keeps perks like Supporter with you on any homeserver. It uses a passkey
        (your fingerprint, face or security key), so there&apos;s no password to leak.
      </Text>
      <Box direction="Column" gap="200">
        <Text size="L400">Create one</Text>
        <Box gap="200">
          <Input
            variant="Background"
            radii="300"
            size="400"
            placeholder="username"
            value={username}
            maxLength={20}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
            }
            style={{ flexGrow: 1 }}
          />
          <Button
            size="400"
            variant="Primary"
            radii="300"
            disabled={username.length < 3}
            onClick={() => run(() => registerPasskey(mx, username))}
          >
            <Text size="B400">Create with Passkey</Text>
          </Button>
        </Box>
      </Box>
      <Box direction="Column" gap="200">
        <Text size="L400">Already have one?</Text>
        <Button
          size="400"
          variant="Secondary"
          fill="Soft"
          radii="300"
          onClick={() => run(() => signInWithPasskey(mx))}
          before={<Icon src={Icons.ShieldUser} size="100" />}
        >
          <Text size="B400">Sign In with Passkey</Text>
        </Button>
        <Text size="T200" priority="300">
          Links this Matrix account to it, so your perks work here too.
        </Text>
      </Box>
    </Box>
  );
}

export function AngaaraAccount() {
  const mx = useMatrixClient();
  const queryClient = useQueryClient();
  const [privateMode] = useSetting(settingsAtom, 'privateMode');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getAngaaraAccount(mx),
    enabled: !privateMode,
    retry: false,
  });

  const run = (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    task()
      .then(() => queryClient.invalidateQueries({ queryKey: QUERY_KEY }))
      .catch((e) => {
        if (!cancelled(e)) setError(e instanceof Error ? e.message : 'Something went wrong.');
      })
      .finally(() => setBusy(false));
  };

  let body: React.ReactNode;
  if (privateMode)
    body = (
      <Text size="T300" priority="300">
        {PRIVATE_MODE_MESSAGE}
      </Text>
    );
  else if (isLoading) body = <Spinner variant="Secondary" size="200" />;
  else if (isError) {
    body = (
      <Text size="T300" priority="300">
        Angaara accounts aren&apos;t available on this server right now.
      </Text>
    );
  } else if (data) body = <Linked account={data} run={run} />;
  else body = <NotLinked run={run} />;

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Angaara Account</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="300"
        style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : undefined }}
      >
        {body}
        {error && (
          <Text size="T200" style={{ color: color.Critical.Main, paddingTop: config.space.S100 }}>
            {error}
          </Text>
        )}
      </SequenceCard>
    </Box>
  );
}
