import { useEffect, useState } from 'react';

const firstFrame = async (url: string): Promise<Blob> => {
  const blob = await (await fetch(url)).blob();
  // createImageBitmap only decodes the first frame of an animated image.
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const still = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!still) throw new Error('Could not draw image');
  return still;
};

// The server's small still thumbnail of a media download URL; loads far faster than a big GIF.
const thumbnailOf = (url: string): string | undefined => {
  try {
    const u = new URL(url, window.location.href);
    if (!u.pathname.includes('/media/') || !u.pathname.includes('/download/')) return undefined;
    u.pathname = u.pathname.replace('/download/', '/thumbnail/');
    u.searchParams.set('width', '800');
    u.searchParams.set('height', '600');
    u.searchParams.set('method', 'scale');
    return u.href;
  } catch {
    return undefined;
  }
};

type LoadState = 'ok' | 'error';
// Remembered across mounts, so a list rebuilt after a swipe shows its images straight away.
const loadCache = new Map<string, LoadState>();

const useFirstFrame = (url: string | undefined): string | undefined => {
  const [still, setStill] = useState<{ src: string; url: string }>();

  useEffect(() => {
    if (!url) return undefined;
    let objectUrl: string | undefined;
    let alive = true;
    firstFrame(url)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setStill({ src: url, url: objectUrl });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return url && still?.src === url ? still.url : undefined;
};

export const useStillImage = (url: string | undefined, freeze: boolean): string | undefined => {
  const thumb = url ? thumbnailOf(url) : undefined;
  const [loaded, setLoaded] = useState<Record<string, LoadState>>({});

  useEffect(() => {
    const targets = [thumb, freeze ? undefined : url].filter((u): u is string => !!u);
    const images = targets.map((src) => {
      const img = new Image();
      const mark = (state: LoadState) => {
        loadCache.set(src, state);
        setLoaded((prev) => (prev[src] ? prev : { ...prev, [src]: state }));
      };
      img.onload = () => mark('ok');
      img.onerror = () => mark('error');
      img.src = src;
      return img;
    });
    return () =>
      images.forEach((img) => {
        /* eslint-disable no-param-reassign */
        img.onload = null;
        img.onerror = null;
        /* eslint-enable no-param-reassign */
      });
  }, [url, thumb, freeze]);

  const stateOf = (src: string) => loaded[src] ?? loadCache.get(src);
  const thumbFailed = !thumb || stateOf(thumb) === 'error';
  const frozen = useFirstFrame(freeze && thumbFailed ? url : undefined);

  if (!url) return undefined;
  if (!freeze && stateOf(url) === 'ok') return url;
  if (thumb && stateOf(thumb) === 'ok') return thumb;
  if (freeze) return frozen;
  return thumbFailed ? url : undefined;
};
