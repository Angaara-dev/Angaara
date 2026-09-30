import React, { CSSProperties, ReactNode, useEffect, useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { Overlay, OverlayBackdrop } from 'folds';
import { stopPropagation } from '../../utils/keyboard';
import * as css from './BottomSheet.css';

const CLOSE_PULL = 100;
// A quick flick down closes it too, in px/ms.
const CLOSE_FLICK = 0.5;
const SLOP = 6;

const scrolledInside = (target: EventTarget | null, sheet: HTMLElement) => {
  let el = target instanceof Element ? target : null;
  while (el && el !== sheet) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
};

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  // Fixed height (e.g. '62vh'); without it the sheet fits its content.
  height?: CSSProperties['height'];
  // Handle floats over the content, for sheets that start with a banner.
  floatingHandle?: boolean;
  children: ReactNode;
};
export function BottomSheet({
  open,
  onClose,
  label,
  height,
  floatingHandle,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet) return undefined;
    let mode: 'idle' | 'deciding' | 'dragging' | 'ignored' | 'closing' = 'idle';
    let startX = 0;
    let startY = 0;
    let dy = 0;
    let speed = 0;
    let lastT = 0;
    // Overlay renders the backdrop just before the sheet; it fades as the sheet is pulled.
    const backdrop = sheet.parentElement?.firstElementChild as HTMLElement | null;
    const fade = (opacity: number, ms: number) => {
      if (!backdrop || backdrop === sheet) return;
      backdrop.style.transition = ms ? `opacity ${ms}ms ease-out` : 'none';
      backdrop.style.opacity = String(opacity);
    };

    const onStart = (evt: TouchEvent) => {
      if (mode === 'closing') return;
      mode = evt.touches.length === 1 ? 'deciding' : 'ignored';
      startX = evt.touches[0].clientX;
      startY = evt.touches[0].clientY;
      dy = 0;
      speed = 0;
      lastT = evt.timeStamp;
      if (scrolledInside(evt.target, sheet)) mode = 'ignored';
    };
    const onMove = (evt: TouchEvent) => {
      if (mode === 'idle' || mode === 'ignored') return;
      const touch = evt.touches[0];
      if (mode === 'deciding') {
        const mx = Math.abs(touch.clientX - startX);
        const my = touch.clientY - startY;
        if (mx < SLOP && Math.abs(my) < SLOP) return;
        if (my <= 0 || mx >= my) {
          mode = 'ignored';
          return;
        }
        mode = 'dragging';
        sheet.style.transition = 'none';
      }
      // Claiming the move also stops the page's own scrolling from taking it.
      if (evt.cancelable) evt.preventDefault();
      const next = Math.max(0, touch.clientY - startY);
      const dt = evt.timeStamp - lastT;
      if (dt > 0) speed = 0.6 * ((next - dy) / dt) + 0.4 * speed;
      lastT = evt.timeStamp;
      dy = next;
      sheet.style.transform = `translateY(${dy}px)`;
      fade(1 - dy / Math.max(sheet.offsetHeight, 1), 0);
    };
    const onEnd = (evt: TouchEvent) => {
      // A finger that stopped before lifting isn't flicking.
      if (evt.timeStamp - lastT > 80) speed = 0;
      if (mode !== 'dragging') {
        if (mode !== 'closing') mode = 'idle';
        return;
      }
      if (dy > CLOSE_PULL || (speed > CLOSE_FLICK && dy > SLOP * 3)) {
        mode = 'closing';
        const rest = sheet.offsetHeight - dy;
        const ms = Math.round(Math.min(280, Math.max(140, rest / Math.max(speed, 1.2))));
        sheet.style.transition = `transform ${ms}ms cubic-bezier(0.2, 0.6, 0.35, 1)`;
        sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
        fade(0, ms);
        window.setTimeout(() => onCloseRef.current(), ms);
        return;
      }
      mode = 'idle';
      sheet.style.transition = 'transform 200ms cubic-bezier(0.2, 0.8, 0.3, 1)';
      sheet.style.transform = '';
      fade(1, 200);
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [open]);

  return (
    <Overlay
      onContextMenu={(evt: React.MouseEvent) => evt.stopPropagation()}
      open={open}
      backdrop={<OverlayBackdrop />}
    >
      <FocusTrap
        focusTrapOptions={{
          initialFocus: false,
          returnFocusOnDeactivate: false,
          onDeactivate: onClose,
          clickOutsideDeactivates: true,
          escapeDeactivates: stopPropagation,
          fallbackFocus: () => sheetRef.current ?? document.body,
        }}
      >
        <div
          ref={sheetRef}
          className={css.Sheet}
          style={{ height, overflow: floatingHandle ? 'hidden' : undefined }}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
        >
          <div className={floatingHandle ? css.SheetHandleFloating : css.SheetHandle} />
          {children}
        </div>
      </FocusTrap>
    </Overlay>
  );
}
