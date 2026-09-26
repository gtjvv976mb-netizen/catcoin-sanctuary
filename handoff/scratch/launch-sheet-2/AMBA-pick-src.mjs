for (const q of ["iris","gloam","seal","night vision"]) {
  try {
    const r = await fetch(`https://www.ambarella.com/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=50`);
    const j = await r.json();
    console.log(q, r.status, Array.isArray(j) ? j.length : j, Array.isArray(j) ? j.slice(0,12).map(x=>x.title).join(" | ") : "");
  } catch (e) { console.log(q, "ERR", String(e)); }
}
