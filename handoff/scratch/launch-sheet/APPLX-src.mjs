const r = await fetch("https://en.wikipedia.org/w/index.php?title=MacOS_version_history&action=raw", { headers: { "user-agent": "cat-sanctuary-research/1.0" } });
const t = await r.text();
console.log("status", r.status, "len", t.length);
const i = t.indexOf("code named");
console.log(t.slice(Math.max(0, i - 200), i + 900));
