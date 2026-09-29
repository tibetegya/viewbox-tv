// Bundles the TizenBrew module into dist/main.js for Tizen 5.5's web engine (~Chrome 69).
import { build, transform } from 'esbuild';
import { readFile } from 'node:fs/promises';

const TARGET = 'chrome69';

// content/player.js is injected as an inline <script> once the site's playNext() exists, so it's embedded as text.
const player = await transform(await readFile(new URL('../content/player.js', import.meta.url), 'utf8'), { target: TARGET, minify: true });

await build({
  entryPoints: [new URL('src/main.js', import.meta.url).pathname],
  outfile: new URL('dist/main.js', import.meta.url).pathname,
  bundle: true,
  format: 'iife',
  target: TARGET,
  loader: { '.css': 'text' },
  define: { PLAYER_SRC: JSON.stringify(player.code), VERSION: JSON.stringify(JSON.parse(await readFile(new URL('package.json', import.meta.url), 'utf8')).version) },
  legalComments: 'none',
});
console.log('built dist/main.js');
