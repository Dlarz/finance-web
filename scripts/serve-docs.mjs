// Serves the built app from docs/ under the same sub-path as GitHub Pages (/finance-web/),
// so the relative base and the service worker scope are tested realistically.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve('docs');
const prefix = '/finance-web';
const port = Number(process.env.PORT || 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path === '/' || path === prefix) {
    res.writeHead(302, { Location: `${prefix}/` });
    res.end();
    return;
  }
  if (!path.startsWith(`${prefix}/`)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  path = path.slice(prefix.length);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Serving docs/ at http://localhost:${port}${prefix}/`);
});
