import React, { useState } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import { Box, color, config, Icon, Icons, Text } from 'folds';

const DISMISSED_KEY = 'angaara.automodDismissed';

export const readAutoModRemoval = (mEvent: MatrixEvent): { message: string } | undefined => {
  const info = mEvent.getUnsigned().redacted_because?.content?.['io.angaara.automod'];
  const message = info && typeof info.message === 'string' ? info.message.slice(0, 200) : undefined;
  return message ? { message } : undefined;
};

const readDismissed = (): string[] => {
  try {
    const list = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const isRemovalDismissed = (eventId: string) => readDismissed().includes(eventId);

const dismiss = (eventId: string) => {
  try {
    localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify([eventId, ...readDismissed()].slice(0, 200))
    );
  } catch {
    // Storage blocked
  }
};

export function AutoModRemovedNotice({ eventId, message }: { eventId: string; message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Box direction="Column" gap="100" style={{ paddingTop: config.space.S100 }}>
      <Text size="T200" style={{ color: color.Critical.Main }}>
        Your message was removed.
      </Text>
      <Box gap="200" alignItems="Start">
        <Icon size="100" src={Icons.Shield} filled style={{ color: color.Critical.Main }} />
        <Box direction="Column">
          <Text size="T300">This content is blocked by this server. From server moderators:</Text>
          <Text size="T300" style={{ fontStyle: 'italic' }}>
            &ldquo;{message}&rdquo;
          </Text>
        </Box>
      </Box>
      <Box alignItems="Center" gap="100">
        <Icon size="50" src={Icons.Eye} />
        <Text size="T200" priority="300">
          Only you can see this ·{' '}
          <Text
            as="button"
            type="button"
            size="T200"
            onClick={() => {
              dismiss(eventId);
              setDismissed(true);
            }}
            style={{
              color: color.Primary.Main,
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            Dismiss message
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
