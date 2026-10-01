import React, { useEffect, useState } from 'react';
import { Box, Button, Icon, IconButton, Icons, Text, color, config, toRem } from 'folds';
import { trimTrailingSlash } from '../../utils/common';
import { buildId } from '../app-reports/reports';

const JUST_UPDATED = 'angaara.justUpdated';
const CHECK_EVERY = 10 * 60 * 1000;

// Set only by this notice's Reload button, so crash and automatic reloads never show it.
// It shows after the reload only if the build really changed.
const markUpdating = () => {
  try {
    sessionStorage.setItem(JUST_UPDATED, buildId());
  } catch {
    // Storage blocked
  }
};

const takeJustUpdated = (): boolean => {
  try {
    const from = sessionStorage.getItem(JUST_UPDATED);
    sessionStorage.removeItem(JUST_UPDATED);
    const current = buildId();
    return !!from && current !== 'dev' && from !== current;
  } catch {
    return false;
  }
};

const latestBuild = async (): Promise<string | undefined> => {
  const res = await fetch(`${trimTrailingSlash(import.meta.env.BASE_URL)}/`, { cache: 'no-store' });
  if (!res.ok) return undefined;
  const html = await res.text();
  return /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1]?.split('/').pop();
};

export function UpdateNotice() {
  const [justUpdated, setJustUpdated] = useState(takeJustUpdated);
  const [newBuild, setNewBuild] = useState<string>();
  const [dismissed, setDismissed] = useState<string>();

  useEffect(() => {
    if (!justUpdated) return undefined;
    const timer = window.setTimeout(() => setJustUpdated(false), 8000);
    return () => window.clearTimeout(timer);
  }, [justUpdated]);

  useEffect(() => {
    const current = buildId();
    if (current === 'dev') return undefined;
    let last = 0;
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 60 * 1000) return;
      last = Date.now();
      latestBuild()
        .then((latest) => {
          if (latest && latest !== current) setNewBuild(latest);
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(check, CHECK_EVERY);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  const outdated = !!newBuild && newBuild !== dismissed;
  if (!outdated && !justUpdated) return null;

  const reload = () => {
    markUpdating();
    window.location.reload();
  };

  return (
    <Box
      role="status"
      alignItems="Center"
      gap="300"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: config.space.S400,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: `min(${toRem(420)}, calc(100% - 32px))`,
        padding: `${config.space.S300} ${config.space.S300} ${config.space.S300} ${config.space.S400}`,
        borderRadius: config.radii.R400,
        background: `var(--angaara-theme-menu, ${color.Surface.Container})`,
        color: color.Surface.OnContainer,
        border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
      }}
    >
      <Box direction="Column" grow="Yes" style={{ minWidth: 0 }}>
        <Text size="H6">
          {outdated ? '✨ A new version of Angaara is out' : '✨ Angaara has been updated'}
        </Text>
        <Text size="T200" priority="300">
          {outdated ? 'Reload to get the newest version.' : "You're on the newest version."}
        </Text>
      </Box>
      {outdated ? (
        <>
          <Button size="300" variant="Primary" radii="300" onClick={reload}>
            <Text size="B300">Reload</Text>
          </Button>
          <IconButton
            size="300"
            radii="300"
            aria-label="Later"
            onClick={() => setDismissed(newBuild)}
          >
            <Icon size="100" src={Icons.Cross} />
          </IconButton>
        </>
      ) : (
        <IconButton size="300" radii="300" aria-label="Close" onClick={() => setJustUpdated(false)}>
          <Icon size="100" src={Icons.Cross} />
        </IconButton>
      )}
    </Box>
  );
}
