const ROOT = "/home/user/cat-sanctuary";
const { createSanctuary } = await import(`${ROOT}/assets/world/cats.js`);
const residents = Array.from({ length: 30 }, (_, i) => ({ id: `cat-${i}`, name: `Cat ${i}`, look: { model: i % 3 ? "cat" : "ginger" } }));
const sim = createSanctuary({ residents });
let tRoute = 0, maxRoute = 0;
const R = sim.nav.route.bind(sim.nav);
sim.nav.route = (...a) => { const t = performance.now(); const r = R(...a); const d = performance.now() - t; tRoute += d; maxRoute = Math.max(maxRoute, d); return r; };
const spikes = [];
for (let f = 0; f < 60 * 300; f++) {
  const r0 = tRoute; const a = performance.now(); sim.update(1 / 60); const d = performance.now() - a;
  if (f > 600 && d > 5) spikes.push([f, d.toFixed(1), (tRoute - r0).toFixed(1)]);
}
console.log('spikes', spikes.length, JSON.stringify(spikes.slice(0, 12)), 'maxRoute', maxRoute.toFixed(2), 'nodes', sim.nav.nodes.length);
