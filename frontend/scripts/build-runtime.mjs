#!/usr/bin/env node
/**
 * Builds the fixed VCL runtime artifacts from backend/runtime/vcl.ts:
 *
 *   vcl.js             ES2022 module executed by generated apps (type-stripped by esbuild)
 *   vcl.d.ts           module declarations (exported TypeScript projects)
 *   vcl.global.d.ts    the same declarations as globals (Monaco IntelliSense for units)
 *   vcl.manifest.json  RTTI (classes, published properties, events, enums) + export list;
 *                      the Python BuildService validates designs against it.
 *
 * These files are part of the IDE toolchain output, never generated per project:
 * the BuildService only copies them.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '..');
const runtimeDir = resolve(frontend, '../backend/runtime');
const src = join(runtimeDir, 'vcl.ts');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const source = readFileSync(src);
const banner = `/* JS-Delphi VCL runtime ${'—'} generated from vcl.ts (sha256 ${sha(source).slice(0, 16)}). Do not edit. */`;

// 1. vcl.js
await build({
  entryPoints: [src],
  outfile: join(runtimeDir, 'vcl.js'),
  format: 'esm',
  target: 'es2022',
  bundle: false,
  minify: false,
  legalComments: 'inline',
  charset: 'utf8',
  banner: { js: banner },
  logLevel: 'warning',
});

// 2. vcl.d.ts via tsc (declarations only)
const out = mkdtempSync(join(tmpdir(), 'vcl-dts-'));
try {
  const tsc = join(frontend, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, '-p', join(frontend, 'tsconfig.runtime.json'), '--outDir', out], { stdio: 'inherit' });
  const dts = readFileSync(join(out, 'vcl.d.ts'), 'utf8');
  writeFileSync(join(runtimeDir, 'vcl.d.ts'), `${banner}\n${dts}`);

  // 3. global flavour for Monaco: a single-file module without imports becomes a script.
  const global = dts
    .replace(/^export declare /gm, 'declare ')
    .replace(/^export (type|interface|abstract class|class|function|const) /gm, 'declare $1 ')
    .replace(/^declare (type|interface) /gm, '$1 ')
    .replace(/^export \{\s*\};?\s*$/gm, '');
  if (/^\s*(import|export)\s/m.test(global)) throw new Error('vcl.global.d.ts still contains module syntax');
  writeFileSync(join(runtimeDir, 'vcl.global.d.ts'), `${banner}\n${global}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}

// 4. manifest (import the freshly built module in Node — vcl.js is DOM-free at load time)
const jsPath = join(runtimeDir, 'vcl.js');
const mod = await import(`${pathToFileURL(jsPath).href}?t=${Date.now()}`);
const manifest = mod.GetRuntimeManifest();
manifest.exports = Object.keys(mod).sort();
// Type-only exports (interfaces/type aliases) for `import type { … }` in generated TypeScript.
const dtsText = readFileSync(join(runtimeDir, 'vcl.d.ts'), 'utf8');
manifest.type_exports = [...dtsText.matchAll(/^export (?:interface|type) (\w+)/gm)].map((m) => m[1]).sort();
// Members of a form instance: component and handler names must never shadow them.
const reserved = new Set();
const probe = new mod.TForm(null);
for (let o = probe; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) {
  for (const k of Object.getOwnPropertyNames(o)) reserved.add(k);
}
manifest.reserved_member_names = [...reserved].filter((k) => /^[A-Za-z_]\w*$/.test(k)).sort();
manifest.source_sha256 = sha(source);
manifest.js_sha256 = sha(readFileSync(jsPath));
manifest.css_sha256 = sha(readFileSync(join(runtimeDir, 'vcl.css')));
writeFileSync(join(runtimeDir, 'vcl.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`VCL runtime built: ${manifest.classes.length} classes, ${manifest.exports.length} exports`);
