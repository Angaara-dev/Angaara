import { RefObject, useEffect } from 'react';

// Marks which edges of a scroller still have content past them, for ScrollFade.
export const useScrollFade = (ref: RefObject<HTMLElement>) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      el.dataset.fadeTop = String(el.scrollTop > 2);
      el.dataset.fadeBottom = String(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [ref]);
};
