import { createRequire } from "node:module";
const pw = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright");
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = path.dirname(new URL(import.meta.url).pathname);
const types = { ".js": "text/javascript", ".html": "text/html", ".glb": "model/gltf-binary", ".jpg": "image/jpeg" };
const srv = http.createServer((q, s) => { const p = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); } s.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(s); }).listen(0);
const port = srv.address().port;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [name, w, h] of [["desktop", 1280, 820], ["phone", 400, 860]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("console", (m) => { if (m.type() !== "log") console.log(name, "console:", m.type(), m.text()); });
  page.on("pageerror", (e) => console.log(name, "pageerror:", e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => document.getElementById("garden").dataset.ready === "true", null, { timeout: 90000 }).catch(() => console.log(name, "not ready"));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(root, `${name}.png`), fullPage: true });
  console.log("shot", name);
}
await browser.close(); srv.close();
