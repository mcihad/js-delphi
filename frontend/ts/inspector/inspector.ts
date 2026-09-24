/**
 * Object Inspector — category based Properties/Events grid driven by the runtime RTTI
 * (vcl.GetClassInfo). Special editors: colour, font, TStrings, component references,
 * connection definitions, table picker, column mapper (TDBGrid.Columns), params, SQL.
 */
import * as vcl from '@vcl';
import type { TPropInfo } from '@vcl';
import type { SchemaInfo, SchemaTable } from '../api/client';
import { Dialog, Emitter, clear, h, icon, toast } from '../core/dom';
import type { FormDesigner } from '../designer/designer';
import type { FormDoc, ProjectModel } from '../model/project';

export interface InspectorHost {
  project(): ProjectModel | null;
  schemaFor(connectionName: string): Promise<SchemaInfo | null>;
  editSql(component: string): void;
  manageConnections(): void;
  goToHandler(component: string, event: string, handler: string): void;
  renameForm(doc: FormDoc, newName: string): Promise<void>;
  uploadAsset(): Promise<string | null>;
}

const CATEGORY_ORDER = ['Layout', 'Visual', 'Behavior', 'Input', 'Data', 'Database', 'Help', 'Misc'] as const;

function display(pi: TPropInfo, v: unknown): string {
  switch (pi.kind) {
    case 'font': {
      const f = v as vcl.TFontJSON;
      return `${f.Name}, ${f.Size}pt${f.Style?.length ? ` ${f.Style.map((s) => s.slice(2)).join('+')}` : ''}`;
    }
    case 'strings': return `(TStrings) ${(v as string[]).length} satır`;
    case 'sql': return (v as string[]).join(' ').slice(0, 60) || '(SQL)';
    case 'params': return `(TParams) ${(v as unknown[]).length}`;
    case 'columns': return `(Columns) ${(v as unknown[]).length}`;
    case 'set': return `[${(v as string[]).join(',')}]`;
    default: return v === null || v === undefined ? '' : String(v);
  }
}

export class ObjectInspector {
  readonly el: HTMLDivElement;
  readonly onChanged = new Emitter<void>();
  private combo: HTMLSelectElement;
  private body: HTMLDivElement;
  private desc: HTMLDivElement;
  private search: HTMLInputElement;
  private tab: 'props' | 'events' = 'props';
  private byCategory = true;
  private collapsed = new Set<string>();
  private expanded = new Set<string>();
  private designer: FormDesigner | null = null;
  private host: InspectorHost;

  constructor(host: InspectorHost) {
    this.host = host;
    this.combo = h('select', { class: 'oi-combo' });
    this.combo.addEventListener('change', () => this.designer?.select([this.combo.value]));
    this.search = h('input', { class: 'oi-search', attrs: { placeholder: 'Özellik ara…', spellcheck: 'false' } });
    this.search.addEventListener('input', () => this.render());
    const tabs = h('div', { class: 'oi-tabs' });
    const mkTab = (id: 'props' | 'events', label: string, ic: string) => {
      const t = h('button', { class: `oi-tab ${this.tab === id ? 'active' : ''}`, dataset: { tab: id } }, icon(ic, 14), h('span', { text: label }));
      t.addEventListener('click', () => {
        this.tab = id;
        tabs.querySelectorAll('.oi-tab').forEach((x) => x.classList.toggle('active', (x as HTMLElement).dataset.tab === id));
        this.render();
      });
      return t;
    };
    const sortBtn = h('button', { class: 'icon-btn', title: 'Kategoriye / ada göre sırala' }, icon('category', 14));
    sortBtn.addEventListener('click', () => {
      this.byCategory = !this.byCategory;
      clear(sortBtn);
      sortBtn.append(icon(this.byCategory ? 'category' : 'sort', 14));
      this.render();
    });
    tabs.append(mkTab('props', 'Özellikler', 'props'), mkTab('events', 'Olaylar', 'events'), h('span', { class: 'flex' }), sortBtn);
    this.body = h('div', { class: 'oi-body' });
    this.desc = h('div', { class: 'oi-desc' });
    this.el = h('div', { class: 'inspector' }, h('div', { class: 'panel-title' }, icon('props', 14), h('span', { text: 'Object Inspector' })), this.combo, tabs, this.search, this.body, this.desc);
  }

  attach(designer: FormDesigner | null): void {
    this.designer = designer;
    this.render();
  }

  /* ------------------------------------------------------------ render */

  render(): void {
    const d = this.designer;
    const doc = d?.document;
    clear(this.combo);
    clear(this.body);
    if (!d || !doc) {
      this.body.append(h('div', { class: 'empty', text: 'Seçili bileşen yok' }));
      return;
    }
    doc.walk((n, _p, depth) => {
      const o = h('option', { text: `${' '.repeat(depth * 2)}${n.name}: ${n.class === 'TForm' ? `T${doc.root.name}` : n.class}` });
      o.value = n.name;
      this.combo.append(o);
    });
    const name = d.primary ?? doc.root.name;
    this.combo.value = name;
    const ref = doc.find(name);
    if (!ref) return;
    const cls = ref.node.class;
    const info = vcl.GetClassInfo(cls);
    if (!info) return;
    const comp = name === doc.root.name ? d.liveForm : d.component(name);
    if (!comp) return;
    if (this.tab === 'events') this.renderEvents(doc, name, cls, info.events);
    else this.renderProps(doc, name, comp, info.props);
    this.desc.textContent = `${cls}: ${info.hint ?? ''}`;
  }

  private rowsContainer(category: string): HTMLElement {
    if (!this.byCategory) return this.body;
    let sec = this.body.querySelector(`[data-cat="${category}"]`) as HTMLElement | null;
    if (!sec) {
      const collapsed = this.collapsed.has(category);
      const head = h('div', { class: `oi-cat ${collapsed ? 'collapsed' : ''}` }, icon(collapsed ? 'chevronRight' : 'chevronDown', 12), h('span', { text: vcl.CategoryLabels[category as keyof typeof vcl.CategoryLabels] ?? category }));
      sec = h('div', { class: 'oi-section', dataset: { cat: category } });
      if (collapsed) sec.classList.add('hidden');
      head.addEventListener('click', () => {
        if (this.collapsed.has(category)) this.collapsed.delete(category);
        else this.collapsed.add(category);
        this.render();
      });
      this.body.append(head, sec);
    }
    return sec;
  }

  private row(label: string, editor: HTMLElement, hint: string, opts: { indent?: number; modified?: boolean; expander?: HTMLElement } = {}): HTMLElement {
    const nameCell = h('div', { class: `oi-name ${opts.modified ? 'modified' : ''}`, title: hint }, opts.expander ?? h('span', { class: 'oi-exp-space' }), h('span', { text: label }));
    nameCell.style.paddingLeft = `${4 + (opts.indent ?? 0) * 14}px`;
    const r = h('div', { class: 'oi-row' }, nameCell, h('div', { class: 'oi-value' }, editor));
    r.addEventListener('mouseenter', () => (this.desc.textContent = `${label}: ${hint || ''}`));
    r.addEventListener('focusin', () => {
      this.body.querySelectorAll('.oi-row.focus').forEach((x) => x.classList.remove('focus'));
      r.classList.add('focus');
    });
    return r;
  }

  private renderProps(doc: FormDoc, name: string, comp: vcl.TComponent, props: TPropInfo[]): void {
    const filter = this.search.value.trim().toLowerCase();
    const stored = doc.find(name)?.node.props ?? {};
    // Name first (special: rename)
    const nameEditor = this.textEditor(name, (v) => this.rename(doc, name, v));
    this.body.append(this.row('Name', nameEditor, 'Bileşenin koddaki adı.', { modified: true }));
    let list = props.filter((p) => !p.hidden && p.name !== 'Name' && (!filter || p.name.toLowerCase().includes(filter)));
    if (!this.byCategory) list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => CATEGORY_ORDER.indexOf(a.category as never) - CATEGORY_ORDER.indexOf(b.category as never));
    for (const pi of list) {
      const value = vcl.GetPropValue(comp, pi);
      const container = this.rowsContainer(pi.category);
      const modified = pi.name in stored;
      const key = `${name}.${pi.name}`;
      if (pi.kind === 'set' || pi.kind === 'font') {
        const open = this.expanded.has(key);
        const exp = h('span', { class: 'oi-exp' }, icon(open ? 'chevronDown' : 'chevronRight', 11));
        exp.addEventListener('click', () => {
          if (open) this.expanded.delete(key);
          else this.expanded.add(key);
          this.render();
        });
        const summary = pi.kind === 'font'
          ? this.dialogEditor(display(pi, value), () => this.fontDialog(name, value as vcl.TFontJSON))
          : h('span', { class: 'oi-summary', text: display(pi, value) });
        container.append(this.row(pi.name, summary, pi.hint ?? '', { modified, expander: exp }));
        if (open) this.subRows(container, name, pi, value);
        continue;
      }
      container.append(this.row(pi.name, this.editorFor(doc, name, comp, pi, value), pi.hint ?? '', { modified }));
    }
  }

  private subRows(container: HTMLElement, name: string, pi: TPropInfo, value: unknown): void {
    if (pi.kind === 'set') {
      const cur = new Set(value as string[]);
      for (const m of pi.values ?? []) {
        const cb = this.boolEditor(cur.has(m), (on) => {
          const next = (pi.values ?? []).filter((x) => (x === m ? on : cur.has(x)));
          this.apply(name, pi.name, next);
        });
        container.append(this.row(m, cb, pi.hint ?? '', { indent: 1 }));
      }
      return;
    }
    const f = { ...(value as Required<vcl.TFontJSON>) };
    const set = (patch: Partial<vcl.TFontJSON>) => this.apply(name, 'Font', { ...f, ...patch });
    container.append(this.row('Name', this.selectEditor(vcl.FontNames as string[], f.Name, (v) => set({ Name: v })), 'Yazı tipi ailesi', { indent: 1 }));
    container.append(this.row('Size', this.numberEditor(f.Size, (v) => set({ Size: v })), 'Punto', { indent: 1 }));
    container.append(this.row('Color', this.colorEditor(f.Color, (v) => set({ Color: v })), 'Yazı rengi', { indent: 1 }));
    for (const st of ['fsBold', 'fsItalic', 'fsUnderline', 'fsStrikeOut'] as vcl.TFontStyle[]) {
      container.append(this.row(st, this.boolEditor(f.Style.includes(st), (on) => set({ Style: on ? [...f.Style, st] : f.Style.filter((x) => x !== st) })), 'Yazı stili', { indent: 1 }));
    }
  }

  private renderEvents(doc: FormDoc, name: string, cls: string, events: vcl.TEventInfo[]): void {
    const node = doc.find(name)?.node;
    const handlers = [...doc.handlers().keys()].sort();
    const codeHandlers = [...doc.code.matchAll(/(\w+)\.prototype\.(\w+)\s*=/g)].filter((m) => m[1] === doc.root.name).map((m) => m[2]);
    const all = [...new Set([...handlers, ...codeHandlers])].sort();
    const filter = this.search.value.trim().toLowerCase();
    for (const ev of events) {
      if (filter && !ev.name.toLowerCase().includes(filter)) continue;
      const current = node?.events?.[ev.name] ?? '';
      const input = h('input', { class: 'oi-input oi-event', attrs: { list: `oi-handlers`, spellcheck: 'false' } });
      input.value = current;
      const commit = () => {
        const v = input.value.trim();
        if (v === current) return;
        if (v && !vcl.IsValidIdent(v)) {
          toast(`'${v}' geçerli bir işleyici adı değil`, 'error');
          input.value = current;
          return;
        }
        this.designer!.setEvent(name, ev.name, v || null);
        if (v) this.host.goToHandler(name, ev.name, v);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commit();
      });
      input.addEventListener('change', commit);
      input.addEventListener('dblclick', () => {
        const handler = input.value.trim() || `${name}_${ev.name}`;
        if (!current) this.designer!.setEvent(name, ev.name, handler);
        this.host.goToHandler(name, ev.name, handler);
      });
      this.body.append(this.row(ev.name, input, `${ev.hint ?? ''}  (${ev.params.replace('$Self', cls === 'TForm' ? doc.root.name : cls)})`, { modified: !!current }));
    }
    const dl = h('datalist', { attrs: { id: 'oi-handlers' } });
    for (const hn of all) dl.append(h('option', { attrs: { value: hn } }));
    this.body.append(dl, h('div', { class: 'oi-tip', text: 'İpucu: olay satırına çift tıklayınca kod biriminde otomatik iskelet (stub) oluşturulur.' }));
  }

  /* ---------------------------------------------------------- editors */

  private apply(name: string, prop: string, value: unknown): void {
    const d = this.designer!;
    const targets = d.selection.length > 1 && d.selection.includes(name) ? d.selection : [name];
    try {
      for (const t of targets) {
        const cls = d.document!.find(t)?.node.class;
        if (cls && vcl.FindPropInfo(cls, prop)) d.setProp(t, prop, value);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
    this.onChanged.emit();
    this.render();
  }

  private async rename(doc: FormDoc, oldName: string, newName: string): Promise<void> {
    if (!newName || newName === oldName) return;
    try {
      if (oldName === doc.root.name) await this.host.renameForm(doc, newName);
      else this.designer!.rename(oldName, newName);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
    this.render();
  }

  private editorFor(doc: FormDoc, name: string, comp: vcl.TComponent, pi: TPropInfo, value: unknown): HTMLElement {
    const set = (v: unknown) => this.apply(name, pi.name, v);
    switch (pi.kind) {
      case 'bool':
        return this.boolEditor(!!value, set);
      case 'int':
        return this.numberEditor(Number(value), set, true);
      case 'float':
        return this.numberEditor(Number(value), set, false);
      case 'enum':
      case 'cursor':
        return this.selectEditor([...(pi.values ?? [])], String(value), set);
      case 'modalresult': {
        const names = Object.entries(vcl.ModalResultNames);
        const sel = h('select', { class: 'oi-select' });
        for (const [n, v] of names) {
          const o = h('option', { text: n });
          o.value = String(v);
          sel.append(o);
        }
        sel.value = String(value);
        sel.addEventListener('change', () => set(Number(sel.value)));
        return sel;
      }
      case 'color':
        return this.colorEditor(String(value), set);
      case 'fontname':
        return this.selectEditor(vcl.FontNames as string[], String(value), set);
      case 'strings':
        return this.dialogEditor(display(pi, value), () => this.stringsDialog(`${name}.${pi.name}`, value as string[], set));
      case 'sql':
        return this.dialogEditor(display(pi, value), () => this.host.editSql(name));
      case 'params':
        return this.dialogEditor(display(pi, value), () => this.paramsDialog(name, value as vcl.TParamJSON[], set));
      case 'columns':
        return this.dialogEditor(display(pi, value), () => void this.columnsDialog(doc, name, value as vcl.TGridColumnJSON[], set));
      case 'component':
        return this.componentEditor(doc, pi, value as string | null, set);
      case 'connection': {
        const conns = this.host.project()?.connections ?? [];
        const sel = this.selectEditor(['', ...conns.map((c) => c.name)], String(value ?? ''), set);
        return this.withButton(sel, () => this.host.manageConnections());
      }
      case 'table':
      case 'procname':
      case 'datafield': {
        const sel = h('select', { class: 'oi-select' });
        sel.append(h('option', { text: String(value ?? '') || '(seçiniz)' }));
        (sel.firstChild as HTMLOptionElement).value = String(value ?? '');
        sel.value = String(value ?? '');
        sel.addEventListener('focus', () => void this.fillDataOptions(doc, name, comp, pi, sel, String(value ?? '')), { once: true });
        sel.addEventListener('mousedown', () => void this.fillDataOptions(doc, name, comp, pi, sel, String(value ?? '')), { once: true });
        sel.addEventListener('change', () => set(sel.value));
        return sel;
      }
      case 'fieldlist':
        return this.withButton(this.textEditor(String(value ?? ''), set), () => void this.fieldListDialog(doc, name, comp, pi, String(value ?? ''), set));
      case 'image':
        return this.withButton(this.textEditor(String(value ?? ''), set), async () => {
          const p = await this.host.uploadAsset();
          if (p) set(p);
        }, 'upload');
      default:
        return this.textEditor(String(value ?? ''), set, pi.live ? (v) => {
          try {
            this.designer!.setProp(name, pi.name, v);
            this.onChanged.emit();
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), 'error');
          }
        } : undefined);
    }
  }

  private textEditor(value: string, set: (v: string) => void, live?: (v: string) => void): HTMLInputElement {
    const i = h('input', { class: 'oi-input', attrs: { spellcheck: 'false' } });
    i.value = value;
    let last = value;
    const commit = () => {
      if (i.value !== last) {
        last = i.value;
        set(i.value);
      }
    };
    i.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') i.value = last;
    });
    i.addEventListener('blur', commit);
    if (live) {
      // Caption/Text: the designer updates while typing (Delphi behaviour)
      let t: ReturnType<typeof setTimeout> | null = null;
      i.addEventListener('input', () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          if (i.value === last) return;
          last = i.value;
          live(i.value);
        }, 120);
      });
    }
    return i;
  }

  private numberEditor(value: number, set: (v: number) => void, integer = true): HTMLInputElement {
    const i = h('input', { class: 'oi-input num', attrs: { spellcheck: 'false' } });
    i.value = String(value);
    const commit = () => {
      const n = Number(i.value.replace(',', '.'));
      if (!Number.isFinite(n)) {
        toast(`'${i.value}' geçerli bir sayı değil`, 'error');
        i.value = String(value);
        return;
      }
      const v = integer ? Math.round(n) : n;
      if (v !== value) set(v);
    };
    i.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        i.value = String(Number(i.value || 0) + (e.key === 'ArrowUp' ? 1 : -1));
      }
    });
    i.addEventListener('blur', commit);
    return i;
  }

  private boolEditor(value: boolean, set: (v: boolean) => void): HTMLElement {
    const b = h('button', { class: `oi-bool ${value ? 'on' : ''}` }, h('span', { class: 'oi-check' }, value ? icon('check', 12) : ''), h('span', { text: value ? 'True' : 'False' }));
    b.addEventListener('click', () => set(!value));
    return b;
  }

  private selectEditor(values: string[], value: string, set: (v: string) => void): HTMLSelectElement {
    const s = h('select', { class: 'oi-select' });
    for (const v of values) {
      const o = h('option', { text: v || '(yok)' });
      o.value = v;
      s.append(o);
    }
    if (!values.includes(value)) {
      const o = h('option', { text: value });
      o.value = value;
      s.prepend(o);
    }
    s.value = value;
    s.addEventListener('change', () => set(s.value));
    return s;
  }

  private colorEditor(value: string, set: (v: string) => void): HTMLElement {
    const swatch = h('span', { class: 'oi-swatch' });
    swatch.style.background = vcl.ColorToCSS(value) || 'transparent';
    const sel = this.selectEditor(vcl.ColorNames as string[], value, set);
    const picker = h('input', { class: 'oi-colorpick', attrs: { type: 'color', title: 'Özel renk' } });
    picker.value = vcl.ColorToRGB(value);
    picker.addEventListener('change', () => set(picker.value));
    return h('div', { class: 'oi-color' }, swatch, sel, picker);
  }

  private dialogEditor(text: string, open: () => void): HTMLElement {
    const s = h('span', { class: 'oi-summary', text });
    return this.withButton(s, open);
  }

  private withButton(el: HTMLElement, fn: () => void, ic = 'ellipsis'): HTMLElement {
    const b = h('button', { class: 'oi-more', title: 'Düzenle…' }, icon(ic, 12));
    b.addEventListener('click', fn);
    el.addEventListener('dblclick', fn);
    return h('div', { class: 'oi-with-btn' }, el, b);
  }

  private componentEditor(doc: FormDoc, pi: TPropInfo, value: string | null, set: (v: string | null) => void): HTMLSelectElement {
    const opts = [''];
    doc.walk((n) => {
      if (!pi.refClass || vcl.InheritsFromClass(n.class, pi.refClass)) opts.push(n.name);
    });
    return this.selectEditor(opts, value ?? '', (v) => set(v || null));
  }

  /* --------------------------------------------------- data helpers */

  private connectionOf(doc: FormDoc, name: string): string | null {
    const node = doc.find(name)?.node;
    const connRef = node?.props?.Connection as string | undefined;
    const conn = connRef ? doc.find(connRef)?.node : null;
    return (conn?.props?.ConnectionDefName as string | undefined) ?? null;
  }

  /** DataSource → DataSet → table name/connection for data-aware controls. */
  private datasetOf(doc: FormDoc, name: string): { dataset: string; table: string | null; conn: string | null } | null {
    const node = doc.find(name)?.node;
    const dsName = node?.props?.DataSource as string | undefined;
    const ds = dsName ? doc.find(dsName)?.node : null;
    const setName = ds?.props?.DataSet as string | undefined;
    if (!setName) return null;
    const set = doc.find(setName)?.node;
    return { dataset: setName, table: (set?.props?.TableName as string | undefined) ?? null, conn: this.connectionOf(doc, setName) };
  }

  private async fieldsFor(doc: FormDoc, name: string, comp: vcl.TComponent): Promise<string[]> {
    // live dataset (design-time Active = True) wins
    const liveDs = comp instanceof vcl.TDataSet ? comp : (() => {
      const info = this.datasetOf(doc, name);
      return info ? (this.designer!.component(info.dataset) as vcl.TDataSet | undefined) : undefined;
    })();
    if (liveDs?.Active) return liveDs.Fields.Items.map((f) => f.FieldName);
    const info = comp instanceof vcl.TTable ? { table: comp.TableName, conn: this.connectionOf(doc, name) } : this.datasetOf(doc, name);
    if (!info?.table || !info.conn) return [];
    const schema = await this.host.schemaFor(info.conn);
    return schema?.tables.find((t) => t.name === info.table)?.columns.map((c) => c.name) ?? [];
  }

  private async fillDataOptions(doc: FormDoc, name: string, comp: vcl.TComponent, pi: TPropInfo, sel: HTMLSelectElement, value: string): Promise<void> {
    let options: string[] = [];
    try {
      if (pi.kind === 'datafield') options = await this.fieldsFor(doc, name, comp);
      else {
        const conn = this.connectionOf(doc, name);
        const schema = conn ? await this.host.schemaFor(conn) : null;
        options = pi.kind === 'table' ? (schema?.tables.map((t: SchemaTable) => t.name) ?? []) : (schema?.procedures.map((p) => p.name) ?? []);
        if (!conn) toast('Önce Connection özelliğine bir TConnection atayın', 'warning');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
    clear(sel);
    for (const v of ['', ...options]) {
      const o = h('option', { text: v || '(yok)' });
      o.value = v;
      sel.append(o);
    }
    sel.value = options.includes(value) ? value : '';
  }

  /* -------------------------------------------------------- dialogs */

  private fontDialog(name: string, f: vcl.TFontJSON): void {
    const d = new Dialog('Yazı Tipi', { width: 440 });
    const family = h('select', { class: 'inp' });
    for (const n of vcl.FontNames) family.append(h('option', { text: n }));
    family.value = f.Name ?? 'Segoe UI';
    const size = h('input', { class: 'inp', attrs: { type: 'number', min: '6', max: '72' } });
    size.value = String(f.Size ?? 9);
    const color = h('input', { class: 'inp', attrs: { type: 'color' } });
    color.value = vcl.ColorToRGB(f.Color ?? 'clWindowText');
    const styles = ['fsBold', 'fsItalic', 'fsUnderline', 'fsStrikeOut'].map((s) => {
      const cb = h('input', { attrs: { type: 'checkbox' } });
      cb.checked = (f.Style ?? []).includes(s as vcl.TFontStyle);
      return [s, cb] as const;
    });
    const sample = h('div', { class: 'font-sample', text: 'AaBbÇçĞğİıÖöŞşÜü 123' });
    const upd = () => {
      sample.style.fontFamily = family.value;
      sample.style.fontSize = `${Math.round((Number(size.value) * 96) / 72)}px`;
      sample.style.color = color.value;
      sample.style.fontWeight = styles[0][1].checked ? '700' : '400';
      sample.style.fontStyle = styles[1][1].checked ? 'italic' : 'normal';
      sample.style.textDecoration = [styles[2][1].checked ? 'underline' : '', styles[3][1].checked ? 'line-through' : ''].join(' ');
    };
    [family, size, color, ...styles.map((s) => s[1])].forEach((e) => e.addEventListener('input', upd));
    upd();
    d.body.append(
      h('label', { class: 'field' }, h('span', { text: 'Yazı tipi' }), family),
      h('div', { class: 'field-row' }, h('label', { class: 'field' }, h('span', { text: 'Punto' }), size), h('label', { class: 'field' }, h('span', { text: 'Renk' }), color)),
      h('div', { class: 'field-row' }, ...styles.map(([s, cb]) => h('label', { class: 'chk' }, cb, h('span', { text: s.slice(2) })))),
      sample,
    );
    d.buttons([
      { label: 'İptal' },
      { label: 'Tamam', primary: true, action: () => this.apply(name, 'Font', { Name: family.value, Size: Number(size.value) || 9, Color: color.value, Style: styles.filter((s) => s[1].checked).map((s) => s[0]) }) },
    ]).show();
  }

  private stringsDialog(title: string, lines: string[], set: (v: string[]) => void): void {
    const d = new Dialog(`String List Editor — ${title}`, { width: 480 });
    const ta = h('textarea', { class: 'inp mono', attrs: { rows: '14', spellcheck: 'false' } });
    ta.value = lines.join('\n');
    const count = h('div', { class: 'muted', text: `${lines.length} satır` });
    ta.addEventListener('input', () => (count.textContent = `${ta.value ? ta.value.split('\n').length : 0} satır`));
    d.body.append(ta, count);
    d.buttons([{ label: 'İptal' }, { label: 'Tamam', primary: true, action: () => set(ta.value === '' ? [] : ta.value.split('\n')) }]).show();
  }

  private paramsDialog(name: string, params: vcl.TParamJSON[], set: (v: vcl.TParamJSON[]) => void): void {
    const d = new Dialog(`${name}.Params`, { width: 560 });
    const types = vcl.EnumTypes.TFieldType as string[];
    const rows = params.map((p) => ({ ...p }));
    const table = h('table', { class: 'grid-table' }, h('thead', {}, h('tr', {}, h('th', { text: 'Ad' }), h('th', { text: 'Veri tipi' }), h('th', { text: 'Tasarım değeri' }))));
    const tb = h('tbody');
    for (const p of rows) {
      const type = h('select', { class: 'inp' });
      for (const t of types) type.append(h('option', { text: t }));
      type.value = p.DataType ?? 'ftUnknown';
      type.addEventListener('change', () => (p.DataType = type.value as vcl.TFieldType));
      const val = h('input', { class: 'inp' });
      val.value = p.Value === undefined || p.Value === null ? '' : String(p.Value);
      val.addEventListener('input', () => (p.Value = val.value === '' ? undefined : val.value));
      tb.append(h('tr', {}, h('td', { class: 'mono', text: `:${p.Name}` }), h('td', {}, type), h('td', {}, val)));
    }
    table.append(tb);
    d.body.append(rows.length ? table : h('p', { class: 'muted', text: 'SQL metninde :parametre yok.' }), h('p', { class: 'muted', text: 'Parametreler SQL metninden (:ad) otomatik çıkarılır; değerler sunucuda bağlanır, SQL metnine eklenmez.' }));
    d.buttons([{ label: 'İptal' }, { label: 'Tamam', primary: true, action: () => set(rows) }]).show();
  }

  /** "Kolon eşleştirici": pick dataset fields, set titles/widths/alignment/format. */
  private async columnsDialog(doc: FormDoc, name: string, cols: vcl.TGridColumnJSON[], set: (v: vcl.TGridColumnJSON[]) => void): Promise<void> {
    const comp = this.designer!.component(name)!;
    const fields = await this.fieldsFor(doc, name, comp);
    const byName = new Map(cols.map((c) => [c.FieldName.toLowerCase(), c]));
    const all = [...cols.map((c) => c.FieldName), ...fields.filter((f) => !byName.has(f.toLowerCase()))];
    const d = new Dialog(`Kolon Eşleştirici — ${name}.Columns`, { width: 720 });
    const table = h('table', { class: 'grid-table' }, h('thead', {}, h('tr', {}, ...['', 'Alan', 'Başlık', 'Genişlik', 'Hiza', 'Biçim', ''].map((t) => h('th', { text: t })))));
    const tb = h('tbody');
    const rows: Array<{ use: HTMLInputElement; field: string; title: HTMLInputElement; width: HTMLInputElement; align: HTMLSelectElement; fmt: HTMLInputElement; tr: HTMLTableRowElement }> = [];
    const render = () => {
      clear(tb);
      for (const r of rows) tb.append(r.tr);
    };
    for (const f of all) {
      const c = byName.get(f.toLowerCase());
      const use = h('input', { attrs: { type: 'checkbox' } });
      use.checked = !!c || cols.length === 0;
      const title = h('input', { class: 'inp' });
      title.value = c?.Title ?? '';
      title.placeholder = f;
      const width = h('input', { class: 'inp num', attrs: { type: 'number', min: '10' } });
      width.value = c?.Width ? String(c.Width) : '';
      const align = h('select', { class: 'inp' });
      for (const a of ['', 'taLeftJustify', 'taCenter', 'taRightJustify']) align.append(h('option', { text: a || '(otomatik)' }));
      (align.options[0] as HTMLOptionElement).value = '';
      align.value = c?.Alignment ?? '';
      const fmt = h('input', { class: 'inp', attrs: { placeholder: '#,##0.00' } });
      fmt.value = c?.DisplayFormat ?? '';
      const up = h('button', { class: 'icon-btn', title: 'Yukarı' }, icon('chevronDown', 12));
      up.style.transform = 'rotate(180deg)';
      const tr = h('tr', {}, h('td', {}, use), h('td', { class: 'mono', text: f }), h('td', {}, title), h('td', {}, width), h('td', {}, align), h('td', {}, fmt), h('td', {}, up));
      const row = { use, field: f, title, width, align, fmt, tr };
      up.addEventListener('click', () => {
        const i = rows.indexOf(row);
        if (i > 0) {
          [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
          render();
        }
      });
      rows.push(row);
    }
    render();
    table.append(tb);
    d.body.append(fields.length || cols.length ? table : h('p', { class: 'muted', text: 'Alan listesi alınamadı: DataSource → DataSet bağlayın ve veri kümesini (Active) açın veya TTable.TableName seçin.' }));
    d.buttons([
      { label: 'İptal' },
      {
        label: 'Tamam',
        primary: true,
        action: () =>
          set(
            rows.filter((r) => r.use.checked).map((r) => {
              const c: vcl.TGridColumnJSON = { FieldName: r.field };
              if (r.title.value) c.Title = r.title.value;
              if (r.width.value) c.Width = Number(r.width.value);
              if (r.align.value) c.Alignment = r.align.value as vcl.TAlignment;
              if (r.fmt.value) c.DisplayFormat = r.fmt.value;
              return c;
            }),
          ),
      },
    ]).show();
  }

  private async fieldListDialog(doc: FormDoc, name: string, comp: vcl.TComponent, pi: TPropInfo, value: string, set: (v: string) => void): Promise<void> {
    const fields = await this.fieldsFor(doc, name, comp);
    const current = value.split(';').map((s) => s.trim().replace(/^-/, '')).filter(Boolean);
    const d = new Dialog(`${name}.${pi.name}`, { width: 380 });
    const boxes = fields.map((f) => {
      const cb = h('input', { attrs: { type: 'checkbox' } });
      cb.checked = current.includes(f);
      d.body.append(h('label', { class: 'chk block' }, cb, h('span', { class: 'mono', text: f })));
      return [f, cb] as const;
    });
    if (!fields.length) d.body.append(h('p', { class: 'muted', text: 'Önce TableName ve Connection seçin.' }));
    d.buttons([{ label: 'İptal' }, { label: 'Tamam', primary: true, action: () => set(boxes.filter((b) => b[1].checked).map((b) => b[0]).join(';')) }]).show();
  }
}
