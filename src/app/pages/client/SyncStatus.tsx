import { MatrixClient, SyncState } from 'matrix-js-sdk';
import React, { useCallback, useEffect, useState } from 'react';
import { Text } from 'folds';
import { useSyncState } from '../../hooks/useSyncState';
import * as css from './SyncStatus.css';

// Short drops that recover on their own aren't worth a pop-up.
const LOST_AFTER_MS = 2000;
const CONNECTED_FOR_MS = 3000;

type Shown = 'lost' | 'back' | undefined;

type SyncStatusProps = {
  mx: MatrixClient;
};
export function SyncStatus({ mx }: SyncStatusProps) {
  const [lost, setLost] = useState(false);
  const [shown, setShown] = useState<Shown>();

  useSyncState(
    mx,
    useCallback((current) => {
      if (current === SyncState.Reconnecting || current === SyncState.Error) setLost(true);
      if (current === SyncState.Syncing || current === SyncState.Prepared) setLost(false);
    }, [])
  );

  useEffect(() => {
    if (lost) {
      const timer = window.setTimeout(() => setShown('lost'), LOST_AFTER_MS);
      return () => window.clearTimeout(timer);
    }
    // Only say we're back if we said we were gone.
    setShown((s) => (s === 'lost' ? 'back' : s));
    return undefined;
  }, [lost]);

  useEffect(() => {
    if (shown !== 'back') return undefined;
    const timer = window.setTimeout(() => setShown(undefined), CONNECTED_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  return (
    <div key={shown} role="status" className={`${css.Toast} ${css.ToastColor[shown]}`}>
      <Text size="L400" style={{ fontWeight: 600 }}>
        {shown === 'lost' ? "You're disconnected" : "You're connected"}
      </Text>
    </div>
  );
}
