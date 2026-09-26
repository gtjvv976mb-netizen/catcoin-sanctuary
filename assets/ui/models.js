/* Which cat a model in assets/models/cats/index.json belongs to. A key there is the file's name
   (<key>.glb and <key>-lo.glb) and names its cat by one of:
     - the cat's id: a stock cat's ticker ("PATCHPAW"), or a famous coin's id ("popcat");
     - a famous coin's contract ("7GCihgDB…W2hr"), letter case aside, or "<chain>:<contract>";
     - a famous coin's symbol ("POPCAT" or "$POPCAT"), only when exactly one famous coin has it and
       no stock cat's ticker is the same.
   An entry may also give its file's name as `file`, when the key is not a file name. Anything
   else matches no cat, and its model is not loaded. */

/** The id of the cat a model key names, or null. */
export function modelIdFor(key, residents) {
  if (typeof key !== "string" || !key || key.length > 160) return null;
  const list = Array.isArray(residents) ? residents : [];
  const exact = list.find((r) => r.id === key);
  if (exact) return exact.id;
  const famous = list.filter((r) => r.kind === "famous" && typeof r.contract === "string");
  const lower = key.toLowerCase();
  const byContract = famous.filter((r) => r.contract.toLowerCase() === lower);
  if (byContract.length === 1) return byContract[0].id;
  const m = /^([a-z0-9-]+):(.+)$/i.exec(key);
  if (m) {
    const hit = famous.filter((r) => r.chain === m[1].toLowerCase() && r.contract.toLowerCase() === m[2].toLowerCase());
    if (hit.length === 1) return hit[0].id;
  }
  const byId = famous.find((r) => r.id === lower);
  if (byId) return byId.id;
  const sym = key.replace(/^\$+/, "").toUpperCase();
  const bySymbol = famous.filter((r) => String(r.ticker || r.symbol || "").toUpperCase() === sym);
  if (bySymbol.length === 1 && !list.some((r) => r.kind !== "famous" && String(r.id).toUpperCase() === sym)) return bySymbol[0].id;
  return null;
}
