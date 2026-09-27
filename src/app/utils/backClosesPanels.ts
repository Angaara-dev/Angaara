// On phones, the system back button closes the top panel (settings, dialogs) instead of leaving
// the page. Each open panel gets a history entry; going back sends it Esc, like its close button.
const MARK = 'angaaraPanel';

const isPanel = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
};

const closeTop = () => {
  // Esc is ignored while typing in a field, so leave the field first.
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  );
};

export const installBackClosesPanels = () => {
  const container = document.getElementById('portalContainer');
  if (!container || !window.matchMedia?.('(pointer: coarse)').matches) return;

  let pushed = 0;
  let ignorePops = 0;
  const openCount = () => Array.from(container.children).filter(isPanel).length;
  const push = () => {
    pushed += 1;
    window.history.pushState({ ...window.history.state, [MARK]: pushed }, '');
  };

  // Panels opened: add entries. Closed some other way: drop our entries, unless the app
  // navigated meanwhile (then going back would undo that navigation).
  const sync = () => {
    const open = openCount();
    while (pushed < open) push();
    if (pushed <= open) return;
    const extra = pushed - open;
    pushed = open;
    if (window.history.state?.[MARK]) {
      ignorePops += 1;
      window.history.go(-extra);
    }
  };

  new MutationObserver(sync).observe(container, { childList: true });
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops -= 1;
      return;
    }
    const before = openCount();
    if (pushed === 0 || before === 0) return;
    // Still on our newest entry: the pop was of an entry a panel added itself (a settings page).
    if (window.history.state?.[MARK] === pushed) return;
    pushed -= 1;
    closeTop();
    // Panels that must stay open (like saving a recovery key) keep blocking back.
    window.setTimeout(() => {
      if (openCount() >= before) push();
    }, 150);
  });
};
