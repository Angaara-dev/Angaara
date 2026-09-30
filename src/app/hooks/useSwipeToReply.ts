import { RefObject, useEffect, useRef } from 'react';

const DECIDE_AFTER = 12;
const TRIGGER = 64;
const MAX_PULL = 96;
const REPLY_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

const blocked = (target: Element, root: HTMLElement) => {
  if (window.getSelection()?.toString()) return true;
  let el: Element | null = target;
  while (el && el !== root) {
    if (el.matches('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) {
      return true;
    }
    const { overflowX } = window.getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
};

export const useSwipeToReply = (
  scrollRef: RefObject<HTMLElement>,
  enabled: boolean,
  canReply: (eventId: string) => boolean,
  onReply: (eventId: string) => void
) => {
  const callbacks = useRef({ canReply, onReply });
  callbacks.current = { canReply, onReply };

  useEffect(() => {
    const root = scrollRef.current;
    if (!enabled || !root) return undefined;

    let mode: 'idle' | 'deciding' | 'swiping' | 'ignored' = 'idle';
    let row: HTMLElement | null = null;
    let icon: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let armed = false;

    const release = () => {
      const r = row;
      const i = icon;
      if (r) {
        r.style.transition = 'transform 160ms ease-out';
        r.style.transform = '';
        window.setTimeout(() => {
          r.style.transition = '';
          i?.remove();
        }, 170);
      }
      row = null;
      icon = null;
      armed = false;
    };

    const onStart = (evt: TouchEvent) => {
      mode = 'ignored';
      if (evt.touches.length !== 1 || !(evt.target instanceof Element)) return;
      const target = evt.target.closest<HTMLElement>('[data-message-id]');
      const eventId = target?.getAttribute('data-message-id');
      if (!target || !eventId || !root.contains(target) || blocked(evt.target, root)) return;
      if (!callbacks.current.canReply(eventId)) return;
      row = target;
      startX = evt.touches[0].clientX;
      startY = evt.touches[0].clientY;
      mode = 'deciding';
    };

    const onMove = (evt: TouchEvent) => {
      if ((mode !== 'deciding' && mode !== 'swiping') || !row) return;
      const dx = evt.touches[0].clientX - startX;
      const dy = evt.touches[0].clientY - startY;
      if (mode === 'deciding') {
        if (Math.abs(dx) < DECIDE_AFTER && Math.abs(dy) < DECIDE_AFTER) return;
        if (dx >= 0 || Math.abs(dx) < Math.abs(dy) * 1.5) {
          mode = 'ignored';
          row = null;
          return;
        }
        mode = 'swiping';
        icon = document.createElement('div');
        icon.innerHTML = REPLY_ICON;
        Object.assign(icon.style, {
          position: 'absolute',
          top: '50%',
          right: `-${TRIGGER - 16}px`,
          transform: 'translateY(-50%) scale(0.6)',
          opacity: '0',
          display: 'flex',
          pointerEvents: 'none',
        });
        if (window.getComputedStyle(row).position === 'static') row.style.position = 'relative';
        row.appendChild(icon);
        row.style.transition = 'none';
      }
      const pull = Math.max(-MAX_PULL, dx < -TRIGGER ? -TRIGGER + (dx + TRIGGER) / 3 : dx);
      row.style.transform = `translateX(${pull}px)`;
      const progress = Math.min(1, -pull / TRIGGER);
      if (icon) {
        icon.style.opacity = String(progress);
        icon.style.transform = `translateY(-50%) scale(${0.6 + progress * 0.4})`;
      }
      const nowArmed = -pull >= TRIGGER;
      if (nowArmed && !armed) navigator.vibrate?.(10);
      armed = nowArmed;
      if (evt.cancelable) evt.preventDefault();
    };

    const onEnd = () => {
      if (mode === 'swiping' && row) {
        const eventId = row.getAttribute('data-message-id');
        const reply = armed && eventId;
        release();
        if (reply) callbacks.current.onReply(eventId);
      } else {
        row = null;
      }
      mode = 'idle';
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('touchcancel', release);
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', release);
      release();
    };
  }, [scrollRef, enabled]);
};
