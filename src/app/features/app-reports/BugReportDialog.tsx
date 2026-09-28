import React, { FormEventHandler, MouseEventHandler, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Menu,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  RectCords,
  Spinner,
  Text,
  TextArea,
  color,
  config,
  toRem,
} from 'folds';
import { stopPropagation } from '../../utils/keyboard';
import { BUG_TYPES, BugType, bugTypeLabel, sendBugReport } from './reports';
import { MarkdownText } from './MarkdownText';

const MAX_TITLE = 120;
const MAX_BODY = 5000;

function TypePicker({ value, onChange }: { value?: BugType; onChange: (type: BugType) => void }) {
  const [anchor, setAnchor] = useState<RectCords>();
  const open: MouseEventHandler<HTMLButtonElement> = (evt) =>
    setAnchor(evt.currentTarget.getBoundingClientRect());

  return (
    <PopOut
      anchor={anchor}
      position="Bottom"
      align="Start"
      offset={4}
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            returnFocusOnDeactivate: false,
            onDeactivate: () => setAnchor(undefined),
            clickOutsideDeactivates: true,
            isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
            isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu style={{ padding: config.space.S100, minWidth: toRem(240) }}>
            {BUG_TYPES.map((type) => (
              <MenuItem
                key={type.key}
                type="button"
                size="300"
                radii="300"
                aria-pressed={value === type.key}
                onClick={() => {
                  onChange(type.key);
                  setAnchor(undefined);
                }}
              >
                <Text size="T300">{type.label}</Text>
              </MenuItem>
            ))}
          </Menu>
        </FocusTrap>
      }
    >
      <Button
        type="button"
        variant="Secondary"
        fill="Soft"
        radii="300"
        size="400"
        onClick={open}
        aria-pressed={!!anchor}
        after={<Icon size="100" src={Icons.ChevronBottom} />}
        style={{ justifyContent: 'space-between' }}
      >
        <Text size="B400" priority={value ? '400' : '300'}>
          {value ? bugTypeLabel(value) : 'Pick a type'}
        </Text>
      </Button>
    </PopOut>
  );
}

// Anonymous bug reports; they land in the developers' User Bug Reports page.
export function BugReportDialog({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<BugType>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  const ready = !!type && !!title.trim() && !!body.trim();

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (evt) => {
    evt.preventDefault();
    if (!type || !ready || sending) return;
    setSending(true);
    setError(undefined);
    try {
      await sendBugReport(type, title, body);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the report.");
    }
    setSending(false);
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: onClose,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface" style={{ width: `min(${toRem(520)}, 100%)` }}>
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">Report a Bug</Text>
              </Box>
              <IconButton size="300" onClick={onClose} radii="300" aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            {sent ? (
              <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
                <Text size="T300">Thanks! The developers got your report. 🔥</Text>
                <Button onClick={onClose}>
                  <Text size="B400">Done</Text>
                </Button>
              </Box>
            ) : (
              <Box
                as="form"
                onSubmit={handleSubmit}
                style={{ padding: config.space.S400, maxHeight: '80vh', overflowY: 'auto' }}
                direction="Column"
                gap="400"
              >
                <Text size="T200" priority="300">
                  Anonymous: your account, user ID and rooms aren&apos;t sent. Only what you write
                  here, the app version and your browser.
                </Text>
                <Box direction="Column" gap="100">
                  <Text size="L400">Type</Text>
                  <TypePicker value={type} onChange={setType} />
                </Box>
                <Box direction="Column" gap="100">
                  <Text size="L400">Title</Text>
                  <Input
                    variant="Background"
                    radii="300"
                    size="400"
                    maxLength={MAX_TITLE}
                    placeholder="Short summary of the bug"
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  />
                </Box>
                <Box direction="Column" gap="100">
                  <Box alignItems="Center" gap="200">
                    <Text size="L400" style={{ flexGrow: 1 }}>
                      What happened?
                    </Text>
                    <Chip
                      type="button"
                      radii="Pill"
                      variant={preview ? 'SurfaceVariant' : 'Primary'}
                      aria-pressed={!preview}
                      onClick={() => setPreview(false)}
                    >
                      <Text size="B300">Write</Text>
                    </Chip>
                    <Chip
                      type="button"
                      radii="Pill"
                      variant={preview ? 'Primary' : 'SurfaceVariant'}
                      aria-pressed={preview}
                      onClick={() => setPreview(true)}
                    >
                      <Text size="B300">Preview</Text>
                    </Chip>
                  </Box>
                  {preview ? (
                    <Box
                      direction="Column"
                      style={{
                        minHeight: toRem(150),
                        padding: config.space.S300,
                        borderRadius: config.radii.R300,
                        background: color.Background.Container,
                      }}
                    >
                      {body.trim() ? (
                        <MarkdownText text={body} />
                      ) : (
                        <Text size="T300" priority="300">
                          Nothing to preview yet.
                        </Text>
                      )}
                    </Box>
                  ) : (
                    <TextArea
                      variant="Background"
                      radii="300"
                      rows={7}
                      maxLength={MAX_BODY}
                      placeholder={
                        'Steps to reproduce, what you expected, what happened instead.\nMarkdown works: **bold**, `code`, - lists, > quotes'
                      }
                      value={body}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setBody(e.target.value)
                      }
                    />
                  )}
                  <Text size="T200" priority="300" align="Right">
                    {`${body.length} / ${MAX_BODY}`}
                  </Text>
                </Box>
                {error && (
                  <Text size="T200" style={{ color: color.Critical.Main }}>
                    {error}
                  </Text>
                )}
                <Button
                  type="submit"
                  variant="Primary"
                  disabled={!ready || sending}
                  before={sending && <Spinner size="100" variant="Primary" fill="Solid" />}
                >
                  <Text size="B400">Send Report</Text>
                </Button>
              </Box>
            )}
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
