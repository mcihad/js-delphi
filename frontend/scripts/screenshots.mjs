#!/usr/bin/env node
/**
 * Captures IDE screenshots with Playwright (Chromium) into docs/screenshots/.
 * Requires a running backend that serves the built IDE:  make build && make serve
 *   JSD_URL=http://127.0.0.1:8000 node scripts/screenshots.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../docs/screenshots');
mkdirSync(out, { recursive: true });
const URL = process.env.JSD_URL ?? 'http://127.0.0.1:8000';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 1020 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, name) });
  console.log('✓', name);
};
const step = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${label}: ${e.message.split('\n')[0]}`);
    await page.keyboard.press('Escape').catch(() => undefined);
  }
};
const closeDialog = async () => {
  const btn = page.locator('.dlg-overlay .dlg-head .icon-btn').last();
  if (await btn.count()) await btn.click();
};

await page.goto(URL);
await page.waitForSelector('.vcl-form', { timeout: 30000 });
await page.waitForTimeout(2500);

await step('designer', async () => {
  await page.locator('[data-vcl-name="btnKaydet"]').click();
  await shot('01-ide-designer.png');
});

await step('guides', async () => {
  const box = await page.locator('[data-vcl-name="edtSoyad"]').boundingBox();
  await page.mouse.move(box.x + 40, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 42, box.y + 14, { steps: 4 });
  await page.mouse.move(box.x + 40, box.y + 18, { steps: 4 });
  await shot('02-alignment-guides.png');
  await page.mouse.move(box.x + 40, box.y + 10, { steps: 4 });
  await page.mouse.up();
});

await step('events + code', async () => {
  await page.locator('[data-vcl-name="btnKaydet"]').click();
  await page.locator('.oi-tab[data-tab="events"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-vcl-name="btnTemizle"]').dblclick();
  await page.waitForSelector('.monaco-editor', { state: 'visible' });
  await page.waitForTimeout(2500);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('this.edt', { delay: 60 });
  await page.waitForTimeout(1800);
  await shot('03-events-code-intellisense.png');
  await page.keyboard.press('Escape');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Control+z');
  await page.waitForTimeout(800);
  await page.locator('.oi-tab[data-tab="props"]').click();
});

await step('run', async () => {
  await page.locator('.tb-run').click();
  await page.waitForSelector('.pv-frame', { timeout: 20000 });
  await page.waitForTimeout(3500);
  await page.locator('.btab[data-show="output"]').click();
  await shot('04-run-preview.png');
  await page.locator('.btab[data-show="messages"]').click();
});

await step('sql + query builder', async () => {
  await page.locator('.vtab:has-text("Tasarım")').first().click();
  await page.waitForTimeout(400);
  await page.locator('.nv-comp[data-nv="qryMusteriler"]').click();
  await page.waitForTimeout(300);
  await page.locator('.oi-row:has(.oi-name span:text-is("SQL")) .oi-more').click();
  await page.waitForSelector('.dlg-sql');
  await page.waitForTimeout(800);
  await page.locator('.dlg-sql .btn:has-text("Çalıştır")').click();
  await page.waitForTimeout(1200);
  await shot('05-sql-editor.png');
  await page.locator('.dlg-tab:has-text("Görsel")').click();
  await page.locator('.qb-tlist-item:has-text("musteriler")').click();
  await page.locator('.qb-tlist-item:has-text("siparisler")').click();
  await page.waitForTimeout(200);
  const t1 = page.locator('.qb-table').nth(0);
  const t2 = page.locator('.qb-table').nth(1);
  await t1.locator('.qb-col:has(span:text-is("ad")) input').check();
  await t1.locator('.qb-col:has(span:text-is("soyad")) input').check();
  await t1.locator('.qb-col:has(span:text-is("sehir")) input').check();
  await t2.locator('.qb-col:has(span:text-is("tutar")) input').check();
  await t1.locator('.qb-col:has(span:text-is("sehir"))').dragTo(page.locator('.qb-zone[data-zone="where"]'));
  await t2.locator('.qb-col:has(span:text-is("tutar"))').dragTo(page.locator('.qb-zone[data-zone="order"]'));
  await page.locator('.qb-zone[data-zone="cols"] .qb-row').last().locator('select').selectOption('sum');
  await page.locator('.qb-zone[data-zone="order"] select').selectOption('desc');
  await page.locator('.btn:has-text("SQL önizle")').click();
  await page.waitForTimeout(900);
  await shot('06-visual-query-builder.png');
  await closeDialog();
});

await step('connections', async () => {
  await page.locator('.tb-btn[title="Veritabanı bağlantıları"]').click();
  await page.waitForSelector('.dlg-conn');
  await page.locator('.dlg-conn .btn:has-text("test")').click();
  await page.waitForTimeout(1200);
  await shot('07-connections.png');
  await closeDialog();
});

await step('schema browser', async () => {
  await page.locator('.tb-btn[title="Şema tarayıcı"]').click();
  await page.waitForSelector('.dlg-schema .data-grid', { timeout: 10000 });
  await page.waitForTimeout(600);
  await shot('08-schema-browser.png');
  await closeDialog();
});

await step('history', async () => {
  await page.locator('.vtab:has-text("Geçmiş")').click();
  await page.waitForSelector('.dlg-history');
  await page.locator('.dlg-history select').selectOption('design');
  await page.waitForTimeout(1500);
  await shot('09-version-history.png');
  await closeDialog();
});

await step('tson', async () => {
  await page.locator('.vtab:has-text(".tson")').click();
  await page.waitForTimeout(1200);
  await shot('10-design-tson.png');
});

await browser.close();
