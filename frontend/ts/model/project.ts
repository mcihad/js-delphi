/* Project / form models: design documents, undo/redo and the debounced save queue. */
import { transform } from 'sucrase';
import * as vcl from '@vcl';
import type { TDesignDocument, TDesignNode } from '@vcl';
import { api, ApiError, type Connection, type FormData, type Project } from '../api/client';
import { Emitter, clone, debounce, toast } from '../core/dom';

export type ChangeKind = 'design' | 'code' | 'reload' | 'rename' | 'saved';

export interface NodeRef {
  node: TDesignNode;
  parent: TDesignNode | null;
}

/** Type-strips a unit with sucrase (line numbers are preserved → exact runtime error mapping). */
export function compileUnit(code: string): { js: string; error: string | null } {
  try {
    return { js: transform(code, { transforms: ['typescript'], disableESTransforms: true, keepUnusedImports: true }).code, error: null };
  } catch (e) {
    return { js: code, error: e instanceof Error ? e.message : String(e) };
  }
}

export class FormDoc {
  id: string;
  name: string;
  version: number;
  design: TDesignDocument;
  code: string;
  warnings: string[];
  autoCreate: boolean;
  dirtyDesign = false;
  dirtyCode = false;
  saving = false;
  private pending = false;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  readonly onChange = new Emitter<{ kind: ChangeKind; source?: string }>();
  readonly scheduleDesign: ReturnType<typeof debounce>;
  readonly scheduleCode: ReturnType<typeof debounce>;

  readonly project: ProjectModel;

  constructor(data: FormData, project: ProjectModel) {
    this.project = project;
    this.id = data.id;
    this.name = data.name;
    this.version = data.version;
    this.design = data.design;
    this.code = data.code;
    this.warnings = data.warnings ?? [];
    this.autoCreate = data.auto_create;
    // Designer changes reach the backend 300 ms after the last edit; typing waits a bit longer.
    this.scheduleDesign = debounce(() => void this.save(), 300);
    this.scheduleCode = debounce(() => void this.save(), 700);
  }

  get root(): TDesignNode {
    return this.design.form;
  }

  get dirty(): boolean {
    return this.dirtyDesign || this.dirtyCode || this.saving;
  }

  /* ------------------------------------------------------------ queries */

  find(name: string): NodeRef | null {
    const lower = name.toLowerCase();
    if (this.root.name.toLowerCase() === lower) return { node: this.root, parent: null };
    let found: NodeRef | null = null;
    const walk = (n: TDesignNode) => {
      for (const c of n.children ?? []) {
        if (found) return;
        if (c.name.toLowerCase() === lower) found = { node: c, parent: n };
        else walk(c);
      }
    };
    walk(this.root);
    return found;
  }

  walk(fn: (node: TDesignNode, parent: TDesignNode | null, depth: number) => void): void {
    const rec = (n: TDesignNode, p: TDesignNode | null, d: number) => {
      fn(n, p, d);
      for (const c of n.children ?? []) rec(c, n, d + 1);
    };
    rec(this.root, null, 0);
  }

  names(): string[] {
    const out: string[] = [];
    this.walk((n) => out.push(n.name));
    return out;
  }

  uniqueName(className: string): string {
    const base = className.replace(/^T/, '');
    const taken = new Set(this.project.allNames().map((n) => n.toLowerCase()));
    let i = 1;
    while (taken.has(`${base}${i}`.toLowerCase())) i++;
    return `${base}${i}`;
  }

  /** Handlers referenced by events of any component of this form. */
  handlers(): Map<string, Array<{ component: string; cls: string; event: string }>> {
    const map = new Map<string, Array<{ component: string; cls: string; event: string }>>();
    this.walk((n) => {
      for (const [ev, h] of Object.entries(n.events ?? {})) {
        if (!map.has(h)) map.set(h, []);
        map.get(h)!.push({ component: n.name, cls: n.class, event: ev });
      }
    });
    return map;
  }

  /* ------------------------------------------------------------ mutations */

  /** Applies a design change as one undoable step and schedules the save. */
  mutate(fn: (design: TDesignDocument) => void, source = 'designer'): void {
    this.undoStack.push(JSON.stringify(this.design));
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
    fn(this.design);
    this.dirtyDesign = true;
    this.onChange.emit({ kind: 'design', source });
    this.project.onDirty.emit();
    this.scheduleDesign();
  }

  setCode(code: string): void {
    if (code === this.code) return;
    this.code = code;
    this.dirtyCode = true;
    this.onChange.emit({ kind: 'code' });
    this.project.onDirty.emit();
    this.scheduleCode();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify(this.design));
    this.design = JSON.parse(prev);
    this.dirtyDesign = true;
    this.onChange.emit({ kind: 'reload', source: 'undo' });
    this.scheduleDesign();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify(this.design));
    this.design = JSON.parse(next);
    this.dirtyDesign = true;
    this.onChange.emit({ kind: 'reload', source: 'redo' });
    this.scheduleDesign();
  }

  /** Remote update from another collaborator (applied when we have no local edits). */
  applyRemote(data: { version: number; design?: TDesignDocument | null; code?: string | null; name?: string }): boolean {
    if (this.dirty) return false;
    this.version = data.version;
    if (data.design) this.design = data.design;
    if (typeof data.code === 'string') this.code = data.code;
    if (data.name) this.name = data.name;
    this.onChange.emit({ kind: 'reload', source: 'remote' });
    return true;
  }

  /* ----------------------------------------------------------------- save */

  async save(): Promise<void> {
    if (!this.dirtyDesign && !this.dirtyCode) return;
    if (this.saving) {
      this.pending = true;
      return;
    }
    const body: Record<string, unknown> = { base_version: this.version };
    const sendDesign = this.dirtyDesign;
    const sendCode = this.dirtyCode;
    if (sendDesign) body.design = clone(this.design);
    if (sendCode) {
      const { js } = compileUnit(this.code);
      body.code = this.code;
      body.code_js = js;
    }
    this.dirtyDesign = this.dirtyCode = false;
    this.saving = true;
    this.project.onSaveState.emit('saving');
    try {
      const r = await api.saveForm(this.project.data.id, this.id, body);
      this.version = r.version;
      this.warnings = r.warnings;
      this.onChange.emit({ kind: 'saved' });
      this.project.onSaveState.emit('saved');
    } catch (e) {
      if (sendDesign) this.dirtyDesign = true;
      if (sendCode) this.dirtyCode = true;
      if (e instanceof ApiError && e.status === 409) {
        // Last writer wins: adopt the server version and resend our change.
        const detail = e.detail as { version?: number } | null;
        this.version = detail?.version ?? this.version;
        toast(`${this.name} başka bir oturumda da değişti; sizin değişiklikleriniz uygulanıyor`, 'warning');
        this.pending = true;
      } else {
        this.project.onSaveState.emit('error');
        toast(`Kaydedilemedi: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }
    } finally {
      this.saving = false;
      if (this.pending) {
        this.pending = false;
        void this.save();
      }
    }
  }

  flush(): Promise<void> {
    this.scheduleDesign.cancel();
    this.scheduleCode.cancel();
    return this.save();
  }
}

export class ProjectModel {
  data: Project;
  forms: FormDoc[] = [];
  connections: Connection[] = [];
  readonly onSaveState = new Emitter<'saving' | 'saved' | 'error'>();
  readonly onDirty = new Emitter<void>();
  readonly onFormsChanged = new Emitter<void>();
  readonly onConnections = new Emitter<void>();

  constructor(data: Project) {
    this.data = data;
  }

  static async load(id: string): Promise<ProjectModel> {
    const [data, forms, connections] = await Promise.all([api.project(id), api.forms(id), api.connections(id)]);
    const m = new ProjectModel(data);
    m.forms = forms.map((f) => new FormDoc(f, m));
    m.connections = connections;
    m.registerConnections();
    return m;
  }

  formByName(name: string): FormDoc | undefined {
    return this.forms.find((f) => f.name.toLowerCase() === name.toLowerCase());
  }

  formById(id: string): FormDoc | undefined {
    return this.forms.find((f) => f.id === id);
  }

  allNames(): string[] {
    return this.forms.flatMap((f) => f.names());
  }

  async reloadConnections(): Promise<void> {
    this.connections = await api.connections(this.data.id);
    this.registerConnections();
    this.onConnections.emit();
  }

  /** Design-time DataService: ConnectionDefName → id (the same map app.js gets at build). */
  registerConnections(): void {
    vcl.DataService.RegisterConnections(Object.fromEntries(this.connections.map((c) => [c.name, c.id])));
  }

  async addForm(): Promise<FormDoc> {
    const data = await api.createForm(this.data.id);
    const doc = new FormDoc(data, this);
    this.forms.push(doc);
    this.onFormsChanged.emit();
    return doc;
  }

  async removeForm(doc: FormDoc): Promise<void> {
    await api.deleteForm(this.data.id, doc.id);
    this.forms = this.forms.filter((f) => f !== doc);
    this.onFormsChanged.emit();
  }

  async flushAll(): Promise<void> {
    await Promise.all(this.forms.map((f) => f.flush()));
  }

  get dirty(): boolean {
    return this.forms.some((f) => f.dirty);
  }
}
