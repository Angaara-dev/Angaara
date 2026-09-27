import React, { useEffect, useState } from 'react';
import * as css from './MathTex.css';
import { KATEX_OPTIONS, MAX_TEX_LENGTH, loadKatex } from './katex';

type MathTexProps = {
  tex: string;
  display?: boolean;
};
// Renders MSC2191 data-mx-maths, including maths sent from other clients.
export function MathTex({ tex, display }: MathTexProps) {
  const [html, setHtml] = useState<string>();

  useEffect(() => {
    let alive = true;
    if (tex.length > MAX_TEX_LENGTH) return undefined;
    loadKatex()
      .then((katex) => {
        if (!alive) return;
        setHtml(katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode: display }));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tex, display]);

  if (!html) {
    return <code className={css.Fallback}>{tex}</code>;
  }
  const Tag = display ? 'div' : 'span';
  return (
    <Tag
      className={display ? css.Display : css.Inline}
      title={tex}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
