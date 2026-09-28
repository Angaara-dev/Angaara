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
  Menu,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  RectCords,
  Spinner,
  Text,
  color,
  config,
  toRem,
} from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { copyToClipboard } from '../../utils/dom';
import { stopPropagation } from '../../utils/keyboard';
import { isPrivateMode, PRIVATE_MODE_MESSAGE } from '../../utils/privateMode';
import { checkLink, LinkReport, quotaText } from './linkCheck';

export const VERDICTS = {
  ok: { title: 'No red flags found', tone: color.Success.Main, icon: Icons.Check },
  warn: { title: 'Be careful', tone: color.Warning.Main, icon: Icons.Warning },
  bad: { title: "Don't open this", tone: color.Critical.Main, icon: Icons.Warning },
};

const daysAgo = (ts: number) => Math.floor((Date.now() - ts) / 86400000);

function Report({ report }: { report: LinkReport }) {
  const verdict = VERDICTS[report.verdict];
  const redirected = report.hops.length > 1;
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
      <Box direction="Column" gap="100">
        <Text size="L400">{redirected ? 'Where it really goes' : 'Address'}</Text>
        <Text size="T200" style={{ overflowWrap: 'anywhere', fontFamily: 'monospace' }}>
          {report.finalUrl}
        </Text>
        {report.title && (
          <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
            Page title: {report.title}
          </Text>
        )}
        {report.registered && (
          <Text size="T200" priority="300">
            {report.domain} registered{' '}
            {new Date(report.registered).toLocaleDateString(undefined, { dateStyle: 'medium' })} (
            {daysAgo(report.registered).toLocaleString()} days ago)
          </Text>
        )}
      </Box>
      {redirected && (
        <Box direction="Column" gap="100">
          <Text size="L400">Redirects ({report.hops.length - 1})</Text>
          {report.hops.map((hop, i) => (
            <Text
              // Hops can repeat, so the position is part of the key.
              // eslint-disable-next-line react/no-array-index-key
              key={`${i}-${hop}`}
              size="T200"
              priority="300"
              style={{ overflowWrap: 'anywhere', fontFamily: 'monospace' }}
            >
              {i + 1}. {hop}
            </Text>
          ))}
        </Box>
      )}
      <Text size="T200" priority="300">
        Checked in a sandbox on Angaara&apos;s server without running the page. It catches common
        scams, not everything, so &quot;no red flags&quot; doesn&apos;t guarantee it&apos;s safe.
        {!report.malwareListChecked && ' The known-malware list wasn’t part of this check.'}{' '}
        {quotaText(report.quota)}
      </Text>
    </Box>
  );
}

function LinkCheckDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const mx = useMatrixClient();
  const [report, setReport] = useState<LinkReport>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    checkLink(mx, url)
      .then((r) => live && setReport(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't check this link."));
    return () => {
      live = false;
    };
  }, [mx, url]);

  const open = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
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
                <Text size="H4">Link Check</Text>
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
                    Opening the link in a sandbox…
                  </Text>
                  <Text size="T200" priority="300" style={{ overflowWrap: 'anywhere' }}>
                    {url}
                  </Text>
                </Box>
              )}
              {error && (
                <Text size="T300" style={{ color: color.Critical.Main }}>
                  {error}
                </Text>
              )}
              {report && <Report report={report} />}
              <Box gap="200">
                <Button
                  variant={report?.verdict === 'ok' ? 'Primary' : 'Critical'}
                  fill={report?.verdict === 'ok' ? 'Solid' : 'Soft'}
                  radii="300"
                  size="400"
                  onClick={open}
                  style={{ flexGrow: 1 }}
                >
                  <Text size="B400">{report?.verdict === 'ok' ? 'Open Link' : 'Open Anyway'}</Text>
                </Button>
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
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

// Right-clicking any web link in the app offers Open, Copy and Check.
export function LinkContextMenu() {
  const [menu, setMenu] = useState<{ url: string; anchor: RectCords }>();
  const [checking, setChecking] = useState<string>();

  useEffect(() => {
    const onContextMenu = (evt: MouseEvent) => {
      const link = (evt.target as Element | null)?.closest?.('a[href]');
      const href = link?.getAttribute('href');
      if (!href || !/^https?:\/\//i.test(href)) return;
      evt.preventDefault();
      setMenu({ url: href, anchor: { x: evt.clientX, y: evt.clientY, width: 0, height: 0 } });
    };
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);

  const close = () => setMenu(undefined);
  const privateMode = isPrivateMode();

  return (
    <>
      {menu && (
        <PopOut
          anchor={menu.anchor}
          position="Bottom"
          align="Start"
          content={
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                returnFocusOnDeactivate: false,
                onDeactivate: close,
                clickOutsideDeactivates: true,
                isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                escapeDeactivates: stopPropagation,
              }}
            >
              <Menu style={{ padding: config.space.S100, maxWidth: toRem(260) }}>
                <MenuItem
                  size="300"
                  radii="300"
                  before={<Icon size="100" src={Icons.Shield} />}
                  disabled={privateMode}
                  onClick={() => {
                    setChecking(menu.url);
                    close();
                  }}
                >
                  <Text size="T300">Check Link</Text>
                </MenuItem>
                <MenuItem
                  size="300"
                  radii="300"
                  before={<Icon size="100" src={Icons.External} />}
                  onClick={() => {
                    window.open(menu.url, '_blank', 'noopener,noreferrer');
                    close();
                  }}
                >
                  <Text size="T300">Open Link</Text>
                </MenuItem>
                <MenuItem
                  size="300"
                  radii="300"
                  before={<Icon size="100" src={Icons.Link} />}
                  onClick={() => {
                    copyToClipboard(menu.url);
                    close();
                  }}
                >
                  <Text size="T300">Copy Link</Text>
                </MenuItem>
                {privateMode && (
                  <Text size="T200" priority="300" style={{ padding: config.space.S200 }}>
                    {PRIVATE_MODE_MESSAGE}
                  </Text>
                )}
              </Menu>
            </FocusTrap>
          }
        />
      )}
      {checking && <LinkCheckDialog url={checking} onClose={() => setChecking(undefined)} />}
    </>
  );
}
