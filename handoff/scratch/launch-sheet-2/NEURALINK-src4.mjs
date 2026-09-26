const r = await fetch("https://neuralink.com/assets/entries/pages_technology_index.page.CWH49R5U.js", { headers: { "user-agent": "Mozilla/5.0" } });
const js = await r.text();
console.log("status", r.status, js.length);
const strs = [...js.matchAll(/"((?:[^"\\]|\\.){25,600})"|`((?:[^`\\]|\\.){25,600})`/g)].map(m => (m[1] ?? m[2]));
const keep = strs.filter(s => /[a-z] [a-z]/.test(s) && !/^[\w.-]+\//.test(s) && /\b(thread|threads|coin|sealed|titanium|electrode|hair|robot|wireless|invisible|charg|battery|flexible|biocompatible|enclosure|chip|needle|polymer|thin)\b/i.test(s));
console.log([...new Set(keep)].slice(0, 30).map(s => "- " + s.slice(0, 400)).join("\n"));
