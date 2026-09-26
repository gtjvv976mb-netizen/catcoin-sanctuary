for (const n of ["Sandstorm", "Toadstep", "Sandstep", "Sand step"]) {
  const r = await fetch(`https://warriors.fandom.com/api.php?action=query&list=search&srsearch=${encodeURIComponent(n)}&format=json&srlimit=5`);
  const j = await r.json().catch(() => ({}));
  const t = await fetch(`https://warriors.fandom.com/api.php?action=query&titles=${encodeURIComponent(n)}&format=json`).then((x) => x.json()).catch(() => ({}));
  console.log(n, r.status, JSON.stringify((j.query?.search ?? []).map((x) => x.title)), "titleExists:", JSON.stringify(Object.values(t.query?.pages ?? {}).map((p) => p.missing === undefined ? p.title : "missing")));
}
