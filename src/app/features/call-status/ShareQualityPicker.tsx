import React from 'react';
import { Box, Button, Text } from 'folds';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { SHARE_FPS, SHARE_QUALITIES } from '../../plugins/call/shareQuality';

type ChoicesProps<T extends number> = {
  values: T[];
  value: T;
  label: (v: T) => string;
  onChange: (v: T) => void;
};
function Choices<T extends number>({ values, value, label, onChange }: ChoicesProps<T>) {
  return (
    <Box gap="200" wrap="Wrap">
      {values.map((v) => (
        <Button
          key={v}
          type="button"
          size="300"
          radii="Pill"
          variant={value === v ? 'Primary' : 'Secondary'}
          fill={value === v ? 'Solid' : 'Soft'}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          <Text size="B300">{label(v)}</Text>
        </Button>
      ))}
    </Box>
  );
}

export function ShareResolutionPicker() {
  const [quality, setQuality] = useSetting(settingsAtom, 'screenShareQuality');
  return (
    <Choices
      values={SHARE_QUALITIES}
      value={quality}
      label={(q) => `${q}p`}
      onChange={setQuality}
    />
  );
}

export function ShareFpsPicker() {
  const [fps, setFps] = useSetting(settingsAtom, 'screenShareFps');
  return <Choices values={SHARE_FPS} value={fps} label={(f) => `${f} FPS`} onChange={setFps} />;
}
