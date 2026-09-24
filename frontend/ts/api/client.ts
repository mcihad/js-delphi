/* Typed REST client + WebSocket live-sync client for the FastAPI backend. */
import type { TDesignDocument } from '@vcl';
import { Emitter } from '../core/dom';

export interface User { id: number; username: string; display_name: string; color: string; is_admin: boolean }
export interface FormSummary { id: string; name: string; version: number; auto_create: boolean; sort_order: number; design_hash: string; code_hash: string; updated_at: string }
export interface ProjectSettings { gridSize: number; snapToGrid: boolean; showGrid: boolean; showGuides: boolean; allowAdHocSql: boolean; livePreview: boolean; theme: 'dark' | 'light' }
export interface Project { id: string; name: string; title: string; description: string; main_form: string; version: number; owner_id: number; settings: ProjectSettings; forms: FormSummary[]; role: string }
export interface ProjectListItem { id: string; name: string; title: string; main_form: string; updated_at: string; form_count: number; role: string }
export interface FormData { id: string; project_id: string; name: string; version: number; design: TDesignDocument; code: string; code_js: string; design_hash: string; code_hash: string; auto_create: boolean; sort_order: number; updated_at: string; warnings: string[] }
export interface BuildMessage { level: 'error' | 'warning' | 'info' | 'hint'; message: string; file?: string | null; line?: number | null; component?: string | null }
export interface BuildFile { path: string; sha256: string; size: number; changed: boolean; unit: string }
export interface BuildResult { ok: boolean; files: BuildFile[]; warnings: BuildMessage[]; errors: BuildMessage[]; build_id: number | null; duration_ms: number; changed: number; skipped_units: string[]; rebuilt_units: string[]; user_code_lines: Record<string, number> }
export interface RunResult { ok: boolean; build: BuildResult; url: string | null; token: string | null; expires_in: number }
export interface Revision { id: number; version: number; name: string; content_hash: string; message: string; author: string | null; created_at: string }
export interface RevisionDetail extends Revision { design: TDesignDocument; code: string }
export interface Connection { id: string; project_id: string; name: string; driver: string; driver_label: string; family: string; host: string | null; port: number | null; database: string | null; username: string | null; has_password: boolean; options: string[]; read_only: boolean; last_test_ok: boolean | null; last_test_message: string; last_test_at: string | null }
export interface ConnectionInput { project_id: string; name: string; driver: string; host?: string | null; port?: number | null; database?: string | null; username?: string | null; password?: string | null; options?: Record<string, string>; url?: string | null; read_only?: boolean }
export interface DriverInfo { driver: string; label: string; family: string; available: boolean; default_port: number | null; fields: Array<{ name: string; label: string; type: string; required: boolean; placeholder: string }>; options: string[] }
export interface SchemaColumn { name: string; type: string; field_type: string; nullable: boolean; default: string | null; primary_key: boolean; autoincrement: boolean }
export interface SchemaTable { name: string; schema: string | null; kind: 'table' | 'view'; columns: SchemaColumn[]; primary_key: string[]; foreign_keys: Array<{ name: string | null; columns: string[]; ref_table: string; ref_columns: string[] }>; indexes: Array<{ name: string | null; columns: string[]; unique: boolean }> }
export interface SchemaInfo { driver: string; default_schema: string | null; tables: SchemaTable[]; procedures: Array<{ name: string; schema: string | null; kind: string }> }
export interface QueryResult { columns: Array<{ name: string; type: string; field_type: string }>; rows: unknown[][]; row_count: number; truncated: boolean; rows_affected: number | null; elapsed_ms: number; primary_key?: string[] }

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function detailMessage(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => `${(d as { loc?: unknown[] }).loc?.slice(1).join('.') ?? ''}: ${(d as { msg?: string }).msg ?? ''}`).join('; ');
  if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message);
  return `HTTP ${status}`;
}

export class ApiClient {
  token: string | null = localStorage.getItem('jsd.token');
  readonly clientId = Math.random().toString(16).slice(2, 14);

  async request<T>(method: string, path: string, body?: unknown, raw = false): Promise<T> {
    const headers: Record<string, string> = { 'X-Client-Id': this.clientId };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
    if (raw && res.ok) return res as unknown as T;
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const detail = (data as { detail?: unknown } | null)?.detail ?? data;
      throw new ApiError(res.status, detailMessage(detail, res.status), detail);
    }
    return data as T;
  }

  get = <T>(p: string) => this.request<T>('GET', p);
  post = <T>(p: string, b: unknown = {}) => this.request<T>('POST', p, b);
  put = <T>(p: string, b: unknown) => this.request<T>('PUT', p, b);
  del = <T>(p: string) => this.request<T>('DELETE', p);

  async ensureLogin(): Promise<User> {
    if (this.token) {
      try {
        return await this.get<User>('/auth/me');
      } catch {
        this.token = null;
      }
    }
    const cfg = await this.get<{ dev_login: boolean }>('/auth/config');
    if (!cfg.dev_login) throw new ApiError(401, 'Oturum açmanız gerekiyor', null);
    const r = await this.post<{ token: string; user: User }>('/auth/dev', { username: 'developer', display_name: 'Geliştirici' });
    this.token = r.token;
    localStorage.setItem('jsd.token', r.token);
    return r.user;
  }

  /* ---- projects & forms */
  projects = () => this.get<ProjectListItem[]>('/projects');
  project = (id: string) => this.get<Project>(`/projects/${id}`);
  createProject = (name: string, title: string, template: 'blank' | 'demo') => this.post<Project>('/projects', { name, title, template });
  updateProject = (id: string, data: Partial<{ title: string; main_form: string; settings: Partial<ProjectSettings> }>) => this.put<Project>(`/projects/${id}`, data);
  forms = (pid: string) => this.get<FormData[]>(`/projects/${pid}/forms`);
  createForm = (pid: string, name?: string) => this.post<FormData>(`/projects/${pid}/forms`, name ? { name } : {});
  saveForm = (pid: string, fid: string, data: Partial<{ design: TDesignDocument; code: string; code_js: string; name: string; base_version: number; auto_create: boolean }>) => this.put<FormData>(`/projects/${pid}/forms/${fid}`, data);
  deleteForm = (pid: string, fid: string) => this.del<void>(`/projects/${pid}/forms/${fid}`);
  revisions = (pid: string, fid: string) => this.get<Revision[]>(`/projects/${pid}/forms/${fid}/revisions`);
  revision = (pid: string, fid: string, rid: number) => this.get<RevisionDetail>(`/projects/${pid}/forms/${fid}/revisions/${rid}`);
  restoreRevision = (pid: string, fid: string, rid: number) => this.post<FormData>(`/projects/${pid}/forms/${fid}/revisions/${rid}/restore`);
  build = (pid: string, force = false) => this.post<BuildResult>(`/projects/${pid}/build`, { force });
  run = (pid: string) => this.post<RunResult>(`/projects/${pid}/run`, {});
  previewToken = (pid: string) => this.post<{ token: string; base: string }>(`/projects/${pid}/preview-token`);
  async exportZip(pid: string): Promise<Blob> {
    const res = await this.request<Response>('POST', `/projects/${pid}/export`, undefined, true);
    return res.blob();
  }
  uploadAsset(pid: string, file: File): Promise<{ path: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.request('POST', `/projects/${pid}/assets`, fd);
  }

  /* ---- database */
  drivers = () => this.get<DriverInfo[]>('/db/drivers');
  connections = (pid: string) => this.get<Connection[]>(`/db/connections?project_id=${encodeURIComponent(pid)}`);
  createConnection = (c: ConnectionInput) => this.post<Connection>('/db/connections', c);
  updateConnection = (id: string, c: ConnectionInput) => this.put<Connection>(`/db/connections/${id}`, c);
  deleteConnection = (id: string) => this.del<void>(`/db/connections/${id}`);
  testConnection = (c: ConnectionInput) => this.post<{ ok: boolean; message: string; server_version: string | null; elapsed_ms: number }>('/db/connections/test', c);
  testSaved = (id: string) => this.post<{ ok: boolean; message: string; server_version: string | null; elapsed_ms: number }>(`/db/${id}/test`);
  schema = (id: string, refresh = false) => this.get<SchemaInfo>(`/db/${id}/schema${refresh ? '?refresh=true' : ''}`);
  preview = (id: string, table: string, limit = 100) => this.get<QueryResult>(`/db/${id}/tables/${encodeURIComponent(table)}/preview?limit=${limit}`);
  query = (id: string, sql: string, params: Record<string, unknown>, mode: 'query' | 'exec' = 'query', max_rows = 200) => this.post<QueryResult>(`/db/${id}/query`, { sql, params, mode, max_rows });
  queryBuilder = (id: string, spec: unknown) => this.post<{ sql: string; params: Array<{ name: string; value: unknown }>; dialect: string }>(`/db/${id}/query-builder`, spec);
  migrations = (id: string) => this.get<{ current: string | null; head: string | null; revisions: Array<{ revision: string; message: string; applied: boolean; created_at: string; upgrade_ops: unknown[] }> }>(`/db/${id}/migrations`);
  createMigration = (id: string, body: unknown) => this.post<{ revision: string; sql: string; notes: string[] }>(`/db/${id}/migrations`, body);
  upgrade = (id: string) => this.post<{ applied: string[] }>(`/db/${id}/migrations/upgrade`, { target: 'head' });
  downgrade = (id: string) => this.post<{ reverted: string[] }>(`/db/${id}/migrations/downgrade`, { target: '-1' });
  targetSchema = (id: string) => this.get<{ tables: unknown[] }>(`/db/${id}/target-schema`);
}

export const api = new ApiClient();

/* ------------------------------------------------------------------- sync */

export interface Peer { client_id: string; username: string; display_name: string; color: string; state: { form?: string; selection?: string[] } }

export class SyncClient {
  readonly peers = new Map<string, Peer>();
  readonly onEvent = new Emitter<Record<string, unknown>>();
  readonly onPeers = new Emitter<Peer[]>();
  readonly onStatus = new Emitter<'online' | 'offline'>();
  private ws: WebSocket | null = null;
  private retry = 0;
  private closed = false;
  private projectId = '';

  connect(projectId: string): void {
    this.projectId = projectId;
    this.closed = false;
    this.open();
  }

  private open(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws/${this.projectId}`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: api.token, client_id: api.clientId }));
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      switch (msg.type) {
        case 'welcome':
          this.retry = 0;
          this.peers.clear();
          for (const p of msg.peers as Peer[]) this.peers.set(p.client_id, p);
          this.onStatus.emit('online');
          this.onPeers.emit([...this.peers.values()]);
          break;
        case 'peer.join':
          this.peers.set((msg.peer as Peer).client_id, msg.peer as Peer);
          this.onPeers.emit([...this.peers.values()]);
          break;
        case 'peer.leave':
          this.peers.delete(String(msg.client_id));
          this.onPeers.emit([...this.peers.values()]);
          break;
        case 'presence': {
          const p = this.peers.get(String(msg.client_id));
          if (p) {
            p.state = msg.state as Peer['state'];
            this.onPeers.emit([...this.peers.values()]);
          }
          break;
        }
        default:
          this.onEvent.emit(msg);
      }
    };
    ws.onclose = () => {
      this.onStatus.emit('offline');
      if (this.closed) return;
      this.retry = Math.min(this.retry + 1, 6);
      setTimeout(() => this.open(), 500 * 2 ** this.retry);
    };
  }

  send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }
}
