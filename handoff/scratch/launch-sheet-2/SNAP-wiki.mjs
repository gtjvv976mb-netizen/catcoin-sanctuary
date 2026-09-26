for (const n of ["Sandstep", "Cloudleap", "Shutterpaw"]) {
  const r = await fetch(`https://warriors.fandom.com/api.php?action=query&list=search&srsearch=${n}&format=json&srlimit=5`);
  const j = await r.json().catch(() => ({}));
  const r2 = await fetch(`https://warriors.fandom.com/wiki/${n}`, { redirect: "manual" });
  console.log(n, "search", r.status, JSON.stringify((j.query?.search ?? []).map((x) => x.title)), "page", r2.status);
}
