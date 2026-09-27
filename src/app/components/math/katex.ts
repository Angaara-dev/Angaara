import type { KatexOptions } from 'katex';

// Longer input is shown as plain code, so a huge formula can't stall the timeline.
export const MAX_TEX_LENGTH = 4000;

// trust stays off, so no \href, \url or raw HTML commands run.
export const KATEX_OPTIONS: KatexOptions = {
  throwOnError: false,
  trust: false,
  strict: 'ignore',
  maxSize: 20,
  maxExpand: 500,
};

// KaTeX and its CSS load on the first formula, keeping them out of the main bundle.
let katexLoader: Promise<typeof import('katex')['default']> | undefined;
export const loadKatex = () => {
  katexLoader ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
    ([mod]) => mod.default
  );
  return katexLoader;
};

const MATHS_ATTR_REG = /data-mx-maths="([^"]*)"/g;
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};
const unescapeHtml = (text: string) => text.replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]);

// Checks every formula in outgoing HTML; returns the first error so it stays on the sender's screen.
export const findMathsError = async (html: string): Promise<string | undefined> => {
  const formulas = [...html.matchAll(MATHS_ATTR_REG)].map((m) => unescapeHtml(m[1]));
  if (formulas.length === 0) return undefined;
  const tooLong = formulas.find((tex) => tex.length > MAX_TEX_LENGTH);
  if (tooLong) return `LaTeX is too long (max ${MAX_TEX_LENGTH} characters).`;

  const katex = await loadKatex();
  let error: string | undefined;
  formulas.some((tex) => {
    try {
      katex.renderToString(tex, { ...KATEX_OPTIONS, throwOnError: true });
      return false;
    } catch (err) {
      // KaTeX underlines the bad spot with combining characters; plain text reads better.
      error = err instanceof Error ? err.message.replace(/\u0332/g, '') : 'Invalid LaTeX.';
      return true;
    }
  });
  return error;
};
