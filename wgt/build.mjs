// Packages the standalone app: dist/ViewboxTV.wgt (unsigned; Apps2Samsung signs it on install).
// Run after `npm run build` (the service embeds dist/main.js). Needs macOS `sips` (icon) and `zip`.
import { build } from 'esbuild';
import { transformAsync } from '@babel/core';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = (p) => new URL(p, import.meta.url).pathname;
const { version } = JSON.parse(await readFile(here('../package.json'), 'utf8'));
const out = here('../dist/ViewboxTV.wgt');
const stage = await mkdtemp(join(tmpdir(), 'viewbox-wgt-'));

await build({
  entryPoints: [here('service.js')],
  outfile: join(stage, 'service.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2017',
  external: ['bufferutil', 'utf-8-validate'], // optional ws speedups
  define: { MODULE_SRC: JSON.stringify(await readFile(here('../dist/main.js'), 'utf8')) },
  legalComments: 'none',
});
// The TV's service Node can be as old as v4 (TizenBrew checks for v4.4.3): compile the bundle down like TizenBrew does.
const svc = join(stage, 'service.js');
const { code } = await transformAsync(await readFile(svc, 'utf8'), { presets: [['@babel/preset-env', { targets: { node: '4' } }]], sourceType: 'script', compact: true, configFile: false, babelrc: false });
if (/^\s*["']use strict["']/.test(code)) throw new Error('service bundle must not be strict: adbhost assigns an undeclared global');
if (/regeneratorRuntime/.test(code)) throw new Error('service needs regenerator-runtime (async/generators in the bundle)');
await writeFile(svc, code);
await writeFile(join(stage, 'config.xml'), (await readFile(here('config.xml'), 'utf8')).replace('version="0.0.0"', `version="${version}"`));
await copyFile(here('index.html'), join(stage, 'index.html'));
await copyFile(here('LICENSE'), join(stage, 'LICENSE'));
// App icon from tv/viewbox-logo.png: fit into 512×512, padded (not stretched).
execFileSync('sips', ['-Z', '512', here('../viewbox-logo.png'), '--out', join(stage, 'icon.png')], { stdio: 'ignore' });
execFileSync('sips', ['-p', '512', '512', join(stage, 'icon.png')], { stdio: 'ignore' });

await rm(out, { force: true });
execFileSync('zip', ['-q', '-r', '-X', out, '.'], { cwd: stage });
await rm(stage, { recursive: true });
console.log(`built dist/ViewboxTV.wgt (${version})`);
