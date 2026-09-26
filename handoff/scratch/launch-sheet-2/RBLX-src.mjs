const fs = await import("fs");
const out = [];
for (const u of ["https://economy.roblox.com/v2/assets/121389389/details",
  "https://thumbnails.roblox.com/v1/assets?assetIds=121389389&returnPolicy=PlaceHolder&size=420x420&format=Png&isCircular=false"]) {
  try { const r = await fetch(u); const t = await r.text(); out.push(`${u}\n${r.status}\n${t.slice(0,1500)}\n`); } catch (e) { out.push(`${u}\nERR ${e}`); }
}
console.log(out.join("\n"));
