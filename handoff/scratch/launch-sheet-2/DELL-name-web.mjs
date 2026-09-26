for (const q of ['"Frostpuff"', '"Frostpuff" cat', '"Frostpuff" token OR coin', '"Frostpuff" trademark OR character']) {
  try {
    const r = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`, { headers: { "user-agent": "Mozilla/5.0" } });
    const t = await r.text();
    const items = [...t.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g)].map(m => `${m[1]} | ${m[2]}`);
    console.log("##", q, r.status, items.length); for (const i of items.slice(0, 10)) console.log(" -", i);
  } catch (e) { console.log("##", q, "ERR", String(e)); }
}
