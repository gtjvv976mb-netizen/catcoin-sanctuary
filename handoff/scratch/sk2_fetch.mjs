import fs from "node:fs";
const [url, label] = process.argv.slice(2);
const OUT = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/themes/raw/skeptic2";
const t = new Date().toISOString();
let status, body, ct;
try { const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (research)" } }); status = r.status; ct = r.headers.get("content-type"); body = Buffer.from(await r.arrayBuffer()); }
catch (e) { status = "ERR"; body = Buffer.from(String(e)); }
const f = `${OUT}/${t.replace(/[:.]/g, "-")}_${label}`;
fs.writeFileSync(f + ".body", body);
fs.writeFileSync(f + ".meta.json", JSON.stringify({ url, fetchedAt: t, status, contentType: ct, bytes: body.length }, null, 1));
console.log(status, ct, body.length, f);
