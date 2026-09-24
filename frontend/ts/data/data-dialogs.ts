/**
 * Visual database tooling: connection manager (secrets are write-only), schema browser
 * with data preview, SQL editor + visual query builder (drag & drop columns) for TQuery
 * and an Alembic-like migrations dialog.
 */
import { monaco } from '../../vendor/monaco';
import { api, type Connection, type ConnectionInput, type DriverInfo, type QueryResult, type SchemaInfo, type SchemaTable } from '../api/client';
import { Dialog, clear, h, icon, toast } from '../core/dom';
import type { ProjectModel } from '../model/project';

/* ------------------------------------------------------------ data grid */

export function renderResult(host: HTMLElement, r: QueryResult | null, note = ''): void {
  clear(host);
  if (!r) {
    host.append(h('div', { class: 'empty', text: note || 'Sonuç yok' }));
    return;
  }
  const table = h('table', { class: 'data-grid' });
  const head = h('tr', {}, h('th', { class: 'rn', text: '#' }), ...r.columns.map((c) => h('th', { title: `${c.type} · ${c.field_type}` }, h('span', { text: c.name }), h('small', { text: c.field_type.replace('ft', '') }))));
  table.append(h('thead', {}, head));
  const tb = h('tbody');
  r.rows.forEach((row, i) => {
    tb.append(h('tr', {}, h('td', { class: 'rn', text: String(i + 1) }), ...row.map((v) => h('td', { class: typeof v === 'number' ? 'num' : v === null ? 'null' : '', text: v === null ? 'NULL' : String(v) }))));
  });
  table.append(tb);
  host.append(h('div', { class: 'grid-scroll' }, table), h('div', { class: 'grid-status', text: `${r.row_count} satır${r.truncated ? ' (kesildi)' : ''} · ${r.elapsed_ms} ms${r.rows_affected !== null && r.rows_affected !== undefined ? ` · etkilenen: ${r.rows_affected}` : ''}${note ? ` · ${note}` : ''}` }));
}

/* --------------------------------------------------------- connections */

export async function connectionManager(project: ProjectModel, preselect?: string): Promise<void> {
  const drivers: DriverInfo[] = await api.drivers();
  const d = new Dialog('Veritabanı Bağlantıları', { width: 820, height: 540, className: 'dlg-conn' });
  const list = h('div', { class: 'conn-list' });
  const form = h('div', { class: 'conn-form' });
  d.body.append(h('div', { class: 'split' }, list, form));
  let current: Connection | null = null;

  const renderList = () => {
    clear(list);
    const add = h('button', { class: 'btn btn-sm' }, icon('plus', 12), h('span', { text: 'Yeni bağlantı' }));
    add.addEventListener('click', () => edit(null));
    list.append(add);
    for (const c of project.connections) {
      const row = h('div', { class: `conn-item ${current?.id === c.id ? 'active' : ''}` }, icon('database', 14), h('div', {}, h('div', { class: 'ci-name', text: c.name }), h('div', { class: 'ci-sub', text: `${c.driver_label}${c.database ? ` · ${c.database}` : ''}` })), c.last_test_ok === true ? h('span', { class: 'ok-dot', title: 'Son test başarılı' }) : '');
      row.addEventListener('click', () => edit(c));
      list.append(row);
    }
  };

  const edit = (c: Connection | null) => {
    current = c;
    renderList();
    clear(form);
    const name = h('input', { class: 'inp', attrs: { placeholder: 'DemoDB' } });
    name.value = c?.name ?? '';
    const driver = h('select', { class: 'inp' });
    for (const dr of drivers) driver.append(h('option', { text: `${dr.label}${dr.available ? '' : ' (sürücü yok)'}`, attrs: { value: dr.driver } }));
    driver.value = c?.driver ?? 'sqlite';
    const fields = h('div', { class: 'conn-fields' });
    const inputs = new Map<string, HTMLInputElement>();
    const url = h('input', { class: 'inp mono', attrs: { placeholder: 'postgresql+psycopg://kullanici:parola@sunucu:5432/veritabani (isteğe bağlı)' } });
    const ro = h('input', { attrs: { type: 'checkbox' } });
    ro.checked = !!c?.read_only;
    const status = h('div', { class: 'conn-status' });
    const renderFields = () => {
      clear(fields);
      inputs.clear();
      const spec = drivers.find((x) => x.driver === driver.value)!;
      for (const f of spec.fields) {
        const i = h('input', { class: 'inp', attrs: { type: f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text', placeholder: f.placeholder || (f.name === 'port' && spec.default_port ? String(spec.default_port) : '') } });
        const v = c ? (c as unknown as Record<string, unknown>)[f.name] : null;
        if (f.type === 'password') i.placeholder = c?.has_password ? '•••••• (kayıtlı — değiştirmek için yazın)' : '';
        else if (v !== null && v !== undefined) i.value = String(v);
        inputs.set(f.name, i);
        fields.append(h('label', { class: 'field' }, h('span', { text: `${f.label}${f.required ? ' *' : ''}` }), i));
      }
      if (spec.driver === 'sqlite') fields.append(h('p', { class: 'muted', text: 'SQLite dosyası projenin data/ klasöründe tutulur (yol dışarı çıkamaz).' }));
    };
    driver.addEventListener('change', renderFields);
    renderFields();
    const payload = (): ConnectionInput => {
      const get = (k: string) => inputs.get(k)?.value.trim() || null;
      const pwd = inputs.get('password')?.value;
      return {
        project_id: project.data.id,
        name: name.value.trim(),
        driver: driver.value,
        host: get('host'),
        port: get('port') ? Number(get('port')) : null,
        database: get('database'),
        username: get('username'),
        password: pwd ? pwd : c ? null : null,
        url: url.value.trim() || null,
        read_only: ro.checked,
      };
    };
    const test = h('button', { class: 'btn' }, icon('link', 14), h('span', { text: 'Bağlantıyı test et' }));
    test.addEventListener('click', async () => {
      status.textContent = 'Test ediliyor…';
      status.className = 'conn-status';
      try {
        const r = c && !inputs.get('password')?.value && !url.value ? await api.testSaved(c.id) : await api.testConnection(payload());
        status.textContent = r.ok ? `✓ ${r.message} — ${r.server_version} (${r.elapsed_ms} ms)` : `✗ ${r.message}`;
        status.className = `conn-status ${r.ok ? 'ok' : 'bad'}`;
      } catch (e) {
        status.textContent = `✗ ${e instanceof Error ? e.message : e}`;
        status.className = 'conn-status bad';
      }
    });
    const save = h('button', { class: 'btn btn-primary' }, icon('save', 14), h('span', { text: 'Kaydet' }));
    save.addEventListener('click', async () => {
      try {
        const r = c ? await api.updateConnection(c.id, payload()) : await api.createConnection(payload());
        await project.reloadConnections();
        toast(`'${r.name}' kaydedildi (parola sunucuda şifreli)`, 'success');
        edit(project.connections.find((x) => x.id === r.id) ?? null);
      } catch (e) {
        status.textContent = `✗ ${e instanceof Error ? e.message : e}`;
        status.className = 'conn-status bad';
      }
    });
    const del = h('button', { class: 'btn btn-danger' }, icon('delete', 14), h('span', { text: 'Sil' }));
    del.disabled = !c;
    del.addEventListener('click', async () => {
      if (!c) return;
      await api.deleteConnection(c.id);
      await project.reloadConnections();
      edit(null);
    });
    form.append(
      h('div', { class: 'field-row' }, h('label', { class: 'field' }, h('span', { text: 'Tanım adı (ConnectionDefName) *' }), name), h('label', { class: 'field' }, h('span', { text: 'Sürücü' }), driver)),
      fields,
      h('label', { class: 'field' }, h('span', { text: 'Bağlantı dizesi' }), url),
      h('label', { class: 'chk' }, ro, h('span', { text: 'Salt okunur (yalnızca SELECT)' })),
      h('div', { class: 'sec-note' }, icon('key', 13), h('span', { text: 'Parola ve bağlantı dizesi sunucuda AES-256-GCM ile şifrelenir; IDE ve üretilen uygulama bunları asla göremez. Uygulama yalnızca ConnectionDefName kullanır.' })),
      h('div', { class: 'row-buttons' }, test, save, del),
      status,
    );
  };

  d.buttons([{ label: 'Kapat', primary: true }]);
  renderList();
  edit(project.connections.find((c) => c.id === preselect || c.name === preselect) ?? project.connections[0] ?? null);
  d.show();
}

/* --------------------------------------------------------- schema browser */

export async function schemaBrowser(project: ProjectModel, connectionId?: string): Promise<void> {
  const conns = project.connections;
  if (!conns.length) {
    toast('Önce bir bağlantı tanımlayın', 'warning');
    return connectionManager(project);
  }
  const d = new Dialog('Şema Tarayıcı ve Veri Önizleme', { width: 1000, height: 600, className: 'dlg-schema' });
  const sel = h('select', { class: 'inp' });
  for (const c of conns) sel.append(h('option', { text: `${c.name} (${c.driver_label})`, attrs: { value: c.id } }));
  sel.value = connectionId ?? conns[0].id;
  const tree = h('div', { class: 'schema-tree' });
  const grid = h('div', { class: 'schema-grid' });
  const refresh = h('button', { class: 'icon-btn', title: 'Yenile' }, icon('refresh'));
  d.body.append(h('div', { class: 'schema-top' }, icon('database', 14), sel, refresh), h('div', { class: 'split' }, tree, grid));
  const load = async (force = false) => {
    clear(tree);
    tree.append(h('div', { class: 'muted', text: 'Yükleniyor…' }));
    let s: SchemaInfo;
    try {
      s = await api.schema(sel.value, force);
    } catch (e) {
      clear(tree);
      tree.append(h('div', { class: 'conn-status bad', text: String(e instanceof Error ? e.message : e) }));
      return;
    }
    clear(tree);
    for (const t of s.tables) {
      const head = h('div', { class: 'st-table' }, icon(t.kind === 'view' ? 'window' : 'table', 14), h('span', { text: t.name }), h('small', { text: `${t.columns.length} kolon` }));
      const cols = h('div', { class: 'st-cols' });
      for (const c of t.columns) cols.append(h('div', { class: 'st-col' }, c.primary_key ? icon('key', 12) : icon('column', 12), h('span', { text: c.name }), h('small', { text: `${c.type || c.field_type}${c.nullable ? '' : ' NOT NULL'}${c.autoincrement ? ' AUTO' : ''}` })));
      for (const fk of t.foreign_keys) cols.append(h('div', { class: 'st-fk' }, icon('link', 12), h('span', { text: `${fk.columns.join(',')} → ${fk.ref_table}(${fk.ref_columns.join(',')})` })));
      for (const ix of t.indexes) cols.append(h('div', { class: 'st-fk' }, icon('sort', 12), h('span', { text: `${ix.unique ? 'UNIQUE ' : ''}${ix.name}: ${ix.columns.join(', ')}` })));
      head.addEventListener('click', async () => {
        tree.querySelectorAll('.st-table.active').forEach((x) => x.classList.remove('active'));
        head.classList.add('active');
        renderResult(grid, null, 'Yükleniyor…');
        try {
          renderResult(grid, await api.preview(sel.value, t.name, 200), `${t.name} önizlemesi`);
        } catch (e) {
          renderResult(grid, null, String(e instanceof Error ? e.message : e));
        }
      });
      tree.append(head, cols);
    }
    if (s.procedures.length) {
      tree.append(h('div', { class: 'st-sep', text: 'Saklı yordamlar' }));
      for (const p of s.procedures) tree.append(h('div', { class: 'st-col' }, icon('build', 12), h('span', { text: p.name })));
    }
    (tree.querySelector('.st-table') as HTMLElement | null)?.click();
  };
  sel.addEventListener('change', () => void load());
  refresh.addEventListener('click', () => void load(true));
  d.buttons([{ label: 'Kapat', primary: true }]).show();
  await load();
}

/* ---------------------------------------------- SQL editor + query builder */

interface QBTable { name: string; alias: string; cols: SchemaTable['columns'] }
interface QBWhere { column: string; op: string; param: string; value: string }

export interface SqlEditResult { sql: string[]; params: Array<{ Name: string; DataType: string; Value?: unknown }> }

export async function sqlEditor(project: ProjectModel, title: string, connectionName: string | null, sql: string[], params: Array<{ Name: string; DataType?: string; Value?: unknown }>): Promise<SqlEditResult | null> {
  const conn = project.connections.find((c) => c.name === connectionName) ?? null;
  const d = new Dialog(`SQL Düzenleyici — ${title}`, { width: 1100, height: 700, className: 'dlg-sql' });
  const tabs = h('div', { class: 'dlg-tabs' });
  const pages = h('div', { class: 'dlg-pages' });
  const sqlHost = h('div', { class: 'sql-editor' });
  const resultHost = h('div', { class: 'sql-result' });
  const paramsHost = h('div', { class: 'sql-params' });
  const sqlPage = h('div', { class: 'dlg-page active' }, sqlHost, paramsHost, resultHost);
  const qbPage = h('div', { class: 'dlg-page' });
  pages.append(sqlPage, qbPage);
  const tabBtn = (label: string, ic: string, page: HTMLElement) => {
    const b = h('button', { class: `dlg-tab ${page === sqlPage ? 'active' : ''}` }, icon(ic, 14), h('span', { text: label }));
    b.addEventListener('click', () => {
      tabs.querySelectorAll('.dlg-tab').forEach((x) => x.classList.remove('active'));
      pages.querySelectorAll('.dlg-page').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      page.classList.add('active');
      editor.layout();
    });
    return b;
  };
  tabs.append(tabBtn('SQL', 'code', sqlPage), tabBtn('Görsel Sorgu Oluşturucu', 'query', qbPage));
  d.body.append(tabs, pages);
  const model = monaco.editor.createModel(sql.join('\n'), 'sql');
  const editor = monaco.editor.create(sqlHost, { model, theme: 'jsd-light', unicodeHighlight: { ambiguousCharacters: false }, minimap: { enabled: false }, fontSize: 13, automaticLayout: true, scrollBeyondLastLine: false, lineNumbers: 'on' });
  const paramValues = new Map(params.map((p) => [p.Name, p]));

  const detectParams = (): string[] => {
    const names: string[] = [];
    for (const m of model.getValue().replace(/'[^']*'/g, '').matchAll(/(?<![:\w]):([A-Za-z_]\w*)/g)) if (!names.includes(m[1])) names.push(m[1]);
    return names;
  };
  const renderParams = () => {
    clear(paramsHost);
    const names = detectParams();
    paramsHost.append(h('span', { class: 'muted', text: names.length ? 'Parametreler (sunucuda bağlanır):' : 'Parametre yok' }));
    for (const n of names) {
      const p = paramValues.get(n) ?? { Name: n, DataType: 'ftString' };
      paramValues.set(n, p);
      const i = h('input', { class: 'inp inp-sm', attrs: { placeholder: 'değer' } });
      i.value = p.Value === undefined || p.Value === null ? '' : String(p.Value);
      i.addEventListener('input', () => (p.Value = i.value));
      paramsHost.append(h('label', { class: 'param-chip' }, h('span', { class: 'mono', text: `:${n}` }), i));
    }
  };
  model.onDidChangeContent(() => renderParams());
  renderParams();

  const run = h('button', { class: 'btn' }, icon('run', 14), h('span', { text: 'Çalıştır (önizleme)' }));
  run.addEventListener('click', async () => {
    if (!conn) return toast('TQuery.Connection → ConnectionDefName atanmamış', 'warning');
    const values: Record<string, unknown> = {};
    for (const n of detectParams()) values[n] = paramValues.get(n)?.Value ?? null;
    const text = model.getValue();
    const mode = /^\s*(select|with)\b/i.test(text) ? 'query' : 'exec';
    if (mode === 'exec') return renderResult(resultHost, null, 'Yalnızca SELECT önizlenir; INSERT/UPDATE/DELETE çalışma zamanında ExecSQL ile yürütülür.');
    renderResult(resultHost, null, 'Çalıştırılıyor…');
    try {
      renderResult(resultHost, await api.query(conn.id, text, values, 'query', 200), 'parametreler sunucuda bağlandı');
    } catch (e) {
      renderResult(resultHost, null, `Hata: ${e instanceof Error ? e.message : e}`);
    }
  });
  d.footer.append(run);

  // ---------------- visual query builder
  if (conn) await buildQueryBuilder(qbPage, conn, (text, qbParams) => {
    model.setValue(text);
    for (const p of qbParams) paramValues.set(p.name, { Name: p.name, DataType: typeof p.value === 'number' ? 'ftFloat' : 'ftString', Value: p.value ?? undefined });
    renderParams();
    (tabs.firstChild as HTMLElement).click();
  });
  else qbPage.append(h('div', { class: 'empty', text: 'Sorgu oluşturucu için TQuery.Connection bir TConnection’a bağlı olmalı.' }));

  let result: SqlEditResult | null = null;
  d.buttons([
    { label: 'İptal' },
    {
      label: 'Tamam',
      primary: true,
      action: () => {
        const text = model.getValue();
        result = {
          sql: text.split('\n'),
          params: detectParams().map((n) => {
            const p = paramValues.get(n)!;
            const out: SqlEditResult['params'][number] = { Name: n, DataType: p.DataType ?? 'ftString' };
            if (p.Value !== undefined && p.Value !== '') out.Value = p.Value;
            return out;
          }),
        };
      },
    },
  ]);
  d.footer.prepend(run);
  d.show();
  await d.closed;
  editor.dispose();
  model.dispose();
  return result;
}

async function buildQueryBuilder(page: HTMLElement, conn: Connection, apply: (sql: string, params: Array<{ name: string; value: unknown }>) => void): Promise<void> {
  const schema = await api.schema(conn.id);
  const tables: QBTable[] = [];
  const columns: Array<{ expr: string; agg: string; alias: string }> = [];
  const where: QBWhere[] = [];
  const order: Array<{ expr: string; dir: string }> = [];
  const kind = h('select', { class: 'inp inp-sm' });
  for (const k of ['select', 'insert', 'update', 'delete']) kind.append(h('option', { text: k.toUpperCase(), attrs: { value: k } }));
  const limit = h('input', { class: 'inp inp-sm', attrs: { type: 'number', placeholder: 'LIMIT', min: '1' } });
  const tableList = h('div', { class: 'qb-tables' });
  const canvas = h('div', { class: 'qb-canvas' });
  const colsZone = h('div', { class: 'qb-zone', dataset: { zone: 'cols' } });
  const whereZone = h('div', { class: 'qb-zone', dataset: { zone: 'where' } });
  const orderZone = h('div', { class: 'qb-zone', dataset: { zone: 'order' } });
  const sqlOut = h('pre', { class: 'qb-sql' });
  const gen = h('button', { class: 'btn btn-primary btn-sm' }, icon('build', 13), h('span', { text: 'SQL üret ve uygula' }));
  const preview = h('button', { class: 'btn btn-sm' }, icon('refresh', 13), h('span', { text: 'SQL önizle' }));

  const spec = () => {
    const main = tables[0];
    const joins = tables.slice(1).map((t) => {
      const fk = schema.tables.find((x) => x.name === t.name)?.foreign_keys.find((f) => tables.some((o) => o !== t && o.name === f.ref_table))
        ?? schema.tables.find((x) => x.name === tables[0].name)?.foreign_keys.find((f) => f.ref_table === t.name);
      let on = [{ left: `${main.alias}.id`, right: `${t.alias}.id` }];
      if (fk) {
        const fromT = schema.tables.find((x) => x.name === t.name)?.foreign_keys.includes(fk) ? t : main;
        const toT = tables.find((o) => o.name === fk.ref_table) ?? main;
        on = fk.columns.map((c, i) => ({ left: `${fromT.alias}.${c}`, right: `${toT.alias}.${fk.ref_columns[i]}` }));
      }
      return { type: 'left', table: t.name, alias: t.alias, on };
    });
    const k = kind.value;
    const values: Record<string, { param: string }> = {};
    if (k === 'insert' || k === 'update') for (const c of columns) values[c.expr.split('.').pop()!] = { param: c.expr.split('.').pop()! };
    return {
      kind: k,
      table: main?.name,
      alias: k === 'select' ? main?.alias : undefined,
      joins: k === 'select' ? joins : [],
      columns: k === 'select' ? columns.map((c) => ({ expr: c.expr, agg: c.agg || undefined, alias: c.alias || undefined })) : [],
      where: where.length ? { op: 'and', items: where.map((w) => ({ left: k === 'select' ? w.column : w.column.split('.').pop(), op: w.op, ...(w.op.includes('null') ? {} : w.param ? { param: w.param } : { value: isNaN(Number(w.value)) || w.value === '' ? w.value : Number(w.value) }) })) } : undefined,
      order_by: k === 'select' ? order.map((o) => ({ expr: o.expr, dir: o.dir })) : [],
      limit: k === 'select' && limit.value ? Number(limit.value) : undefined,
      values: k === 'insert' || k === 'update' ? values : {},
    };
  };

  const compile = async (applyIt: boolean) => {
    if (!tables.length) return toast('Önce bir tablo ekleyin', 'warning');
    try {
      const r = await api.queryBuilder(conn.id, spec());
      sqlOut.textContent = r.sql;
      if (applyIt) apply(r.sql, r.params);
    } catch (e) {
      sqlOut.textContent = `Hata: ${e instanceof Error ? e.message : e}`;
    }
  };
  gen.addEventListener('click', () => void compile(true));
  preview.addEventListener('click', () => void compile(false));

  const render = () => {
    clear(canvas);
    for (const t of tables) {
      const box = h('div', { class: 'qb-table' }, h('div', { class: 'qb-thead' }, icon('table', 13), h('span', { text: `${t.name} ${t.alias !== t.name ? `(${t.alias})` : ''}` })));
      const rm = h('button', { class: 'icon-btn', title: 'Kaldır' }, icon('close', 11));
      rm.addEventListener('click', () => {
        tables.splice(tables.indexOf(t), 1);
        render();
      });
      box.firstChild!.appendChild(rm);
      for (const c of t.cols) {
        const expr = `${t.alias}.${c.name}`;
        const cb = h('input', { attrs: { type: 'checkbox' } });
        cb.checked = columns.some((x) => x.expr === expr);
        cb.addEventListener('change', () => {
          if (cb.checked) columns.push({ expr, agg: '', alias: '' });
          else columns.splice(columns.findIndex((x) => x.expr === expr), 1);
          render();
        });
        const item = h('label', { class: 'qb-col', attrs: { draggable: 'true' } }, cb, c.primary_key ? icon('key', 11) : '', h('span', { text: c.name }), h('small', { text: c.field_type.replace('ft', '') }));
        item.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/x-qb-col', expr));
        box.append(item);
      }
      canvas.append(box);
    }
    const zone = (host: HTMLElement, title: string, rows: HTMLElement[]) => {
      clear(host);
      host.append(h('div', { class: 'qb-zone-title', text: title }), ...rows);
      if (!rows.length) host.append(h('div', { class: 'muted small', text: 'Kolonları buraya sürükleyin' }));
    };
    zone(colsZone, 'Kolonlar (SELECT / değerler)', columns.map((c) => {
      const agg = h('select', { class: 'inp inp-xs' });
      for (const a of ['', 'count', 'sum', 'avg', 'min', 'max']) agg.append(h('option', { text: a || '—', attrs: { value: a } }));
      agg.value = c.agg;
      agg.addEventListener('change', () => (c.agg = agg.value));
      const alias = h('input', { class: 'inp inp-xs', attrs: { placeholder: 'başlık' } });
      alias.value = c.alias;
      alias.addEventListener('input', () => (c.alias = alias.value));
      const rm = h('button', { class: 'icon-btn' }, icon('close', 11));
      rm.addEventListener('click', () => {
        columns.splice(columns.indexOf(c), 1);
        render();
      });
      return h('div', { class: 'qb-row' }, h('span', { class: 'mono', text: c.expr }), agg, alias, rm);
    }));
    zone(whereZone, 'Koşullar (WHERE — değerler parametre olur)', where.map((w) => {
      const op = h('select', { class: 'inp inp-xs' });
      for (const o of ['=', '<>', '<', '<=', '>', '>=', 'like', 'is null', 'is not null']) op.append(h('option', { text: o }));
      op.value = w.op;
      op.addEventListener('change', () => (w.op = op.value));
      const param = h('input', { class: 'inp inp-xs', attrs: { placeholder: ':parametre' } });
      param.value = w.param;
      param.addEventListener('input', () => (w.param = param.value.replace(/^:/, '')));
      const val = h('input', { class: 'inp inp-xs', attrs: { placeholder: 'veya sabit değer' } });
      val.value = w.value;
      val.addEventListener('input', () => (w.value = val.value));
      const rm = h('button', { class: 'icon-btn' }, icon('close', 11));
      rm.addEventListener('click', () => {
        where.splice(where.indexOf(w), 1);
        render();
      });
      return h('div', { class: 'qb-row' }, h('span', { class: 'mono', text: w.column }), op, param, val, rm);
    }));
    zone(orderZone, 'Sıralama (ORDER BY)', order.map((o) => {
      const dir = h('select', { class: 'inp inp-xs' });
      for (const x of ['asc', 'desc']) dir.append(h('option', { text: x.toUpperCase(), attrs: { value: x } }));
      dir.value = o.dir;
      dir.addEventListener('change', () => (o.dir = dir.value));
      const rm = h('button', { class: 'icon-btn' }, icon('close', 11));
      rm.addEventListener('click', () => {
        order.splice(order.indexOf(o), 1);
        render();
      });
      return h('div', { class: 'qb-row' }, h('span', { class: 'mono', text: o.expr }), dir, rm);
    }));
  };

  for (const [zoneEl, add] of [
    [colsZone, (expr: string) => !columns.some((c) => c.expr === expr) && columns.push({ expr, agg: '', alias: '' })],
    [whereZone, (expr: string) => where.push({ column: expr, op: '=', param: expr.split('.').pop()!, value: '' })],
    [orderZone, (expr: string) => order.push({ expr, dir: 'asc' })],
  ] as const) {
    zoneEl.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('text/x-qb-col')) {
        e.preventDefault();
        zoneEl.classList.add('over');
      }
    });
    zoneEl.addEventListener('dragleave', () => zoneEl.classList.remove('over'));
    zoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      zoneEl.classList.remove('over');
      add(e.dataTransfer!.getData('text/x-qb-col'));
      render();
    });
  }

  for (const t of schema.tables) {
    const b = h('div', { class: 'qb-tlist-item', attrs: { title: 'Sorguya eklemek için tıklayın' } }, icon('table', 13), h('span', { text: t.name }));
    b.addEventListener('click', () => {
      const alias = tables.some((x) => x.name === t.name) ? `${t.name[0]}${tables.length + 1}` : t.name.length > 3 ? t.name[0] : t.name;
      tables.push({ name: t.name, alias: tables.some((x) => x.alias === alias) ? `${alias}${tables.length}` : alias, cols: t.columns });
      render();
    });
    tableList.append(b);
  }
  page.append(
    h('div', { class: 'qb-toolbar' }, h('span', { text: 'Tür' }), kind, limit, h('span', { class: 'flex' }), preview, gen),
    h('div', { class: 'qb-main' }, h('div', { class: 'qb-side' }, h('div', { class: 'qb-zone-title', text: 'Tablolar' }), tableList), canvas, h('div', { class: 'qb-zones' }, colsZone, whereZone, orderZone)),
    sqlOut,
  );
  render();
}

/* --------------------------------------------------------------- migrations */

export async function migrationsDialog(project: ProjectModel): Promise<void> {
  const conns = project.connections.filter((c) => c.family === 'sql');
  if (!conns.length) return toast('SQL bağlantısı yok', 'warning');
  const d = new Dialog('Migration Yönetimi (Alembic benzeri)', { width: 900, height: 620, className: 'dlg-mig' });
  const sel = h('select', { class: 'inp' });
  for (const c of conns) sel.append(h('option', { text: c.name, attrs: { value: c.id } }));
  const list = h('div', { class: 'mig-list' });
  const editorHost = h('textarea', { class: 'inp mono mig-ops', attrs: { spellcheck: 'false' } });
  const out = h('pre', { class: 'qb-sql' });
  const template = [
    { op: 'create_table', table: 'urunler', columns: [{ name: 'id', type: 'Integer', primary_key: true, autoincrement: true }, { name: 'ad', type: 'String(80)', nullable: false }, { name: 'fiyat', type: 'Numeric(12,2)' }] },
  ];
  editorHost.value = JSON.stringify(template, null, 2);
  const load = async () => {
    clear(list);
    try {
      const m = await api.migrations(sel.value);
      list.append(h('div', { class: 'muted', text: `Veritabanı sürümü: ${m.current ?? '(boş)'} · head: ${m.head ?? '-'}` }));
      for (const r of m.revisions) list.append(h('div', { class: `mig-item ${r.applied ? 'applied' : ''}` }, icon(r.applied ? 'check' : 'history', 13), h('span', { class: 'mono', text: r.revision }), h('span', { text: r.message }), h('small', { text: `${r.upgrade_ops.length} işlem` })));
      if (!m.revisions.length) list.append(h('div', { class: 'empty', text: 'Henüz migration yok' }));
    } catch (e) {
      list.append(h('div', { class: 'conn-status bad', text: String(e instanceof Error ? e.message : e) }));
    }
  };
  const act = (label: string, ic: string, fn: () => Promise<void>, primary = false) => {
    const b = h('button', { class: `btn btn-sm ${primary ? 'btn-primary' : ''}` }, icon(ic, 13), h('span', { text: label }));
    b.addEventListener('click', async () => {
      try {
        await fn();
        await load();
      } catch (e) {
        out.textContent = `Hata: ${e instanceof Error ? e.message : e}`;
      }
    });
    return b;
  };
  const create = act('Revizyon oluştur', 'plus', async () => {
    const ops = JSON.parse(editorHost.value);
    const isSchema = !Array.isArray(ops) && Array.isArray(ops.tables);
    const r = await api.createMigration(sel.value, isSchema ? { message: 'Tablo tasarımcısından', autogenerate: true, target_schema: ops } : { message: 'Elle oluşturuldu', upgrade_ops: ops, downgrade_ops: [] });
    out.textContent = `-- ${r.revision}\n${r.sql}${r.notes.length ? `\n\n-- Notlar:\n-- ${r.notes.join('\n-- ')}` : ''}`;
  }, true);
  const target = act('Hedef şemayı yükle', 'table', async () => {
    editorHost.value = JSON.stringify(await api.targetSchema(sel.value), null, 2);
    out.textContent = '-- Şemayı düzenleyin (tablo/kolon ekleyin) ve "Revizyon oluştur" ile farkı otomatik migration’a çevirin.';
  });
  const up = act('Upgrade → head', 'chevronRight', async () => {
    const r = await api.upgrade(sel.value);
    out.textContent = `Uygulandı: ${r.applied.join(', ') || '(değişiklik yok)'}`;
  });
  const down = act('Downgrade -1', 'undo', async () => {
    const r = await api.downgrade(sel.value);
    out.textContent = `Geri alındı: ${r.reverted.join(', ')}`;
  });
  sel.addEventListener('change', () => void load());
  d.body.append(
    h('div', { class: 'schema-top' }, icon('database', 14), sel, h('span', { class: 'flex' }), up, down),
    h('div', { class: 'split' }, list, h('div', { class: 'mig-edit' }, h('div', { class: 'qb-toolbar' }, h('span', { text: 'İşlemler (JSON) veya hedef şema' }), h('span', { class: 'flex' }), target, create), editorHost, out)),
  );
  d.buttons([{ label: 'Kapat', primary: true }]).show();
  await load();
}
