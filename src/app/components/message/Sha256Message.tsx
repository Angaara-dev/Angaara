import React, { useState } from 'react';
import { Box, Chip, Icon, Icons, Text, config } from 'folds';

export function Sha256Message({ hash }: { hash: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Box direction="Column" gap="100" alignItems="Start">
      <Chip
        variant="SurfaceVariant"
        radii="Pill"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        before={<Icon size="50" src={Icons.Lock} />}
        after={<Icon size="50" src={open ? Icons.ChevronTop : Icons.ChevronBottom} />}
      >
        <Text size="B300">SHA-256 hashed message</Text>
      </Chip>
      {open && (
        <Text
          size="T200"
          priority="300"
          style={{
            fontFamily: 'monospace',
            overflowWrap: 'anywhere',
            paddingLeft: config.space.S100,
          }}
        >
          {hash}
        </Text>
      )}
    </Box>
  );
}
