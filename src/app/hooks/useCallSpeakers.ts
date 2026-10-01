import { useEffect, useState } from 'react';
import { CallEmbed } from '../plugins/call';
import { isUserId } from '../utils/matrix';
import { useCallJoined } from './useCallEmbed';

const sameSet = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && Array.from(a).every((id) => b.has(id));

// Watches tile classes only: tiles animate through `style` every frame, which made this re-render nonstop.
export const useCallSpeakers = (callEmbed: CallEmbed): Set<string> => {
  const [speakers, setSpeakers] = useState(new Set<string>());
  const joined = useCallJoined(callEmbed);

  useEffect(() => {
    const doc = callEmbed.document;
    if (!joined || !doc?.body) return undefined;
    let frame = 0;
    const scan = () => {
      frame = 0;
      const s = new Set<string>();
      doc.querySelectorAll('[data-video-fit][class*="_speaking_"]').forEach((el) => {
        const id = el.querySelector('[aria-label]')?.getAttribute('aria-label');
        if (id && isUserId(id)) s.add(id);
      });
      setSpeakers((prev) => (sameSet(prev, s) ? prev : s));
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = window.setTimeout(scan, 100);
    });
    observer.observe(doc.body, { subtree: true, childList: true, attributeFilter: ['class'] });
    scan();
    return () => {
      observer.disconnect();
      window.clearTimeout(frame);
      setSpeakers(new Set());
    };
  }, [callEmbed, joined]);

  return speakers;
};
