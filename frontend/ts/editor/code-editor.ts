/**
 * Monaco integration: ONE editor instance, one model per document (never disposed on tab
 * switch; view state is saved/restored), VCL IntelliSense (global vcl declarations +
 * generated per-form declarations), custom completion/hover/diagnostics and stubs.
 */
import * as vcl from '@vcl';
import vclGlobalDts from '@runtime/vcl.global.d.ts?raw';
import { monaco } from '../../vendor/monaco';
import { Emitter, h } from '../core/dom';
import type { FormDoc, ProjectModel } from '../model/project';
import type { SchemaInfo } from '../api/client';

const ts = monaco.typescript;

export function unitUri(doc: FormDoc): monaco.Uri {
  return monaco.Uri.parse(`file:///project/forms/${doc.name}.ts`);
}

function eventSignature(cls: string, event: string, self: string): string {
  const ev = vcl.GetClassInfo(cls)?.events.find((e) => e.name === event);
  return (ev?.params ?? 'Sender: TObject, e?: any').replace('$Self', self);
}

/** Declarations that make `this.btnKaydet` and handler parameters typed inside units. */
export function formDeclarations(doc: FormDoc): string {
  const form = doc.root.name;
  const lines: string[] = [`declare class ${form} extends TForm {`];
  doc.walk((n) => {
    if (n !== doc.root) lines.push(`  /** ${n.class} — tasarımcıda oluşturuldu */\n  ${n.name}: ${n.class};`);
  });
  const handlers = new Map<string, string>();
  for (const [handler, uses] of doc.handlers()) {
    const sigs = new Set(uses.map((u) => eventSignature(u.cls, u.event, u.cls === 'TForm' ? form : u.cls)));
    handlers.set(handler, sigs.size === 1 ? [...sigs][0] : 'Sender: TObject, e?: any');
  }
  for (const m of doc.code.matchAll(new RegExp(`\\b${form}\\.prototype\\.(\\w+)\\s*=`, 'g'))) {
    if (!handlers.has(m[1])) handlers.set(m[1], '...args: any[]');
  }
  for (const [name, sig] of handlers) lines.push(`  ${name}(this: ${form}, ${sig}): any;`);
  lines.push('}');
  return lines.join('\n');
}

export class CodeEditor {
  readonly el: HTMLDivElement;
  readonly editor: monaco.editor.IStandaloneCodeEditor;
  readonly onCursor = new Emitter<{ line: number; col: number }>();
  private models = new Map<string, monaco.editor.ITextModel>();
  private viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>();
  private current: string | null = null;
  private libs = new Map<string, monaco.IDisposable>();
  private project: ProjectModel | null = null;
  private suppress = false;
  schemaProvider: (() => Promise<SchemaInfo | null>) | null = null;

  constructor() {
    this.el = h('div', { class: 'code-editor' });
    CodeEditor.configureTypeScript();
    this.editor = monaco.editor.create(this.el, {
      theme: 'jsd-light',
      automaticLayout: true,
      // Turkish letters (ı, ş, ğ…) are not "ambiguous" for our users.
      unicodeHighlight: { ambiguousCharacters: false },
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 20,
      minimap: { enabled: true, scale: 1, renderCharacters: false },
      smoothScrolling: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      fixedOverflowWidgets: true,
      padding: { top: 8 },
    });
    this.editor.onDidChangeCursorPosition((e) => this.onCursor.emit({ line: e.position.lineNumber, col: e.position.column }));
    this.registerProviders();
  }

  static configured = false;

  static configureTypeScript(): void {
    if (CodeEditor.configured) return;
    CodeEditor.configured = true;
    const opts = {
      target: ts.ScriptTarget.ES2020,
      lib: ['es2022', 'dom', 'dom.iterable'],
      allowNonTsExtensions: true,
      noEmit: true,
      strict: false,
      noImplicitAny: false,
      noImplicitThis: true,
      moduleDetection: 3, // "force": every unit is its own module, like the generated FormN.js
    };
    ts.typescriptDefaults.setCompilerOptions(opts);
    ts.javascriptDefaults.setCompilerOptions({ ...opts, allowJs: true, checkJs: false });
    ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: [1375, 1378, 7044, 80001, 80004, 80005, 6133] });
    ts.typescriptDefaults.setEagerModelSync(true);
    ts.typescriptDefaults.addExtraLib(vclGlobalDts, 'file:///lib/vcl.global.d.ts');
    ts.javascriptDefaults.addExtraLib(vclGlobalDts, 'file:///lib/vcl.global.d.ts');
  }

  setProject(project: ProjectModel): void {
    this.project = project;
    for (const f of project.forms) this.updateDeclarations(f);
  }

  /** Regenerates the per-form IntelliSense declarations (called on design/code changes). */
  updateDeclarations(doc: FormDoc): void {
    const key = doc.id;
    this.libs.get(key)?.dispose();
    this.libs.set(key, ts.typescriptDefaults.addExtraLib(formDeclarations(doc), `file:///decl/${doc.id}.d.ts`));
  }

  removeDeclarations(doc: FormDoc): void {
    this.libs.get(doc.id)?.dispose();
    this.libs.delete(doc.id);
  }

  /* ---------------------------------------------------------- models */

  unitModel(doc: FormDoc): monaco.editor.ITextModel {
    const uri = unitUri(doc);
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(doc.code, 'typescript', uri);
      model.onDidChangeContent(() => {
        if (this.suppress) return;
        doc.setCode(model!.getValue());
        this.lint(doc);
      });
      this.models.set(uri.toString(), model);
      this.lint(doc);
    }
    return model;
  }

  textModel(key: string, text: string, language: string): monaco.editor.ITextModel {
    const uri = monaco.Uri.parse(`inmemory://view/${key}`);
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel(text, language, uri);
      this.models.set(uri.toString(), model);
    } else if (model.getValue() !== text) model.setValue(text);
    return model;
  }

  /** Swap the model of the single editor instance (view state kept per model). */
  show(model: monaco.editor.ITextModel, readOnly = false): void {
    const key = model.uri.toString();
    if (this.current && this.current !== key) this.viewStates.set(this.current, this.editor.saveViewState());
    if (this.editor.getModel() !== model) this.editor.setModel(model);
    this.editor.updateOptions({ readOnly });
    const vs = this.viewStates.get(key);
    if (vs) this.editor.restoreViewState(vs);
    this.current = key;
    requestAnimationFrame(() => this.editor.layout());
  }

  /** Replace a unit's text after a remote/restore update without echoing a save. */
  syncUnit(doc: FormDoc): void {
    const model = monaco.editor.getModel(unitUri(doc));
    if (model && model.getValue() !== doc.code) {
      this.suppress = true;
      model.setValue(doc.code);
      this.suppress = false;
    }
    this.lint(doc);
  }

  renameUnit(doc: FormDoc, oldName: string): void {
    const old = monaco.editor.getModel(monaco.Uri.parse(`file:///project/forms/${oldName}.ts`));
    const code = (old?.getValue() ?? doc.code).replace(new RegExp(`\\b${oldName}\\.prototype\\b`, 'g'), `${doc.name}.prototype`);
    old?.dispose();
    doc.setCode(code);
    this.unitModel(doc);
    this.updateDeclarations(doc);
  }

  focus(): void {
    this.editor.focus();
  }

  reveal(line: number, col = 1): void {
    this.editor.revealLineInCenter(line);
    this.editor.setPosition({ lineNumber: line, column: col });
    this.editor.focus();
  }

  layout(): void {
    this.editor.layout();
  }

  /* ----------------------------------------------------------- stubs */

  /**
   * Ensures `FormN.prototype.handler = function (Sender, e) { };` exists in the unit and
   * returns the line to place the caret on (Delphi: double-click an event → code).
   */
  ensureStub(doc: FormDoc, handler: string, component: string, event: string, cls: string): number {
    const model = this.unitModel(doc);
    const form = doc.root.name;
    const re = new RegExp(`^\\s*${form}\\.prototype\\.${handler}\\s*=`, 'm');
    const text = model.getValue();
    const m = re.exec(text);
    if (m) return text.slice(0, m.index).split('\n').length + 1;
    const sig = eventSignature(cls, event, cls === 'TForm' ? form : cls);
    const stub = `\n/** ${component}.${event} — ${sig} */\n${form}.prototype.${handler} = function (Sender, e) {\n  \n};\n`;
    const last = model.getLineCount();
    const prefix = text.endsWith('\n') || !text ? '' : '\n';
    model.pushEditOperations([], [{ range: new monaco.Range(last, model.getLineMaxColumn(last), last, model.getLineMaxColumn(last)), text: prefix + stub }], () => null);
    return model.getLineCount() - 2;
  }

  /* ------------------------------------------------------ lint/markers */

  lint(doc: FormDoc): void {
    const model = monaco.editor.getModel(unitUri(doc));
    if (!model) return;
    const markers: monaco.editor.IMarkerData[] = [];
    const text = model.getValue();
    const form = doc.root.name;
    const defined = new Set([...text.matchAll(new RegExp(`\\b${form}\\.prototype\\.(\\w+)\\s*=`, 'g'))].map((m) => m[1]));
    for (const [handler, uses] of doc.handlers()) {
      if (defined.has(handler)) continue;
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `'${handler}' olay işleyicisi tasarımda bağlı (${uses.map((u) => `${u.component}.${u.event}`).join(', ')}) ama kodda tanımlı değil. Hızlı düzeltme: iskelet oluştur.`,
        startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: model.getLineMaxColumn(1),
        code: `missing-handler:${handler}`,
        source: 'vcl',
      });
    }
    const referenced = new Set(doc.handlers().keys());
    text.split('\n').forEach((line, i) => {
      const n = i + 1;
      const push = (sev: monaco.MarkerSeverity, message: string, re: RegExp) => {
        const m = re.exec(line);
        if (m) markers.push({ severity: sev, message, startLineNumber: n, startColumn: m.index + 1, endLineNumber: n, endColumn: m.index + 1 + m[0].length, source: 'vcl' });
      };
      push(monaco.MarkerSeverity.Warning, 'SQL injection riski: değerleri SQL metnine eklemeyin; :parametre kullanıp ParamByName(...).Value ile bağlayın.', /\.SQL\.(Text\s*=|Add\s*\().*(\+|\$\{)/);
      push(monaco.MarkerSeverity.Warning, 'Güvenlik: eval/new Function çalışma zamanında kod çalıştırır.', /\b(eval\s*\(|new\s+Function\s*\()/);
      push(monaco.MarkerSeverity.Warning, 'Güvenlik (XSS): innerHTML/document.write yerine textContent veya VCL bileşenleri kullanın.', /(\.innerHTML\s*=|document\.write\s*\()/);
      push(monaco.MarkerSeverity.Warning, 'Olay işleyicisi ok fonksiyonu olmamalı: `this` forma bağlanmaz. function (Sender, e) { … } kullanın.', new RegExp(`${form}\\.prototype\\.\\w+\\s*=\\s*(async\\s*)?\\(`));
      const m = new RegExp(`^\\s*${form}\\.prototype\\.(\\w+)\\s*=`).exec(line);
      if (m && !referenced.has(m[1]) && /_On[A-Z]|^(Before|After|On)/.test(m[1])) {
        markers.push({ severity: monaco.MarkerSeverity.Hint, message: `'${m[1]}' hiçbir bileşen olayına bağlı değil.`, startLineNumber: n, startColumn: line.indexOf(m[1]) + 1, endLineNumber: n, endColumn: line.indexOf(m[1]) + 1 + m[1].length, tags: [monaco.MarkerTag.Unnecessary], source: 'vcl' });
      }
    });
    monaco.editor.setModelMarkers(model, 'vcl', markers);
  }

  markersFor(doc: FormDoc): monaco.editor.IMarker[] {
    return monaco.editor.getModelMarkers({ resource: unitUri(doc) });
  }

  /* -------------------------------------------------------- providers */

  private docForModel(model: monaco.editor.ITextModel): FormDoc | undefined {
    const m = /\/forms\/(\w+)\.ts$/.exec(model.uri.path);
    return m ? this.project?.formByName(m[1]) : undefined;
  }

  private registerProviders(): void {
    const colorItems = (range: monaco.IRange): monaco.languages.CompletionItem[] =>
      vcl.ColorNames.filter((c) => c.startsWith('cl')).map((c) => ({
        label: c,
        kind: monaco.languages.CompletionItemKind.Color,
        insertText: `'${c}'`,
        documentation: vcl.ColorToRGB(c),
        detail: 'VCL rengi',
        range,
      }));

    monaco.languages.registerCompletionItemProvider('typescript', {
      triggerCharacters: ["'", '"', '.', ' '],
      provideCompletionItems: async (model, position) => {
        const doc = this.docForModel(model);
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
        const suggestions: monaco.languages.CompletionItem[] = [];
        // SQL context: table/column names from the live schema
        if (/SQL\.(Text\s*=|Add\s*\()\s*['"`][^'"`]*$/.test(line) && this.schemaProvider) {
          const schema = await this.schemaProvider();
          for (const t of schema?.tables ?? []) {
            suggestions.push({ label: t.name, kind: monaco.languages.CompletionItemKind.Struct, insertText: t.name, detail: `tablo (${t.columns.length} kolon)`, range });
            for (const c of t.columns) suggestions.push({ label: `${c.name}`, kind: monaco.languages.CompletionItemKind.Field, insertText: c.name, detail: `${t.name}.${c.name}: ${c.type}`, range });
          }
          return { suggestions };
        }
        if (/Color\s*=\s*$|Color\s*=\s*['"]$/.test(line)) return { suggestions: colorItems(range) };
        if (/[.'"]\s*$/.test(line)) return { suggestions: [] };
        const form = doc?.root.name ?? 'Form1';
        const snip = (label: string, insertText: string, documentation: string) =>
          suggestions.push({ label, kind: monaco.languages.CompletionItemKind.Snippet, insertText, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, documentation, detail: 'JS-Delphi kod parçası', range });
        snip('olay', `${form}.prototype.\${1:Button1}_On\${2:Click} = function (Sender, e) {\n\t$0\n};`, 'Form metoduna olay işleyicisi ekler');
        snip('showmessage', "await ShowMessage('${1:Mesaj}');", 'Bilgi kutusu (ShowMessage)');
        snip('messagedlg', "if (await MessageDlg('${1:Emin misiniz?}', 'mtConfirmation', ['mbYes', 'mbNo']) === mrYes) {\n\t$0\n}", 'Onay kutusu');
        snip('qopen', "this.${1:Query1}.ParamByName('${2:param}').AsString = ${3:deger};\nawait this.${1:Query1}.Refresh();", 'Parametreli sorguyu çalıştır');
        snip('foreach', "const ds = this.${1:Query1};\nds.First();\nwhile (!ds.Eof) {\n\tconst ${2:ad} = ds.FieldByName('${3:alan}').AsString;\n\t$0\n\tds.Next();\n}", 'Veri kümesinde dolaş (First/Eof/Next)');
        snip('execsql', "const n = await this.${1:qryEkle}.ExecSQL();\nawait ShowMessage(n + ' kayıt etkilendi');", 'INSERT/UPDATE/DELETE çalıştır');
        snip('showform', "const sonuc = await ${1:Form2}.ShowModal();\nif (sonuc === mrOk) {\n\t$0\n}", 'Formu modal göster');
        for (const cls of vcl.GetRegisteredClassNames()) {
          const info = vcl.GetClassInfo(cls);
          if (!info || info.abstract) continue;
          suggestions.push({ label: cls, kind: monaco.languages.CompletionItemKind.Class, insertText: cls, detail: `VCL · ${info.palette ?? ''}`, documentation: { value: `**${cls}** — ${info.hint ?? ''}\n\nYeni örnek: \`${cls}.Create(this)\`` }, range, sortText: `~${cls}` });
        }
        return { suggestions };
      },
    });

    monaco.languages.registerHoverProvider('typescript', {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        const doc = this.docForModel(model);
        if (!word) return null;
        const info = vcl.GetClassInfo(word.word);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        if (info && !info.abstract) {
          return { range, contents: [{ value: `**${info.name}** \`${info.ancestors.concat(info.name).join(' → ')}\`` }, { value: `${info.hint ?? ''}\n\nVarsayılan olay: \`${info.defaultEvent ?? '-'}\` · Palet: ${info.palette ?? '-'}` }] };
        }
        const node = doc?.find(word.word)?.node;
        if (node && doc && node !== doc.root) {
          const p = node.props ?? {};
          const bounds = p.Left !== undefined ? `(${p.Left}, ${p.Top}) ${p.Width}×${p.Height}` : 'görsel olmayan bileşen';
          const extras = Object.entries(p).filter(([k]) => !['Left', 'Top', 'Width', 'Height', 'DesignLeft', 'DesignTop'].includes(k)).slice(0, 6).map(([k, v]) => `- ${k}: \`${JSON.stringify(v).slice(0, 60)}\``).join('\n');
          const events = Object.entries(node.events ?? {}).map(([k, v]) => `- ${k} → \`${v}\``).join('\n');
          return { range, contents: [{ value: `**${node.name}**: ${node.class} — ${bounds}` }, { value: `${extras}${events ? `\n\n**Olaylar**\n${events}` : ''}` }] };
        }
        return null;
      },
    });

    monaco.languages.registerCodeActionProvider('typescript', {
      provideCodeActions: (model, _range, context) => {
        const doc = this.docForModel(model);
        if (!doc) return { actions: [], dispose: () => undefined };
        const actions: monaco.languages.CodeAction[] = [];
        for (const mk of context.markers) {
          const code = typeof mk.code === 'string' ? mk.code : '';
          if (!code.startsWith('missing-handler:')) continue;
          const handler = code.split(':')[1];
          const use = doc.handlers().get(handler)?.[0];
          const sig = use ? eventSignature(use.cls, use.event, use.cls === 'TForm' ? doc.root.name : use.cls) : 'Sender, e';
          const last = model.getLineCount();
          actions.push({
            title: `'${handler}' için iskelet oluştur`,
            kind: 'quickfix',
            diagnostics: [mk],
            isPreferred: true,
            edit: { edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: new monaco.Range(last, model.getLineMaxColumn(last), last, model.getLineMaxColumn(last)), text: `\n/** ${sig} */\n${doc.root.name}.prototype.${handler} = function (Sender, e) {\n  \n};\n` } }] },
          });
        }
        return { actions, dispose: () => undefined };
      },
    });
  }
}
