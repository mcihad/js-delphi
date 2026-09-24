/* Tool Palette — icon list of registered components grouped by palette page (RTTI). */
import * as vcl from '@vcl';
import { Emitter, clear, componentIcon, h, icon } from '../core/dom';

const PAGE_LABELS: Record<string, string> = {
  Forms: 'Formlar',
  Standard: 'Standart',
  Additional: 'Ek',
  System: 'Sistem',
  'Data Access': 'Veri Erişimi',
  'Data Controls': 'Veri Kontrolleri',
};

export class ToolPalette {
  readonly el: HTMLDivElement;
  /** Emits the class chosen for placement (null = pointer). */
  readonly onPick = new Emitter<string | null>();
  /** Double click: add at a default position. */
  readonly onQuickAdd = new Emitter<string>();
  private list: HTMLDivElement;
  private search: HTMLInputElement;
  private selected: string | null = null;
  private collapsed = new Set<string>();

  constructor() {
    this.search = h('input', { class: 'pal-search', attrs: { placeholder: 'Bileşen ara…', spellcheck: 'false' } });
    this.search.addEventListener('input', () => this.render());
    this.list = h('div', { class: 'pal-list' });
    this.el = h('div', { class: 'palette' }, h('div', { class: 'panel-title' }, icon('category', 14), h('span', { text: 'Tool Palette' })), h('div', { class: 'pal-search-wrap' }, icon('search', 13), this.search), this.list);
    this.render();
  }

  get current(): string | null {
    return this.selected;
  }

  pick(cls: string | null): void {
    this.selected = cls;
    this.list.querySelectorAll('.pal-item').forEach((e) => e.classList.toggle('active', (e as HTMLElement).dataset.cls === cls));
    this.list.querySelector('.pal-pointer')?.classList.toggle('active', cls === null);
  }

  private render(): void {
    clear(this.list);
    const q = this.search.value.trim().toLowerCase();
    const pointer = h('div', { class: `pal-item pal-pointer ${this.selected === null ? 'active' : ''}`, title: 'Seçim işaretçisi (Esc)' }, h('span', { class: 'pal-ico' }, icon('chevronRight', 16)), h('span', { text: 'İşaretçi' }));
    pointer.addEventListener('click', () => {
      this.pick(null);
      this.onPick.emit(null);
    });
    this.list.append(pointer);
    for (const page of vcl.PaletteOrder) {
      const classes = vcl.GetRegisteredClassNames()
        .map((n) => vcl.GetClassInfo(n)!)
        .filter((i) => i.palette === page && !i.abstract && (!q || i.name.toLowerCase().includes(q)));
      if (!classes.length) continue;
      const collapsed = this.collapsed.has(page) && !q;
      const head = h('div', { class: `pal-cat ${collapsed ? 'collapsed' : ''}` }, icon(collapsed ? 'chevronRight' : 'chevronDown', 12), h('span', { text: PAGE_LABELS[page] ?? page }), h('span', { class: 'pal-count', text: String(classes.length) }));
      head.addEventListener('click', () => {
        if (this.collapsed.has(page)) this.collapsed.delete(page);
        else this.collapsed.add(page);
        this.render();
      });
      this.list.append(head);
      if (collapsed) continue;
      const grid = h('div', { class: 'pal-group' });
      for (const info of classes) {
        const item = h('div', { class: `pal-item ${this.selected === info.name ? 'active' : ''}`, title: `${info.name}\n${info.hint ?? ''}`, dataset: { cls: info.name }, attrs: { draggable: info.name === 'TForm' ? 'false' : 'true' } }, h('span', { class: 'pal-ico' }, componentIcon(info.name, 22)), h('span', { class: 'pal-name', text: info.name }), info.visual ? '' : h('span', { class: 'pal-badge', text: 'NV', title: 'Görsel olmayan bileşen' }));
        item.addEventListener('click', () => {
          const next = this.selected === info.name ? null : info.name;
          this.pick(next);
          this.onPick.emit(next);
        });
        item.addEventListener('dblclick', () => {
          this.pick(null);
          this.onQuickAdd.emit(info.name);
        });
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData('application/x-jsd-component', info.name);
          e.dataTransfer!.effectAllowed = 'copy';
        });
        grid.append(item);
      }
      this.list.append(grid);
    }
  }
}
