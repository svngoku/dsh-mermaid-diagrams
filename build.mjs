/**
 * Build the browser half into one self-contained `client.js` bundle in the
 * `window.__ModuleLoader__` factory form the Host serves.
 *
 * React stays external (the page seeds it); Mermaid is bundled so the plugin
 * renders offline and needs no CDN.
 */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

const GLOBAL = '__dshMermaidDiagramsModule';

const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/client.jsx'],
  bundle: true,
  write: false,
  // An IIFE keeps the browser environment honest: no `module`/`exports` shim
  // makes a bundled dependency take a CommonJS code path inside the page.
  format: 'iife',
  globalName: GLOBAL,
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.js': 'jsx' },
  logLevel: 'warning',
});

const body = result.outputFiles[0].text;
const envelope = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(packageJson.name)},
  factory(require) {
${body}
    return ${GLOBAL};
  },
});
`;

await writeFile(resolve(root, 'client.js'), envelope, 'utf8');
console.log(`client.js ${(envelope.length / 1024 / 1024).toFixed(2)} MiB`);
