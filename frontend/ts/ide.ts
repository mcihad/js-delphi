/**
 * JS-Delphi IDE — application shell.
 *
 *  ┌ menu / toolbar ─────────────────────────────────────────────────────────┐
 *  │ Tool Palette │ Form Designer · Code (Monaco) · Preview │ Object Inspector │
 *  │──────────────┴─────────────────────────────────────────┴──────────────────│
 *  │ Project Explorer │ Messages │ Output                                      │
 *  └ status bar ─────────────────────────────────────────────────────────────┘
 */
import * as vcl from '@vcl';
import { api, SyncClient, type BuildResult, type Peer, type ProjectListItem, type SchemaInfo } from './api/client';
import { Dialog, clear, closeMenus, confirmDialog, debounce, downloadBlob, h, icon, menubar, splitter, toast, type MenuItem } from './core/dom';
import { FormDesigner } from './designer/designer';
import { CodeEditor } from './editor/code-editor';
import { MessagesPanel, OutputPanel, ProjectExplorer, type MessageItem } from './explorer/panels';
import { ObjectInspector } from './inspector/inspector';
import { FormDoc, ProjectModel } from './model/project';
import { ToolPalette } from './palette/palette';
import { PreviewPane } from './preview/preview';
import { connectionManager, migrationsDialog, schemaBrowser, sqlEditor } from './data/data-dialogs';
import { monaco } from '../vendor/monaco';

type View = 'design' | 'code' | 'tson' | 'preview';

class Ide {
  project: ProjectModel | null = null;
  active: FormDoc | null = null;
  view: View = 'design';
  openDocs: FormDoc[] = [];
  lastBuild: BuildResult | null = null;
  previewToken = '';
  readonly sync = new SyncClient();
  readonly palette = new ToolPalette();
  readonly designer = new FormDesigner();
  readonly code = new CodeEditor();
  readonly preview = new PreviewPane();
  readonly messages = new MessagesPanel();
  readonly output = new OutputPanel();
  readonly inspector: ObjectInspector;
  readonly explorer: ProjectExplorer;
  private schemas = new Map<string, Promise<SchemaInfo | null>>();
  private docTabs = h('div', { class: 'doc-tabs' });
  private viewTabs = h('div', { class: 'view-tabs' });
  private center = h('div', { class: 'center-views' });
  private status = { left: h('span', { class: 'sb-item' }), save: h('span', { class: 'sb-item' }), pos: h('span', { class: 'sb-item' }), peers: h('span', { class: 'sb-peers' }), conn: h('span', { class: 'sb-item' }), msgs: h('span', { class: 'sb-item' }) };
  private titleEl = h('span', { class: 'app-project' });
  private toolbarToggles = new Map<string, HTMLButtonElement>();
  private bottomTabs = h('div', { class: 'bottom-tabs' });
  private liveRun = debounce(() => void this.run(true), 900);

  constructor() {
    this.inspector = new ObjectInspector({
      project: () => this.project,
      schemaFor: (name) => this.schemaFor(name),
      editSql: (c) => void this.editSql(c),
      manageConnections: () => void this.manageConnections(),
      goToHandler: (c, ev, handler) => this.goToHandler(c, ev, handler),
      renameForm: (doc, name) => this.renameForm(doc, name),
      uploadAsset: () => this.uploadAsset(),
    });
    this.explorer = new ProjectExplorer({
      openForm: (doc, view) => this.openForm(doc, view),
      selectComponent: (doc, name) => {
        this.openForm(doc, 'design');
        this.designer.select([name]);
      },
      newForm: () => void this.newForm(),
      deleteForm: (doc) => void this.deleteForm(doc),
      setMainForm: (doc) => void this.setMainForm(doc),
      manageConnections: () => void this.manageConnections(),
      browseSchema: (id) => this.project && void schemaBrowser(this.project, id),
      openBuildFile: (p) => void this.openBuildFile(p),
    });
  }

  /* ================================================================ boot */

  async start(): Promise<void> {
    const root = document.getElementById('ide')!;
    root.classList.remove('ide-boot');
    clear(root);
    root.append(this.buildLayout());
    this.wire();
    try {
      const user = await api.ensureLogin();
      this.output.log(`Oturum: ${user.display_name || user.username}`, 'dim');
      vcl.DataService.Configure({ transport: (path, body) => api.post(path, body) });
      const projects = await api.projects();
      const last = localStorage.getItem('jsd.project');
      const pick = projects.find((p) => p.id === last) ?? projects[0];
      if (pick) await this.openProject(pick.id);
      else await this.createProject('Project1', 'Yeni Proje', 'blank');
    } catch (e) {
      toast(`Başlatılamadı: ${e instanceof Error ? e.message : e}`, 'error', 10000);
      this.output.log(String(e), 'err');
    }
  }

  private buildLayout(): HTMLElement {
    const logo = h('div', { class: 'app-logo', title: 'JS-Delphi' }, h('span', { text: 'JS' }));
    const bar = menubar([
      { label: 'Dosya', items: () => this.menuFile() },
      { label: 'Düzen', items: () => this.menuEdit() },
      { label: 'Görünüm', items: () => this.menuView() },
      { label: 'Proje', items: () => this.menuProject() },
      { label: 'Çalıştır', items: () => this.menuRun() },
      { label: 'Veritabanı', items: () => this.menuDb() },
      { label: 'Yardım', items: () => this.menuHelp() },
    ]);
    const header = h('header', { class: 'app-header' }, logo, bar, h('span', { class: 'flex' }), this.titleEl, this.status.peers);
    const tb = h('div', { class: 'toolbar' });
    const btn = (ic: string, title: string, fn: () => void, cls = '') => {
      const b = h('button', { class: `tb-btn ${cls}`, title }, icon(ic, 16));
      b.addEventListener('click', fn);
      tb.append(b);
      return b;
    };
    const sep = () => tb.append(h('span', { class: 'tb-sep' }));
    btn('new', 'Yeni proje', () => void this.newProjectDialog());
    btn('open', 'Proje aç', () => void this.openProjectDialog());
    btn('save', 'Tümünü kaydet (Ctrl+S)', () => void this.saveAll());
    sep();
    btn('undo', 'Geri al (Ctrl+Z)', () => this.undo());
    btn('redo', 'Yinele (Ctrl+Y)', () => this.redo());
    sep();
    btn('cut', 'Kes', () => this.designer.copySelection(true));
    btn('copy', 'Kopyala', () => this.designer.copySelection());
    btn('paste', 'Yapıştır', () => this.designer.paste());
    btn('delete', 'Sil', () => this.designer.deleteSelection());
    sep();
    for (const [ic, cmd, title] of [['alignLeft', 'left', 'Sola hizala'], ['alignHCenter', 'hcenter', 'Yatay ortala'], ['alignRight', 'right', 'Sağa hizala'], ['alignTop', 'top', 'Üste hizala'], ['alignVCenter', 'vcenter', 'Dikey ortala'], ['alignBottom', 'bottom', 'Alta hizala'], ['sameWidth', 'sameWidth', 'Aynı genişlik'], ['sameHeight', 'sameHeight', 'Aynı yükseklik'], ['front', 'front', 'Öne getir'], ['back', 'back', 'Arkaya gönder']] as const) {
      btn(ic, title, () => this.designer.align(cmd));
    }
    sep();
    this.toolbarToggles.set('grid', btn('grid', 'Izgarayı göster', () => this.toggleSetting('showGrid'), 'toggle'));
    this.toolbarToggles.set('snap', btn('magnet', 'Izgaraya yapış (snap-to-grid)', () => this.toggleSetting('snapToGrid'), 'toggle'));
    this.toolbarToggles.set('guides', btn('guides', 'Hizalama kılavuzları', () => this.toggleSetting('showGuides'), 'toggle'));
    sep();
    const build = h('button', { class: 'tb-btn tb-text', title: 'Derle (Ctrl+F9)' }, icon('build', 16), h('span', { text: 'Derle' }));
    build.addEventListener('click', () => void this.build());
    const run = h('button', { class: 'tb-btn tb-text tb-run', title: 'Çalıştır (F9)' }, icon('run', 16), h('span', { text: 'Çalıştır' }));
    run.addEventListener('click', () => void this.run());
    tb.append(build, run);
    btn('stop', 'Durdur', () => this.stop(), 'tb-stop');
    sep();
    btn('database', 'Veritabanı bağlantıları', () => void this.manageConnections());
    btn('table', 'Şema tarayıcı', () => this.project && void schemaBrowser(this.project));
    btn('migration', 'Migration yönetimi', () => this.project && void migrationsDialog(this.project));
    sep();
    btn('export', 'Dışa aktar (zip)', () => void this.exportZip());
    btn('history', 'Sürüm geçmişi', () => void this.historyDialog());

    // center
    const views = h('div', { class: 'center' }, this.docTabs, this.center, this.viewTabs);
    this.center.append(this.designer.el, this.code.el, this.preview.el);
    const left = h('aside', { class: 'side side-left' }, this.palette.el);
    const right = h('aside', { class: 'side side-right' }, this.inspector.el);
    const main = h('div', { class: 'main' }, left, splitter(left, 'x', { min: 160, max: 420 }), views, splitter(right, 'x', { invert: true, min: 240, max: 560 }), right);
    // bottom dock
    const bottomRight = h('div', { class: 'bottom-right' }, this.bottomTabs, this.messages.el, this.output.el);
    const explorerWrap = h('div', { class: 'bottom-left' }, this.explorer.el);
    const bottom = h('div', { class: 'bottom' }, explorerWrap, splitter(explorerWrap, 'x', { min: 200, max: 700 }), bottomRight);
    const tabBtn = (label: string, ic: string, show: 'messages' | 'output') => {
      const b = h('button', { class: `btab ${show === 'messages' ? 'active' : ''}`, dataset: { show } }, icon(ic, 13), h('span', { text: label }), show === 'messages' ? this.status.msgs : '');
      b.addEventListener('click', () => this.showBottom(show));
      return b;
    };
    this.bottomTabs.append(tabBtn('Messages', 'warning', 'messages'), tabBtn('Output', 'terminal', 'output'));
    this.output.el.classList.add('hidden');
    const statusbar = h('footer', { class: 'statusbar' }, this.status.left, this.status.save, h('span', { class: 'flex' }), this.status.pos, this.status.conn, h('span', { class: 'sb-item', text: `VCL ${vcl.VCL_VERSION}` }));
    return h('div', { class: 'app' }, header, tb, main, splitter(bottom, 'y', { invert: true, min: 120, max: 600 }), bottom, statusbar);
  }

  private showBottom(which: 'messages' | 'output'): void {
    this.messages.el.classList.toggle('hidden', which !== 'messages');
    this.output.el.classList.toggle('hidden', which !== 'output');
    this.bottomTabs.querySelectorAll('.btab').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.show === which));
  }

  private wire(): void {
    this.designer.onSelect.on((sel) => {
      this.inspector.render();
      if (this.active) this.sync.send({ type: 'presence', state: { form: this.active.name, selection: sel } });
      const c = sel[0] ? this.active?.find(sel[0])?.node : null;
      this.status.left.textContent = c ? `${c.name}: ${c.class === 'TForm' ? `T${c.name}` : c.class}` : '';
    });
    this.designer.onStatus.on((s) => (this.status.pos.textContent = s));
    this.designer.onDefaultEvent.on(({ name, cls }) => this.defaultEvent(name, cls));
    this.designer.onLoadWarnings.on((w) => this.messages.replaceSource('Tasarım', w.map((text) => ({ level: 'warning', source: 'Tasarım', text, form: this.active?.name }))));
    this.designer.onPlaced = () => this.palette.pick(null);
    this.palette.onPick.on((cls) => {
      if (cls === 'TForm') {
        this.palette.pick(null);
        void this.newForm();
        return;
      }
      this.designer.placing = cls;
      this.designer.el.classList.toggle('placing', !!cls);
      if (this.view !== 'design') this.setView('design');
    });
    this.palette.onQuickAdd.on((cls) => {
      if (cls === 'TForm') return void this.newForm();
      const form = this.designer.liveForm;
      if (!form) return;
      const info = vcl.GetClassInfo(cls);
      const n = form.Components.length;
      this.designer.create(cls, form, info?.visual ? 16 + (n % 10) * 8 : 16 + (n % 8) * 40, info?.visual ? 16 + (n % 10) * 8 : Math.max(8, form.ClientHeight - 48));
    });
    this.inspector.onChanged.on(() => this.explorerLater());
    this.code.onCursor.on(({ line, col }) => {
      if (this.view === 'code') this.status.pos.textContent = `Satır ${line}, Sütun ${col}`;
    });
    this.code.schemaProvider = async () => {
      const name = this.project?.connections[0]?.name;
      return name ? this.schemaFor(name) : null;
    };
    this.messages.onActivate.on((m) => this.activateMessage(m));
    this.messages.onCount.on(({ errors, warnings }) => (this.status.msgs.textContent = errors + warnings ? ` ${errors}✖ ${warnings}⚠` : ''));
    this.preview.onMessage.on((m) => this.runtimeMessage(m));
    this.preview.onReload.on(() => void this.run());
    this.sync.onPeers.on((peers) => this.renderPeers(peers));
    this.sync.onStatus.on((s) => (this.status.conn.textContent = s === 'online' ? '● canlı senkron' : '○ çevrimdışı'));
    this.sync.onEvent.on((e) => this.remoteEvent(e));
    document.addEventListener('keydown', (e) => this.shortcut(e), true);
    window.addEventListener('beforeunload', (e) => {
      if (this.project?.dirty) {
        void this.project.flushAll();
        e.preventDefault();
      }
    });
    this.updateToggles();
  }

  /* ============================================================ project */

  async openProject(id: string): Promise<void> {
    this.sync.close();
    const p = await ProjectModel.load(id);
    this.project = p;
    this.openDocs = [];
    this.schemas.clear();
    localStorage.setItem('jsd.project', id);
    this.titleEl.textContent = `${p.data.title || p.data.name}`;
    document.title = `${p.data.title || p.data.name} — JS-Delphi IDE`;
    this.designer.applySettings(p.data.settings);
    this.updateToggles();
    this.code.setProject(p);
    for (const f of p.forms) this.watchDoc(f);
    p.onSaveState.on((s) => (this.status.save.textContent = s === 'saving' ? '⟳ Kaydediliyor…' : s === 'saved' ? '✓ Kaydedildi' : '⚠ Kaydedilemedi'));
    p.onDirty.on(() => (this.status.save.textContent = '● Değişiklik var'));
    p.onConnections.on(() => {
      this.schemas.clear();
      this.explorer.render();
      this.inspector.render();
    });
    p.onFormsChanged.on(() => this.explorer.render());
    this.explorer.setProject(p);
    this.sync.connect(id);
    try {
      const t = await api.previewToken(id);
      this.previewToken = t.token;
      vcl.AssetResolver.Resolve = (src) => (src.startsWith('assets/') ? `/preview/${id}/${t.token}/${src}` : src);
    } catch {
      /* assets optional */
    }
    const main = p.formByName(p.data.main_form) ?? p.forms[0];
    this.openDocs = [...p.forms];
    this.active = null;
    this.openForm(main, 'design');
    this.output.log(`Proje açıldı: ${p.data.title} (${p.forms.length} form, ${p.connections.length} bağlantı)`, 'accent');
    this.messages.clear();
    for (const f of p.forms) this.reportWarnings(f);
  }

  private watchDoc(doc: FormDoc): void {
    const decl = debounce(() => {
      this.code.updateDeclarations(doc);
      this.code.lint(doc);
    }, 400);
    doc.onChange.on(({ kind, source }) => {
      if (kind === 'design' || kind === 'code') decl();
      if (kind === 'design') {
        this.explorerLater();
        if (this.view === 'tson' && doc === this.active) this.showTson();
      }
      if (kind === 'reload') {
        if (doc === this.active) {
          this.designer.reload();
          this.inspector.render();
          if (this.view === 'tson') this.showTson();
        }
        this.code.syncUnit(doc);
        decl();
        this.explorerLater();
        if (source === 'remote') toast(`${doc.name} başka bir kullanıcı tarafından güncellendi`, 'info');
      }
      if (kind === 'saved') {
        this.reportWarnings(doc);
        if (this.project?.data.settings.livePreview && this.preview.running) this.liveRun();
      }
      this.renderDocTabs();
    });
  }

  private reportWarnings(doc: FormDoc): void {
    this.messages.replaceSource(`Tasarım:${doc.name}`, doc.warnings.map((text) => ({ level: 'warning', source: `Tasarım:${doc.name}`, text, file: `forms/${doc.name}.design.tson`, form: doc.name })));
  }

  private explorerLater = debounce(() => this.explorer.render(), 250);

  async createProject(name: string, title: string, template: 'blank' | 'demo'): Promise<void> {
    const p = await api.createProject(name, title, template);
    await this.openProject(p.id);
  }

  /* ============================================================ documents */

  openForm(doc: FormDoc, view: View = 'design'): void {
    if (!this.openDocs.includes(doc)) this.openDocs.push(doc);
    const switching = this.active !== doc;
    this.active = doc;
    if (switching) {
      this.designer.open(doc);
      this.inspector.attach(this.designer);
    }
    this.setView(view);
    this.renderDocTabs();
  }

  setView(view: View): void {
    this.view = view;
    this.designer.el.classList.toggle('hidden', view !== 'design');
    this.code.el.classList.toggle('hidden', view !== 'code' && view !== 'tson');
    this.preview.el.classList.toggle('hidden', view !== 'preview');
    if (view === 'code' && this.active) {
      this.code.show(this.code.unitModel(this.active));
      this.code.focus();
    } else if (view === 'tson') this.showTson();
    else if (view === 'design') {
      this.designer.renderOverlay();
      this.designer.focus();
    }
    this.renderViewTabs();
    this.renderDocTabs();
  }

  private showTson(): void {
    if (!this.active) return;
    const text = JSON.stringify(this.active.design, null, 2);
    this.code.show(this.code.textModel(`${this.active.id}.design.tson`, text, 'json'), true);
  }

  private renderDocTabs(): void {
    clear(this.docTabs);
    for (const d of this.openDocs) {
      const isActive = d === this.active && this.view !== 'preview';
      const tab = h('div', { class: `doc-tab ${isActive ? 'active' : ''}` }, icon(this.view === 'code' && isActive ? 'code' : 'form', 14), h('span', { text: `${d.name}${d.dirty ? ' •' : ''}` }));
      tab.addEventListener('click', () => this.openForm(d, this.view === 'preview' ? 'design' : this.view));
      const close = h('span', { class: 'doc-close' }, icon('close', 11));
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openDocs = this.openDocs.filter((x) => x !== d);
        if (this.active === d && this.openDocs.length) this.openForm(this.openDocs[0], 'design');
        this.renderDocTabs();
      });
      if (this.openDocs.length > 1) tab.append(close);
      this.docTabs.append(tab);
    }
    if (this.preview.running) {
      const tab = h('div', { class: `doc-tab doc-run ${this.view === 'preview' ? 'active' : ''}` }, icon('run', 12), h('span', { text: 'Çalışan uygulama' }));
      tab.addEventListener('click', () => this.setView('preview'));
      this.docTabs.append(tab);
    }
  }

  private renderViewTabs(): void {
    clear(this.viewTabs);
    const mk = (v: View, label: string, ic: string, key?: string) => {
      const b = h('button', { class: `vtab ${this.view === v ? 'active' : ''}` }, icon(ic, 13), h('span', { text: label }), key ? h('kbd', { text: key }) : '');
      b.addEventListener('click', () => this.setView(v));
      this.viewTabs.append(b);
    };
    mk('code', 'Kod', 'code', 'F12');
    mk('design', 'Tasarım', 'design', 'F12');
    mk('tson', 'Tasarım dosyası (.tson)', 'file');
    const hist = h('button', { class: 'vtab' }, icon('history', 13), h('span', { text: 'Geçmiş' }));
    hist.addEventListener('click', () => void this.historyDialog());
    this.viewTabs.append(hist);
  }

  /* ============================================================== events */

  private defaultEvent(name: string, cls: string): void {
    const doc = this.active;
    if (!doc) return;
    const info = vcl.GetClassInfo(cls);
    const event = info?.defaultEvent ?? 'OnClick';
    if (!info?.events.some((e) => e.name === event)) return;
    const node = doc.find(name)?.node;
    const handler = node?.events?.[event] ?? `${name}_${event}`;
    if (!node?.events?.[event]) this.designer.setEvent(name, event, handler);
    this.goToHandler(name, event, handler);
  }

  goToHandler(component: string, event: string, handler: string): void {
    const doc = this.active;
    if (!doc) return;
    const cls = doc.find(component)?.node.class ?? 'TForm';
    const line = this.code.ensureStub(doc, handler, component, event, cls);
    this.code.updateDeclarations(doc);
    this.setView('code');
    this.code.reveal(line, 3);
    this.output.log(`${component}.${event} → ${doc.name}.prototype.${handler}`, 'dim');
  }

  private async editSql(component: string): Promise<void> {
    const doc = this.active;
    if (!doc || !this.project) return;
    const node = doc.find(component)?.node;
    if (!node) return;
    const connRef = node.props?.Connection as string | undefined;
    const connName = connRef ? (doc.find(connRef)?.node.props?.ConnectionDefName as string | undefined) ?? null : null;
    const r = await sqlEditor(this.project, `${component}.SQL`, connName, (node.props?.SQL as string[]) ?? [], (node.props?.Params as Array<{ Name: string }>) ?? []);
    if (!r) return;
    this.designer.setProp(component, 'SQL', r.sql);
    this.designer.setProp(component, 'Params', r.params);
    this.inspector.render();
  }

  private async schemaFor(connectionName: string): Promise<SchemaInfo | null> {
    const conn = this.project?.connections.find((c) => c.name === connectionName);
    if (!conn) return null;
    if (!this.schemas.has(conn.id)) this.schemas.set(conn.id, api.schema(conn.id).catch((e) => {
      toast(`Şema alınamadı: ${e.message}`, 'error');
      this.schemas.delete(conn.id);
      return null;
    }));
    return this.schemas.get(conn.id)!;
  }

  private async manageConnections(): Promise<void> {
    if (!this.project) return;
    await connectionManager(this.project);
  }

  private async uploadAsset(): Promise<string | null> {
    const input = h('input', { attrs: { type: 'file', accept: 'image/*' } });
    const file = await new Promise<File | null>((resolve) => {
      input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
      input.click();
    });
    if (!file || !this.project) return null;
    const r = await api.uploadAsset(this.project.data.id, file);
    toast(`${r.path} yüklendi`, 'success');
    return r.path;
  }

  /* ========================================================= build / run */

  async saveAll(): Promise<void> {
    await this.project?.flushAll();
    toast('Tüm değişiklikler kaydedildi', 'success', 1800);
  }

  private reportBuild(r: BuildResult, label: string): void {
    this.lastBuild = r;
    const items: MessageItem[] = [
      ...r.errors.map((m) => ({ level: 'error' as const, source: 'Derleme', text: m.message, file: m.file })),
      ...r.warnings.map((m) => ({ level: 'warning' as const, source: 'Derleme', text: m.message, file: m.file })),
    ];
    for (const f of this.project?.forms ?? []) {
      for (const mk of this.code.markersFor(f)) {
        if (mk.severity >= monaco.MarkerSeverity.Warning) items.push({ level: mk.severity === monaco.MarkerSeverity.Error ? 'error' : 'warning', source: mk.owner === 'vcl' ? 'Lint' : 'TypeScript', text: mk.message, file: `forms/${f.name}.ts`, line: mk.startLineNumber, col: mk.startColumn, form: f.name });
      }
    }
    this.messages.replaceSource('Derleme', items.filter((i) => i.source === 'Derleme'));
    this.messages.replaceSource('Lint', items.filter((i) => i.source === 'Lint'));
    this.messages.replaceSource('TypeScript', items.filter((i) => i.source === 'TypeScript'));
    this.output.log(`${label}: ${r.ok ? 'BAŞARILI' : 'HATALI'} · ${r.duration_ms} ms · değişen dosya ${r.changed}`, r.ok ? 'ok' : 'err');
    if (r.rebuilt_units.length) this.output.log(`  yeniden derlendi: ${r.rebuilt_units.join(', ')}`, 'plain');
    if (r.skipped_units.length) this.output.log(`  değişmedi (hash aynı, atlandı): ${r.skipped_units.join(', ')}`, 'dim');
    for (const f of r.files.filter((x) => x.changed)) this.output.log(`  → build/${f.path}  ${f.sha256.slice(0, 12)}  ${f.size} B`, 'dim');
    this.explorer.buildFiles = r.files;
    this.explorer.render();
    if (!r.ok) this.showBottom('messages');
  }

  async build(force = false): Promise<BuildResult | null> {
    if (!this.project) return null;
    await this.project.flushAll();
    this.output.log('Derleniyor (flatten_design → Jinja2)…', 'accent');
    try {
      const r = await api.build(this.project.data.id, force);
      this.reportBuild(r, 'Derleme');
      return r;
    } catch (e) {
      this.output.log(`Derleme başarısız: ${e instanceof Error ? e.message : e}`, 'err');
      return null;
    }
  }

  async run(live = false): Promise<void> {
    if (!this.project) return;
    await this.project.flushAll();
    this.output.log(live ? 'Canlı önizleme: yeniden derleniyor…' : 'Çalıştırılıyor…', 'accent');
    try {
      const r = await api.run(this.project.data.id);
      this.reportBuild(r.build, 'Derleme');
      if (!r.ok || !r.url || !r.token) {
        toast('Derleme hatalı — Messages paneline bakın', 'error');
        return;
      }
      this.messages.clear('Çalışma zamanı');
      this.preview.load(r.url, r.token);
      if (!live) this.setView('preview');
      this.renderDocTabs();
    } catch (e) {
      this.output.log(`Çalıştırılamadı: ${e instanceof Error ? e.message : e}`, 'err');
    }
  }

  stop(): void {
    this.preview.stop();
    if (this.view === 'preview') this.setView('design');
    this.renderDocTabs();
    this.output.log('Uygulama durduruldu', 'dim');
  }

  private runtimeMessage(m: { type: string; level?: string; args?: unknown[]; message?: string; file?: string; line?: number; col?: number; stack?: string }): void {
    if (m.type === 'ready') {
      this.output.log('Uygulama yüklendi (IDE köprüsü bağlandı)', 'ok');
      return;
    }
    if (m.type === 'console') {
      const text = (m.args ?? []).map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      this.output.log(`[console.${m.level}] ${text}`, m.level === 'error' ? 'err' : m.level === 'warn' ? 'accent' : 'plain');
      if (m.level === 'error' || m.level === 'warn') this.messages.add({ level: m.level === 'error' ? 'error' : 'warning', source: 'Çalışma zamanı', text });
      return;
    }
    if (m.type === 'error') {
      // map FormN.js:line back to forms/FormN.ts (sucrase keeps line numbers)
      const js = /\/(\w+)\.js$/.exec(m.file ?? '');
      let file = m.file?.replace(/.*\/preview\/[^/]+\/[^/]+\//, '') ?? null;
      let line = m.line ?? null;
      let form: string | undefined;
      const start = js ? this.lastBuild?.user_code_lines[js[1]] : undefined;
      if (js && start && line && line >= start) {
        form = js[1];
        file = `forms/${form}.ts`;
        line = line - start + 1;
      }
      this.messages.add({ level: 'error', source: 'Çalışma zamanı', text: m.message ?? 'Hata', file, line, col: m.col ?? null, form });
      this.output.log(`[hata] ${m.message}`, 'err');
      this.showBottom('messages');
    }
    if (m.type === 'terminated') this.output.log('Uygulama sonlandı (ana form kapatıldı)', 'dim');
  }

  private activateMessage(m: MessageItem): void {
    const p = this.project;
    if (!p) return;
    const name = m.form ?? /forms\/(\w+)\./.exec(m.file ?? '')?.[1];
    const doc = name ? p.formByName(name) : undefined;
    if (!doc) return;
    if (m.file?.endsWith('.ts') && m.line) {
      this.openForm(doc, 'code');
      this.code.reveal(m.line, m.col ?? 1);
    } else {
      this.openForm(doc, 'design');
      const comp = /^(\w+)[:.]/.exec(m.text)?.[1];
      if (comp && doc.find(comp)) this.designer.select([comp]);
    }
  }

  private async exportZip(): Promise<void> {
    if (!this.project) return;
    await this.project.flushAll();
    const blob = await api.exportZip(this.project.data.id);
    downloadBlob(blob, `${this.project.data.name}.zip`);
    this.output.log(`Dışa aktarıldı: ${this.project.data.name}.zip (${Math.round(blob.size / 1024)} KB)`, 'ok');
  }

  private async openBuildFile(path: string): Promise<void> {
    if (!this.project || !this.previewToken) return;
    const res = await fetch(`/preview/${this.project.data.id}/${this.previewToken}/${path}`);
    const text = await res.text();
    const lang = path.endsWith('.ts') ? 'typescript' : path.endsWith('.js') ? 'javascript' : path.endsWith('.html') ? 'html' : path.endsWith('.css') ? 'css' : path.endsWith('.json') ? 'json' : 'plaintext';
    this.code.el.classList.remove('hidden');
    this.designer.el.classList.add('hidden');
    this.preview.el.classList.add('hidden');
    this.view = 'tson';
    this.code.show(this.code.textModel(`build/${path}`, text, lang), true);
    this.renderViewTabs();
    this.output.log(`build/${path} (salt okunur, BuildService çıktısı)`, 'dim');
  }

  /* ================================================================ forms */

  async newForm(): Promise<void> {
    if (!this.project) return;
    const doc = await this.project.addForm();
    this.watchDoc(doc);
    this.code.updateDeclarations(doc);
    this.openForm(doc, 'design');
    this.output.log(`${doc.name} eklendi (forms/${doc.name}.design.tson + forms/${doc.name}.ts)`, 'ok');
  }

  async deleteForm(doc: FormDoc): Promise<void> {
    if (!this.project || !(await confirmDialog('Formu sil', `${doc.name} ve kod birimi silinsin mi?`, 'Sil', true))) return;
    await this.project.removeForm(doc);
    this.code.removeDeclarations(doc);
    this.openDocs = this.openDocs.filter((d) => d !== doc);
    if (this.active === doc) this.openForm(this.project.forms[0], 'design');
    this.renderDocTabs();
  }

  async setMainForm(doc: FormDoc): Promise<void> {
    if (!this.project) return;
    this.project.data = await api.updateProject(this.project.data.id, { main_form: doc.name });
    this.explorer.render();
    toast(`${doc.name} ana form yapıldı`, 'success');
  }

  async renameForm(doc: FormDoc, newName: string): Promise<void> {
    if (!this.project) return;
    await doc.flush();
    const old = doc.name;
    const r = await api.saveForm(this.project.data.id, doc.id, { name: newName });
    doc.name = r.name;
    doc.version = r.version;
    doc.design = r.design;
    this.code.renameUnit(doc, old);
    this.project.data = await api.project(this.project.data.id);
    this.designer.reload();
    this.designer.select([r.name]);
    this.explorer.render();
    this.renderDocTabs();
  }

  /* ============================================================ settings */

  private toggleSetting(key: 'showGrid' | 'snapToGrid' | 'showGuides'): void {
    if (!this.project) return;
    const s = this.project.data.settings;
    s[key] = !s[key];
    this.designer.applySettings(s);
    this.updateToggles();
    void api.updateProject(this.project.data.id, { settings: { [key]: s[key] } });
  }

  private updateToggles(): void {
    const s = this.designer.settings;
    this.toolbarToggles.get('grid')?.classList.toggle('on', s.showGrid);
    this.toolbarToggles.get('snap')?.classList.toggle('on', s.snapToGrid);
    this.toolbarToggles.get('guides')?.classList.toggle('on', s.showGuides);
  }

  private undo(): void {
    this.active?.undo();
  }

  private redo(): void {
    this.active?.redo();
  }

  private shortcut(e: KeyboardEvent): void {
    const inEditor = (e.target as HTMLElement).closest?.('.monaco-editor, input, textarea, select, .dlg');
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F9') {
      e.preventDefault();
      if (ctrl) void this.build();
      else void this.run();
    } else if (e.key === 'F12') {
      e.preventDefault();
      this.setView(this.view === 'design' ? 'code' : 'design');
    } else if (ctrl && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void this.saveAll();
    } else if (!inEditor && ctrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (!inEditor && ctrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
    } else if (e.key === 'Escape') closeMenus();
  }

  /* =============================================================== sync */

  private renderPeers(peers: Peer[]): void {
    clear(this.status.peers);
    for (const p of peers) {
      const a = h('span', { class: 'avatar', title: `${p.display_name}${p.state.form ? ` — ${p.state.form}` : ''}`, text: (p.display_name || p.username).slice(0, 2).toUpperCase() });
      a.style.background = p.color;
      this.status.peers.append(a);
    }
    this.designer.peers = peers;
    this.designer.renderOverlay();
  }

  private async remoteEvent(e: Record<string, unknown>): Promise<void> {
    const p = this.project;
    if (!p) return;
    if (e.type === 'form.saved') {
      const doc = p.formById(String(e.form_id));
      if (!doc) return;
      const applied = doc.applyRemote({ version: Number(e.version), design: (e.design as never) ?? null, code: (e.code as string | null) ?? null, name: String(e.name) });
      this.output.log(`${e.by}: ${doc.name} güncellendi (v${e.version})${applied ? '' : ' — yerel değişiklikleriniz korunuyor'}`, 'dim');
    } else if (e.type === 'form.created' || e.type === 'form.deleted') {
      await this.openProject(p.data.id);
    } else if (e.type === 'build.done') {
      this.output.log(`${e.by} projeyi derledi (${e.ok ? 'başarılı' : 'hatalı'})`, 'dim');
    }
  }

  /* ============================================================= dialogs */

  private async newProjectDialog(): Promise<void> {
    const d = new Dialog('Yeni Proje', { width: 460 });
    const name = h('input', { class: 'inp', attrs: { value: 'Project1' } });
    name.value = 'Project1';
    const title = h('input', { class: 'inp', attrs: { placeholder: 'Uygulama başlığı' } });
    const tpl = h('select', { class: 'inp' }, h('option', { text: 'Boş proje (Form1)', attrs: { value: 'blank' } }), h('option', { text: 'Örnek: Müşteri Takip (SQLite)', attrs: { value: 'demo' } }));
    d.body.append(h('label', { class: 'field' }, h('span', { text: 'Proje adı (tanımlayıcı)' }), name), h('label', { class: 'field' }, h('span', { text: 'Başlık' }), title), h('label', { class: 'field' }, h('span', { text: 'Şablon' }), tpl));
    d.buttons([{ label: 'İptal' }, { label: 'Oluştur', primary: true, action: async () => {
      try {
        await this.createProject(name.value.trim(), title.value.trim() || name.value.trim(), tpl.value as 'blank' | 'demo');
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'error');
        return false;
      }
      return true;
    } }]).show();
  }

  private async openProjectDialog(): Promise<void> {
    const list: ProjectListItem[] = await api.projects();
    const d = new Dialog('Proje Aç', { width: 560 });
    for (const p of list) {
      const row = h('div', { class: 'proj-item' }, icon('window', 16), h('div', {}, h('div', { class: 'ci-name', text: p.title || p.name }), h('div', { class: 'ci-sub', text: `${p.name} · ${p.form_count} form · ${new Date(p.updated_at).toLocaleString('tr-TR')}` })));
      row.addEventListener('click', async () => {
        d.close(true);
        await this.openProject(p.id);
      });
      d.body.append(row);
    }
    d.buttons([{ label: 'Kapat' }]).show();
  }

  private async optionsDialog(): Promise<void> {
    if (!this.project) return;
    const s = { ...this.project.data.settings };
    const d = new Dialog('Proje Seçenekleri', { width: 480 });
    const grid = h('input', { class: 'inp', attrs: { type: 'number', min: '2', max: '64' } });
    grid.value = String(s.gridSize);
    const checks: Array<[keyof typeof s, string]> = [['snapToGrid', 'Izgaraya yapış'], ['showGrid', 'Izgarayı göster'], ['showGuides', 'Hizalama kılavuzları'], ['livePreview', 'Canlı önizleme (kaydedince yeniden çalıştır)'], ['allowAdHocSql', 'Geliştirmede kayıtsız SELECT sorgularına izin ver (güvensiz)']];
    const boxes = checks.map(([k, label]) => {
      const cb = h('input', { attrs: { type: 'checkbox' } });
      cb.checked = !!s[k];
      d.body.append(h('label', { class: 'chk block' }, cb, h('span', { text: label })));
      return [k, cb] as const;
    });
    d.body.prepend(h('label', { class: 'field' }, h('span', { text: 'Izgara aralığı (px)' }), grid));
    d.buttons([{ label: 'İptal' }, { label: 'Kaydet', primary: true, action: async () => {
      const patch: Record<string, unknown> = { gridSize: Number(grid.value) || 8 };
      for (const [k, cb] of boxes) patch[k] = cb.checked;
      this.project!.data = await api.updateProject(this.project!.data.id, { settings: patch });
      this.designer.applySettings(this.project!.data.settings);
      this.updateToggles();
    } }]).show();
  }

  private async historyDialog(): Promise<void> {
    const doc = this.active;
    if (!doc || !this.project) return;
    await doc.flush();
    const revs = await api.revisions(this.project.data.id, doc.id);
    const d = new Dialog(`Sürüm Geçmişi — ${doc.name}`, { width: 1100, height: 640, className: 'dlg-history' });
    const list = h('div', { class: 'hist-list' });
    const kind = h('select', { class: 'inp inp-sm' }, h('option', { text: 'Kod (unit)', attrs: { value: 'code' } }), h('option', { text: 'Tasarım (.tson)', attrs: { value: 'design' } }));
    const diffHost = h('div', { class: 'hist-diff' });
    d.body.append(h('div', { class: 'split' }, list, h('div', { class: 'hist-right' }, h('div', { class: 'qb-toolbar' }, h('span', { text: 'Karşılaştır:' }), kind, h('span', { class: 'muted', text: 'sol: seçili sürüm · sağ: güncel' })), diffHost)));
    const diff = monaco.editor.createDiffEditor(diffHost, { theme: 'jsd-light', readOnly: true, automaticLayout: true, renderSideBySide: true, unicodeHighlight: { ambiguousCharacters: false }, minimap: { enabled: false } });
    let selected = revs[0];
    const models: monaco.editor.ITextModel[] = [];
    const show = async () => {
      if (!selected) return;
      const detail = await api.revision(this.project!.data.id, doc.id, selected.id);
      const lang = kind.value === 'code' ? 'typescript' : 'json';
      const left = monaco.editor.createModel(kind.value === 'code' ? detail.code : JSON.stringify(detail.design, null, 2), lang);
      const right = monaco.editor.createModel(kind.value === 'code' ? doc.code : JSON.stringify(doc.design, null, 2), lang);
      models.push(left, right);
      diff.setModel({ original: left, modified: right });
    };
    for (const r of revs) {
      const row = h('div', { class: `hist-item ${r === selected ? 'active' : ''}` }, h('div', { class: 'ci-name', text: `v${r.version} ${r.message ? `— ${r.message}` : ''}` }), h('div', { class: 'ci-sub', text: `${r.author ?? '?'} · ${new Date(r.created_at).toLocaleString('tr-TR')} · ${r.content_hash.slice(0, 10)}` }));
      row.addEventListener('click', () => {
        selected = r;
        list.querySelectorAll('.hist-item').forEach((x) => x.classList.remove('active'));
        row.classList.add('active');
        void show();
      });
      list.append(row);
    }
    kind.addEventListener('change', () => void show());
    d.buttons([
      { label: 'Kapat' },
      { label: 'Bu sürüme geri dön', primary: true, action: async () => {
        if (!selected) return;
        const r = await api.restoreRevision(this.project!.data.id, doc.id, selected.id);
        doc.version = r.version;
        doc.design = r.design;
        doc.code = r.code;
        doc.onChange.emit({ kind: 'reload', source: 'restore' });
        toast(`${doc.name} v${selected.version} sürümüne döndü`, 'success');
      } },
    ]).show();
    await show();
    await d.closed;
    diff.dispose();
    models.forEach((m) => m.dispose());
  }

  private aboutDialog(roadmap = false): void {
    const d = new Dialog(roadmap ? 'Yol Haritası' : 'JS-Delphi Hakkında', { width: 640 });
    if (!roadmap) {
      d.body.append(
        h('div', { class: 'about-head' }, h('div', { class: 'app-logo big' }, h('span', { text: 'JS' })), h('div', {}, h('h2', { text: 'JS-Delphi IDE' }), h('p', { class: 'muted', text: `VCL runtime ${vcl.VCL_VERSION} · Vite + TypeScript · FastAPI + Jinja2` }))),
        h('p', { text: 'Delphi RAD felsefesi tarayıcıda: görsel tasarım + olay güdümlü kod + tek tuşla derle/çalıştır + görsel veritabanı bağlama. Tasarımcı ve çalışan uygulama aynı vcl.ts sınıflarını kullanır (WYSIWYG); Python yalnızca doğrulanmış verileri sabit Jinja2 şablonlarıyla birleştirir.' }),
      );
    } else {
      const items = [
        ['Data Module yüzeyi', 'Görsel olmayan bileşenler için formdan bağımsız tasarım yüzeyi (TDataModule), birden çok formdan paylaşım.'],
        ['Component Writer', 'Kullanıcı tanımlı bileşen yazıcı: RTTI tanımlı TS sınıfı + palet ikonu; runtime’a paket olarak eklenir.'],
        ['Form mirası', 'TForm2 = class(TForm1): tasarım belgesinde "inherits" ve delta serileştirme.'],
        ['Live preview', 'Kaydetme sonrası artımlı derleme + iframe yenileme (şu an: Proje Seçenekleri → Canlı önizleme).'],
        ['CRDT ortak tasarım', 'WS senkronunu Yjs/Automerge tabanlı bileşen ağacı CRDT’sine taşıma; son-yazan-kazanır yerine birleşme.'],
        ['iframe debugger protokolü', 'Kesme noktaları, adım adım yürütme, değişken izleme için postMessage tabanlı hata ayıklama protokolü.'],
        ['i18n', 'IDE metinleri ve Caption/Hint için çok dilli kaynak dosyaları.'],
        ['Tema editörü', 'vcl.css değişkenleri (clBtnFace…) için görsel tema editörü ve VCL stilleri.'],
        ['Bileşen mağazası', 'İmzalı bileşen paketleri, sürümleme ve güvenli yükleme.'],
        ['Native export', 'Tauri/Electron ile masaüstü paketleme; gömülü Python backend.'],
      ];
      for (const [t, desc] of items) d.body.append(h('div', { class: 'road-item' }, icon('roadmap', 16), h('div', {}, h('b', { text: t }), h('div', { class: 'muted', text: desc }))));
    }
    d.buttons([{ label: 'Tamam', primary: true }]).show();
  }

  /* ================================================================ menus */

  private menuFile(): MenuItem[] {
    return [
      { label: 'Yeni proje…', icon: 'new', action: () => void this.newProjectDialog() },
      { label: 'Proje aç…', icon: 'open', action: () => void this.openProjectDialog() },
      { label: 'Yeni form', icon: 'form', action: () => void this.newForm() },
      { separator: true },
      { label: 'Tümünü kaydet', icon: 'save', shortcut: 'Ctrl+S', action: () => void this.saveAll() },
      { label: 'Dışa aktar (.zip)', icon: 'export', action: () => void this.exportZip() },
    ];
  }

  private menuEdit(): MenuItem[] {
    return [
      { label: 'Geri al', icon: 'undo', shortcut: 'Ctrl+Z', disabled: !this.active?.canUndo, action: () => this.undo() },
      { label: 'Yinele', icon: 'redo', shortcut: 'Ctrl+Y', disabled: !this.active?.canRedo, action: () => this.redo() },
      { separator: true },
      { label: 'Kes', icon: 'cut', shortcut: 'Ctrl+X', action: () => this.designer.copySelection(true) },
      { label: 'Kopyala', icon: 'copy', shortcut: 'Ctrl+C', action: () => this.designer.copySelection() },
      { label: 'Yapıştır', icon: 'paste', shortcut: 'Ctrl+V', action: () => this.designer.paste() },
      { label: 'Sil', icon: 'delete', shortcut: 'Del', action: () => this.designer.deleteSelection() },
      { label: 'Tümünü seç', shortcut: 'Ctrl+A', action: () => this.designer.selectAll() },
    ];
  }

  private menuView(): MenuItem[] {
    const s = this.designer.settings;
    return [
      { label: 'Tasarım / Kod', icon: 'code', shortcut: 'F12', action: () => this.setView(this.view === 'design' ? 'code' : 'design') },
      { label: 'Tasarım dosyası (.tson)', icon: 'file', action: () => this.setView('tson') },
      { separator: true },
      { label: 'Izgara', checked: s.showGrid, action: () => this.toggleSetting('showGrid') },
      { label: 'Izgaraya yapış', checked: s.snapToGrid, action: () => this.toggleSetting('snapToGrid') },
      { label: 'Hizalama kılavuzları', checked: s.showGuides, action: () => this.toggleSetting('showGuides') },
      { separator: true },
      { label: 'Messages', icon: 'warning', action: () => this.showBottom('messages') },
      { label: 'Output', icon: 'terminal', action: () => this.showBottom('output') },
    ];
  }

  private menuProject(): MenuItem[] {
    return [
      { label: 'Derle', icon: 'build', shortcut: 'Ctrl+F9', action: () => void this.build() },
      { label: 'Tümünü yeniden derle', icon: 'refresh', action: () => void this.build(true) },
      { separator: true },
      { label: 'Yeni form', icon: 'form', action: () => void this.newForm() },
      { label: 'Sürüm geçmişi…', icon: 'history', action: () => void this.historyDialog() },
      { label: 'Seçenekler…', icon: 'props', action: () => void this.optionsDialog() },
    ];
  }

  private menuRun(): MenuItem[] {
    return [
      { label: 'Çalıştır', icon: 'run', shortcut: 'F9', action: () => void this.run() },
      { label: 'Durdur', icon: 'stop', disabled: !this.preview.running, action: () => this.stop() },
      { label: 'Menü sayfası (index.html)', icon: 'window', disabled: !this.preview.running, action: () => this.preview.navigate('index.html') },
    ];
  }

  private menuDb(): MenuItem[] {
    return [
      { label: 'Bağlantılar…', icon: 'database', action: () => void this.manageConnections() },
      { label: 'Şema tarayıcı ve veri önizleme…', icon: 'table', action: () => this.project && void schemaBrowser(this.project) },
      { label: 'Migration yönetimi…', icon: 'migration', action: () => this.project && void migrationsDialog(this.project) },
      { separator: true },
      { label: 'Seçili TQuery için SQL / sorgu oluşturucu…', icon: 'query', disabled: !this.designer.primary || this.active?.find(this.designer.primary)?.node.class !== 'TQuery', action: () => void this.editSql(this.designer.primary!) },
    ];
  }

  private menuHelp(): MenuItem[] {
    return [
      { label: 'Yol haritası', icon: 'roadmap', action: () => this.aboutDialog(true) },
      { label: 'Hakkında', icon: 'info', action: () => this.aboutDialog(false) },
    ];
  }
}

const ide = new Ide();
void ide.start();
(window as unknown as { jsd: Ide }).jsd = ide;
