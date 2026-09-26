import { createRequire } from "node:module";
const pw = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright");
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = path.dirname(new URL(import.meta.url).pathname);
const srv = http.createServer((q, s) => { const p = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(p)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".html") ? "text/html" : "application/octet-stream" }); fs.createReadStream(p).pipe(s); }).listen(0);
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 400 } });
page.on("console", (m) => console.log("console:", m.text()));
for (const m of process.argv.slice(2)) {
  await page.goto(`http://127.0.0.1:${port}/index.html?m=${encodeURIComponent(m)}`);
  await page.waitForFunction(() => document.title === "done", null, { timeout: 60000 });
  await page.locator("#c").screenshot({ path: path.join(root, m.replace(/\.glb$/, ".png")) });
  console.log("shot", m);
}
await browser.close(); srv.close();
