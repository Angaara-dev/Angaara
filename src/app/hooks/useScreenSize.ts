import { createContext, useCallback, useContext, useState } from 'react';
import { useElementSizeObserver } from './useElementSizeObserver';

export const TABLET_BREAKPOINT = 1124;
export const MOBILE_BREAKPOINT = 750;

export enum ScreenSize {
  Desktop = 'Desktop',
  Tablet = 'Tablet',
  Mobile = 'Mobile',
}

// Without a touch screen, narrow windows keep the side-by-side PC layout down to this width.
const PC_MOBILE_BREAKPOINT = 480;
const hasCoarsePointer = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

export const getScreenSize = (width: number): ScreenSize => {
  if (width > TABLET_BREAKPOINT) return ScreenSize.Desktop;
  const mobileBelow = hasCoarsePointer() ? MOBILE_BREAKPOINT : PC_MOBILE_BREAKPOINT;
  if (width > mobileBelow) return ScreenSize.Tablet;
  return ScreenSize.Mobile;
};

export const useScreenSize = (): ScreenSize => {
  const [size, setSize] = useState<ScreenSize>(getScreenSize(document.body.clientWidth));

  useElementSizeObserver(
    useCallback(() => document.body, []),
    useCallback((width) => setSize(getScreenSize(width)), [])
  );

  return size;
};

const ScreenSizeContext = createContext<ScreenSize | null>(null);
export const ScreenSizeProvider = ScreenSizeContext.Provider;

export const useScreenSizeContext = (): ScreenSize => {
  const screenSize = useContext(ScreenSizeContext);
  if (screenSize === null) {
    throw new Error('Screen size not provided!');
  }
  return screenSize;
};

// A real phone: narrow screen plus a touch (coarse) pointer. Narrow PC windows keep the PC look.
export const PHONE_MEDIA = `screen and (max-width: ${MOBILE_BREAKPOINT}px) and (pointer: coarse)`;
export const usePhone = (): boolean =>
  useScreenSizeContext() === ScreenSize.Mobile && hasCoarsePointer();
