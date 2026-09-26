const ROOT = "/home/user/cat-sanctuary";
const { createSanctuary } = await import(`${ROOT}/assets/world/cats.js`);
const residents = Array.from({ length: 30 }, (_, i) => ({ id: `cat-${i}`, name: `Cat ${i}`, look: { model: i % 3 ? "cat" : "ginger" } }));
const sim = createSanctuary({ residents });
const R = sim.nav.route.bind(sim.nav); const fails = new Map();
let cur = null;
sim.nav.route = (ax, az, bx, bz, ig) => { const r = R(ax, az, bx, bz, ig); if (!r && cur) { const k = `${cur.act?.kind}/${cur.act?.steps[cur.act.i]?.type}`; const e = fails.get(k) || { n: 0, ex: [] }; e.n++; if (e.ex.length < 3) e.ex.push([ax, az, bx, bz].map((v) => v.toFixed(2)).join(',') + ' ign=' + [...(ig || [])].join('|') + ' startFree=' + sim.nav.pointFree(ax, az) + ' goalFree=' + sim.nav.pointFree(bx, bz, undefined, new Set(ig || []))); fails.set(k, e); } return r; };
// Track the cat being updated via a wrapper on update order: patch cats' run by proxying update
const orig = sim.update;
for (let f = 0; f < 60 * 300; f++) {
  // find which cat routes: wrap each cat act access by setting cur before update of each cat is not possible; approximate by checking all cats with a fresh route
  cur = null; 
  sim.nav.route = (ax, az, bx, bz, ig) => { const r = R(ax, az, bx, bz, ig); if (!r) { const c = sim.cats.find((c) => Math.abs(c.x - ax) < 1e-9 && Math.abs(c.z - az) < 1e-9); const k = `${c?.act?.kind}/${c?.act?.steps[c.act.i]?.type}`; const e = fails.get(k) || { n: 0, ex: [] }; e.n++; if (e.ex.length < 4) e.ex.push([ax, az, bx, bz].map((v) => v.toFixed(2)).join(',') + ' ign=' + [...(ig || [])].join('|') + ' startFree=' + sim.nav.pointFree(ax, az) + ' goalFree=' + sim.nav.pointFree(bx, bz, undefined, new Set(ig || [])) + ' contains=' + sim.nav.containing(ax, az).join('|')); fails.set(k, e); } return r; };
  sim.update(1 / 60);
}
for (const [k, v] of fails) console.log(k, v.n, '\n   ' + v.ex.join('\n   '));
