// Phone scrolling with a calmer fling: the finger is followed 1:1, and release speed eases
// toward a ceiling, v' = cap * tanh(v / cap), so only very hard flings get held back.

// Scroll speed setting steps; the top one keeps the phone's native scrolling.
export const PHONE_SCROLL_NATIVE = 10;
// Top speed a fling tends to, in px/ms, for a setting step.
export const scrollCapFor = (step: number) => 12 + step * 3;

const SLOP = 6;
// How long a fling takes to slow down, in ms; distance travelled is about speed * TAU.
const TAU = 750;
const STOP_SPEED = 0.02;
const SAMPLE_WINDOW = 100;

// Close to 1:1 for normal flings, and it never gets past `cap` px/ms.
export const compressSpeed = (v: number, cap: number): number => cap * Math.tanh(v / cap);

const canScrollY = (el: HTMLElement, style: CSSStyleDeclaration) =>
  (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
  el.scrollHeight > el.clientHeight + 1;

const canScrollX = (el: HTMLElement, style: CSSStyleDeclaration) =>
  (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
  el.scrollWidth > el.clientWidth + 1;

// Nearest vertical scroller, or undefined where native handling should win.
const findScroller = (target: EventTarget | null): HTMLElement | undefined => {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.documentElement) {
    if (!(el instanceof HTMLElement)) {
      el = el.parentElement;
    } else {
      if (el.isContentEditable || el.matches('input, textarea, select, [data-native-scroll]')) {
        return undefined;
      }
      const style = window.getComputedStyle(el);
      if (style.touchAction === 'none') return undefined;
      if (canScrollY(el, style)) return el;
      if (canScrollX(el, style)) return undefined;
      el = el.parentElement;
    }
  }
  return undefined;
};

export const installTouchScroll = (cap: number): (() => void) => {
  let scroller: HTMLElement | undefined;
  let mode: 'idle' | 'deciding' | 'dragging' | 'ignored' = 'idle';
  let startX = 0;
  let startY = 0;
  let lastY = 0;
  let samples: { t: number; y: number }[] = [];
  let frame = 0;
  let carry = 0;
  // When a touch stopped a fling, so its tap doesn't also press what's underneath.
  let stoppedAt = -1;

  const scrollBy = (el: HTMLElement, delta: number): boolean => {
    carry += delta;
    const step = Math.trunc(carry);
    if (step === 0) return true;
    carry -= step;
    const before = el.scrollTop;
    el.scrollBy({ top: step, behavior: 'auto' });
    return el.scrollTop !== before;
  };

  const stopFling = () => {
    if (!frame) return false;
    cancelAnimationFrame(frame);
    frame = 0;
    return true;
  };

  const fling = (el: HTMLElement, speed: number) => {
    let v = speed;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 32);
      last = now;
      const moved = scrollBy(el, v * dt);
      v *= Math.exp(-dt / TAU);
      frame = moved && Math.abs(v) > STOP_SPEED ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);
  };

  const onStart = (evt: TouchEvent) => {
    // A touch during a fling just stops it, like native scrolling.
    stoppedAt = stopFling() ? evt.timeStamp : -1;
    mode = 'ignored';
    if (evt.touches.length !== 1) return;
    scroller = findScroller(evt.target);
    if (!scroller) return;
    const touch = evt.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    lastY = startY;
    samples = [{ t: evt.timeStamp, y: startY }];
    carry = 0;
    mode = 'deciding';
  };

  const onMove = (evt: TouchEvent) => {
    if (mode === 'idle' || mode === 'ignored' || !scroller) return;
    // Horizontal swipes (back, reply) claim the gesture first.
    if (evt.defaultPrevented || evt.touches.length !== 1) {
      mode = 'ignored';
      return;
    }
    if (evt.cancelable) evt.preventDefault();
    const touch = evt.touches[0];
    if (mode === 'deciding') {
      const dx = Math.abs(touch.clientX - startX);
      const dy = Math.abs(touch.clientY - startY);
      if (dx < SLOP && dy < SLOP) return;
      if (dx >= dy) {
        mode = 'ignored';
        return;
      }
      mode = 'dragging';
      stoppedAt = -1;
    }
    scrollBy(scroller, lastY - touch.clientY);
    lastY = touch.clientY;
    samples.push({ t: evt.timeStamp, y: touch.clientY });
    samples = samples.filter((s) => evt.timeStamp - s.t <= SAMPLE_WINDOW);
  };

  const onEnd = (evt: TouchEvent) => {
    if (mode === 'dragging' && scroller && samples.length > 1) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const recent = evt.timeStamp - last.t < 50;
      const dt = last.t - first.t;
      if (recent && dt > 0) {
        const speed = compressSpeed((first.y - last.y) / dt, cap);
        if (Math.abs(speed) > STOP_SPEED) fling(scroller, speed);
      }
    }
    mode = 'idle';
  };

  const onClick = (evt: MouseEvent) => {
    const stopped = stoppedAt >= 0 && evt.timeStamp - stoppedAt < 600;
    stoppedAt = -1;
    if (!stopped) return;
    evt.preventDefault();
    evt.stopPropagation();
  };

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);
  document.addEventListener('click', onClick, true);
  return () => {
    stopFling();
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
    document.removeEventListener('click', onClick, true);
  };
};
