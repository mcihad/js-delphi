/**
 * Preview pane: the build folder served under /preview/{project}/{token}/ runs inside a
 * sandbox="allow-scripts" iframe (opaque origin: no access to the IDE, its storage or
 * cookies). A postMessage bridge brings console output and runtime errors back.
 */
import { Emitter, h, icon } from '../core/dom';

export interface RuntimeMessage {
  type: string;
  level?: string;
  args?: unknown[];
  message?: string;
  file?: string;
  line?: number;
  col?: number;
  stack?: string;
  path?: string;
}

export class PreviewPane {
  readonly el: HTMLDivElement;
  readonly onMessage = new Emitter<RuntimeMessage>();
  readonly onReload = new Emitter<void>();
  private frame: HTMLIFrameElement | null = null;
  private addr: HTMLSpanElement;
  private url = '';
  private token = '';

  constructor() {
    this.addr = h('span', { class: 'pv-addr' });
    const reload = h('button', { class: 'icon-btn', title: 'Yeniden derle ve yükle (F9)' }, icon('refresh'));
    reload.addEventListener('click', () => this.onReload.emit());
    const menu = h('button', { class: 'icon-btn', title: 'index.html menüsü' }, icon('window'));
    menu.addEventListener('click', () => this.navigate('index.html'));
    const ext = h('button', { class: 'icon-btn', title: 'Yeni sekmede aç' }, icon('export'));
    ext.addEventListener('click', () => this.url && window.open(this.url, '_blank', 'noopener'));
    this.el = h('div', { class: 'preview' }, h('div', { class: 'pv-bar' }, reload, menu, ext, h('span', { class: 'pv-lock', title: 'sandbox="allow-scripts" · CSP' }, icon('key', 12)), this.addr), h('div', { class: 'pv-body' }));
    window.addEventListener('message', (ev) => this.receive(ev));
  }

  load(url: string, token: string): void {
    this.url = url;
    this.token = token;
    this.addr.textContent = url.replace(/\/preview\/([^/]+)\/[^/]+\//, '/preview/$1/…/');
    const body = this.el.querySelector('.pv-body')!;
    this.frame?.remove();
    const f = h('iframe', { class: 'pv-frame', attrs: { sandbox: 'allow-scripts', referrerpolicy: 'no-referrer', title: 'Uygulama önizlemesi' } });
    f.src = url;
    body.append(f);
    this.frame = f;
  }

  navigate(page: string): void {
    if (!this.url) return;
    this.load(this.url.replace(/[^/]+$/, page), this.token);
  }

  stop(): void {
    this.frame?.remove();
    this.frame = null;
    this.addr.textContent = '';
  }

  get running(): boolean {
    return !!this.frame;
  }

  private receive(ev: MessageEvent): void {
    // Only messages from *our* iframe (its origin is opaque, so compare windows).
    if (!this.frame || ev.source !== this.frame.contentWindow) return;
    const data = ev.data as (RuntimeMessage & { __jsd?: number }) | null;
    if (!data || data.__jsd !== 1 || typeof data.type !== 'string') return;
    if (data.type === 'ready') this.frame.contentWindow?.postMessage({ __jsd: 1, type: 'init', token: this.token }, '*');
    this.onMessage.emit(data);
  }
}
