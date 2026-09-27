import React, { KeyboardEvent as ReactKeyboardEvent, useMemo } from 'react';
import { Editor, Transforms } from 'slate';
import { Box, MenuItem, Text, config, toRem } from 'folds';
import { AutocompleteMenu } from './AutocompleteMenu';
import { LatexQuery } from './latexQuery';
import { LatexCommand, searchLatexCommands } from './latexCommands';
import { useKeyDown } from '../../../hooks/useKeyDown';
import { onTabPress } from '../../../utils/keyboard';
import { MathTex } from '../../math';

type Suggestion = { key: string; label: string; hint: string; preview?: string; snippet: string };

const WRAPPER_SUGGESTION: Suggestion = {
  key: 'wrapper',
  label: '{latex}…{/latex}',
  hint: 'Math, rendered for everyone on Angaara and Element',
  preview: 'e^{i\\pi}+1=0',
  snippet: '{latex}{/latex}',
};

const toSuggestion = (c: LatexCommand): Suggestion => ({
  key: c.name,
  label: `\\${c.name}`,
  hint: c.snippet,
  preview: c.preview,
  snippet: c.snippet,
});

// Where the cursor goes after inserting: inside the first {} or wrapper, else the end.
const cursorOffset = (snippet: string): number => {
  if (snippet === WRAPPER_SUGGESTION.snippet) return '{latex}'.length;
  const braces = snippet.indexOf('{}');
  if (braces !== -1) return braces + 1;
  const spaced = snippet.indexOf('  ');
  return spaced !== -1 ? spaced + 1 : snippet.length;
};

type LatexAutocompleteProps = {
  editor: Editor;
  query: LatexQuery;
  requestClose: () => void;
};
export function LatexAutocomplete({ editor, query, requestClose }: LatexAutocompleteProps) {
  const suggestions = useMemo(
    () =>
      query.kind === 'wrapper'
        ? [WRAPPER_SUGGESTION]
        : searchLatexCommands(query.text).map(toSuggestion),
    [query]
  );

  const insert = (snippet: string) => {
    Transforms.select(editor, query.range);
    editor.insertText(snippet);
    const back = snippet.length - cursorOffset(snippet);
    if (back > 0) Transforms.move(editor, { distance: back, reverse: true });
    requestClose();
  };

  useKeyDown(window, (evt: KeyboardEvent) => {
    onTabPress(evt, () => {
      if (suggestions[0]) insert(suggestions[0].snippet);
    });
  });

  if (suggestions.length === 0) return null;
  return (
    <AutocompleteMenu headerContent={<Text size="L400">LaTeX</Text>} requestClose={requestClose}>
      {suggestions.map((s) => (
        <MenuItem
          key={s.key}
          as="button"
          radii="300"
          style={{ height: 'unset' }}
          onKeyDown={(evt: ReactKeyboardEvent<HTMLButtonElement>) =>
            onTabPress(evt, () => insert(s.snippet))
          }
          onClick={() => insert(s.snippet)}
          after={
            s.preview && (
              <Box shrink="No" style={{ maxWidth: toRem(160), overflow: 'hidden' }}>
                <MathTex tex={s.preview} />
              </Box>
            )
          }
        >
          <Box
            grow="Yes"
            direction="Column"
            gap="100"
            style={{ padding: `${config.space.S200} 0`, minWidth: 0 }}
          >
            <Text size="B400" truncate>
              {s.label}
            </Text>
            <Text size="T200" priority="300" truncate>
              {s.hint}
            </Text>
          </Box>
        </MenuItem>
      ))}
    </AutocompleteMenu>
  );
}
