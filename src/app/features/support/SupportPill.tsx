import React from 'react';
import { useSetAtom } from 'jotai';
import { Box, Icon, Icons, Text } from 'folds';
import { userSettingsPageAtom } from '../settings/UserSettingsRenderer';
import { SettingsPages } from '../settings';
import * as css from './SupportPill.css';

export function SupportPill() {
  const openSettings = useSetAtom(userSettingsPageAtom);
  return (
    <button
      type="button"
      className={css.SupportPill}
      onClick={() => openSettings(SettingsPages.AboutPage)}
    >
      <Text as="span" size="T200" aria-hidden>
        🔥
      </Text>
      <Box grow="Yes" style={{ minWidth: 0, textAlign: 'left' }}>
        <Text as="span" size="T200" truncate style={{ fontWeight: 600 }}>
          Support us
        </Text>
      </Box>
      <Icon size="50" src={Icons.ChevronRight} />
    </button>
  );
}
