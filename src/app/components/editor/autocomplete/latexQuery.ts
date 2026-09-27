import { BasePoint, BaseRange, Editor, Range } from 'slate';
import { getPrevWordRange } from '../utils';

export type LatexQuery = {
  // wrapper: typing {lat… ; command: typing \fr… inside {latex}
  kind: 'wrapper' | 'command';
  range: BaseRange;
  text: string;
};

const WRAPPER = 'latex';

// Editor.after doesn't accept a distance of 0.
const offsetPoint = (editor: Editor, point: BasePoint, distance: number) =>
  distance === 0 ? point : Editor.after(editor, point, { distance });

export const getLatexQuery = (editor: Editor): LatexQuery | undefined => {
  const wordRange = getPrevWordRange(editor);
  if (!wordRange) return undefined;
  const word = Editor.string(editor, wordRange);

  // At least "{l", so a lone "{" doesn't pop a menu.
  const wrapper = word.match(/\{(l[a-z]*)$/);
  if (wrapper && WRAPPER.startsWith(wrapper[1]) && wrapper.index !== undefined) {
    const start = offsetPoint(editor, Range.start(wordRange), wrapper.index);
    if (start)
      return {
        kind: 'wrapper',
        range: { anchor: start, focus: wordRange.focus },
        text: wrapper[1],
      };
  }

  const command = word.match(/\\([a-zA-Z]*)$/);
  if (!command || command.index === undefined) return undefined;
  // Only inside an open {latex}, so backslashes in normal chat are left alone.
  const before = Editor.string(editor, {
    anchor: Editor.start(editor, []),
    focus: wordRange.focus,
  });
  if (before.lastIndexOf('{latex}') <= before.lastIndexOf('{/latex}')) return undefined;
  const start = offsetPoint(editor, Range.start(wordRange), command.index);
  if (!start) return undefined;
  return { kind: 'command', range: { anchor: start, focus: wordRange.focus }, text: command[1] };
};
