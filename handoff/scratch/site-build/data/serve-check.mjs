import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/playwright/package.json");
const { chromium } = require("playwright");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".jpg": "image/jpeg", ".png": "image/png", ".txt": "text/plain" };
async function check(dir, label) {
  const server = http.createServer((req, res) => { const p = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html")); fs.readFile(p, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }); res.end(b); }); }).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  const logs = []; page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`)); page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  const outside = []; page.on("request", (r) => { if (!r.url().startsWith(`http://localhost:${port}`)) outside.push(r.url()); });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const items = await page.$$eval("#list .resident", (els) => els.map((e) => e.querySelector("h3").textContent + " | " + [...e.querySelectorAll("dd")].map((d) => d.textContent).join(" / ") + (e.querySelector(".badge") ? " [" + e.querySelector(".badge").textContent + "]" : "")));
  const status = await page.$eval("#status", (e) => e.textContent).catch(() => null);
  console.log(`== ${label}: status=${JSON.stringify(status)} residents=${items.length}`); items.forEach((i) => console.log("   ", i));
  console.log("   logs:", logs.filter((l) => !/GPU stall|WebGL|swiftshader/i.test(l)).slice(0, 8));
  console.log("   outside requests:", outside);
  await page.screenshot({ path: `shot-${label}.png` });
  await browser.close(); server.close();
}
await check("sitecopy", "examples");
// A copy with two real launches listed (their real wallets), as the builder wrote them.
fs.cpSync("sitecopy", "sitecopy-real", { recursive: true });
fs.writeFileSync("sitecopy-real/data/wallets.json", JSON.stringify({ launchers: [
  { address: "8MwvKAAYCq258pUuT4ndQFjbwTyDZ8qHdGG6RzNdr43b", since: "2026-09-01", label: "GOOGLx launcher" },
  { address: "45ByChvJhwVFBP9pzZDvsByfoepRnmRMRNhXE6SD2Wjc", since: "2026-09-01", label: "GMEx launcher" } ] }));
fs.writeFileSync("sitecopy-real/data/collection.json", fs.readFileSync("built-collection.json"));
await check("sitecopy-real", "real");
