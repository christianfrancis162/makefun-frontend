import * as fs from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./app/', import.meta.url));
const portFlag = process.argv.indexOf('--port');
const port = portFlag < 0 ? 8080 : Number(process.argv[portFlag + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port with a valid port number.');
const contentTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
createServer((request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
    const file = resolve(directory, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(directory.endsWith(sep) ? directory : directory + sep)) {
      response.writeHead(403).end('Forbidden'); return;
    }
    const info = fs.statSync(file);
    if (!info.isFile()) throw new Error('Not a regular file');
    response.writeHead(200, { 'Content-Type': (contentTypes[extname(file)] || 'application/octet-stream') + (['.html','.css','.js','.json'].includes(extname(file)) ? '; charset=utf-8' : ''), 'Content-Length': info.size, 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`make.fun frontend: http://127.0.0.1:${port}`));

// recorded rewrite
// recorded rewrite 2
