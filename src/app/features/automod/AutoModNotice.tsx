import React from 'react';
import { Box, color, config, Icon, Icons, Text } from 'folds';

type AutoModNoticeProps = {
  message: string;
  preview?: string;
  onDismiss: () => void;
};
export function AutoModNotice({ message, preview, onDismiss }: AutoModNoticeProps) {
  return (
    <Box
      role="status"
      direction="Column"
      gap="100"
      style={{
        margin: `${config.space.S200} ${config.space.S300} 0`,
        padding: config.space.S300,
        borderRadius: config.radii.R400,
        background: color.SurfaceVariant.Container,
        borderLeft: `${config.borderWidth.B700} solid ${color.Critical.Main}`,
      }}
    >
      {preview && (
        <Text size="T200" priority="300" truncate>
          {preview}
        </Text>
      )}
      <Text size="T200" style={{ color: color.Critical.Main }}>
        Your message wasn&apos;t sent.
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
            onClick={onDismiss}
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

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Right-aligned like a stopwatch: the countdown while waiting, just the icon otherwise.
export function SlowmodeStatus({ seconds, remaining }: { seconds: number; remaining: number }) {
  const label =
    remaining > 0
      ? `Slowmode is on. You can send again in ${remaining}s.`
      : `Slowmode is on: one message every ${clock(seconds)}.`;
  return (
    <Box
      justifyContent="End"
      alignItems="Center"
      gap="100"
      title={label}
      aria-label={label}
      role="timer"
      style={{ padding: `0 ${config.space.S300} ${config.space.S100}` }}
    >
      {remaining > 0 && (
        <Text size="T200" priority="300" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {clock(remaining)}
        </Text>
      )}
      <Icon size="100" src={Icons.Clock} filled={remaining > 0} style={{ opacity: 0.7 }} />
    </Box>
  );
}
