import { useEffect, useMemo } from 'react';

export const useObjectURL = (object?: Blob): string | undefined => {
  const url = useMemo(() => {
    if (object) return URL.createObjectURL(object);
    return undefined;
  }, [object]);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );

  return url;
};

// Frees a blob: URL made elsewhere once it's replaced or the component unmounts.
export const useRevokeObjectURL = (url?: string) => {
  useEffect(
    () => () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    },
    [url]
  );
};
