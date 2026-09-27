import React, { useState } from 'react';
import { Box, Chip, Text, color, config } from 'folds';
import { copyToClipboard } from '../../utils/dom';

export function CopyChip({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Chip
      variant="SurfaceVariant"
      radii="Pill"
      onClick={() => {
        copyToClipboard(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Text size="B300">{copied ? 'Copied!' : label}</Text>
    </Chip>
  );
}

export function CodeBlock({ code, file }: { code: string; file?: string }) {
  return (
    <Box direction="Column" gap="200">
      {file && (
        <Text size="L400" priority="300">
          {file}
        </Text>
      )}
      <pre
        style={{
          margin: 0,
          padding: config.space.S300,
          borderRadius: config.radii.R400,
          background: color.Background.Container,
          overflowX: 'auto',
          fontSize: '0.8rem',
        }}
      >
        <code>{code}</code>
      </pre>
      <Box>
        <CopyChip value={code} label="Copy Code" />
      </Box>
    </Box>
  );
}
