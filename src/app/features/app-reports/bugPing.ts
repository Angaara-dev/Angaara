import { useEffect, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useClientConfig } from '../../hooks/useClientConfig';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import {
  atomWithLocalStorage,
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../state/utils/atomWithLocalStorage';
import { BugReport, listBugReports } from './reports';

// Only decides what to show; the Worker checks the badge itself on every request.
export const useIsAppDeveloper = (): boolean => {
  const mx = useMatrixClient();
  const { badges } = useClientConfig();
  return !!badges?.[mx.getSafeUserId()]?.includes('developer');
};

// The newest bug report this device has shown; anything newer gets a red badge.
const bugsSeenAtom = atomWithLocalStorage<number>(
  'angaaraBugsSeen',
  (key) => getLocalStorageItem(key, 0),
  setLocalStorageItem
);

export const BUG_REPORTS_KEY = ['bug-reports'];

// Unseen bug reports, for developers only; checks every two minutes.
export const useNewBugReports = (): number => {
  const mx = useMatrixClient();
  const dev = useIsAppDeveloper();
  const [privateMode] = useSetting(settingsAtom, 'privateMode');
  const seen = useAtomValue(bugsSeenAtom);
  const { data } = useQuery({
    queryKey: BUG_REPORTS_KEY,
    queryFn: () => listBugReports(mx),
    enabled: dev && !privateMode,
    refetchInterval: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
  return data?.filter((r) => r.id > seen && !r.archivedAt).length ?? 0;
};

// Clears the badge once the list is shown, and returns what was seen before, to mark "New".
export const useMarkBugsSeen = (reports: BugReport[] | undefined): number => {
  const [seen, setSeen] = useAtom(bugsSeenAtom);
  const [seenBefore] = useState(seen);
  useEffect(() => {
    const newest = Math.max(0, ...(reports ?? []).map((r) => r.id));
    if (newest > seen) setSeen(newest);
  }, [reports, seen, setSeen]);
  return seenBefore;
};
