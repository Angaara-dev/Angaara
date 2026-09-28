import React, { useEffect, useState } from 'react';
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
import { bytesToSize } from '../../utils/common';
import { isPrivateMode } from '../../utils/privateMode';
import { checkFile, FileReport } from './fileCheck';
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
          {report.yara
            ? "Checked against ReversingLabs' malware rules."
            : "ReversingLabs' malware rules couldn't run on this file."}
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

type FileCheckDialogProps = {
  name: string;
  getFile: () => Promise<Blob>;
  onClose: () => void;
};
// Scans a file locally, and looks up its fingerprint unless private mode is on.
export function FileCheckDialog({ name, getFile, onClose }: FileCheckDialogProps) {
  const mx = useMatrixClient();
  const [report, setReport] = useState<FileReport>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    getFile()
      .then((blob) => checkFile(mx, name, blob, !isPrivateMode()))
      .then((r) => live && setReport(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't check this file."));
    return () => {
      live = false;
    };
  }, [mx, name, getFile]);

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
          <Dialog variant="Surface" style={{ width: `min(${toRem(480)}, 100%)` }}>
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">File Check</Text>
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
              {!report && !error && (
                <Box direction="Column" alignItems="Center" gap="300" style={{ padding: 24 }}>
                  <Spinner variant="Secondary" size="400" />
                  <Text size="T300" priority="300">
                    Scanning on your device. Big files can take a moment…
                  </Text>
                </Box>
              )}
              {error && (
                <Text size="T300" style={{ color: color.Critical.Main }}>
                  {error}
                </Text>
              )}
              {report && <Report report={report} />}
              <Button variant="Secondary" fill="Soft" radii="300" size="400" onClick={onClose}>
                <Text size="B400">Close</Text>
              </Button>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
