import React from 'react';
import { Box, Text, color, config, toRem } from 'folds';
import { hexToHsl, hslToHex, MAX_THEME_SHADE, themeStop } from '../../utils/accent';
import { ThemeKind, useTheme } from '../../hooks/useTheme';
import * as css from './GradientEditor.css';

const SATURATION = 70;
const HUE_TRACK =
  'linear-gradient(90deg, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)';

type StopProps = {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (hex: string) => void;
};
function GradientStop({ label, value, disabled, onChange }: StopProps) {
  const { h, l } = hexToHsl(value);
  const set = (hue: number, shade: number) =>
    onChange(hslToHex({ h: hue, s: shade === 0 ? 0 : SATURATION, l: shade }));

  const slider = (name: string, min: number, max: number, v: number, track: string) => (
    <input
      type="range"
      aria-label={`${label} ${name}`}
      min={min}
      max={max}
      value={Math.round(v)}
      disabled={disabled}
      onChange={(evt) => {
        const n = parseInt(evt.target.value, 10);
        if (name === 'hue') set(n, Math.max(l, 18));
        else set(h, n);
      }}
      className={css.TrackSlider}
      style={{ background: track }}
    />
  );

  return (
    <Box direction="Column" gap="200" grow="Yes">
      <Box alignItems="Center" gap="200">
        <span
          style={{
            width: toRem(16),
            height: toRem(16),
            borderRadius: '50%',
            background: value,
            border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
          }}
        />
        <Text size="T300">{label}</Text>
      </Box>
      <Text size="T200" priority="300">
        Hue
      </Text>
      {slider('hue', 0, 359, h, HUE_TRACK)}
      <Text size="T200" priority="300">
        Shade
      </Text>
      {slider(
        'shade',
        0,
        MAX_THEME_SHADE,
        Math.min(l, MAX_THEME_SHADE),
        `linear-gradient(90deg, #000, ${hslToHex({ h, s: SATURATION, l: MAX_THEME_SHADE })})`
      )}
    </Box>
  );
}

type GradientEditorProps = {
  top: string;
  bottom: string;
  disabled?: boolean;
  onChange: (top: string, bottom: string) => void;
};
// Two-colour, top-to-bottom theme, each end with its own hue and shade sliders.
export function GradientEditor({ top, bottom, disabled, onChange }: GradientEditorProps) {
  const dark = useTheme().kind === ThemeKind.Dark;
  return (
    <Box direction="Column" gap="400">
      <div
        aria-hidden
        style={{
          height: toRem(88),
          borderRadius: config.radii.R400,
          border: `1px solid ${color.SurfaceVariant.ContainerLine}`,
          background: `linear-gradient(180deg, ${themeStop(top, dark)}, ${themeStop(
            bottom,
            dark
          )})`,
        }}
      />
      <Box gap="500" wrap="Wrap">
        <Box grow="Yes" style={{ minWidth: toRem(180) }}>
          <GradientStop
            label="Color"
            value={top}
            disabled={disabled}
            onChange={(hex) => onChange(hex, bottom)}
          />
        </Box>
        <Box grow="Yes" style={{ minWidth: toRem(180) }}>
          <GradientStop
            label="Accent"
            value={bottom}
            disabled={disabled}
            onChange={(hex) => onChange(top, hex)}
          />
        </Box>
      </Box>
    </Box>
  );
}
