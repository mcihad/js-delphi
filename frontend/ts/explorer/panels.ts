/* Bottom dock: Project Explorer (tree), Messages (diagnostics) and Output (logs). */
import { Emitter, clear, componentIcon, h, icon, showMenu, type MenuItem } from '../core/dom';
import type { BuildFile } from '../api/client';
import type { FormDoc, ProjectModel } from '../model/project';

export type MessageLevel = 'error' | 'warning' | 'info' | 'hint';
export interface MessageItem { level: MessageLevel; source: string; text: string; file?: string | null; line?: number | null; col?: number | null; form?: string }

export interface ExplorerHost {
  openForm(doc: FormDoc, view: 'design' | 'code'): void;
  selectComponent(doc: FormDoc, name: string): void;
  newForm(): void;
  deleteForm(doc: FormDoc): void;
  setMainForm(doc: FormDoc): void;
  manageConnections(): void;
  browseSchema(connectionId: string): void;
  openBuildFile(path: string): void;
}

export class ProjectExplorer {
  readonly el: HTMLDivElement;
  private tree: HTMLDivElement;
  private project: ProjectModel | null = null;
  private open = new Set<string>(['project', 'forms', 'data', 'build']);
  buildFiles: BuildFile[] = [];
  private host: ExplorerHost;

  constructor(host: ExplorerHost) {
    this.host = host;
    this.tree = h('div', { class: 'tree' });
    const add = h('button', { class: 'icon-btn', title: 'Yeni form' }, icon('plus', 14));
    add.addEventListener('click', () => host.newForm());
    this.el = h('div', { class: 'explorer' }, h('div', { class: 'panel-title' }, icon('folder', 14), h('span', { text: 'Project Explorer' }), h('span', { class: 'flex' }), add), this.tree);
  }

  setProject(p: ProjectModel): void {
    this.project = p;
    this.render();
  }

  private node(key: string, label: string, ic: SVGSVGElement, depth: number, opts: { children?: boolean; onOpen?: () => void; onMenu?: () => MenuItem[]; detail?: string; bold?: boolean } = {}): HTMLElement {
    const expanded = this.open.has(key);
    const tw = h('span', { class: 'tw' }, opts.children ? icon(expanded ? 'chevronDown' : 'chevronRight', 11) : '');
    const row = h('div', { class: `tree-row ${opts.bold ? 'bold' : ''}` }, tw, ic, h('span', { class: 'tree-label', text: label }), opts.detail ? h('span', { class: 'tree-detail', text: opts.detail }) : '');
    row.style.paddingLeft = `${6 + depth * 14}px`;
    tw.addEventListener('click', (e) => {
      e.stopPropagation();
      if (expanded) this.open.delete(key);
      else this.open.add(key);
      this.render();
    });
    row.addEventListener('dblclick', () => opts.onOpen?.());
    row.addEventListener('click', () => {
      this.tree.querySelectorAll('.tree-row.sel').forEach((r) => r.classList.remove('sel'));
      row.classList.add('sel');
    });
    if (opts.onMenu) {
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMenu(opts.onMenu!(), e.clientX, e.clientY);
      });
    }
    this.tree.append(row);
    return row;
  }

  render(): void {
    clear(this.tree);
    const p = this.project;
    if (!p) return;
    this.node('project', `${p.data.title || p.data.name}`, icon('window'), 0, { children: true, bold: true, detail: 'project.tson' });
    if (!this.open.has('project')) return;
    this.node('forms', 'Formlar', icon('folder'), 1, { children: true, detail: `${p.forms.length}` });
    if (this.open.has('forms')) {
      for (const f of p.forms) {
        const key = `form:${f.id}`;
        const isMain = p.data.main_form === f.name;
        this.node(key, f.name, icon('form'), 2, {
          children: true,
          detail: `${String(f.root.props?.Caption ?? '')}${isMain ? ' · ana form' : ''}`,
          bold: isMain,
          onOpen: () => this.host.openForm(f, 'design'),
          onMenu: () => [
            { label: 'Tasarımı aç', icon: 'design', action: () => this.host.openForm(f, 'design') },
            { label: 'Kodu aç (F12)', icon: 'code', action: () => this.host.openForm(f, 'code') },
            { separator: true },
            { label: 'Ana form yap', icon: 'check', disabled: isMain, action: () => this.host.setMainForm(f) },
            { label: 'Formu sil', icon: 'delete', disabled: p.forms.length < 2, action: () => this.host.deleteForm(f) },
          ],
        });
        if (this.open.has(key)) {
          this.node(`${key}:design`, `${f.name}.design.tson`, icon('design'), 3, { onOpen: () => this.host.openForm(f, 'design') });
          this.node(`${key}:unit`, `${f.name}.ts`, icon('code'), 3, { onOpen: () => this.host.openForm(f, 'code') });
          f.walk((n, _parent, depth) => {
            if (depth === 0) return;
            this.node(`${key}:${n.name}`, n.name, componentIcon(n.class, 14), 3 + depth, { detail: n.class, onOpen: () => this.host.selectComponent(f, n.name) });
          });
        }
      }
    }
    this.node('data', 'Veri bağlantıları', icon('database'), 1, { children: true, detail: `${p.connections.length}`, onOpen: () => this.host.manageConnections(), onMenu: () => [{ label: 'Bağlantıları yönet…', icon: 'database', action: () => this.host.manageConnections() }] });
    if (this.open.has('data')) {
      for (const c of p.connections) {
        this.node(`conn:${c.id}`, c.name, icon('database'), 2, { detail: `${c.driver_label}${c.database ? ` · ${c.database}` : ''}`, onOpen: () => this.host.browseSchema(c.id) });
      }
    }
    this.node('build', 'build/', icon('folder'), 1, { children: true, detail: this.buildFiles.length ? `${this.buildFiles.length} dosya` : 'derlenmedi' });
    if (this.open.has('build')) {
      for (const bf of this.buildFiles) {
        this.node(`bf:${bf.path}`, bf.path, icon('file'), 2, { detail: `${bf.sha256.slice(0, 8)}${bf.changed ? ' · yeni' : ''}`, onOpen: () => this.host.openBuildFile(bf.path) });
      }
    }
  }
}

export class MessagesPanel {
  readonly el: HTMLDivElement;
  readonly onActivate = new Emitter<MessageItem>();
  readonly onCount = new Emitter<{ errors: number; warnings: number }>();
  private list: HTMLDivElement;
  private items: MessageItem[] = [];
  private filters = new Set<MessageLevel>(['error', 'warning', 'info', 'hint']);

  constructor() {
    this.list = h('div', { class: 'msg-list' });
    const bar = h('div', { class: 'msg-bar' });
    for (const [lvl, label] of [['error', 'Hatalar'], ['warning', 'Uyarılar'], ['info', 'Bilgi'], ['hint', 'İpuçları']] as Array<[MessageLevel, string]>) {
      const b = h('button', { class: 'chip active', dataset: { lvl } }, icon(lvl === 'hint' ? 'hint' : lvl, 12), h('span', { text: label }));
      b.addEventListener('click', () => {
        if (this.filters.has(lvl)) this.filters.delete(lvl);
        else this.filters.add(lvl);
        b.classList.toggle('active', this.filters.has(lvl));
        this.render();
      });
      bar.append(b);
    }
    const clr = h('button', { class: 'chip', text: 'Temizle' });
    clr.addEventListener('click', () => this.clear());
    bar.append(h('span', { class: 'flex' }), clr);
    this.el = h('div', { class: 'messages' }, bar, this.list);
  }

  add(m: MessageItem): void {
    this.items.push(m);
    if (this.items.length > 2000) this.items.shift();
    this.render();
  }

  replaceSource(source: string, items: MessageItem[]): void {
    this.items = this.items.filter((m) => m.source !== source).concat(items);
    this.render();
  }

  clear(source?: string): void {
    this.items = source ? this.items.filter((m) => m.source !== source) : [];
    this.render();
  }

  private render(): void {
    clear(this.list);
    const visible = this.items.filter((m) => this.filters.has(m.level));
    for (const m of visible.slice(-500)) {
      const loc = m.file ? `${m.file}${m.line ? `:${m.line}${m.col ? `:${m.col}` : ''}` : ''}` : '';
      const row = h('div', { class: `msg msg-${m.level}` }, icon(m.level === 'hint' ? 'hint' : m.level, 13), h('span', { class: 'msg-src', text: m.source }), h('span', { class: 'msg-text', text: m.text }), h('span', { class: 'msg-loc', text: loc }));
      row.addEventListener('dblclick', () => this.onActivate.emit(m));
      this.list.append(row);
    }
    if (!visible.length) this.list.append(h('div', { class: 'empty', text: 'İleti yok' }));
    this.list.scrollTop = this.list.scrollHeight;
    this.onCount.emit({ errors: this.items.filter((m) => m.level === 'error').length, warnings: this.items.filter((m) => m.level === 'warning').length });
  }
}

export class OutputPanel {
  readonly el: HTMLDivElement;
  private pre: HTMLDivElement;

  constructor() {
    this.pre = h('div', { class: 'output-log' });
    this.el = h('div', { class: 'output' }, this.pre);
  }

  log(text: string, kind: 'plain' | 'ok' | 'err' | 'dim' | 'accent' = 'plain'): void {
    const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
    this.pre.append(h('div', { class: `out-line out-${kind}` }, h('span', { class: 'out-time', text: time }), h('span', { text })));
    while (this.pre.childElementCount > 3000) this.pre.firstElementChild?.remove();
    this.pre.scrollTop = this.pre.scrollHeight;
  }

  clear(): void {
    clear(this.pre);
  }
}
