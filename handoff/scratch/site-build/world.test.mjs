// Behaviour checks for the garden's cats (assets/world/cats.js, nav.js, layout.js). Pure Node,
// no browser. Meant for tests/world.test.mjs; SITE=/path/to/site runs it from elsewhere.
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const ROOT = process.env.SITE ? pathToFileURL(process.env.SITE.replace(/\/?$/, "/")) : new URL("../", import.meta.url);
const { createSanctuary } = await import(new URL("assets/world/cats.js", ROOT));
const L = await import(new URL("assets/world/layout.js", ROOT));
const { distToObstacle } = await import(new URL("assets/world/nav.js", ROOT));

const residents = (n) => Array.from({ length: n }, (_, i) => ({ id: `cat-${i}`, name: `Cat ${i}`, look: { model: i % 3 ? "cat" : "ginger" } }));

function simulate(sim, seconds, dt, each) {
  for (let t = 0; t < seconds; t += dt) { sim.update(dt); each?.(sim); }
}

test("30 cats for five minutes: nothing walked through, no shared beds, varied days", () => {
  const sim = createSanctuary({ residents: residents(30) });
  const obs = L.obstacles();
  const kinds = new Map(), doing = new Set();
  let worstInside = 0, worstWhere = null, bedShares = 0, frames = 0;
  const t0 = performance.now();
  simulate(sim, 300, 1 / 60, (s) => {
    frames++;
    for (const c of s.cats) {
      if (c.act) kinds.set(c.act.kind, (kinds.get(c.act.kind) || 0) + 1);
      doing.add(c.doing);
      if (c.perch || c.y > 0.3) continue;
      const st = c.act && c.act.steps[c.act.i];
      if (st && (st.type === "hop" || st.type === "pounce")) continue;
      // Between activities the sim lets a cat stay in the bed it is lying in (the obstacle that already contains it).
      const ign = c.act?.ignoreNow || new Set(s.nav.containing(c.x, c.z));
      for (const o of obs) {
        if (ign.has(o.id)) continue;
        const d = distToObstacle(o, c.x, c.z);
        if (d < L.CAT.bodyR - 0.02 && L.CAT.bodyR - d > worstInside) { worstInside = L.CAT.bodyR - d; worstWhere = [c.id, o.id, c.x.toFixed(2), c.z.toFixed(2), st?.type]; }
      }
      assert.ok(Math.hypot(c.x, c.z) <= L.GARDEN.walkR + 1e-6, `${c.id} left the garden`);
    }
    for (const b of L.BEDS) {
      const inBed = s.cats.filter((c) => Math.hypot(c.x - b.x, c.z - b.z) < 0.35 && c.pose !== "walk");
      if (inBed.length > 1) bedShares++;
    }
  });
  const ms = (performance.now() - t0) / frames;
  console.log("activity-frames", Object.fromEntries([...kinds].sort((a, b) => b[1] - a[1])));
  console.log("doing", [...doing].join(" | "));
  console.log(`avg update ${ms.toFixed(3)} ms / frame for 30 cats`);
  assert.equal(worstInside, 0, `a cat was inside an obstacle: ${JSON.stringify(worstWhere)}`);
  assert.equal(bedShares, 0, "two cats in one bed");
  for (const k of ["nap", "eat", "drink", "climb", "play", "porch", "groom", "wander"]) assert.ok(kinds.has(k), `nobody did ${k}`);
  assert.ok(ms < 2, "the simulation should stay well under 2 ms a frame");
});

test("cats don't walk through each other (capsule bodies)", () => {
  const sim = createSanctuary({ residents: residents(30) });
  const HALF = { walk: 0.42, loaf: 0.38, stretch: 0.5, sit: 0.17, sleep: 0.12 };
  let bad = 0, checks = 0;
  const segd = (a, b) => { // sampled distance between the two body segments
    let best = Infinity;
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
      const sa = (i / 3 - 1) * HALF[a.pose], sb = (j / 3 - 1) * HALF[b.pose];
      const ax = a.x + Math.cos(a.yaw) * sa, az = a.z - Math.sin(a.yaw) * sa, bx = b.x + Math.cos(b.yaw) * sb, bz = b.z - Math.sin(b.yaw) * sb;
      best = Math.min(best, Math.hypot(ax - bx, az - bz));
    }
    return best;
  };
  simulate(sim, 120, 1 / 30, (s) => {
    const g = s.cats.filter((c) => c.y < 0.3 && !c.perch);
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      if (!g[i].moving && !g[j].moving) continue;
      checks++;
      if (segd(g[i], g[j]) < 0.4) bad++;
    }
  });
  assert.ok(bad / checks < 0.002, `overlapping cats ${bad}/${checks}`);
});

test("reservations are never shared", () => {
  const sim = createSanctuary({ residents: residents(24) });
  simulate(sim, 120, 1 / 30, (s) => {
    const held = new Map();
    for (const c of s.cats) for (const h of c.holds) { assert.ok(!held.has(h), `${h} held by two cats`); held.set(h, c.id); }
  });
});

test("personal space: resting cats keep apart", () => {
  const sim = createSanctuary({ residents: residents(20) });
  let close = 0, samples = 0;
  simulate(sim, 90, 1 / 30, (s) => {
    const rest = s.cats.filter((c) => !c.moving && !c.perch && c.y < 0.3);
    for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) { samples++; if (Math.hypot(rest[i].x - rest[j].x, rest[i].z - rest[j].z) < 0.6) close++; }
  });
  assert.ok(close / Math.max(1, samples) < 0.002, `resting cats too close ${close}/${samples}`);
});

test("each cat's rhythm is seeded by its id", () => {
  const a = createSanctuary({ residents: residents(8) }), b = createSanctuary({ residents: residents(8) });
  simulate(a, 30, 1 / 30); simulate(b, 30, 1 / 30);
  for (let i = 0; i < 8; i++) { assert.equal(a.cats[i].x.toFixed(6), b.cats[i].x.toFixed(6)); }
  assert.notEqual(a.cats[0].traits.pace, a.cats[1].traits.pace);
});

test("reduced motion: every cat settles in one spot and stays", () => {
  const sim = createSanctuary({ residents: residents(12), reduced: true });
  const before = sim.cats.map((c) => [c.x, c.y, c.z, c.yaw, c.pose].join());
  simulate(sim, 20, 1 / 30);
  assert.deepEqual(sim.cats.map((c) => [c.x, c.y, c.z, c.yaw, c.pose].join()), before);
  assert.ok(sim.cats.every((c) => ["sleep", "loaf", "sit"].includes(c.pose)));
  const beds = L.BEDS.map((b) => sim.cats.filter((c) => Math.hypot(c.x - b.x, c.z - b.z) < 0.3).length);
  assert.ok(beds.every((n) => n <= 1));
  // And back again: they get up and carry on.
  sim.setReduced(false);
  simulate(sim, 15, 1 / 30);
  assert.ok(sim.cats.some((c, i) => [c.x, c.y, c.z, c.yaw, c.pose].join() !== before[i]));
});

test("routes go round the cottage and never cut through it", () => {
  const sim = createSanctuary({ residents: residents(1) });
  const nav = sim.nav;
  const pts = [[-6, -1], [6.6, 1.5], [1.2, -6.8], [0.4, 6.8], [-5.6, 4.6], [6, -4.6], [-4.8, -4.2]];
  for (const [x, z] of pts) assert.ok(nav.pointFree(x, z), `test point ${x},${z} should be open lawn`);
  for (const [ax, az] of pts) for (const [bx, bz] of pts) {
    if (ax === bx && az === bz) continue;
    const path = nav.route(ax, az, bx, bz);
    assert.ok(path, `no route ${ax},${az} → ${bx},${bz}`);
    let px = ax, pz = az;
    for (const p of path) { assert.ok(nav.segmentClear(px, pz, p.x, p.z, null, L.CAT.bodyR), `leg crosses something ${px},${pz} → ${p.x},${p.z}`); px = p.x; pz = p.z; }
  }
});
