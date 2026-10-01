import React, { PointerEvent as ReactPointerEvent, ReactNode, useRef, useState } from 'react';
import { Box } from 'folds';
import { CallView } from '../call/CallView';
import * as css from './CallSplit.css';

const HEIGHT_KEY = 'angaara_call_split_height';
const MIN_CALL = 160;
const MIN_CHAT = 180;

const readHeight = (): number | undefined => {
  try {
    const v = Number(localStorage.getItem(HEIGHT_KEY));
    return v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
};

// A call on top of the chat in the same panel, with a bar to drag between them.
export function CallSplit({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(readHeight);

  const clamp = (h: number) => {
    const total = rootRef.current?.clientHeight ?? 0;
    return Math.max(MIN_CALL, Math.min(h, total - MIN_CHAT));
  };

  const startDrag = (evt: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    evt.preventDefault();
    const { top } = root.getBoundingClientRect();
    let last = height;
    // The call iframe would swallow pointer moves while dragging over it.
    document.body.style.setProperty('pointer-events', 'none');
    const move = (e: PointerEvent) => {
      last = clamp(e.clientY - top);
      setHeight(last);
    };
    const up = () => {
      document.body.style.removeProperty('pointer-events');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        if (last) localStorage.setItem(HEIGHT_KEY, String(Math.round(last)));
      } catch {
        // Height just isn't remembered.
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <Box ref={rootRef} grow="Yes" direction="Column" style={{ minHeight: 0 }}>
      <Box
        className={css.CallArea}
        style={{ height: height ? `min(${height}px, calc(100% - ${MIN_CHAT}px))` : undefined }}
      >
        <CallView />
      </Box>
      <div
        className={css.Handle}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize call"
        onPointerDown={startDrag}
      />
      <Box grow="Yes" style={{ minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
