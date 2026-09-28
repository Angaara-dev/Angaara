import React from 'react';
import { Box, Switch, Text, color, config } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { setPrivateMode } from '../../../utils/privateMode';

const TURNS_OFF = [
  'XP, levels and the XP bot',
  'Ban appeal checks through the appeal bot',
  'GitHub linking in Developer Tools',
  'Crash reports and bug reports',
];

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
    </Box>
  );
}
