for (const t of ["Eli_Lilly_(pharmacist)", "Eli_Lilly_and_Company"]) {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&formatversion=2&titles=${t}`, { headers: { "user-agent": "CatSanctuaryResearch/1.0 (https://catcoinsanctuary.com; research) node-fetch", "api-user-agent": "CatSanctuaryResearch/1.0" } });
  const body = await r.text();
  let text = ""; try { text = JSON.parse(body).query.pages[0].extract ?? ""; } catch { console.log(t, r.status, body.slice(0, 200)); continue; }
  console.log("==", t, r.status, text.length);
  console.log(text.split(/(?<=\.)\s+/).filter((s) => /drug ?store|apothecar|pharmac(y|ist)|Greencastle|apprentic|chemist|1876/i.test(s)).slice(0, 10).join("\n"));
}
