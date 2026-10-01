import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { Box, color, Icon, Icons, Text } from 'folds';
import { noCameraNoticeAtom } from '../../state/callEmbed';
import { Toast } from '../../pages/client/SyncStatus.css';

const SHOWN_FOR_MS = 3500;

export function NoCameraNotice() {
  const [shown, setShown] = useAtom(noCameraNoticeAtom);

  useEffect(() => {
    if (!shown) return undefined;
    const timer = window.setTimeout(() => setShown(false), SHOWN_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [shown, setShown]);

  if (!shown) return null;
  return (
    <Box
      role="status"
      className={Toast}
      alignItems="Center"
      gap="200"
      style={{ background: color.Surface.ContainerActive, color: color.Surface.OnContainer }}
    >
      <Icon size="100" src={Icons.VideoCameraMute} />
      <Text size="L400" style={{ fontWeight: 600 }}>
        You have no camera connected
      </Text>
    </Box>
  );
}
