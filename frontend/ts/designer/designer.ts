/**
 * Form Designer — renders the *real* runtime TForm (vcl.ts, csDesigning) inside a shadow
 * root (vcl.css only → WYSIWYG) and draws selection, 8-way grab handles, snap lines and
 * the grid on an overlay. Every edit goes through FormDoc.mutate (undo + debounced save).
 */
import * as vcl from '@vcl';
import type { TDesignNode } from '@vcl';
import vclCss from '@runtime/vcl.css?inline';
import { Emitter, clone, componentIcon, h, icon, showMenu, type MenuItem } from '../core/dom';
import type { FormDoc } from '../model/project';
import type { Peer } from '../api/client';

const DESIGN_CSS = `
:host { all: initial; display: block; position: relative; }
.vcl-form.vcl-designing { position: absolute; }
.vcl-form.jsd-grid > .vcl-form-client {
  background-image: radial-gradient(circle, rgba(0,0,0,.32) 0.9px, transparent 1.2px);
  background-size: var(--jsd-grid) var(--jsd-grid);
  background-position: calc(var(--jsd-grid) / -2) calc(var(--jsd-grid) / -2);
}
.vcl-designing, .vcl-designing * { cursor: default !important; user-select: none !important; }
.jsd-drop-target { outline: 2px dashed #0078d7 !important; outline-offset: -2px; }
`;

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Rect { x: number; y: number; w: number; h: number }

export interface DesignerSettings { gridSize: number; snapToGrid: boolean; showGrid: boolean; showGuides: boolean }

/** Delphi-style defaults for new components. */
function defaultProps(cls: string, name: string): Record<string, unknown> {
  switch (cls) {
    case 'TLabel': case 'TButton': case 'TCheckBox': case 'TRadioButton': case 'TPanel': case 'TGroupBox':
      return { Caption: name };
    case 'TEdit': case 'TDBEdit':
      return cls === 'TEdit' ? { Text: name } : {};
    case 'TMemo':
      return { Lines: [name] };
    case 'TComboBox':
      return { Text: name };
    case 'TTabControl':
      return { Tabs: ['Sekme1', 'Sekme2', 'Sekme3'], TabIndex: 0 };
    default:
      return {};
  }
}

export class FormDesigner {
  readonly el: HTMLDivElement;
  readonly onSelect = new Emitter<string[]>();
  readonly onDefaultEvent = new Emitter<{ name: string; cls: string }>();
  readonly onStatus = new Emitter<string>();
  readonly onLoadWarnings = new Emitter<string[]>();
  selection: string[] = [];
  placing: string | null = null;
  settings: DesignerSettings = { gridSize: 8, snapToGrid: true, showGrid: true, showGuides: true };
  peers: Peer[] = [];
  clipboard: TDesignNode[] = [];
  onPlaced: (() => void) | null = null;

  private stage: HTMLDivElement;
  private hostEl: HTMLDivElement;
  private shadow: ShadowRoot;
  private overlay: HTMLDivElement;
  private form: vcl.TForm | null = null;
  private comps = new Map<string, vcl.TComponent>();
  private doc: FormDoc | null = null;
  private raf = 0;
  private dragRect: HTMLDivElement | null = null;

  constructor() {
    this.el = h('div', { class: 'designer', attrs: { tabindex: '0' } });
    this.stage = h('div', { class: 'designer-stage' });
    this.hostEl = h('div', { class: 'designer-host' });
    this.shadow = this.hostEl.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `${vclCss}\n${DESIGN_CSS}`;
    this.shadow.append(style);
    this.overlay = h('div', { class: 'designer-overlay' });
    this.stage.append(this.hostEl, this.overlay);
    this.el.append(this.stage);
    this.stage.addEventListener('pointerdown', (e) => this.pointerDown(e), true);
    this.stage.addEventListener('dblclick', (e) => this.doubleClick(e));
    this.stage.addEventListener('contextmenu', (e) => this.contextMenu(e));
    this.stage.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('application/x-jsd-component')) e.preventDefault();
    });
    this.stage.addEventListener('drop', (e) => this.drop(e));
    this.el.addEventListener('keydown', (e) => this.keyDown(e));
    this.el.addEventListener('scroll', () => this.renderOverlay());
    new ResizeObserver(() => this.renderOverlay()).observe(this.el);
  }

  /* ================================================================ load */

  get document(): FormDoc | null {
    return this.doc;
  }

  get liveForm(): vcl.TForm | null {
    return this.form;
  }

  component(name: string): vcl.TComponent | undefined {
    return this.comps.get(name.toLowerCase());
  }

  open(doc: FormDoc): void {
    this.doc = doc;
    this.selection = [doc.root.name];
    this.reload();
    this.onSelect.emit(this.selection);
  }

  /** Rebuilds the live form from the design document (initial load, undo, remote edits). */
  reload(): void {
    const doc = this.doc;
    if (!doc) return;
    this.form?.Free();
    this.comps.clear();
    const form = new vcl.TForm(null);
    form.SetDesigning(true);
    this.shadow.append(form.Element);
    const warnings: string[] = [];
    const map = vcl.LoadDesign(form, doc.design, (m) => warnings.push(m));
    for (const [name, comp] of map) this.comps.set(name.toLowerCase(), comp);
    this.form = form;
    form.Element.classList.toggle('jsd-grid', this.settings.showGrid);
    form.Element.style.setProperty('--jsd-grid', `${this.settings.gridSize}px`);
    this.selection = this.selection.filter((n) => doc.find(n));
    if (!this.selection.length) this.selection = [doc.root.name];
    this.syncStageSize();
    this.renderOverlay();
    if (warnings.length) this.onLoadWarnings.emit(warnings);
  }

  applySettings(s: Partial<DesignerSettings>): void {
    this.settings = { ...this.settings, ...s };
    this.form?.Element.classList.toggle('jsd-grid', this.settings.showGrid);
    this.form?.Element.style.setProperty('--jsd-grid', `${this.settings.gridSize}px`);
  }

  private syncStageSize(): void {
    if (!this.form) return;
    this.stage.style.width = `${this.form.Width + 80}px`;
    this.stage.style.height = `${this.form.Height + 80}px`;
  }

  /* ========================================================== geometry */

  private overlayRect(el: Element): Rect {
    const o = this.overlay.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
  }

  private clientOrigin(): { x: number; y: number } {
    const r = this.overlayRect(this.form!.ClientElement);
    return { x: r.x, y: r.y };
  }

  private rectOf(name: string): Rect | null {
    const c = this.component(name);
    if (!c) return null;
    if (c instanceof vcl.TControl) return this.overlayRect(c.Element);
    const o = this.clientOrigin();
    return { x: o.x + c.DesignLeft, y: o.y + c.DesignTop, w: 28, h: 28 };
  }

  /** Deepest component under a viewport point (shadow DOM hit testing). */
  private hitTest(clientX: number, clientY: number): vcl.TComponent | null {
    const nv = (document.elementsFromPoint(clientX, clientY) as HTMLElement[]).find((e) => e.dataset?.nv);
    if (nv) return this.component(nv.dataset.nv!) ?? null;
    for (const el of this.shadow.elementsFromPoint(clientX, clientY)) {
      let n: Element | null = el;
      while (n) {
        const owner = vcl.ElementOwner.get(n);
        if (owner) return owner;
        n = n.parentElement;
      }
    }
    return null;
  }

  private containerAt(clientX: number, clientY: number, exclude: Set<vcl.TComponent>): vcl.TWinControl | null {
    for (const el of this.shadow.elementsFromPoint(clientX, clientY)) {
      let n: Element | null = el;
      while (n) {
        const owner = vcl.ElementOwner.get(n);
        if (owner instanceof vcl.TWinControl && !exclude.has(owner) && ![...exclude].some((x) => x instanceof vcl.TControl && owner.IsChildOf(x))) {
          const info = vcl.GetClassInfo(vcl.RegisteredClassOf(owner));
          if (info?.container) return owner;
        }
        n = n.parentElement;
      }
    }
    return this.form;
  }

  private snap(v: number, alt: boolean): number {
    if (!this.settings.snapToGrid || alt) return Math.round(v);
    const g = this.settings.gridSize;
    return Math.round(v / g) * g;
  }

  /* ============================================================ overlay */

  renderOverlay(): void {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.drawOverlay());
  }

  private drawOverlay(): void {
    const o = this.overlay;
    o.replaceChildren();
    if (!this.form || !this.doc) return;
    // non-visual components (design-time only icons, Delphi style)
    const origin = this.clientOrigin();
    for (const c of this.form.Components) {
      if (c instanceof vcl.TControl) continue;
      const cls = vcl.RegisteredClassOf(c);
      const tile = h('div', { class: 'nv-comp', dataset: { nv: c.Name }, title: `${c.Name}: ${cls}` }, componentIcon(cls, 22), h('span', { class: 'nv-name', text: c.Name }));
      tile.style.left = `${origin.x + c.DesignLeft}px`;
      tile.style.top = `${origin.y + c.DesignTop}px`;
      o.append(tile);
    }
    // collaborators' selections
    for (const p of this.peers) {
      if (p.state.form !== this.doc.name) continue;
      for (const n of p.state.selection ?? []) {
        const r = this.rectOf(n);
        if (!r) continue;
        const box = h('div', { class: 'peer-box' }, h('span', { class: 'peer-tag', text: p.display_name }));
        Object.assign(box.style, { left: `${r.x - 2}px`, top: `${r.y - 2}px`, width: `${r.w + 4}px`, height: `${r.h + 4}px`, borderColor: p.color });
        (box.firstChild as HTMLElement).style.background = p.color;
        o.append(box);
      }
    }
    // selection
    const multi = this.selection.length > 1;
    for (const [i, name] of this.selection.entries()) {
      const isForm = name === this.doc.root.name;
      const r = isForm ? this.overlayRect(this.form.Element) : this.rectOf(name);
      if (!r) continue;
      const box = h('div', { class: `sel-box ${multi ? 'multi' : ''} ${isForm ? 'form' : ''}` });
      Object.assign(box.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
      const comp = this.component(name);
      const resizable = isForm || (comp instanceof vcl.TControl && !multi);
      const handles: Handle[] = isForm ? ['e', 's', 'se'] : resizable ? HANDLES : ['nw', 'ne', 'se', 'sw'];
      for (const hd of handles) {
        const k = h('div', { class: `grab grab-${hd} ${i === 0 ? 'primary' : ''} ${resizable ? '' : 'passive'}`, dataset: { handle: hd, name } });
        box.append(k);
      }
      o.append(box);
    }
  }

  private showGuides(lines: Array<{ axis: 'x' | 'y'; pos: number; from: number; to: number }>): void {
    this.overlay.querySelectorAll('.guide').forEach((g) => g.remove());
    if (!this.settings.showGuides) return;
    for (const l of lines) {
      const g = h('div', { class: `guide guide-${l.axis}` });
      if (l.axis === 'x') Object.assign(g.style, { left: `${l.pos}px`, top: `${l.from}px`, height: `${l.to - l.from}px` });
      else Object.assign(g.style, { top: `${l.pos}px`, left: `${l.from}px`, width: `${l.to - l.from}px` });
      this.overlay.append(g);
    }
  }

  /* =========================================================== selection */

  select(names: string[], emit = true): void {
    this.selection = names.length ? names : this.doc ? [this.doc.root.name] : [];
    this.renderOverlay();
    if (emit) this.onSelect.emit(this.selection);
  }

  get primary(): string | null {
    return this.selection[0] ?? null;
  }

  /* ============================================================ pointer */

  private pointerDown(e: PointerEvent): void {
    if (!this.form || !this.doc || e.button !== 0) return;
    this.el.focus({ preventScroll: true });
    const target = e.target as HTMLElement;
    const handle = target.dataset?.handle as Handle | undefined;
    e.preventDefault();
    e.stopPropagation();
    if (handle && !target.classList.contains('passive')) {
      this.startResize(e, target.dataset.name!, handle);
      return;
    }
    const hit = this.hitTest(e.clientX, e.clientY);
    if (this.placing) {
      const parent = this.containerAt(e.clientX, e.clientY, new Set());
      this.startCreate(e, parent ?? this.form);
      return;
    }
    if (!hit || hit === this.form) {
      if (!e.shiftKey) this.select([this.doc.root.name]);
      this.startRubberBand(e, this.form);
      return;
    }
    // TTabControl: clicking a tab switches TabIndex at design time (Delphi behaviour)
    if (hit instanceof vcl.TTabControl) {
      const r = hit.Element.getBoundingClientRect();
      const idx = hit.TabAtPoint(e.clientX - r.left, e.clientY - r.top);
      if (idx >= 0 && idx !== hit.TabIndex) this.setProp(hit.Name, 'TabIndex', idx);
    }
    if (e.ctrlKey && hit instanceof vcl.TWinControl && vcl.GetClassInfo(vcl.RegisteredClassOf(hit))?.container) {
      this.select([hit.Name]);
      this.startRubberBand(e, hit);
      return;
    }
    const name = hit.Name;
    if (e.shiftKey) {
      const set = this.selection.filter((n) => n !== this.doc!.root.name);
      this.select(set.includes(name) ? set.filter((n) => n !== name) : [...set, name]);
      return;
    }
    if (!this.selection.includes(name)) this.select([name]);
    else if (this.selection[0] !== name) this.select([name, ...this.selection.filter((n) => n !== name)]);
    this.startMove(e, name);
  }

  private track(e: PointerEvent, move: (m: PointerEvent) => void, up: (m: PointerEvent) => void): void {
    const target = this.stage;
    target.setPointerCapture(e.pointerId);
    const mv = (m: PointerEvent) => move(m);
    const u = (m: PointerEvent) => {
      target.removeEventListener('pointermove', mv);
      target.removeEventListener('pointerup', u);
      target.removeEventListener('pointercancel', u);
      up(m);
    };
    target.addEventListener('pointermove', mv);
    target.addEventListener('pointerup', u);
    target.addEventListener('pointercancel', u);
  }

  /* -------------------------------------------------------------- move */

  private siblingsRects(parent: vcl.TWinControl | null, exclude: Set<string>): Rect[] {
    const out: Rect[] = [];
    if (!parent) return out;
    for (const c of parent.Controls) if (!exclude.has(c.Name.toLowerCase())) out.push(this.overlayRect(c.Element));
    const pr = this.overlayRect(parent.ClientElement);
    out.push({ x: pr.x, y: pr.y, w: pr.w, h: pr.h });
    return out;
  }

  /** Snaps a rect to sibling edges/centres (alignment guides). Returns the adjustment and guide lines. */
  private guideSnap(r: Rect, others: Rect[], edges: { x: Array<'l' | 'c' | 'r'>; y: Array<'t' | 'c' | 'b'> }) {
    const T = 5;
    let dx = 0, dy = 0, bestX = T + 1, bestY = T + 1;
    const lines: Array<{ axis: 'x' | 'y'; pos: number; from: number; to: number }> = [];
    const xs = { l: r.x, c: r.x + r.w / 2, r: r.x + r.w };
    const ys = { t: r.y, c: r.y + r.h / 2, b: r.y + r.h };
    let lineX: { pos: number; o: Rect } | null = null, lineY: { pos: number; o: Rect } | null = null;
    for (const o of others) {
      const oxs = [o.x, o.x + o.w / 2, o.x + o.w];
      const oys = [o.y, o.y + o.h / 2, o.y + o.h];
      for (const k of edges.x) for (const ox of oxs) {
        const d = ox - xs[k];
        if (Math.abs(d) < bestX) { bestX = Math.abs(d); dx = d; lineX = { pos: ox, o }; }
      }
      for (const k of edges.y) for (const oy of oys) {
        const d = oy - ys[k];
        if (Math.abs(d) < bestY) { bestY = Math.abs(d); dy = d; lineY = { pos: oy, o }; }
      }
    }
    if (bestX > T) dx = 0; else if (lineX) lines.push({ axis: 'x', pos: lineX.pos, from: Math.min(r.y, lineX.o.y) - 6, to: Math.max(r.y + r.h, lineX.o.y + lineX.o.h) + 6 });
    if (bestY > T) dy = 0; else if (lineY) lines.push({ axis: 'y', pos: lineY.pos, from: Math.min(r.x, lineY.o.x) - 6, to: Math.max(r.x + r.w, lineY.o.x + lineY.o.w) + 6 });
    return { dx, dy, lines };
  }

  private startMove(e: PointerEvent, primaryName: string): void {
    const doc = this.doc!;
    const primary = this.component(primaryName)!;
    const movers = this.selection
      .map((n) => this.component(n))
      .filter((c): c is vcl.TComponent => !!c && c !== this.form)
      .filter((c) => !(c instanceof vcl.TControl) || (c.Align === 'alNone' && (!(primary instanceof vcl.TControl) || c.Parent === primary.Parent)));
    if (!movers.includes(primary)) return;
    const start = movers.map((c) => (c instanceof vcl.TControl ? { c, x: c.Left, y: c.Top } : { c, x: c.DesignLeft, y: c.DesignTop }));
    const sx = e.clientX, sy = e.clientY;
    const exclude = new Set(movers.map((c) => c.Name.toLowerCase()));
    const parent = primary instanceof vcl.TControl ? primary.Parent : null;
    const others = primary instanceof vcl.TControl ? this.siblingsRects(parent, exclude) : [];
    const startRect = this.rectOf(primaryName)!;
    const startPrimary = start.find((s) => s.c === primary)!;
    let moved = false;
    let dropTarget: vcl.TWinControl | null = null;
    this.track(
      e,
      (m) => {
        let dx = m.clientX - sx, dy = m.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        let nx = this.snap(startPrimary.x + dx, m.altKey), ny = this.snap(startPrimary.y + dy, m.altKey);
        let lines: Array<{ axis: 'x' | 'y'; pos: number; from: number; to: number }> = [];
        if (primary instanceof vcl.TControl && !m.altKey) {
          const r = { x: startRect.x + (nx - startPrimary.x), y: startRect.y + (ny - startPrimary.y), w: startRect.w, h: startRect.h };
          const g = this.guideSnap(r, others, { x: ['l', 'c', 'r'], y: ['t', 'c', 'b'] });
          nx += Math.round(g.dx);
          ny += Math.round(g.dy);
          lines = g.lines;
        }
        dx = nx - startPrimary.x;
        dy = ny - startPrimary.y;
        for (const s of start) {
          if (s.c instanceof vcl.TControl) s.c.SetBounds(s.x + dx, s.y + dy, s.c.Width, s.c.Height);
          else {
            s.c.DesignLeft = Math.max(0, s.x + dx);
            s.c.DesignTop = Math.max(0, s.y + dy);
          }
        }
        // reparenting: find a container under the pointer
        if (primary instanceof vcl.TControl && movers.length === 1) {
          const target = this.containerAt(m.clientX, m.clientY, new Set([primary]));
          if (target !== dropTarget) {
            dropTarget?.Element.classList.remove('jsd-drop-target');
            dropTarget = target;
            if (dropTarget && dropTarget !== primary.Parent && dropTarget !== this.form) dropTarget.Element.classList.add('jsd-drop-target');
          }
        }
        this.drawOverlay();
        this.showGuides(lines); // after the redraw, which clears the overlay
        this.onStatus.emit(`${primaryName}  X: ${nx}  Y: ${ny}`);
      },
      (m) => {
        this.showGuides([]);
        dropTarget?.Element.classList.remove('jsd-drop-target');
        if (!moved) return;
        const reparent = primary instanceof vcl.TControl && dropTarget && dropTarget !== primary.Parent ? dropTarget : null;
        let newPos: { x: number; y: number } | null = null;
        if (reparent && primary instanceof vcl.TControl) {
          const cr = reparent.ClientElement.getBoundingClientRect();
          const pr = primary.Element.getBoundingClientRect();
          newPos = { x: this.snap(pr.left - cr.left, m.altKey), y: this.snap(pr.top - cr.top, m.altKey) };
        }
        doc.mutate((d) => {
          for (const s of start) {
            const ref = this.findIn(d.form, s.c.Name);
            if (!ref) continue;
            ref.node.props ??= {};
            if (s.c instanceof vcl.TControl) {
              ref.node.props.Left = s.c.Left;
              ref.node.props.Top = s.c.Top;
            } else {
              ref.node.props.DesignLeft = s.c.DesignLeft;
              ref.node.props.DesignTop = s.c.DesignTop;
            }
          }
          if (reparent && newPos) {
            const ref = this.findIn(d.form, primary.Name)!;
            ref.parent!.children = ref.parent!.children!.filter((c) => c !== ref.node);
            const target = reparent === this.form ? d.form : this.findIn(d.form, reparent.Name)!.node;
            (target.children ??= []).push(ref.node);
            ref.node.props!.Left = newPos.x;
            ref.node.props!.Top = newPos.y;
          }
        });
        if (reparent) this.reload();
        else this.renderOverlay();
      },
    );
  }

  /* ------------------------------------------------------------ resize */

  private startResize(e: PointerEvent, name: string, hd: Handle): void {
    const doc = this.doc!;
    const isForm = name === doc.root.name;
    const comp = isForm ? this.form! : (this.component(name) as vcl.TControl);
    const sx = e.clientX, sy = e.clientY;
    const b0 = isForm ? { l: 0, t: 0, w: this.form!.ClientWidth, h: this.form!.ClientHeight } : { l: comp.Left, t: comp.Top, w: comp.Width, h: comp.Height };
    const others = isForm ? [] : this.siblingsRects((comp as vcl.TControl).Parent, new Set([name.toLowerCase()]));
    const r0 = isForm ? null : this.rectOf(name)!;
    this.track(
      e,
      (m) => {
        const dx = m.clientX - sx, dy = m.clientY - sy;
        let { l, t, w, h: hh } = b0;
        if (hd.includes('e')) w = this.snap(b0.l + b0.w + dx, m.altKey) - b0.l;
        if (hd.includes('s')) hh = this.snap(b0.t + b0.h + dy, m.altKey) - b0.t;
        if (hd.includes('w')) { l = this.snap(b0.l + dx, m.altKey); w = b0.l + b0.w - l; }
        if (hd.includes('n')) { t = this.snap(b0.t + dy, m.altKey); hh = b0.t + b0.h - t; }
        let lines: Array<{ axis: 'x' | 'y'; pos: number; from: number; to: number }> = [];
        if (r0 && !m.altKey) {
          const r = { x: r0.x + (l - b0.l), y: r0.y + (t - b0.t), w, h: hh };
          const g = this.guideSnap(r, others, { x: hd.includes('e') ? ['r'] : hd.includes('w') ? ['l'] : [], y: hd.includes('s') ? ['b'] : hd.includes('n') ? ['t'] : [] });
          if (hd.includes('e')) w += Math.round(g.dx);
          if (hd.includes('w')) { l += Math.round(g.dx); w -= Math.round(g.dx); }
          if (hd.includes('s')) hh += Math.round(g.dy);
          if (hd.includes('n')) { t += Math.round(g.dy); hh -= Math.round(g.dy); }
          lines = g.lines;
        }
        w = Math.max(isForm ? 120 : 4, w);
        hh = Math.max(isForm ? 60 : 4, hh);
        if (isForm) {
          this.form!.ClientWidth = w;
          this.form!.ClientHeight = hh;
          this.syncStageSize();
        } else comp.SetBounds(l, t, w, hh);
        this.drawOverlay();
        this.showGuides(lines);
        this.onStatus.emit(`${name}  G: ${w}  Y: ${hh}`);
      },
      () => {
        this.showGuides([]);
        doc.mutate((d) => {
          const ref = this.findIn(d.form, name);
          if (!ref) return;
          ref.node.props ??= {};
          if (isForm) {
            ref.node.props.ClientWidth = this.form!.ClientWidth;
            ref.node.props.ClientHeight = this.form!.ClientHeight;
          } else {
            Object.assign(ref.node.props, { Left: comp.Left, Top: comp.Top, Width: comp.Width, Height: comp.Height });
          }
        });
        this.reload();
      },
    );
  }

  /* ------------------------------------------------------ rubber band */

  private startRubberBand(e: PointerEvent, container: vcl.TWinControl): void {
    const o = this.overlay.getBoundingClientRect();
    const sx = e.clientX - o.left, sy = e.clientY - o.top;
    const band = h('div', { class: 'rubber-band' });
    this.overlay.append(band);
    this.track(
      e,
      (m) => {
        const x = m.clientX - o.left, y = m.clientY - o.top;
        Object.assign(band.style, { left: `${Math.min(sx, x)}px`, top: `${Math.min(sy, y)}px`, width: `${Math.abs(x - sx)}px`, height: `${Math.abs(y - sy)}px` });
      },
      (m) => {
        band.remove();
        const x = m.clientX - o.left, y = m.clientY - o.top;
        const r = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
        if (r.w < 3 && r.h < 3) return;
        const hits: string[] = [];
        const candidates: vcl.TComponent[] = [...container.Controls];
        if (container === this.form) candidates.push(...this.form.Components.filter((c) => !(c instanceof vcl.TControl)));
        for (const c of candidates) {
          const cr = this.rectOf(c.Name);
          if (cr && cr.x < r.x + r.w && cr.x + cr.w > r.x && cr.y < r.y + r.h && cr.y + cr.h > r.y) hits.push(c.Name);
        }
        if (hits.length) this.select(e.shiftKey ? [...new Set([...this.selection, ...hits])] : hits);
      },
    );
  }

  /* ------------------------------------------------------------ create */

  private startCreate(e: PointerEvent, parent: vcl.TWinControl): void {
    const cls = this.placing!;
    const info = vcl.GetClassInfo(cls);
    if (!info) return;
    const cr = parent.ClientElement.getBoundingClientRect();
    const o = this.overlay.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    this.dragRect = h('div', { class: 'create-rect' });
    this.overlay.append(this.dragRect);
    this.track(
      e,
      (m) => {
        Object.assign(this.dragRect!.style, {
          left: `${Math.min(sx, m.clientX) - o.left}px`, top: `${Math.min(sy, m.clientY) - o.top}px`,
          width: `${Math.abs(m.clientX - sx)}px`, height: `${Math.abs(m.clientY - sy)}px`,
        });
      },
      (m) => {
        this.dragRect?.remove();
        this.dragRect = null;
        const x = this.snap(Math.min(sx, m.clientX) - cr.left, m.altKey);
        const y = this.snap(Math.min(sy, m.clientY) - cr.top, m.altKey);
        let w = Math.abs(m.clientX - sx), hh = Math.abs(m.clientY - sy);
        if (w < 6 && hh < 6) {
          w = info.defaultSize?.w ?? 100;
          hh = info.defaultSize?.h ?? 24;
        } else {
          w = Math.max(8, this.snap(w, m.altKey));
          hh = Math.max(8, this.snap(hh, m.altKey));
        }
        this.create(cls, parent, x, y, w, hh);
        if (!e.shiftKey) {
          this.placing = null;
          this.onPlaced?.();
        }
      },
    );
  }

  /** Adds a component (visual or non-visual) to the design and selects it. */
  create(cls: string, parent: vcl.TWinControl | null, x: number, y: number, w?: number, hh?: number): string | null {
    const doc = this.doc!;
    const info = vcl.GetClassInfo(cls);
    if (!info || !this.form) return null;
    const name = doc.uniqueName(cls);
    const node: TDesignNode = { class: cls, name, props: {} };
    if (info.visual) {
      Object.assign(node.props!, { Left: Math.max(0, x), Top: Math.max(0, y), Width: w ?? info.defaultSize?.w ?? 100, Height: hh ?? info.defaultSize?.h ?? 24 }, defaultProps(cls, name));
    } else {
      Object.assign(node.props!, { DesignLeft: Math.max(0, x), DesignTop: Math.max(0, y) });
      parent = this.form;
    }
    const target = parent && parent !== this.form ? parent.Name : null;
    doc.mutate((d) => {
      const host = target ? this.findIn(d.form, target)!.node : d.form;
      (host.children ??= []).push(node);
    });
    this.reload();
    this.select([name]);
    return name;
  }

  private drop(e: DragEvent): void {
    const cls = e.dataTransfer?.getData('application/x-jsd-component');
    if (!cls || !this.form) return;
    e.preventDefault();
    const parent = this.containerAt(e.clientX, e.clientY, new Set()) ?? this.form;
    const cr = parent.ClientElement.getBoundingClientRect();
    this.create(cls, parent, this.snap(e.clientX - cr.left, e.altKey), this.snap(e.clientY - cr.top, e.altKey));
  }

  /* ------------------------------------------------------ doc helpers */

  findIn(root: TDesignNode, name: string): { node: TDesignNode; parent: TDesignNode | null } | null {
    if (root.name.toLowerCase() === name.toLowerCase()) return { node: root, parent: null };
    for (const c of root.children ?? []) {
      if (c.name.toLowerCase() === name.toLowerCase()) return { node: c, parent: root };
      const r = this.findIn(c, name);
      if (r) return r;
    }
    return null;
  }

  /** Inspector entry point: live setter + design document (+ undo). */
  setProp(name: string, prop: string, value: unknown): void {
    const doc = this.doc!;
    const comp = name === doc.root.name ? this.form : this.component(name);
    if (!comp) return;
    const pi = vcl.FindPropInfo(vcl.RegisteredClassOf(comp), prop);
    if (!pi) return;
    try {
      vcl.SetPropValue(comp, pi, value, (n) => this.component(n) ?? (n === doc.root.name ? this.form : null));
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    if (prop === 'Font') (comp as vcl.TControl).ParentFont = false;
    doc.mutate((d) => {
      const ref = this.findIn(d.form, name);
      if (!ref) return;
      ref.node.props ??= {};
      const stored = vcl.GetPropValue(comp, pi);
      if (vcl.IsDefaultPropValue(pi, stored) && !['Left', 'Top', 'Width', 'Height'].includes(prop)) delete ref.node.props[prop];
      else ref.node.props[prop] = stored;
      if (prop === 'Font') ref.node.props.ParentFont = false;
      if (prop === 'Color' && vcl.FindPropInfo(vcl.RegisteredClassOf(comp), 'ParentColor')) ref.node.props.ParentColor = false;
    }, 'inspector');
    if (['Align', 'AutoSize', 'Font', 'Caption', 'BorderStyle', 'ClientWidth', 'ClientHeight', 'Visible', 'Anchors', 'Parent'].includes(prop)) this.syncStageSize();
    this.renderOverlay();
  }

  setEvent(name: string, event: string, handler: string | null): void {
    this.doc!.mutate((d) => {
      const ref = this.findIn(d.form, name);
      if (!ref) return;
      ref.node.events ??= {};
      if (handler) ref.node.events[event] = handler;
      else delete ref.node.events[event];
      if (!Object.keys(ref.node.events).length) delete ref.node.events;
    }, 'inspector');
  }

  rename(oldName: string, newName: string): void {
    const doc = this.doc!;
    if (!vcl.IsValidIdent(newName)) throw new Error(`'${newName}' geçerli bir ad değil`);
    if (oldName.toLowerCase() !== newName.toLowerCase() && doc.project.allNames().some((n) => n.toLowerCase() === newName.toLowerCase())) throw new Error(`'${newName}' adı zaten kullanılıyor`);
    if (newName in (this.form ?? {})) throw new Error(`'${newName}' ayrılmış bir üye adı`);
    doc.mutate((d) => {
      const ref = this.findIn(d.form, oldName);
      if (!ref) return;
      ref.node.name = newName;
      // Caption follows the name when it mirrored it (Delphi designer behaviour)
      if (ref.node.props?.Caption === oldName) ref.node.props.Caption = newName;
      // component references stored by name
      const walk = (n: TDesignNode) => {
        for (const [k, v] of Object.entries(n.props ?? {})) {
          if (v === oldName && vcl.FindPropInfo(n.class, k)?.kind === 'component') n.props![k] = newName;
        }
        n.children?.forEach(walk);
      };
      walk(d.form);
    }, 'inspector');
    this.selection = this.selection.map((n) => (n === oldName ? newName : n));
    this.reload();
    this.onSelect.emit(this.selection);
  }

  /* ========================================================= commands */

  deleteSelection(): void {
    const doc = this.doc!;
    const names = this.selection.filter((n) => n !== doc.root.name);
    if (!names.length) return;
    doc.mutate((d) => {
      for (const n of names) {
        const ref = this.findIn(d.form, n);
        if (ref?.parent) ref.parent.children = ref.parent.children!.filter((c) => c !== ref.node);
      }
      // clear references to deleted components
      const gone = new Set(names.map((n) => n.toLowerCase()));
      const walk = (n: TDesignNode) => {
        for (const [k, v] of Object.entries(n.props ?? {})) if (typeof v === 'string' && gone.has(v.toLowerCase()) && vcl.FindPropInfo(n.class, k)?.kind === 'component') delete n.props![k];
        n.children?.forEach(walk);
      };
      walk(d.form);
    });
    this.selection = [doc.root.name];
    this.reload();
    this.onSelect.emit(this.selection);
  }

  copySelection(cut = false): void {
    const doc = this.doc!;
    this.clipboard = this.selection.filter((n) => n !== doc.root.name).map((n) => clone(doc.find(n)!.node));
    void navigator.clipboard?.writeText(JSON.stringify(this.clipboard, null, 2)).catch(() => undefined);
    if (cut) this.deleteSelection();
  }

  paste(): void {
    const doc = this.doc!;
    if (!this.clipboard.length || !this.form) return;
    const primary = this.primary ? this.component(this.primary) : null;
    const parentName = primary instanceof vcl.TWinControl && vcl.GetClassInfo(vcl.RegisteredClassOf(primary))?.container ? primary.Name : doc.root.name;
    const created: string[] = [];
    const renames = new Map<string, string>();
    const taken = new Set(doc.project.allNames().map((n) => n.toLowerCase()));
    const renameTree = (n: TDesignNode) => {
      const base = n.class.replace(/^T/, '');
      let i = 1;
      while (taken.has(`${base}${i}`.toLowerCase())) i++;
      const nn = `${base}${i}`;
      taken.add(nn.toLowerCase());
      renames.set(n.name, nn);
      if (n.props?.Caption === n.name) n.props.Caption = nn;
      n.name = nn;
      n.children?.forEach(renameTree);
    };
    const nodes = this.clipboard.map((n) => {
      const c = clone(n);
      renameTree(c);
      if (c.props && typeof c.props.Left === 'number') {
        c.props.Left = (c.props.Left as number) + this.settings.gridSize;
        c.props.Top = (c.props.Top as number) + this.settings.gridSize;
      }
      delete c.events;
      created.push(c.name);
      return c;
    });
    doc.mutate((d) => {
      const host = this.findIn(d.form, parentName)!.node;
      for (const n of nodes) {
        const visual = vcl.GetClassInfo(n.class)?.visual;
        ((visual ? host : d.form).children ??= []).push(n);
      }
    });
    this.reload();
    this.select(created);
  }

  selectAll(): void {
    const doc = this.doc!;
    const primary = this.primary ? this.component(this.primary) : null;
    const parent = primary instanceof vcl.TControl && primary.Parent ? primary.Parent : this.form!;
    this.select(parent.Controls.map((c) => c.Name).concat(parent === this.form ? this.form.Components.filter((c) => !(c instanceof vcl.TControl)).map((c) => c.Name) : []).filter((n) => n !== doc.root.name));
  }

  nudge(dx: number, dy: number, resize: boolean): void {
    const doc = this.doc!;
    const comps = this.selection.map((n) => this.component(n)).filter((c): c is vcl.TControl => c instanceof vcl.TControl);
    if (!comps.length) return;
    doc.mutate((d) => {
      for (const c of comps) {
        if (resize) c.SetBounds(c.Left, c.Top, Math.max(1, c.Width + dx), Math.max(1, c.Height + dy));
        else c.SetBounds(c.Left + dx, c.Top + dy, c.Width, c.Height);
        const ref = this.findIn(d.form, c.Name);
        if (ref) Object.assign((ref.node.props ??= {}), { Left: c.Left, Top: c.Top, Width: c.Width, Height: c.Height });
      }
    });
    this.renderOverlay();
  }

  /** Align/size commands of the Delphi alignment palette. */
  align(kind: 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter' | 'sameWidth' | 'sameHeight' | 'front' | 'back'): void {
    const doc = this.doc!;
    const comps = this.selection.map((n) => this.component(n)).filter((c): c is vcl.TControl => c instanceof vcl.TControl);
    if (!comps.length) return;
    const [p] = comps;
    if (kind === 'front' || kind === 'back') {
      doc.mutate((d) => {
        for (const c of comps) {
          const ref = this.findIn(d.form, c.Name);
          if (!ref?.parent?.children) continue;
          const list = ref.parent.children.filter((x) => x !== ref.node);
          ref.parent.children = kind === 'front' ? [...list, ref.node] : [ref.node, ...list];
        }
      });
      this.reload();
      return;
    }
    if (comps.length < 2) return;
    for (const c of comps.slice(1)) {
      let { Left: l, Top: t, Width: w, Height: hh } = c;
      switch (kind) {
        case 'left': l = p.Left; break;
        case 'right': l = p.Left + p.Width - w; break;
        case 'top': t = p.Top; break;
        case 'bottom': t = p.Top + p.Height - hh; break;
        case 'hcenter': l = p.Left + Math.round((p.Width - w) / 2); break;
        case 'vcenter': t = p.Top + Math.round((p.Height - hh) / 2); break;
        case 'sameWidth': w = p.Width; break;
        case 'sameHeight': hh = p.Height; break;
      }
      c.SetBounds(l, t, w, hh);
    }
    doc.mutate((d) => {
      for (const c of comps) {
        const ref = this.findIn(d.form, c.Name);
        if (ref) Object.assign((ref.node.props ??= {}), { Left: c.Left, Top: c.Top, Width: c.Width, Height: c.Height });
      }
    });
    this.renderOverlay();
  }

  /* =========================================================== events */

  private doubleClick(e: MouseEvent): void {
    if (!this.doc || !this.form) return;
    const hit = this.hitTest(e.clientX, e.clientY) ?? this.form;
    this.onDefaultEvent.emit({ name: hit.Name, cls: vcl.RegisteredClassOf(hit) });
  }

  private contextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (!this.doc || !this.form) return;
    const hit = this.hitTest(e.clientX, e.clientY);
    if (hit && hit !== this.form && !this.selection.includes(hit.Name)) this.select([hit.Name]);
    const hasSel = this.selection.some((n) => n !== this.doc!.root.name);
    const items: MenuItem[] = [
      { label: 'Olay işleyicisi oluştur', icon: 'events', action: () => { const c = hit ?? this.form!; this.onDefaultEvent.emit({ name: c.Name, cls: vcl.RegisteredClassOf(c) }); } },
      { separator: true },
      { label: 'Kes', icon: 'cut', shortcut: 'Ctrl+X', disabled: !hasSel, action: () => this.copySelection(true) },
      { label: 'Kopyala', icon: 'copy', shortcut: 'Ctrl+C', disabled: !hasSel, action: () => this.copySelection() },
      { label: 'Yapıştır', icon: 'paste', shortcut: 'Ctrl+V', disabled: !this.clipboard.length, action: () => this.paste() },
      { label: 'Sil', icon: 'delete', shortcut: 'Del', disabled: !hasSel, action: () => this.deleteSelection() },
      { separator: true },
      { label: 'Öne getir', icon: 'front', disabled: !hasSel, action: () => this.align('front') },
      { label: 'Arkaya gönder', icon: 'back', disabled: !hasSel, action: () => this.align('back') },
      { separator: true },
      { label: 'Sola hizala', icon: 'alignLeft', disabled: this.selection.length < 2, action: () => this.align('left') },
      { label: 'Üste hizala', icon: 'alignTop', disabled: this.selection.length < 2, action: () => this.align('top') },
      { label: 'Aynı genişlik', icon: 'sameWidth', disabled: this.selection.length < 2, action: () => this.align('sameWidth') },
      { separator: true },
      { label: 'Tümünü seç', shortcut: 'Ctrl+A', action: () => this.selectAll() },
    ];
    showMenu(items, e.clientX, e.clientY);
  }

  private keyDown(e: KeyboardEvent): void {
    if (!this.doc) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const step = ctrl ? 1 : this.settings.snapToGrid ? this.settings.gridSize : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key]) {
      e.preventDefault();
      const [dx, dy] = arrows[e.key];
      this.nudge(e.shiftKey ? Math.sign(dx) : dx, e.shiftKey ? Math.sign(dy) : dy, e.shiftKey);
      return;
    }
    if (e.key === 'Delete' || (e.key === 'Backspace' && !ctrl)) {
      e.preventDefault();
      this.deleteSelection();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (this.placing) {
        this.placing = null;
        this.onPlaced?.();
        return;
      }
      const c = this.primary ? this.component(this.primary) : null;
      if (c instanceof vcl.TControl && c.Parent) this.select([c.Parent === this.form ? this.doc.root.name : c.Parent.Name]);
    } else if (ctrl && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      this.copySelection();
    } else if (ctrl && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      this.copySelection(true);
    } else if (ctrl && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      this.paste();
    } else if (ctrl && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      this.selectAll();
    } else if (e.key === 'Enter') {
      const c = this.primary ?? this.doc.root.name;
      this.onDefaultEvent.emit({ name: c, cls: (this.doc.find(c)?.node.class ?? 'TForm') });
    }
  }

  focus(): void {
    this.el.focus({ preventScroll: true });
  }

  /** Small badge used by the explorer / status bar. */
  static iconFor(cls: string): SVGSVGElement {
    return cls === 'TForm' ? icon('form') : componentIcon(cls, 16);
  }
}
