import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'web/package.json'));
const { transformSync } = require('esbuild');
const source = path.join(root, 'third_party/games/mario/upstream');
const target = path.join(root, 'web/public/game-assets/mario/v1');
const files = [...fs.readFileSync(path.join(source, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)"/g)].map(match => match[1]).filter(file => file !== 'index.js');
const scripts = files.map(file => fs.readFileSync(path.join(source, file), 'utf8')).join('\n;\n').replace('PAUSE: P/RIGHTCLICK', 'PAUSE: ESC/HOME');
fs.writeFileSync(path.join(target, 'engine.js'), transformSync(scripts, { minifyWhitespace: true, minifySyntax: true, legalComments: 'eof' }).code);
fs.writeFileSync(path.join(target, 'index.html'), `<!doctype html>
<html lang="zh-CN" data-game="mario"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>超级马里奥 · MEO_Blog</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'">
<style>@font-face{font-family:'Press Start';src:url('Fonts/pressstart2p-webfont.woff')}html,body{height:100%;margin:0;background:#000;overflow:hidden}#game{position:absolute;inset:0}#game>div{transform-origin:center;position:absolute;left:50%;top:50%}canvas{image-rendering:pixelated}#status{position:absolute;inset:0;display:grid;place-items:center;background:#080b10;color:#ddd;font:15px system-ui;text-align:center}#status[hidden]{display:none}</style></head>
<body><div id="game"></div><div id="status">正在准备马里奥…</div><script src="../../common/runtime.js"></script><script src="engine.js"></script><script src="adapter.js"></script></body></html>`);
const zelda = path.join(root, 'web/public/game-assets/zelda/v1/zplayer.js');
const original = 'let innerFunc=()=>new Promise(resolve=>setTimeout(resolve,ms));return Asyncify.handleAsync(innerFunc)';
const patched = 'let innerFunc=()=>globalThis.MEORuntime?globalThis.MEORuntime.sleep(ms):new Promise(resolve=>setTimeout(resolve,ms));return Asyncify.handleAsync(innerFunc)';
let content = fs.readFileSync(zelda, 'utf8');
if (content.includes(original)) content = content.replace(original, patched);
else if (!content.includes(patched)) throw new Error('ZQuest sleep adapter does not match the pinned runtime');
fs.writeFileSync(zelda, content);
console.log(JSON.stringify({ marioScripts: files.length, marioBundleBytes: fs.statSync(path.join(target, 'engine.js')).size, zeldaPausePatch: true }));
