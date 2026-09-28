import React, { useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Dialog,
  Header,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Spinner,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { stopPropagation } from '../../utils/keyboard';
import { themeBackdrop } from '../../styles/themeBackdrop';
import { bytesToSize } from '../../utils/common';
import { isPrivateMode } from '../../utils/privateMode';
import { FileReport } from './fileCheck';
import {
  clearFileScans,
  FileScan,
  removeFileScan,
  useFileScans,
  useScansSynced,
} from './fileScans';
import { quotaText } from './linkCheck';
import { LinkCheckDialog, VERDICTS } from './LinkCheck';

const monospace = { overflowWrap: 'anywhere', fontFamily: 'monospace' } as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{title}</Text>
      {children}
    </Box>
  );
}

function Report({ report }: { report: FileReport }) {
  const [checking, setChecking] = useState<string>();
  const verdict = VERDICTS[report.verdict];
  let listLine = "The known-malware list wasn't checked (private mode is on).";
  if (report.listed === false) listLine = "It isn't on MalwareBazaar's list of known malware.";
  else if (report.listed === undefined && report.lookupNote) listLine = report.lookupNote;
  else if (report.listed === undefined && !isPrivateMode()) {
    listLine = "The known-malware list isn't set up on this server.";
  }
  return (
    <Box direction="Column" gap="300">
      <Box
        alignItems="Center"
        gap="200"
        style={{
          padding: config.space.S300,
          borderRadius: config.radii.R400,
          color: verdict.tone,
          background: `color-mix(in srgb, ${verdict.tone} 14%, transparent)`,
        }}
      >
        <Icon src={verdict.icon} size="200" filled />
        <Text size="H5">{verdict.title}</Text>
      </Box>
      {report.findings.length > 0 && (
        <Box as="ul" direction="Column" gap="100" style={{ margin: 0, paddingLeft: '1.2em' }}>
          {report.findings.map((f) => (
            <Text
              as="li"
              key={f.text}
              size="T300"
              style={{ color: f.level === 'bad' ? color.Critical.Main : undefined }}
            >
              {f.text}
            </Text>
          ))}
        </Box>
      )}
      {report.behaviors.length > 0 && (
        <Section title="What it does">
          <Box as="ul" direction="Column" gap="100" style={{ margin: 0, paddingLeft: '1.2em' }}>
            {report.behaviors.map((b) => (
              <Text as="li" key={b} size="T300" style={{ overflowWrap: 'anywhere' }}>
                {b}
              </Text>
            ))}
          </Box>
        </Section>
      )}
      {report.commands.length > 0 && (
        <Section title="Hidden commands, decoded">
          {report.commands.map((c) => (
            <Text
              key={c}
              as="pre"
              size="T200"
              style={{
                ...monospace,
                margin: 0,
                padding: config.space.S200,
                borderRadius: config.radii.R300,
                background: color.SurfaceVariant.Container,
                whiteSpace: 'pre-wrap',
                maxHeight: toRem(160),
                overflowY: 'auto',
              }}
            >
              {c}
            </Text>
          ))}
        </Section>
      )}
      {report.links.length > 0 && (
        <Section title="Links inside">
          {report.links.map((url) => (
            <Box key={url} alignItems="Center" gap="200">
              <Text size="T200" style={{ ...monospace, flexGrow: 1, minWidth: 0 }} truncate>
                {url}
              </Text>
              <Button
                size="300"
                variant="Secondary"
                fill="Soft"
                radii="300"
                disabled={isPrivateMode()}
                onClick={() => setChecking(url)}
              >
                <Text size="B300">Check</Text>
              </Button>
            </Box>
          ))}
        </Section>
      )}
      <Box direction="Column" gap="100">
        <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
          {report.name} · {bytesToSize(report.size)}
          {report.kind ? ` · really a ${report.kind} file` : ''}
        </Text>
        {report.known && (
          <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
            It matches a published file, {report.known}, on CIRCL&apos;s list of known software.
          </Text>
        )}
        {report.listed !== true && (
          <Text size="T200" priority="300">
            {listLine}
          </Text>
        )}
        <Text size="T200" priority="300">
          {report.yara && "Checked against ReversingLabs' malware rules."}
          {!report.yara &&
            (report.size > 64 * 1024 * 1024
              ? "It's too big for ReversingLabs' malware rules (over 64 MB)."
              : "ReversingLabs' malware rules couldn't run on this file.")}
        </Text>
        {report.sha256 && (
          <Text size="T200" priority="300" style={monospace}>
            SHA-256 {report.sha256}
          </Text>
        )}
      </Box>
      <Text size="T200" priority="300">
        Checked on your device without opening the file. Only its fingerprint was looked up, never
        the file itself. It catches common tricks, not everything. {quotaText(report.quota)}
      </Text>
      {checking && <LinkCheckDialog url={checking} onClose={() => setChecking(undefined)} />}
    </Box>
  );
}

const verdictOf = (scan: FileScan) => (scan.report ? VERDICTS[scan.report.verdict] : undefined);

function Frame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
          {/* Takes the server theme, buttons included, like the rest of the app. */}
          <Dialog
            data-theme-wash
            variant="Surface"
            style={{ ...themeBackdrop('surface'), width: `min(${toRem(480)}, 100%)` }}
          >
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">{title}</Text>
              </Box>
              <IconButton size="300" onClick={onClose} radii="300" aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box
              direction="Column"
              gap="400"
              style={{ padding: config.space.S400, maxHeight: '75vh', overflowY: 'auto' }}
            >
              {children}
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

type FileCheckDialogProps = {
  scanId: string;
  onClose: () => void;
  // Only offered where the file itself is at hand, like a message.
  onRescan?: () => void;
};
// Shows one scan; closing it doesn't stop the scan, which carries on in the background.
export function FileCheckDialog({ scanId, onClose, onRescan }: FileCheckDialogProps) {
  const mx = useMatrixClient();
  const scan = useFileScans(mx).find((s) => s.id === scanId);

  return (
    <Frame title="File Check" onClose={onClose}>
      {!scan && (
        <Text size="T300" priority="300">
          This scan was removed.
        </Text>
      )}
      {scan?.status === 'scanning' && (
        <Box direction="Column" alignItems="Center" gap="300" style={{ padding: 24 }}>
          <Spinner variant="Secondary" size="400" />
          <Text size="T300" align="Center" style={{ overflowWrap: 'anywhere' }}>
            Scanning {scan.name}
          </Text>
          <Text size="T200" priority="300" align="Center">
            This happens on your device and big files can take a while. You can close this and keep
            chatting; the result shows up under Scanned Files in the sidebar.
          </Text>
        </Box>
      )}
      {scan?.status === 'failed' && (
        <Text size="T300" style={{ color: color.Critical.Main }}>
          {scan.error}
        </Text>
      )}
      {scan?.report && <Report report={scan.report} />}
      <Box gap="200">
        {scan?.status === 'scanning' && (
          <Button
            variant="Critical"
            fill="Soft"
            radii="300"
            size="400"
            onClick={() => {
              removeFileScan(scan.id);
              onClose();
            }}
            style={{ flexGrow: 1 }}
          >
            <Text size="B400">Cancel Scan</Text>
          </Button>
        )}
        {scan && scan.status !== 'scanning' && onRescan && (
          <Button
            variant="Secondary"
            fill="Soft"
            radii="300"
            size="400"
            onClick={onRescan}
            style={{ flexGrow: 1 }}
          >
            <Text size="B400">Scan Again</Text>
          </Button>
        )}
        <Button
          variant="Secondary"
          fill="Soft"
          radii="300"
          size="400"
          onClick={onClose}
          style={{ flexGrow: 1 }}
        >
          <Text size="B400">Close</Text>
        </Button>
      </Box>
    </Frame>
  );
}

function ScanRow({ scan, onOpen }: { scan: FileScan; onOpen: () => void }) {
  const verdict = verdictOf(scan);
  let status = 'Scanning…';
  if (verdict) status = verdict.title;
  else if (scan.status === 'failed') status = "Couldn't check it";
  return (
    <Box alignItems="Center" gap="200">
      <Box
        as="button"
        type="button"
        grow="Yes"
        alignItems="Center"
        gap="300"
        onClick={onOpen}
        style={{
          minWidth: 0,
          padding: config.space.S300,
          borderRadius: config.radii.R400,
          background: color.SurfaceVariant.Container,
          border: 'none',
          color: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {scan.status === 'scanning' ? (
          <Spinner variant="Secondary" size="200" />
        ) : (
          <Icon
            src={verdict?.icon ?? Icons.Warning}
            size="200"
            filled
            style={{ color: verdict?.tone ?? color.Critical.Main, flexShrink: 0 }}
          />
        )}
        <Box direction="Column" style={{ minWidth: 0 }}>
          <Text size="T300" truncate>
            <b>{scan.name}</b>
          </Text>
          <Text size="T200" priority="300" truncate>
            {status} · {new Date(scan.at).toLocaleString()}
          </Text>
        </Box>
      </Box>
      <IconButton
        size="300"
        radii="300"
        aria-label={scan.status === 'scanning' ? 'Cancel scan' : 'Remove'}
        onClick={() => removeFileScan(scan.id)}
      >
        <Icon size="100" src={Icons.Cross} />
      </IconButton>
    </Box>
  );
}

// Every file checked on this device, including scans still running in the background.
export function ScannedFilesDialog({ onClose }: { onClose: () => void }) {
  const mx = useMatrixClient();
  const scans = useFileScans(mx);
  const synced = useScansSynced();
  const [open, setOpen] = useState<string>();

  return (
    <Frame title="Scanned Files" onClose={onClose}>
      {scans.length === 0 ? (
        <Text size="T300" priority="300">
          Files you check show up here. Use the shield button next to any file in a chat.
        </Text>
      ) : (
        <Box direction="Column" gap="200">
          {scans.map((scan) => (
            <ScanRow key={scan.id} scan={scan} onOpen={() => setOpen(scan.id)} />
          ))}
        </Box>
      )}
      <Text size="T200" priority="300">
        {synced
          ? 'Synced to your devices through your Matrix account, encrypted so only you can read it.'
          : 'Kept on this device until your encrypted storage is set up, then synced to your devices.'}
      </Text>
      {scans.some((s) => s.status !== 'scanning') && (
        <Button variant="Secondary" fill="Soft" radii="300" size="400" onClick={clearFileScans}>
          <Text size="B400">Clear Finished Scans</Text>
        </Button>
      )}
      {open && <FileCheckDialog scanId={open} onClose={() => setOpen(undefined)} />}
    </Frame>
  );
}
