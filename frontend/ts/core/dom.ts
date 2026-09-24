/* DOM helpers, icons and small UI widgets (dialog, menus, toast) used across the IDE. */

type Child = Node | string | null | undefined | false;

export interface HProps {
  class?: string;
  text?: string;
  title?: string;
  attrs?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, (ev: any) => void>>;
}

/** Hyperscript-style element builder (textContent only — never innerHTML with data). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: HProps = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.title) el.title = props.title;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [k, v] of Object.entries(props.dataset ?? {})) el.dataset[k] = v;
  if (props.style) Object.assign(el.style, props.style);
  for (const [k, fn] of Object.entries(props.on ?? {})) el.addEventListener(k, fn as EventListener);
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.firstChild.remove();
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): ((...a: A) => void) & { flush(): void; cancel(): void } {
  let t: ReturnType<typeof setTimeout> | null = null;
  let last: A | null = null;
  const d = ((...a: A) => {
    last = a;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      const args = last!;
      last = null;
      fn(...args);
    }, ms);
  }) as ((...a: A) => void) & { flush(): void; cancel(): void };
  d.flush = () => {
    if (t && last) {
      clearTimeout(t);
      t = null;
      const args = last;
      last = null;
      fn(...args);
    }
  };
  d.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
    last = null;
  };
  return d;
}

export class Emitter<T> {
  private fns = new Set<(v: T) => void>();
  on(fn: (v: T) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }
  emit(v: T): void {
    for (const f of [...this.fns]) f(v);
  }
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

/* ------------------------------------------------------------------ icons */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Monochrome UI icons (16×16, stroke = currentColor). */
const UI: Record<string, string> = {
  new: '<path d="M4 1.5h5l3.5 3.5v9.5h-8.5z M9 1.5V5h3.5"/>',
  open: '<path d="M1.5 4.5h5l1.5 1.5h6.5v7.5h-13z"/>',
  save: '<path d="M2 2h10l2 2v10H2z M5 2v4h6V2 M5 14v-4h6v4"/>',
  undo: '<path d="M5 3L2 6l3 3 M2 6h8a4 4 0 0 1 0 8H7"/>',
  redo: '<path d="M11 3l3 3-3 3 M14 6H6a4 4 0 0 0 0 8h3"/>',
  cut: '<circle cx="4.5" cy="12" r="2"/><circle cx="11.5" cy="12" r="2"/><path d="M5.8 10.5L11 2 M10.2 10.5L5 2"/>',
  copy: '<path d="M5 5h8v9H5z M3 11V2h7"/>',
  paste: '<path d="M4 3H2.5v11.5h11V3H12 M5 1.5h6v3H5z"/>',
  delete: '<path d="M2.5 4h11 M6 4V2h4v2 M4 4l1 10h6l1-10"/>',
  build: '<path d="M9.5 2.5l4 4-2 2-4-4z M7.5 4.5l-6 6 2 2 6-6"/>',
  run: '<path d="M4 2.5l9 5.5-9 5.5z" fill="currentColor" stroke="none"/>',
  stop: '<path d="M3.5 3.5h9v9h-9z" fill="currentColor" stroke="none"/>',
  export: '<path d="M8 1.5v9 M4.5 7L8 10.5 11.5 7 M2 11v3h12v-3"/>',
  refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.5 M13 2.5V5h-2.5"/>',
  grid: '<path d="M2 2h12v12H2z M6 2v12 M10 2v12 M2 6h12 M2 10h12"/>',
  magnet: '<path d="M3 2v6a5 5 0 0 0 10 0V2h-3v6a2 2 0 0 1-4 0V2z M3 5h3 M10 5h3"/>',
  guides: '<path d="M8 1v14 M1 8h14" stroke-dasharray="2 2"/><rect x="3" y="3" width="4" height="4"/>',
  alignLeft: '<path d="M2 1v14 M4 4h8v3H4z M4 9h5v3H4z"/>',
  alignRight: '<path d="M14 1v14 M4 4h8v3H4z M7 9h5v3H7z"/>',
  alignTop: '<path d="M1 2h14 M4 4v8h3V4z M9 4v5h3V4z"/>',
  alignBottom: '<path d="M1 14h14 M4 4v8h3V4z M9 7v5h3V7z"/>',
  alignHCenter: '<path d="M8 1v14 M4 4h8v3H4z M5.5 9h5v3h-5z"/>',
  alignVCenter: '<path d="M1 8h14 M4 4v8h3V4z M9 5.5v5h3v-5z"/>',
  sameWidth: '<path d="M2 4h12 M2 12h12 M2 2v4 M14 2v4 M2 10v4 M14 10v4"/>',
  sameHeight: '<path d="M4 2v12 M12 2v12 M2 2h4 M2 14h4 M10 2h4 M10 14h4"/>',
  front: '<path d="M6 6h8v8H6z" fill="currentColor" fill-opacity=".35"/><path d="M2 2h8v8H2z"/>',
  back: '<path d="M2 2h8v8H2z" fill="currentColor" fill-opacity=".35"/><path d="M6 6h8v8H6z"/>',
  form: '<path d="M1.5 2.5h13v11h-13z M1.5 5.5h13"/>',
  code: '<path d="M5.5 4L2 8l3.5 4 M10.5 4L14 8l-3.5 4"/>',
  design: '<path d="M2 2h12v12H2z M4.5 5h4 M4.5 8h7 M4.5 11h5"/>',
  history: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9 M2 2.5V5h2.5 M8 5v3.5l2.5 1.5"/>',
  database: '<ellipse cx="8" cy="3.5" rx="5.5" ry="2"/><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9 M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>',
  table: '<path d="M1.5 2.5h13v11h-13z M1.5 6h13 M1.5 9.5h13 M6 6v7.5"/>',
  column: '<path d="M5 2h6v12H5z M5 6h6"/>',
  key: '<circle cx="5" cy="8" r="2.5"/><path d="M7.5 8H14 M12 8v2.5 M10 8v2"/>',
  query: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
  folder: '<path d="M1.5 4h5l1.5 1.5h6.5v8h-13z"/>',
  file: '<path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3"/>',
  chevronRight: '<path d="M6 3.5L10.5 8 6 12.5"/>',
  chevronDown: '<path d="M3.5 6L8 10.5 12.5 6"/>',
  close: '<path d="M4 4l8 8 M12 4l-8 8"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>',
  error: '<circle cx="8" cy="8" r="6.5"/><path d="M5.5 5.5l5 5 M10.5 5.5l-5 5"/>',
  warning: '<path d="M8 1.5l7 12.5H1z M8 6v4 M8 11.8v.4"/>',
  info: '<circle cx="8" cy="8" r="6.5"/><path d="M8 7v4.5 M8 4.6v.4"/>',
  hint: '<path d="M8 1.5a4.5 4.5 0 0 0-2.5 8.2V12h5V9.7A4.5 4.5 0 0 0 8 1.5z M6 14h4"/>',
  users: '<circle cx="6" cy="5" r="2.5"/><path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4 M11 3a2.5 2.5 0 0 1 0 5 M12.5 10.5c1.5.5 2 1.8 2 3.5"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1v2 M8 13v2 M1 8h2 M13 8h2 M3 3l1.4 1.4 M11.6 11.6L13 13 M3 13l1.4-1.4 M11.6 4.4L13 3"/>',
  moon: '<path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z"/>',
  plus: '<path d="M8 3v10 M3 8h10"/>',
  minus: '<path d="M3 8h10"/>',
  check: '<path d="M3 8.5l3.5 3.5L13 4.5"/>',
  link: '<path d="M6.5 9.5l3-3 M5 7L3.5 8.5a2.5 2.5 0 0 0 3.5 3.5L8.5 10.5 M11 9l1.5-1.5a2.5 2.5 0 0 0-3.5-3.5L7.5 5.5"/>',
  ellipsis: '<circle cx="3.5" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="12.5" cy="8" r="1" fill="currentColor"/>',
  events: '<path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z"/>',
  props: '<path d="M2 3h12 M2 8h12 M2 13h12 M5 1.5v3 M11 6.5v3 M7 11.5v3"/>',
  sort: '<path d="M4 2v12 M1.5 11.5L4 14l2.5-2.5 M9 3h5 M9 7h4 M9 11h3"/>',
  category: '<path d="M2 2.5h5v5H2z M9 2.5h5v5H9z M2 9.5h5v5H2z M9 9.5h5v5H9z"/>',
  window: '<path d="M1.5 2.5h13v11h-13z M1.5 5.5h13"/>',
  terminal: '<path d="M1.5 2.5h13v11h-13z M4 6l2.5 2L4 10 M8 10.5h4"/>',
  upload: '<path d="M8 11V2 M4.5 5.5L8 2l3.5 3.5 M2 11v3h12v-3"/>',
  migration: '<path d="M2 4h8 M7 1l3 3-3 3 M14 12H6 M9 9l-3 3 3 3"/>',
  roadmap: '<path d="M2 13.5l3-10 3 6 3-4 3 8"/>',
};

export type UiIcon = keyof typeof UI;

export function icon(name: string, size = 16, cls = 'ico'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  // constant, trusted markup from the table above
  svg.innerHTML = UI[name] ?? UI.file;
  return svg;
}

/** Colourful 24×24 component palette icons (Delphi-like). */
const COMPONENT_ICONS: Record<string, string> = {
  TForm: '<rect x="2" y="3" width="20" height="18" rx="2" fill="#2f3440" stroke="#8ab4ff"/><rect x="2" y="3" width="20" height="4" rx="2" fill="#4c8dff"/><circle cx="18.5" cy="5" r="1" fill="#fff"/>',
  TLabel: '<path d="M5 19L11 5h2l6 14" fill="none" stroke="#f5c542" stroke-width="2"/><path d="M7.5 14h9" stroke="#f5c542" stroke-width="2"/><path d="M3 21.5h18" stroke="#8a93a3"/>',
  TButton: '<rect x="2.5" y="6.5" width="19" height="11" rx="2" fill="#3a4150" stroke="#9aa6b8"/><rect x="4" y="8" width="16" height="3" rx="1" fill="#566073"/><path d="M8 14h8" stroke="#e6ebf2" stroke-width="1.6"/>',
  TEdit: '<rect x="2.5" y="7" width="19" height="10" fill="#fff" stroke="#7aa7e8"/><path d="M5.5 12h6" stroke="#333" stroke-width="1.5"/><path d="M14 9.5v5" stroke="#0078d7" stroke-width="1.5"/>',
  TMemo: '<rect x="3" y="3" width="18" height="18" fill="#fff" stroke="#7aa7e8"/><path d="M6 7.5h12 M6 11h12 M6 14.5h9 M6 18h6" stroke="#555" stroke-width="1.3"/><rect x="18" y="4" width="2" height="7" fill="#9bb7de"/>',
  TComboBox: '<rect x="2.5" y="7" width="19" height="10" fill="#fff" stroke="#7aa7e8"/><rect x="15.5" y="7.5" width="5.5" height="9" fill="#dfe8f5"/><path d="M16.8 11l1.5 1.8 1.5-1.8" fill="none" stroke="#333" stroke-width="1.3"/><path d="M5 12h7" stroke="#555" stroke-width="1.5"/>',
  TCheckBox: '<rect x="4" y="4" width="16" height="16" rx="2" fill="#fff" stroke="#6b7a90"/><path d="M7.5 12.5l3.2 3.2L17 8.5" fill="none" stroke="#2da44e" stroke-width="2.4"/>',
  TRadioButton: '<circle cx="12" cy="12" r="8" fill="#fff" stroke="#6b7a90"/><circle cx="12" cy="12" r="3.8" fill="#2f81f7"/>',
  TImage: '<rect x="2.5" y="4" width="19" height="16" rx="1.5" fill="#dbeafe" stroke="#60a5fa"/><circle cx="8" cy="9" r="2" fill="#f5c542"/><path d="M3 18l6-6 4 4 3-3 5 5" fill="#34d399" stroke="#059669"/>',
  TProgressBar: '<rect x="2.5" y="9" width="19" height="6" rx="1" fill="#e5e7eb" stroke="#9ca3af"/><rect x="3" y="9.5" width="11" height="5" fill="#22c55e"/>',
  TPanel: '<rect x="3" y="4" width="18" height="16" fill="#4b5263"/><path d="M3 20V4h18" fill="none" stroke="#c7cfdd" stroke-width="1.5"/><path d="M21 4v16H3" fill="none" stroke="#1f232b" stroke-width="1.5"/>',
  TGroupBox: '<path d="M8 6H3v14h18V6h-4" fill="none" stroke="#a5b4fc" stroke-width="1.6"/><path d="M9.5 6h6" stroke="#a5b4fc" stroke-width="2"/>',
  TTabControl: '<path d="M3 9h18v11H3z" fill="#3a4150" stroke="#9aa6b8"/><path d="M3 9V5h6v4" fill="#566073" stroke="#9aa6b8"/><path d="M9 9V6h5v3" fill="none" stroke="#9aa6b8"/>',
  TScrollBox: '<rect x="3" y="3" width="18" height="18" fill="none" stroke="#9aa6b8" stroke-width="1.5"/><rect x="17" y="3.8" width="3.2" height="16.4" fill="#566073"/><rect x="17.4" y="6" width="2.4" height="6" fill="#c7cfdd"/>',
  TTimer: '<circle cx="12" cy="13" r="8" fill="#fff" stroke="#6b7a90" stroke-width="1.5"/><path d="M12 13V8.5 M12 13l3 2" stroke="#ef4444" stroke-width="1.8"/><path d="M10 3h4" stroke="#6b7a90" stroke-width="2"/>',
  TConnection: '<ellipse cx="10" cy="6" rx="7" ry="2.5" fill="#fbbf24" stroke="#b45309"/><path d="M3 6v10c0 1.4 3.1 2.5 7 2.5" fill="#fde68a" stroke="#b45309"/><path d="M17 6v4" stroke="#b45309"/><path d="M15 13l-2 4h3l-2 4" fill="none" stroke="#2563eb" stroke-width="1.8"/>',
  TDataSource: '<ellipse cx="9" cy="6" rx="6.5" ry="2.3" fill="#86efac" stroke="#15803d"/><path d="M2.5 6v10c0 1.3 2.9 2.3 6.5 2.3s6.5-1 6.5-2.3V6" fill="#bbf7d0" stroke="#15803d"/><path d="M15 12h7 M19.5 9.5L22 12l-2.5 2.5" stroke="#2563eb" stroke-width="1.6" fill="none"/>',
  TQuery: '<ellipse cx="9" cy="6" rx="6.5" ry="2.3" fill="#93c5fd" stroke="#1d4ed8"/><path d="M2.5 6v10c0 1.3 2.9 2.3 6.5 2.3" fill="#bfdbfe" stroke="#1d4ed8"/><circle cx="16" cy="15" r="3.8" fill="#fff" stroke="#f59e0b" stroke-width="1.8"/><path d="M18.8 17.8L22 21" stroke="#f59e0b" stroke-width="2"/>',
  TTable: '<rect x="2.5" y="4" width="19" height="16" fill="#fff" stroke="#2563eb"/><rect x="2.5" y="4" width="19" height="4" fill="#60a5fa"/><path d="M2.5 12h19 M2.5 16h19 M9 8v12 M15 8v12" stroke="#93c5fd"/>',
  TStoredProc: '<ellipse cx="9" cy="6" rx="6.5" ry="2.3" fill="#c4b5fd" stroke="#6d28d9"/><path d="M2.5 6v10c0 1.3 2.9 2.3 6.5 2.3" fill="#ddd6fe" stroke="#6d28d9"/><circle cx="16.5" cy="15.5" r="3" fill="none" stroke="#f472b6" stroke-width="2"/><path d="M16.5 10.5v2 M16.5 18.5v2 M11.5 15.5h2 M19.5 15.5h2" stroke="#f472b6" stroke-width="2"/>',
  TDBGrid: '<rect x="2.5" y="4" width="19" height="16" fill="#fff" stroke="#16a34a"/><rect x="2.5" y="4" width="19" height="4" fill="#4ade80"/><rect x="2.5" y="8" width="3.5" height="12" fill="#dcfce7"/><path d="M2.5 12h19 M2.5 16h19 M11 8v12 M16 8v12" stroke="#86efac"/>',
  TDBNavigator: '<rect x="1.5" y="8" width="21" height="8" rx="1" fill="#3a4150" stroke="#9aa6b8"/><path d="M5 12l3-2.5v5z M19 12l-3-2.5v5z" fill="#4ade80"/><path d="M11 10v4 M13 10v4" stroke="#e6ebf2" stroke-width="1.5"/>',
  TDBEdit: '<rect x="2.5" y="7" width="19" height="10" fill="#fff" stroke="#16a34a"/><path d="M5.5 12h6" stroke="#333" stroke-width="1.5"/><ellipse cx="17.5" cy="10" rx="2.5" ry="1" fill="#4ade80"/><path d="M15 10v4c0 .6 1.1 1 2.5 1s2.5-.4 2.5-1v-4" fill="#bbf7d0" stroke="#16a34a" stroke-width=".8"/>',
};

export function componentIcon(className: string, size = 24): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'cico');
  svg.innerHTML = COMPONENT_ICONS[className] ?? COMPONENT_ICONS.TPanel;
  return svg;
}

/* ------------------------------------------------------------------ toast */

export function toast(message: string, kind: 'info' | 'success' | 'warning' | 'error' = 'info', ms = 3800): void {
  let host = document.querySelector('.toasts');
  if (!host) host = document.body.appendChild(h('div', { class: 'toasts' }));
  const t = h('div', { class: `toast toast-${kind}` }, icon(kind === 'success' ? 'check' : kind === 'error' ? 'error' : kind === 'warning' ? 'warning' : 'info'), h('span', { text: message }));
  host.append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/* ------------------------------------------------------------------ dialog */

export interface DialogButton {
  label: string;
  primary?: boolean;
  danger?: boolean;
  /** Return false to keep the dialog open. */
  action?: () => unknown;
}

export class Dialog {
  readonly overlay: HTMLDivElement;
  readonly win: HTMLDivElement;
  readonly body: HTMLDivElement;
  readonly footer: HTMLDivElement;
  private resolve: (v: boolean) => void = () => undefined;
  readonly closed: Promise<boolean>;

  constructor(title: string, opts: { width?: number; height?: number; className?: string } = {}) {
    this.overlay = h('div', { class: 'dlg-overlay' });
    this.win = h('div', { class: `dlg ${opts.className ?? ''}` });
    if (opts.width) this.win.style.width = `${opts.width}px`;
    if (opts.height) this.win.style.height = `${opts.height}px`;
    const head = h('div', { class: 'dlg-head' }, h('span', { class: 'dlg-title', text: title }), h('button', { class: 'icon-btn', title: 'Kapat', on: { click: () => this.close(false) } }, icon('close')));
    this.body = h('div', { class: 'dlg-body' });
    this.footer = h('div', { class: 'dlg-foot' });
    this.win.append(head, this.body, this.footer);
    this.overlay.append(this.win);
    this.closed = new Promise((r) => (this.resolve = r));
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.win.classList.add('shake');
      setTimeout(() => this.win.classList.remove('shake'), 300);
    });
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close(false);
      }
    });
    this.win.tabIndex = -1;
  }

  buttons(list: DialogButton[]): this {
    clear(this.footer);
    for (const b of list) {
      const btn = h('button', { class: `btn ${b.primary ? 'btn-primary' : ''} ${b.danger ? 'btn-danger' : ''}`, text: b.label });
      btn.addEventListener('click', async () => {
        const r = b.action ? await b.action() : true;
        if (r !== false) this.close(!!b.primary);
      });
      this.footer.append(btn);
    }
    return this;
  }

  show(): this {
    document.body.append(this.overlay);
    requestAnimationFrame(() => (this.win.querySelector('input, select, textarea, button.btn-primary') as HTMLElement | null)?.focus());
    return this;
  }

  close(ok: boolean): void {
    this.overlay.remove();
    this.resolve(ok);
  }
}

export async function prompt(title: string, label: string, value = ''): Promise<string | null> {
  const d = new Dialog(title, { width: 420 });
  const input = h('input', { class: 'inp', attrs: { value } });
  input.value = value;
  d.body.append(h('label', { class: 'field' }, h('span', { text: label }), input));
  let result: string | null = null;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      result = input.value;
      d.close(true);
    }
  });
  d.buttons([{ label: 'İptal' }, { label: 'Tamam', primary: true, action: () => (result = input.value) }]).show();
  input.select();
  await d.closed;
  return result;
}

export async function confirmDialog(title: string, message: string, okLabel = 'Evet', danger = false): Promise<boolean> {
  const d = new Dialog(title, { width: 420 });
  d.body.append(h('p', { class: 'dlg-msg', text: message }));
  d.buttons([{ label: 'Vazgeç' }, { label: okLabel, primary: true, danger }]).show();
  return d.closed;
}

/* ------------------------------------------------------------------ menus */

export interface MenuItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  items?: MenuItem[];
}

let openMenu: HTMLElement | null = null;

export function closeMenus(): void {
  openMenu?.remove();
  openMenu = null;
  document.querySelectorAll('.menubar .mb-item.open').forEach((e) => e.classList.remove('open'));
}

export function showMenu(items: MenuItem[], x: number, y: number): HTMLElement {
  closeMenus();
  const m = h('div', { class: 'ctx-menu' });
  for (const it of items) {
    if (it.separator) {
      m.append(h('div', { class: 'ctx-sep' }));
      continue;
    }
    const row = h(
      'div',
      { class: `ctx-item ${it.disabled ? 'disabled' : ''}` },
      h('span', { class: 'ctx-icon' }, it.checked ? icon('check', 14) : it.icon ? icon(it.icon, 14) : ''),
      h('span', { class: 'ctx-label', text: it.label ?? '' }),
      h('span', { class: 'ctx-short', text: it.shortcut ?? '' }),
    );
    if (!it.disabled) {
      row.addEventListener('mousedown', (e) => e.preventDefault());
      row.addEventListener('click', () => {
        closeMenus();
        it.action?.();
      });
    }
    m.append(row);
  }
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.min(x, window.innerWidth - r.width - 4)}px`;
  m.style.top = `${Math.min(y, window.innerHeight - r.height - 4)}px`;
  openMenu = m;
  return m;
}

document.addEventListener('mousedown', (e) => {
  if (openMenu && !openMenu.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.mb-item')) closeMenus();
});
window.addEventListener('blur', () => closeMenus());

export function menubar(menus: Array<{ label: string; items: () => MenuItem[] }>): HTMLElement {
  const bar = h('nav', { class: 'menubar' });
  for (const menu of menus) {
    const item = h('div', { class: 'mb-item', text: menu.label });
    const open = () => {
      const r = item.getBoundingClientRect();
      showMenu(menu.items(), r.left, r.bottom + 2);
      item.classList.add('open');
    };
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (item.classList.contains('open')) closeMenus();
      else open();
    });
    item.addEventListener('mouseenter', () => {
      if (openMenu && !item.classList.contains('open') && document.querySelector('.menubar .mb-item.open')) open();
    });
    bar.append(item);
  }
  return bar;
}

/* --------------------------------------------------------------- splitter */

export function splitter(target: HTMLElement, axis: 'x' | 'y', opts: { invert?: boolean; min?: number; max?: number; onResize?: () => void } = {}): HTMLElement {
  const s = h('div', { class: `splitter splitter-${axis}` });
  s.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    s.setPointerCapture(e.pointerId);
    const start = axis === 'x' ? e.clientX : e.clientY;
    const size = axis === 'x' ? target.getBoundingClientRect().width : target.getBoundingClientRect().height;
    document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y');
    const move = (m: PointerEvent) => {
      const d = (axis === 'x' ? m.clientX : m.clientY) - start;
      const next = Math.max(opts.min ?? 120, Math.min(opts.max ?? 900, size + (opts.invert ? -d : d)));
      target.style[axis === 'x' ? 'width' : 'height'] = `${next}px`;
      opts.onResize?.();
    };
    const up = () => {
      s.removeEventListener('pointermove', move);
      s.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing-x', 'resizing-y');
    };
    s.addEventListener('pointermove', move);
    s.addEventListener('pointerup', up);
  });
  return s;
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { attrs: { href: url, download: filename } });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
