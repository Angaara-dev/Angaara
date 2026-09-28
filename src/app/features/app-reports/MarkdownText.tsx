import React, { useMemo } from 'react';
import parse from 'html-react-parser';
import { Text } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { parseBlockMD, parseInlineMD } from '../../plugins/markdown';
import { getReactCustomHtmlParser, LINKIFY_OPTS } from '../../plugins/react-custom-html-parser';
import { sanitizeCustomHtml, sanitizeText } from '../../utils/sanitize';

// Same markdown as messages; raw HTML is escaped first, and quotes get their ">" back.
const toHtml = (text: string): string =>
  sanitizeCustomHtml(
    parseBlockMD(sanitizeText(text).replace(/^(\s*)&gt;/gm, '$1>'), parseInlineMD)
  );

export function MarkdownText({ text }: { text: string }) {
  const mx = useMatrixClient();
  const options = useMemo(
    () => getReactCustomHtmlParser(mx, undefined, { linkifyOpts: LINKIFY_OPTS }),
    [mx]
  );
  return (
    <Text as="div" size="T300" style={{ overflowWrap: 'anywhere' }}>
      {parse(toHtml(text), options)}
    </Text>
  );
}
