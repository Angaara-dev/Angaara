import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Box, color, config, Text } from 'folds';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useBackRoute } from './BackRouteHandler';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, INBOX_PATH, SPACE_PATH } from '../pages/paths';
import { THEME_BG_VAR, THEME_SURFACE_VAR } from '../utils/accent';

const DECIDE_AFTER = 12;
// Android's own back gesture lives at the very left edge; leave it alone.
const EDGE_GUARD = 24;
const COMMIT_RATIO = 0.33;
const BACK_GUARD = 'angaaraBack';
let lastPage: string | undefined;
let snapshotPage: string | undefined;
let snapshotScrolls: [HTMLElement, number, number][] = [];

// Copies the page into the preview, so swiping back in shows the real chat instead of a blank.
// The copy is inert; media and frames are dropped so nothing reloads or plays.
const takeSnapshot = (page: HTMLElement, into: HTMLElement, path: string) => {
  const clone = page.cloneNode(true) as HTMLElement;
  const originals = page.querySelectorAll<HTMLElement>('*');
  const copies = clone.querySelectorAll<HTMLElement>('*');
  const scrolls: [HTMLElement, number, number][] = [];
  originals.forEach((el, i) => {
    if (el.scrollTop || el.scrollLeft) scrolls.push([copies[i], el.scrollTop, el.scrollLeft]);
  });
  clone
    .querySelectorAll('iframe, video, audio, canvas, script, object, embed')
    .forEach((n) => n.remove());
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  clone.removeAttribute('id');
  clone.setAttribute('inert', '');
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, { transform: '', transition: '', width: '100%', height: '100%' });
  into.replaceChildren(clone);
  snapshotPage = path;
  snapshotScrolls = scrolls;
};

// A moving page breaks the screen-fixed server gradient (each panel would redraw it in its own
// box), so while sliding the page paints the gradient once. Panels keep their flat washes and lift,
// so nothing changes colour when the slide ends.
const setThemeSlide = (node: HTMLElement | null, on: boolean) => {
  if (!node) return;
  const { style } = document.body;
  const gradient = style.getPropertyValue(THEME_BG_VAR);
  if (on && gradient) {
    const lift = style.getPropertyValue(THEME_SURFACE_VAR).replace(`, ${gradient}`, '');
    node.style.setProperty('background-image', gradient);
    node.style.setProperty(THEME_BG_VAR, 'none');
    node.style.setProperty(THEME_SURFACE_VAR, lift || 'none');
    return;
  }
  node.style.removeProperty('background-image');
  node.style.removeProperty(THEME_BG_VAR);
  node.style.removeProperty(THEME_SURFACE_VAR);
};

const blocksSwipe = (target: EventTarget | null, container: HTMLElement): boolean => {
  if (window.getSelection()?.toString()) return true;
  let el = target instanceof Element ? target : null;
  while (el && el !== container) {
    if (
      el.matches('input, textarea, select, [contenteditable="true"], [data-no-swipe]') ||
      el.classList.contains('monaco-editor')
    ) {
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

// While a chat is open on a phone, the room list still renders here (hidden) so a swipe reveals it.
type Slots = { rail: HTMLElement | null; nav: HTMLElement | null };
const UnderlayContext = createContext<Slots>({ rail: null, nav: null });
// Always rendered in place and only its DOM moves behind the chat, so the list and rail stay
// mounted (a portal would rebuild them, with flicker, on every switch).
export function SwipeUnderlay({
  slot,
  active,
  children,
}: {
  slot: keyof Slots;
  active: boolean;
  children: ReactNode;
}) {
  const target = useContext(UnderlayContext)[slot];
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const home = node?.parentNode;
    if (!node || !home || !active || !target) return undefined;
    const next = node.nextSibling;
    target.appendChild(node);
    // Moved back before React touches it again, including when it unmounts.
    return () => {
      home.insertBefore(node, next?.parentNode === home ? next : null);
    };
  }, [active, target]);
  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

function usePageName(path?: string): string {
  const mx = useMatrixClient();
  const id = path
    ?.split('/')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .find((part) => part.startsWith('!') || part.startsWith('#'));
  if (!id) return '';
  const room = id.startsWith('!')
    ? mx.getRoom(id)
    : mx
        .getRooms()
        .find((r: { getCanonicalAlias(): string | null }) => r.getCanonicalAlias() === id);
  return room?.name ?? '';
}

function useIsSectionList() {
  const home = useMatch({ path: HOME_PATH, caseSensitive: true, end: true });
  const direct = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: true });
  const space = useMatch({ path: SPACE_PATH, caseSensitive: true, end: true });
  const explore = useMatch({ path: EXPLORE_PATH, caseSensitive: true, end: true });
  const inbox = useMatch({ path: INBOX_PATH, caseSensitive: true, end: true });
  return !!(home || direct || space || explore || inbox);
}

export function SwipeNavigation({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  const mobile = useScreenSizeContext() === ScreenSize.Mobile;
  const ref = useRef<HTMLDivElement>(null);
  const underlayRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Slots>({ rail: null, nav: null });
  // Stable refs: a new callback each render would reset the slots in a loop.
  const railRef = useCallback(
    (rail: HTMLDivElement | null) => setSlots((s) => (s.rail === rail ? s : { ...s, rail })),
    []
  );
  const navRef = useCallback(
    (navEl: HTMLDivElement | null) => setSlots((s) => (s.nav === navEl ? s : { ...s, nav: navEl })),
    []
  );
  const handoffRef = useRef<number>();
  const location = useLocation();
  const navigate = useNavigate();
  const goBack = useBackRoute();
  const onList = useIsSectionList();

  const actionsRef = useRef({ goBack, navigate, onList, pathname: location.pathname });
  actionsRef.current = { goBack, navigate, onList, pathname: location.pathname };

  // Taps, swipes and the back button all slide the same way: the chat moves over a still list,
  // and a released swipe continues from where the finger let go. A layout effect, so the new
  // page never shows for a frame before its slide starts.
  const wasOnList = useRef(onList);
  const revealRef = useRef(0);
  const revealingRef = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    const preview = previewRef.current;
    const changed = wasOnList.current !== onList;
    wasOnList.current = onList;
    const handoff = handoffRef.current;
    handoffRef.current = undefined;
    const clearSnapshot = () => {
      snapshotPage = undefined;
      snapshotScrolls = [];
      snapshotRef.current?.replaceChildren();
    };
    const hasSnapshotOf = (page?: string) =>
      !!page && snapshotPage === page && !!snapshotRef.current?.firstChild;
    const showSnapshot = () => {
      if (!preview) return;
      Object.assign(preview.style, { transition: 'none', transform: 'none', display: 'flex' });
      setThemeSlide(preview, true);
      if (snapshotRef.current) snapshotRef.current.style.display = 'flex';
      if (headerRef.current) headerRef.current.style.display = 'none';
      snapshotScrolls.forEach(([node, top, left]) => {
        Object.assign(node, { scrollTop: top, scrollLeft: left });
      });
    };
    const hidePreview = () => {
      if (!preview) return;
      revealingRef.current = false;
      preview.style.display = 'none';
      setThemeSlide(preview, false);
    };

    // Entering a chat: its snapshot (or a swipe's name-only preview) covers it while phones
    // draw its messages, since they're already in memory but drawn a moment after opening.
    const entering = mobile && changed && !onList;
    const swipePreview = handoff !== undefined && preview?.style.display !== 'none';
    const covering = entering && (hasSnapshotOf(location.pathname) || swipePreview);
    const leaving = mobile && changed && onList && hasSnapshotOf(lastPage);
    if (!onList) {
      lastPage = location.pathname;
      if (!covering && !revealingRef.current) clearSnapshot();
    }
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
    setThemeSlide(el, false);
    const underlay = underlayRef.current;
    if (underlay) underlay.style.display = 'none';
    if (!changed) {
      // A re-run for the same page leaves a preview that's still in use alone.
      if (!revealingRef.current) hidePreview();
      return;
    }
    revealRef.current += 1;
    const token = revealRef.current;
    hidePreview();
    if (covering && hasSnapshotOf(location.pathname)) showSnapshot();
    else if (covering && preview) {
      Object.assign(preview.style, { transition: 'none', transform: 'none', display: 'flex' });
    }
    if (leaving) showSnapshot();
    if (covering || leaving) revealingRef.current = true;

    const reveal = () => {
      const started = performance.now();
      let readySince: number | undefined;
      const check = () => {
        if (revealRef.current !== token) return;
        // The chat can mount twice while opening; wait until it has stayed drawn for a moment.
        const now = performance.now();
        if (!el.querySelector('[data-room-ready]')) readySince = undefined;
        else readySince ??= now;
        const settled = readySince !== undefined && now - readySince >= 150;
        if (!settled && now - started < 1000) {
          requestAnimationFrame(check);
          return;
        }
        requestAnimationFrame(() => {
          if (revealRef.current !== token || !preview) return;
          const fade = preview.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
          fade.onfinish = () => {
            if (revealRef.current !== token) return;
            hidePreview();
            clearSnapshot();
          };
        });
      };
      requestAnimationFrame(check);
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!mobile || reduceMotion || typeof el.animate !== 'function') {
      if (leaving) hidePreview();
      if (covering) reveal();
      return;
    }
    const done = handoff ?? 0;
    const timing = {
      duration: Math.max(90, 220 * (1 - done)),
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    };
    if (onList) {
      if (leaving && preview) {
        const slide = preview.animate(
          [{ transform: `translateX(${done * 100}%)` }, { transform: 'translateX(100%)' }],
          timing
        );
        slide.onfinish = () => {
          if (revealRef.current === token) hidePreview();
        };
        return;
      }
      setThemeSlide(el, true);
      const slide = el.animate(
        [
          { transform: 'translateX(-30%)', opacity: 0.6 },
          { transform: 'none', opacity: 1 },
        ],
        timing
      );
      const finish = () => setThemeSlide(el, false);
      slide.onfinish = finish;
      slide.oncancel = finish;
      return;
    }
    setThemeSlide(el, true);
    const frames = [{ transform: `translateX(${(1 - done) * 100}%)` }, { transform: 'none' }];
    const slide = el.animate(frames, timing);
    if (covering && preview) preview.animate(frames, timing);
    if (underlay) underlay.style.display = 'flex';
    const finish = () => {
      setThemeSlide(el, false);
      if (underlay) underlay.style.display = 'none';
    };
    slide.onfinish = finish;
    slide.oncancel = finish;
    if (covering) reveal();
  }, [location.pathname, onList, mobile]);

  // The phone's back button acts like the header's back arrow: up to the list, not to the
  // previous page. Each page keeps one spare history entry; using it up triggers the arrow.
  useEffect(() => {
    if (!mobile || onList) return undefined;
    const { href } = window.location;
    if (!window.history.state?.[BACK_GUARD]) {
      window.history.pushState({ ...window.history.state, [BACK_GUARD]: true }, '');
    }
    const onPop = () => {
      // Landing on a guard means a panel entry above it was used up; the panel handles that.
      if (window.history.state?.[BACK_GUARD] || window.location.href !== href) return;
      actionsRef.current.goBack(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [mobile, onList, location.pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!mobile || !el) return undefined;
    let startX = 0;
    let startY = 0;
    let mode: 'idle' | 'deciding' | 'swiping' | 'ignored' = 'idle';
    let direction: 1 | -1 = 1;

    const snapshot = () => {
      const into = snapshotRef.current;
      const { onList: list, pathname } = actionsRef.current;
      if (into && !list) takeSnapshot(el, into, pathname);
    };
    const showSnapshot = () => {
      const has = snapshotPage === lastPage && !!snapshotRef.current?.firstChild;
      if (snapshotRef.current) snapshotRef.current.style.display = has ? 'flex' : 'none';
      if (headerRef.current) headerRef.current.style.display = has ? 'none' : 'flex';
      if (!has) return;
      snapshotScrolls.forEach(([node, top, left]) => {
        Object.assign(node, { scrollTop: top, scrollLeft: left });
      });
    };
    // Snapshot on every way out of a page: swiping right, a tap (like the back arrow), or the
    // phone's back button. Only taps on things that can navigate, so ordinary taps stay cheap.
    const onClickCapture = (evt: MouseEvent) => {
      if (evt.target instanceof Element && evt.target.closest('a, button, [role="button"]')) {
        snapshot();
      }
    };
    const onPopState = () => snapshot();

    const canSwipe = (dir: 1 | -1) => {
      const { onList: list, pathname } = actionsRef.current;
      if (dir === 1) return !list;
      return list && !!lastPage && lastPage !== pathname && lastPage.startsWith(pathname);
    };

    const onStart = (evt: TouchEvent) => {
      if (evt.touches.length !== 1) return;
      const touch = evt.touches[0];
      if (touch.clientX < EDGE_GUARD || blocksSwipe(evt.target, el)) {
        mode = 'ignored';
        return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      mode = 'deciding';
    };

    const onMove = (evt: TouchEvent) => {
      if (mode === 'idle' || mode === 'ignored') return;
      const touch = evt.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (mode === 'deciding') {
        if (Math.abs(dx) < DECIDE_AFTER && Math.abs(dy) < DECIDE_AFTER) return;
        direction = dx > 0 ? 1 : -1;
        if (Math.abs(dx) < Math.abs(dy) * 1.5 || !canSwipe(direction)) {
          mode = 'ignored';
          return;
        }
        mode = 'swiping';
        if (direction === 1) snapshot();
        if (direction === 1) setThemeSlide(el, true);
        if (direction === -1) setThemeSlide(previewRef.current, true);
        el.style.transition = 'none';
        const behind = direction === 1 ? underlayRef.current : previewRef.current;
        if (behind) {
          behind.style.transition = 'none';
          behind.style.display = 'flex';
        }
        if (direction === -1) showSnapshot();
      }
      const offset = direction === 1 ? Math.max(0, dx) : Math.min(0, dx);
      if (direction === 1) el.style.transform = `translateX(${offset}px)`;
      const preview = previewRef.current;
      if (direction === -1 && preview) {
        preview.style.transform = `translateX(${preview.clientWidth + offset}px)`;
      }
      if (evt.cancelable) evt.preventDefault();
    };

    const onEnd = (evt: TouchEvent) => {
      if (mode !== 'swiping') {
        mode = 'idle';
        return;
      }
      mode = 'idle';
      const dx = (evt.changedTouches[0]?.clientX ?? startX) - startX;
      const width = el.clientWidth || window.innerWidth;
      const committed = direction * dx > width * COMMIT_RATIO;
      const preview = previewRef.current;
      if (!committed) {
        // Spring back as an animation and tidy up exactly when it ends, so the slide's
        // temporary colours and positions never linger.
        const moving = direction === 1 ? el : preview;
        const from = moving?.style.transform || 'none';
        const to = direction === 1 ? 'none' : 'translateX(100%)';
        const tidy = () => {
          el.style.transition = '';
          el.style.transform = '';
          if (underlayRef.current) underlayRef.current.style.display = 'none';
          if (preview) {
            preview.style.transition = '';
            preview.style.transform = '';
            preview.style.display = 'none';
          }
          setThemeSlide(el, false);
          setThemeSlide(preview, false);
        };
        if (!moving || typeof moving.animate !== 'function') {
          tidy();
          return;
        }
        moving.style.transition = 'none';
        moving.style.transform = to;
        const back = moving.animate([{ transform: from }, { transform: to }], {
          duration: 180,
          easing: 'ease-out',
        });
        back.onfinish = tidy;
        back.oncancel = tidy;
        return;
      }
      handoffRef.current = Math.min(1, (direction * dx) / width);
      const { goBack: back, navigate: go, pathname } = actionsRef.current;
      if (direction === 1) back();
      else if (lastPage && lastPage !== pathname) go(lastPage);
    };

    el.addEventListener('click', onClickCapture, true);
    window.addEventListener('popstate', onPopState);
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('popstate', onPopState);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [mobile]);

  const previewName = usePageName(onList ? lastPage : undefined);
  const hidden = { position: 'absolute', inset: 0, display: 'none' } as const;

  return (
    <UnderlayContext.Provider value={slots}>
      {/* Clipped, so a chat sliding off-screen can't make the whole page pan sideways. */}
      <Box grow="Yes" style={{ position: 'relative', minWidth: 0, overflow: 'clip' }}>
        {mobile && (
          <Box ref={underlayRef} style={hidden}>
            <Box shrink="No" ref={railRef} />
            <Box grow="Yes" style={{ minWidth: 0 }} ref={navRef} />
          </Box>
        )}
        <Box shrink="No">{nav}</Box>
        {/* No transform or will-change at rest: either would break position: fixed overlays inside. */}
        <Box
          ref={ref}
          grow="Yes"
          style={{ minWidth: 0, position: 'relative', background: color.Background.Container }}
        >
          {children}
        </Box>
        {mobile && (
          <Box
            ref={previewRef}
            direction="Column"
            style={{ ...hidden, background: color.Background.Container }}
          >
            <Box
              ref={headerRef}
              alignItems="Center"
              shrink="No"
              style={{
                height: config.lineHeight.T400,
                minHeight: '3.5rem',
                padding: `0 ${config.space.S400}`,
                borderBottom: `1px solid ${color.Background.ContainerLine}`,
              }}
            >
              <Text size="H4" truncate>
                {previewName}
              </Text>
            </Box>
            <Box
              ref={snapshotRef}
              grow="Yes"
              style={{ minHeight: 0, display: 'none', pointerEvents: 'none' }}
            />
          </Box>
        )}
      </Box>
    </UnderlayContext.Provider>
  );
}
