import React, { useEffect, useRef } from 'react';
import * as monaco from './monaco';
import { languageFor } from './fileTypes';
import { ThemeKind, useTheme } from '../../hooks/useTheme';

type DiffViewProps = {
  path: string;
  remote: string;
  local: string;
};
// Read-only side-by-side diff: the other copy on the left, this browser's on the right.
export default function DiffView({ path, remote, local }: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor>();
  const dark = useTheme().kind === ThemeKind.Dark;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const editor = monaco.editor.createDiffEditor(container, {
      automaticLayout: true,
      readOnly: true,
      originalEditable: false,
      minimap: { enabled: false },
      fontSize: 13,
      scrollBeyondLastLine: false,
      // Side by side when there's room, stacked inline on narrow screens.
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      renderSideBySideInlineBreakpoint: 640,
    });
    editorRef.current = editor;
    return () => {
      const model = editor.getModel();
      editor.dispose();
      model?.original.dispose();
      model?.modified.dispose();
      editorRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const previous = editor.getModel();
    const language = languageFor(path);
    editor.setModel({
      original: monaco.editor.createModel(remote, language),
      modified: monaco.editor.createModel(local, language),
    });
    previous?.original.dispose();
    previous?.modified.dispose();
  }, [path, remote, local]);

  useEffect(() => {
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
  }, [dark]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
