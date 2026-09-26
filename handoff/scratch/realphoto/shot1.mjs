import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [out, port, k, id] = process.argv.slice(2);
const say = (m) => fs.appendFileSync(`${out}/shot.log`, m + "\n");
const b = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
// The browser here does not trust the sandbox proxy's CA, so pbs.twimg.com images are fetched with
// curl (which verifies TLS against /root/.ccr/ca-bundle.crt) and handed to the page.
await ctx.route("https://pbs.twimg.com/**", async (route) => {
  try {
    const body = execFileSync("curl", ["-sSf", "--cacert", "/root/.ccr/ca-bundle.crt", "-m", "20", route.request().url()]);
    say(`curl ok ${body.length}B ${route.request().url()}`);
    await route.fulfill({ status: 200, contentType: "image/jpeg", body });
  } catch (e) { say("curl fail " + route.request().url()); await route.abort(); }
});
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:${port}/#cat=${id}`, { waitUntil: "commit", timeout: 20000 }).catch((e) => say("goto " + e.message));
await p.waitForSelector("#card .card-body", { timeout: 30000 }).catch(() => say("no card " + id));
await p.waitForTimeout(2500);
const box = await p.evaluate(() => {
  const c = document.getElementById("world"); if (c) c.style.display = "none";
  const img = document.querySelector(".card-real-photo-img");
  const r = document.getElementById("card").getBoundingClientRect();
  return { info: { cap: document.querySelector(".card-real-photo-caption")?.textContent, href: document.querySelector(".card-real-photo-link")?.href, ing: document.querySelector(".card-ingame-caption")?.textContent, first: document.querySelector(".card-body")?.firstElementChild?.className, w: img?.naturalWidth }, clip: { x: r.x, y: r.y, width: Math.max(1, r.width), height: Math.max(1, r.height) } };
}).catch((e) => { say("eval " + e.message); return null; });
say(`${k} ${id} ${JSON.stringify(box?.info)}`);
await p.screenshot({ clip: box?.clip, path: `${out}/card-${k}-${id}.png`, timeout: 30000, animations: "disabled" }).catch((e) => say("shot " + e.message));
await b.close();
