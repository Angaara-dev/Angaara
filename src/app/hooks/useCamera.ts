import { useCallback, useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import { noCameraNoticeAtom } from '../state/callEmbed';

const findCamera = async (): Promise<boolean> => {
  const devices = (await navigator.mediaDevices?.enumerateDevices().catch(() => [])) ?? [];
  return devices.some((d) => d.kind === 'videoinput');
};

// Whether a camera is plugged in; undefined until checked. Follows plugging in and out.
export const useHasCamera = (): boolean | undefined => {
  const [hasCamera, setHasCamera] = useState<boolean>();
  useEffect(() => {
    let alive = true;
    const check = () =>
      findCamera().then((found) => {
        if (alive) setHasCamera(found);
      });
    check();
    navigator.mediaDevices?.addEventListener('devicechange', check);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener('devicechange', check);
    };
  }, []);
  return hasCamera;
};

// Wraps a camera toggle: with no camera it says so instead of turning on.
export const useCameraToggle = (toggle: () => unknown, turningOn: boolean) => {
  const notify = useSetAtom(noCameraNoticeAtom);
  return useCallback(async () => {
    if (turningOn && !(await findCamera())) {
      notify(true);
      return;
    }
    await toggle();
  }, [toggle, turningOn, notify]);
};
