import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2] || '/home/user/cat-sanctuary'; const port = +(process.argv[3] || 8765);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.jpg':'image/jpeg', '.png':'image/png', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.txt':'text/plain' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('nf'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
}).listen(port, () => console.log('serving', root, port));
