// READ-ONLY StonkFun public API prober: GET only, <= ~3 req/s, saves body + selected headers.
import fs from "node:fs";
export const OUT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adopt/raw/registry/api/";
const BASE = "https://www.stonkfun.xyz/api/public/v1";
let last = 0;
export async function sf(path, { save = null, origin = null } = {}) {
  const wait = Math.max(0, last + 350 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait));
  last = Date.now();
  const headers = origin ? { Origin: origin } : {};
  const res = await fetch(BASE + path, { headers });
  const text = await res.text();
  const h = Object.fromEntries([...res.headers].filter(([k]) => /ratelimit|quota|retry|access-control|cache-control|age|x-vercel-cache|date/i.test(k)));
  let json = null; try { json = JSON.parse(text); } catch {}
  if (save) {
    fs.writeFileSync(OUT + save + ".json", text);
    fs.writeFileSync(OUT + save + ".meta.json", JSON.stringify({ url: BASE + path, status: res.status, fetchedAt: new Date().toISOString(), headers: h }, null, 1));
  }
  return { status: res.status, json, headers: h, text };
}
