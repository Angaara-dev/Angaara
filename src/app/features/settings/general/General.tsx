import React, {
  ChangeEventHandler,
  FormEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  useEffect,
  useState,
} from 'react';
import dayjs from 'dayjs';
import {
  as,
  Box,
  Button,
  Chip,
  config,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Scroll,
  Switch,
  Text,
  toRem,
  color,
} from 'folds';
import { isKeyHotkey } from 'is-hotkey';
import FocusTrap from 'focus-trap-react';
import { Page, PageContent } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { useSetting } from '../../../state/hooks/settings';
import { DateFormat, MessageLayout, MessageSpacing, settingsAtom } from '../../../state/settings';
import { SettingTile } from '../../../components/setting-tile';
import { KeySymbol } from '../../../utils/key-symbol';
import { isMacOS } from '../../../utils/user-agent';
import {
  EmberTheme,
  LightTheme,
  Theme,
  ThemeKind,
  useSystemThemeKind,
  useThemeNames,
  useThemes,
} from '../../../hooks/useTheme';
import { stopPropagation } from '../../../utils/keyboard';
import { useMessageLayoutItems } from '../../../hooks/useMessageLayout';
import { useMessageSpacingItems } from '../../../hooks/useMessageSpacing';
import { useDateFormatItems } from '../../../hooks/useDateFormat';
import { SequenceCardStyle } from '../styles.css';
import { ACCENT_PRESETS, isHexColor } from '../../../utils/accent';
import { PHONE_SCROLL_NATIVE } from '../../../utils/touchScroll';
import { SettingsPageHeader } from '../SettingsPageHeader';
import { usePhone } from '../../../hooks/useScreenSize';

type ThemeSelectorProps = {
  themeNames: Record<string, string>;
  themes: Theme[];
  selected: Theme;
  onSelect: (theme: Theme) => void;
};
const ThemeSelector = as<'div', ThemeSelectorProps>(
  ({ themeNames, themes, selected, onSelect, ...props }, ref) => (
    <Menu {...props} ref={ref}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        {themes.map((theme) => (
          <MenuItem
            key={theme.id}
            size="300"
            variant={theme.id === selected.id ? 'Primary' : 'Surface'}
            radii="300"
            onClick={() => onSelect(theme)}
          >
            <Text size="T300">{themeNames[theme.id] ?? theme.id}</Text>
          </MenuItem>
        ))}
      </Box>
    </Menu>
  )
);

function SelectTheme({ disabled }: { disabled?: boolean }) {
  const themes = useThemes();
  const themeNames = useThemeNames();
  const [themeId, setThemeId] = useSetting(settingsAtom, 'themeId');
  const [menuCords, setMenuCords] = useState<RectCords>();
  const selectedTheme = themes.find((theme) => theme.id === themeId) ?? EmberTheme;

  const handleThemeMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleThemeSelect = (theme: Theme) => {
    setThemeId(theme.id);
    setMenuCords(undefined);
  };

  return (
    <>
      <Button
        size="300"
        variant="Primary"
        outlined
        fill="Soft"
        radii="300"
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={disabled ? undefined : handleThemeMenu}
        aria-disabled={disabled}
      >
        <Text size="T300">{themeNames[selectedTheme.id] ?? selectedTheme.id}</Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <ThemeSelector
              themeNames={themeNames}
              themes={themes}
              selected={selectedTheme}
              onSelect={handleThemeSelect}
            />
          </FocusTrap>
        }
      />
    </>
  );
}

function SystemThemePreferences() {
  const themeKind = useSystemThemeKind();
  const themeNames = useThemeNames();
  const themes = useThemes();
  const [lightThemeId, setLightThemeId] = useSetting(settingsAtom, 'lightThemeId');
  const [darkThemeId, setDarkThemeId] = useSetting(settingsAtom, 'darkThemeId');

  const lightThemes = themes.filter((theme) => theme.kind === ThemeKind.Light);
  const darkThemes = themes.filter((theme) => theme.kind === ThemeKind.Dark);

  const selectedLightTheme = lightThemes.find((theme) => theme.id === lightThemeId) ?? LightTheme;
  const selectedDarkTheme = darkThemes.find((theme) => theme.id === darkThemeId) ?? EmberTheme;

  const [ltCords, setLTCords] = useState<RectCords>();
  const [dtCords, setDTCords] = useState<RectCords>();

  const handleLightThemeMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setLTCords(evt.currentTarget.getBoundingClientRect());
  };
  const handleDarkThemeMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setDTCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleLightThemeSelect = (theme: Theme) => {
    setLightThemeId(theme.id);
    setLTCords(undefined);
  };

  const handleDarkThemeSelect = (theme: Theme) => {
    setDarkThemeId(theme.id);
    setDTCords(undefined);
  };

  return (
    <Box wrap="Wrap" gap="400">
      <SettingTile
        title="Light Theme:"
        after={
          <Chip
            variant={themeKind === ThemeKind.Light ? 'Primary' : 'Secondary'}
            outlined={themeKind === ThemeKind.Light}
            radii="Pill"
            after={<Icon size="200" src={Icons.ChevronBottom} />}
            onClick={handleLightThemeMenu}
          >
            <Text size="B300">{themeNames[selectedLightTheme.id] ?? selectedLightTheme.id}</Text>
          </Chip>
        }
      />
      <PopOut
        anchor={ltCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setLTCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <ThemeSelector
              themeNames={themeNames}
              themes={lightThemes}
              selected={selectedLightTheme}
              onSelect={handleLightThemeSelect}
            />
          </FocusTrap>
        }
      />
      <SettingTile
        title="Dark Theme:"
        after={
          <Chip
            variant={themeKind === ThemeKind.Dark ? 'Primary' : 'Secondary'}
            outlined={themeKind === ThemeKind.Dark}
            radii="Pill"
            after={<Icon size="200" src={Icons.ChevronBottom} />}
            onClick={handleDarkThemeMenu}
          >
            <Text size="B300">{themeNames[selectedDarkTheme.id] ?? selectedDarkTheme.id}</Text>
          </Chip>
        }
      />
      <PopOut
        anchor={dtCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setDTCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <ThemeSelector
              themeNames={themeNames}
              themes={darkThemes}
              selected={selectedDarkTheme}
              onSelect={handleDarkThemeSelect}
            />
          </FocusTrap>
        }
      />
    </Box>
  );
}

function PageZoomInput() {
  const [pageZoom, setPageZoom] = useSetting(settingsAtom, 'pageZoom');
  const [currentZoom, setCurrentZoom] = useState(`${pageZoom}`);

  const handleZoomChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setCurrentZoom(evt.target.value);
  };

  const handleZoomEnter: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (isKeyHotkey('escape', evt)) {
      evt.stopPropagation();
      setCurrentZoom(pageZoom.toString());
    }
    if (
      isKeyHotkey('enter', evt) &&
      'value' in evt.target &&
      typeof evt.target.value === 'string'
    ) {
      const newZoom = parseInt(evt.target.value, 10);
      if (Number.isNaN(newZoom)) return;
      const safeZoom = Math.max(Math.min(newZoom, 150), 75);
      setPageZoom(safeZoom);
      setCurrentZoom(safeZoom.toString());
    }
  };

  return (
    <Input
      style={{ width: toRem(100) }}
      variant={pageZoom === parseInt(currentZoom, 10) ? 'Secondary' : 'Success'}
      size="300"
      radii="300"
      type="number"
      min="75"
      max="150"
      value={currentZoom}
      onChange={handleZoomChange}
      onKeyDown={handleZoomEnter}
      after={<Text size="T300">%</Text>}
      outlined
    />
  );
}

const MESSAGE_SCALE_MIN = 80;
const MESSAGE_SCALE_MAX = 130;

function ScrollSpeedSlider() {
  const [speed, setSpeed] = useSetting(settingsAtom, 'phoneScrollSpeed');
  const native = speed >= PHONE_SCROLL_NATIVE;

  return (
    <Box alignItems="Center" gap="300">
      <Text size="T200" priority="300">
        Calm
      </Text>
      <input
        type="range"
        aria-label="Scroll speed"
        min={1}
        max={PHONE_SCROLL_NATIVE}
        step={1}
        value={speed}
        onChange={(evt) => setSpeed(parseInt(evt.target.value, 10))}
        style={{ flexGrow: 1, accentColor: color.Primary.Main }}
      />
      <Text size="T200" priority="300">
        Fast
      </Text>
      <Text size="T300" style={{ minWidth: toRem(52), textAlign: 'right' }}>
        {native ? 'Native' : speed}
      </Text>
    </Box>
  );
}

// Phones: one slider for chat text, avatars and the message box, with a live preview.
function MessageSizeSlider() {
  const [scale, setScale] = useSetting(settingsAtom, 'phoneMessageScale');

  return (
    <Box direction="Column" gap="300">
      <Box alignItems="Center" gap="300">
        <Text size="T200" priority="300">
          A
        </Text>
        <input
          type="range"
          aria-label="Message size"
          min={MESSAGE_SCALE_MIN}
          max={MESSAGE_SCALE_MAX}
          step={5}
          value={scale}
          onChange={(evt) => setScale(parseInt(evt.target.value, 10))}
          style={{ flexGrow: 1, accentColor: color.Primary.Main }}
        />
        <Text size="H4" priority="300">
          A
        </Text>
        <Text size="T300" style={{ minWidth: toRem(44), textAlign: 'right' }}>
          {`${scale}%`}
        </Text>
      </Box>
      <Text
        style={{
          fontSize: `calc(17px * ${scale / 100})`,
          lineHeight: 1.45,
          padding: config.space.S300,
          borderRadius: config.radii.R300,
          background: color.Background.Container,
        }}
      >
        This is how messages will look.
      </Text>
      {scale !== 100 && (
        <Button
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="300"
          onClick={() => setScale(100)}
          style={{ alignSelf: 'flex-start' }}
        >
          <Text size="B300">Reset</Text>
        </Button>
      )}
    </Box>
  );
}

function AccentColorPicker() {
  const [accentColor, setAccentColor] = useSetting(settingsAtom, 'accentColor');
  const current = accentColor ?? ACCENT_PRESETS[0].value;
  const isPreset = ACCENT_PRESETS.some((p) => p.value.toLowerCase() === current.toLowerCase());

  const swatch = (value: string, selected: boolean): React.CSSProperties => ({
    width: toRem(28),
    height: toRem(28),
    borderRadius: '50%',
    background: value,
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    outline: selected ? `2px solid ${color.Surface.OnContainer}` : 'none',
    outlineOffset: toRem(2),
  });

  return (
    <Box gap="200" alignItems="Center" wrap="Wrap">
      {ACCENT_PRESETS.map((preset) => {
        const selected = preset.value.toLowerCase() === current.toLowerCase();
        return (
          <button
            key={preset.value}
            type="button"
            title={preset.name}
            aria-label={`${preset.name} accent`}
            aria-pressed={selected}
            style={swatch(preset.value, selected)}
            // The first preset is the theme's own color, so picking it clears the override.
            onClick={() => setAccentColor(preset === ACCENT_PRESETS[0] ? undefined : preset.value)}
          />
        );
      })}
      <Box
        as="label"
        title="Custom color"
        alignItems="Center"
        justifyContent="Center"
        style={{
          ...swatch(isPreset ? color.SurfaceVariant.ContainerActive : current, !isPreset),
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isPreset && <Icon size="100" src={Icons.Plus} />}
        <input
          type="color"
          aria-label="Custom accent color"
          value={isHexColor(current) ? current : '#ff6b3d'}
          onChange={(evt) => setAccentColor(evt.currentTarget.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </Box>
    </Box>
  );
}

function Appearance() {
  const phone = usePhone();
  const [systemTheme, setSystemTheme] = useSetting(settingsAtom, 'useSystemTheme');
  const [monochromeMode, setMonochromeMode] = useSetting(settingsAtom, 'monochromeMode');
  const [twitterEmoji, setTwitterEmoji] = useSetting(settingsAtom, 'twitterEmoji');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Appearance</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="System Theme"
          description="Choose between light and dark theme based on system preference."
          after={<Switch variant="Primary" value={systemTheme} onChange={setSystemTheme} />}
        />
        {systemTheme && <SystemThemePreferences />}
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Theme"
          description="Theme to use when system theme is not enabled."
          after={<SelectTheme disabled={systemTheme} />}
        />
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Accent Color"
          description="Buttons, highlights and links. Works with every theme."
        >
          <AccentColorPicker />
        </SettingTile>
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Monochrome Mode"
          after={<Switch variant="Primary" value={monochromeMode} onChange={setMonochromeMode} />}
        />
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Twitter Emoji"
          after={<Switch variant="Primary" value={twitterEmoji} onChange={setTwitterEmoji} />}
        />
      </SequenceCard>

      {phone && (
        <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
          <SettingTile title="Message Size" description="Chat text, avatars and the message box.">
            <MessageSizeSlider />
          </SettingTile>
          <SettingTile
            title="Scroll Speed"
            description="How far a quick swipe carries chats and lists. The last step is your phone's own scrolling."
          >
            <ScrollSpeedSlider />
          </SettingTile>
        </SequenceCard>
      )}

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile title="Page Zoom" after={<PageZoomInput />} />
      </SequenceCard>
    </Box>
  );
}

type DateHintProps = {
  hasChanges: boolean;
  handleReset: () => void;
};
function DateHint({ hasChanges, handleReset }: DateHintProps) {
  const [anchor, setAnchor] = useState<RectCords>();
  const categoryPadding = { padding: config.space.S200, paddingTop: 0 };

  const handleOpenMenu: MouseEventHandler<HTMLElement> = (evt) => {
    setAnchor(evt.currentTarget.getBoundingClientRect());
  };
  return (
    <PopOut
      anchor={anchor}
      position="Top"
      align="End"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setAnchor(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <Header size="300" style={{ padding: `0 ${config.space.S200}` }}>
              <Text size="L400">Formatting</Text>
            </Header>

            <Box direction="Column">
              <Box style={categoryPadding} direction="Column">
                <Header size="300">
                  <Text size="L400">Year</Text>
                </Header>
                <Box direction="Column" tabIndex={0} gap="100">
                  <Text size="T300">
                    YY
                    <Text as="span" size="Inherit" priority="300">
                      {': '}
                      Two-digit year
                    </Text>{' '}
                  </Text>
                  <Text size="T300">
                    YYYY
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Four-digit year
                    </Text>
                  </Text>
                </Box>
              </Box>

              <Box style={categoryPadding} direction="Column">
                <Header size="300">
                  <Text size="L400">Month</Text>
                </Header>
                <Box direction="Column" tabIndex={0} gap="100">
                  <Text size="T300">
                    M
                    <Text as="span" size="Inherit" priority="300">
                      {': '}The month
                    </Text>
                  </Text>
                  <Text size="T300">
                    MM
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Two-digit month
                    </Text>{' '}
                  </Text>
                  <Text size="T300">
                    MMM
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Short month name
                    </Text>
                  </Text>
                  <Text size="T300">
                    MMMM
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Full month name
                    </Text>
                  </Text>
                </Box>
              </Box>

              <Box style={categoryPadding} direction="Column">
                <Header size="300">
                  <Text size="L400">Day of the Month</Text>
                </Header>
                <Box direction="Column" tabIndex={0} gap="100">
                  <Text size="T300">
                    D
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Day of the month
                    </Text>
                  </Text>
                  <Text size="T300">
                    DD
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Two-digit day of the month
                    </Text>
                  </Text>
                </Box>
              </Box>
              <Box style={categoryPadding} direction="Column">
                <Header size="300">
                  <Text size="L400">Day of the Week</Text>
                </Header>
                <Box direction="Column" tabIndex={0} gap="100">
                  <Text size="T300">
                    d
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Day of the week (Sunday = 0)
                    </Text>
                  </Text>
                  <Text size="T300">
                    dd
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Two-letter day name
                    </Text>
                  </Text>
                  <Text size="T300">
                    ddd
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Short day name
                    </Text>
                  </Text>
                  <Text size="T300">
                    dddd
                    <Text as="span" size="Inherit" priority="300">
                      {': '}Full day name
                    </Text>
                  </Text>
                </Box>
              </Box>
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      {hasChanges ? (
        <IconButton
          tabIndex={-1}
          onClick={handleReset}
          type="reset"
          variant="Secondary"
          size="300"
          radii="300"
        >
          <Icon src={Icons.Cross} size="100" />
        </IconButton>
      ) : (
        <IconButton
          tabIndex={-1}
          onClick={handleOpenMenu}
          type="button"
          variant="Secondary"
          size="300"
          radii="300"
          aria-pressed={!!anchor}
        >
          <Icon style={{ opacity: config.opacity.P300 }} size="100" src={Icons.Info} />
        </IconButton>
      )}
    </PopOut>
  );
}

type CustomDateFormatProps = {
  value: string;
  onChange: (format: string) => void;
};
function CustomDateFormat({ value, onChange }: CustomDateFormatProps) {
  const [dateFormatCustom, setDateFormatCustom] = useState(value);

  useEffect(() => {
    setDateFormatCustom(value);
  }, [value]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    const format = evt.currentTarget.value;
    setDateFormatCustom(format);
  };

  const handleReset = () => {
    setDateFormatCustom(value);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();

    const target = evt.target as HTMLFormElement | undefined;
    const customDateFormatInput = target?.customDateFormatInput as HTMLInputElement | undefined;
    const format = customDateFormatInput?.value;
    if (!format) return;

    onChange(format);
  };

  const hasChanges = dateFormatCustom !== value;
  return (
    <SettingTile>
      <Box as="form" onSubmit={handleSubmit} gap="200">
        <Box grow="Yes" direction="Column">
          <Input
            required
            name="customDateFormatInput"
            value={dateFormatCustom}
            onChange={handleChange}
            maxLength={16}
            autoComplete="off"
            variant="Secondary"
            radii="300"
            style={{ paddingRight: config.space.S200 }}
            after={<DateHint hasChanges={hasChanges} handleReset={handleReset} />}
          />
        </Box>
        <Button
          size="400"
          variant={hasChanges ? 'Success' : 'Secondary'}
          fill={hasChanges ? 'Solid' : 'Soft'}
          outlined
          radii="300"
          disabled={!hasChanges}
          type="submit"
        >
          <Text size="B400">Save</Text>
        </Button>
      </Box>
    </SettingTile>
  );
}

type PresetDateFormatProps = {
  value: string;
  onChange: (format: string) => void;
};
function PresetDateFormat({ value, onChange }: PresetDateFormatProps) {
  const [menuCords, setMenuCords] = useState<RectCords>();
  const dateFormatItems = useDateFormatItems();

  const getDisplayDate = (format: string): string =>
    format !== '' ? dayjs().format(format) : 'Custom';

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelect = (format: DateFormat) => {
    onChange(format);
    setMenuCords(undefined);
  };

  return (
    <>
      <Button
        size="300"
        variant="Secondary"
        outlined
        fill="Soft"
        radii="300"
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={handleMenu}
      >
        <Text size="T300">
          {getDisplayDate(dateFormatItems.find((i) => i.format === value)?.format ?? value)}
        </Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {dateFormatItems.map((item) => (
                  <MenuItem
                    key={item.format}
                    size="300"
                    variant={value === item.format ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => handleSelect(item.format)}
                  >
                    <Text size="T300">{getDisplayDate(item.format)}</Text>
                  </MenuItem>
                ))}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}

function SelectDateFormat() {
  const [dateFormatString, setDateFormatString] = useSetting(settingsAtom, 'dateFormatString');
  const [selectedDateFormat, setSelectedDateFormat] = useState(dateFormatString);
  const customDateFormat = selectedDateFormat === '';

  const handlePresetChange = (format: string) => {
    setSelectedDateFormat(format);
    if (format !== '') {
      setDateFormatString(format);
    }
  };

  return (
    <>
      <SettingTile
        title="Date Format"
        description={customDateFormat ? dayjs().format(dateFormatString) : ''}
        after={<PresetDateFormat value={selectedDateFormat} onChange={handlePresetChange} />}
      />
      {customDateFormat && (
        <CustomDateFormat value={dateFormatString} onChange={setDateFormatString} />
      )}
    </>
  );
}

function DateAndTime() {
  const [hour24Clock, setHour24Clock] = useSetting(settingsAtom, 'hour24Clock');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Date & Time</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="24-Hour Time Format"
          after={<Switch variant="Primary" value={hour24Clock} onChange={setHour24Clock} />}
        />
      </SequenceCard>

      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SelectDateFormat />
      </SequenceCard>
    </Box>
  );
}

function Editor() {
  const [enterForNewline, setEnterForNewline] = useSetting(settingsAtom, 'enterForNewline');
  const [isMarkdown, setIsMarkdown] = useSetting(settingsAtom, 'isMarkdown');
  const [hideActivity, setHideActivity] = useSetting(settingsAtom, 'hideActivity');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Editor</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="ENTER for Newline"
          description={`Use ${
            isMacOS() ? KeySymbol.Command : 'Ctrl'
          } + ENTER to send message and ENTER for newline.`}
          after={<Switch variant="Primary" value={enterForNewline} onChange={setEnterForNewline} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Markdown Formatting"
          after={<Switch variant="Primary" value={isMarkdown} onChange={setIsMarkdown} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Hide Typing & Read Receipts"
          description="Turn off both typing status and read receipts to keep your activity private."
          after={<Switch variant="Primary" value={hideActivity} onChange={setHideActivity} />}
        />
      </SequenceCard>
    </Box>
  );
}

function SelectMessageLayout() {
  const [menuCords, setMenuCords] = useState<RectCords>();
  const [messageLayout, setMessageLayout] = useSetting(settingsAtom, 'messageLayout');
  const messageLayoutItems = useMessageLayoutItems();

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelect = (layout: MessageLayout) => {
    setMessageLayout(layout);
    setMenuCords(undefined);
  };

  return (
    <>
      <Button
        size="300"
        variant="Secondary"
        outlined
        fill="Soft"
        radii="300"
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={handleMenu}
      >
        <Text size="T300">
          {messageLayoutItems.find((i) => i.layout === messageLayout)?.name ?? messageLayout}
        </Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {messageLayoutItems.map((item) => (
                  <MenuItem
                    key={item.layout}
                    size="300"
                    variant={messageLayout === item.layout ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => handleSelect(item.layout)}
                  >
                    <Text size="T300">{item.name}</Text>
                  </MenuItem>
                ))}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}

function SelectMessageSpacing() {
  const [menuCords, setMenuCords] = useState<RectCords>();
  const [messageSpacing, setMessageSpacing] = useSetting(settingsAtom, 'messageSpacing');
  const messageSpacingItems = useMessageSpacingItems();

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  const handleSelect = (layout: MessageSpacing) => {
    setMessageSpacing(layout);
    setMenuCords(undefined);
  };

  return (
    <>
      <Button
        size="300"
        variant="Secondary"
        outlined
        fill="Soft"
        radii="300"
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={handleMenu}
      >
        <Text size="T300">
          {messageSpacingItems.find((i) => i.spacing === messageSpacing)?.name ?? messageSpacing}
        </Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {messageSpacingItems.map((item) => (
                  <MenuItem
                    key={item.spacing}
                    size="300"
                    variant={messageSpacing === item.spacing ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => handleSelect(item.spacing)}
                  >
                    <Text size="T300">{item.name}</Text>
                  </MenuItem>
                ))}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}

function Messages() {
  const [legacyUsernameColor, setLegacyUsernameColor] = useSetting(
    settingsAtom,
    'legacyUsernameColor'
  );
  const [hideJoinLeaveEvents, setHideJoinLeaveEvents] = useSetting(
    settingsAtom,
    'hideJoinLeaveEvents'
  );
  const [hideNickAvatarEvents, setHideNickAvatarEvents] = useSetting(
    settingsAtom,
    'hideNickAvatarEvents'
  );
  const [mediaAutoLoad, setMediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview, setUrlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview, setEncUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const [showHiddenEvents, setShowHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Messages</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile title="Message Layout" after={<SelectMessageLayout />} />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile title="Message Spacing" after={<SelectMessageSpacing />} />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Legacy Username Color"
          after={
            <Switch
              variant="Primary"
              value={legacyUsernameColor}
              onChange={setLegacyUsernameColor}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Hide Joins & Leaves"
          description="Kicks, bans and invites always show."
          after={
            <Switch
              variant="Primary"
              value={hideJoinLeaveEvents}
              onChange={setHideJoinLeaveEvents}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Hide Profile Change"
          after={
            <Switch
              variant="Primary"
              value={hideNickAvatarEvents}
              onChange={setHideNickAvatarEvents}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Disable Media Auto Load"
          after={
            <Switch
              variant="Primary"
              value={!mediaAutoLoad}
              onChange={(v) => setMediaAutoLoad(!v)}
            />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Url Preview"
          after={<Switch variant="Primary" value={urlPreview} onChange={setUrlPreview} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Url Preview in Encrypted Room"
          after={<Switch variant="Primary" value={encUrlPreview} onChange={setEncUrlPreview} />}
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Show Hidden Events"
          after={
            <Switch variant="Primary" value={showHiddenEvents} onChange={setShowHiddenEvents} />
          }
        />
      </SequenceCard>
    </Box>
  );
}

type GeneralProps = {
  requestClose: () => void;
};
export function General({ requestClose }: GeneralProps) {
  return (
    <Page>
      <SettingsPageHeader title="General" requestClose={requestClose} />
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Appearance />
              <DateAndTime />
              <Editor />
              <Messages />
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
