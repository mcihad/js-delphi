/**
 * Monaco Editor bootstrap (vendor layer): ESM build + Vite web workers.
 * The IDE keeps a single editor instance and swaps models between tabs.
 */
import * as monaco from 'monaco-editor';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'typescript':
      case 'javascript':
        return new TsWorker();
      case 'json':
        return new JsonWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker();
      default:
        return new EditorWorker();
    }
  },
};

monaco.editor.defineTheme('jsd-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
    { token: 'keyword', foreground: '0000ff' },
    { token: 'string', foreground: 'a31515' },
    { token: 'number', foreground: '098658' },
    { token: 'type', foreground: '267f99' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.lineHighlightBackground': '#f3f8fd',
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': '#9aa0a6',
    'editorLineNumber.activeForeground': '#1e1e1e',
    'editorGutter.background': '#fafafa',
    'editor.selectionBackground': '#cce4f7',
    'editorIndentGuide.background1': '#ececec',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#c8c8c8',
    'editorSuggestWidget.background': '#ffffff',
    'editorSuggestWidget.selectedBackground': '#cce4f7',
    'editorSuggestWidget.selectedForeground': '#1e1e1e',
    'editorSuggestWidget.selectedIconForeground': '#1e1e1e',
    'editorSuggestWidget.highlightForeground': '#0066bf',
    'editorSuggestWidget.focusHighlightForeground': '#0066bf',
    'list.activeSelectionForeground': '#1e1e1e',
    'list.activeSelectionIconForeground': '#1e1e1e',
    'quickInputList.focusForeground': '#1e1e1e',
    'editorHoverWidget.background': '#ffffff',
    'minimap.background': '#fafafa',
  },
});

export { monaco };
