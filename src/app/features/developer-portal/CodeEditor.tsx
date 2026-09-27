import React, { useEffect, useRef } from 'react';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import * as monaco from './monaco';
import { ThemeKind, useTheme } from '../../hooks/useTheme';
import { languageFor } from './fileTypes';

// Monaco (the editor inside VS Code) runs its language services in web workers.
window.MonacoEnvironment = {
  getWorker: (_id: string, label: string) =>
    label === 'json' ? new JsonWorker() : new EditorWorker(),
};

type CodeEditorProps = {
  path: string;
  value: string;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
};
export default function CodeEditor({ path, value, onChange, onCursorChange }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();
  const modelsRef = useRef(new Map<string, monaco.editor.ITextModel>());
  const syncingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCursorRef = useRef(onCursorChange);
  onCursorRef.current = onCursorChange;
  const dark = useTheme().kind === ThemeKind.Dark;
  const readOnly = !onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const models = modelsRef.current;
    const editor = monaco.editor.create(container, {
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      tabSize: 4,
      scrollBeyondLastLine: false,
      dropIntoEditor: { enabled: false },
    });
    editorRef.current = editor;
    const changes = editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model && !syncingRef.current) onChangeRef.current?.(model.getValue());
    });

    const cursor = editor.onDidChangeCursorPosition(({ position }) =>
      onCursorRef.current?.(position.lineNumber, position.column)
    );

    return () => {
      changes.dispose();
      cursor.dispose();
      editor.dispose();
      models.forEach((m) => m.dispose());
      models.clear();
      editorRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    let model = modelsRef.current.get(path);
    if (!model) {
      // Unique URI per editor instance and file, so two editors never share a model.
      const uri = monaco.Uri.parse(`inmemory://${Math.random().toString(36).slice(2)}/${path}`);
      model = monaco.editor.createModel(value, languageFor(path), uri);
      modelsRef.current.set(path, model);
    } else if (model.getValue() !== value) {
      syncingRef.current = true;
      model.setValue(value);
      syncingRef.current = false;
    }
    if (editor.getModel() !== model) editor.setModel(model);
  }, [path, value]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly });
  }, [readOnly]);

  useEffect(() => {
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
  }, [dark]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
