const u = "https://newsroom.snap.com/sendchinatownlove-lunarnewyear-2022";
const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (research script)" } });
const h = await r.text();
const t = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
console.log("status", r.status, "len", t.length);
for (const k of ["tiger", "February"]) { const re = new RegExp(k, "gi"); let m, n = 0; while ((m = re.exec(t)) && n < 3) { console.log(k, "::", t.slice(Math.max(0, m.index - 200), m.index + 250)); n++; } }
