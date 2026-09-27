// Nothing in the app scrolls the page or its fixed-size frames. Android can still shift them
// (keyboard, focus, scrollIntoView) and leave the header off screen, so snap them back.
const fixedFrames = new WeakMap<Element, boolean>();
const isFixedFrame = (el: Element) => {
  let fixed = fixedFrames.get(el);
  if (fixed === undefined) {
    const { overflowX, overflowY } = window.getComputedStyle(el);
    fixed = ['hidden', 'clip'].includes(overflowY) && ['hidden', 'clip'].includes(overflowX);
    fixedFrames.set(el, fixed);
  }
  return fixed;
};
const unshift = (evt: Event) => {
  const el = evt.target === document ? document.scrollingElement : evt.target;
  if (!(el instanceof Element) || el.closest('.monaco-editor, .monaco-diff-editor')) return;
  if (el !== document.scrollingElement && !isFixedFrame(el)) return;
  if (el.scrollTop || el.scrollLeft) el.scrollTo(0, 0);
};
export const installPageShiftGuard = () =>
  document.addEventListener('scroll', unshift, { capture: true, passive: true });
