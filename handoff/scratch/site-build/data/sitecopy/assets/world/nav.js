/* How cats find their way round the garden without walking through anything.
   Pure geometry on the ground plane (x, z); no three.js, so it also runs under Node.

   Obstacles are axis-aligned rectangles (the cottage, flower beds, the cat tree's base) and
   circles (cat beds, bowls, lantern posts, bushes). A route is a short list of waypoints: the
   straight line when nothing is in the way, otherwise the shortest path over a small graph
   whose nodes sit just outside each obstacle's corners (a visibility graph). Movement then
   gets a hard check too: a cat is pushed back out of anything it overlaps, so nothing is ever
   walked through, even while cats steer round each other. */

const EPS = 1e-6;

export class NavWorld {
  /**
   * @param {object} o
   * @param {Array} o.obstacles  [{id, type:"rect", minX,maxX,minZ,maxZ} | {id, type:"circle", x,z,r}]
   * @param {number} o.walkR     cats stay within this radius of the origin
   * @param {number} o.clearR    clearance used when routing (half a cat, plus a little)
   * @param {number} o.bodyR     radius used by the hard overlap check
   */
  constructor({ obstacles, walkR, clearR = 0.42, bodyR = 0.3 }) {
    this.obstacles = obstacles.map((o) => ({ ...o }));
    this.byId = new Map(this.obstacles.map((o) => [o.id, o]));
    this.walkR = walkR;
    this.clearR = clearR;
    this.bodyR = bodyR;
    this.nodes = [];
    this.#buildGraph();
  }

  /* ── Queries ─────────────────────────────────────────────────────────── */

  /** True when a circle of radius `pad` at (x, z) touches no obstacle (except ignored) and is in the garden. */
  pointFree(x, z, pad = this.clearR, ignore = null) {
    if (Math.hypot(x, z) > this.walkR - pad * 0.25) return false;
    for (const o of this.obstacles) {
      if (ignore && ignore.has(o.id)) continue;
      if (distToObstacle(o, x, z) < pad) return false;
    }
    return true;
  }

  /** The obstacles whose clearance zone contains (x, z): used to let a cat leave a bed it is lying in. */
  containing(x, z, pad = this.clearR) {
    const out = [];
    for (const o of this.obstacles) if (distToObstacle(o, x, z) < pad) out.push(o.id);
    return out;
  }

  /** True when a cat can walk the straight segment a→b keeping `pad` clear of every obstacle. */
  segmentClear(ax, az, bx, bz, ignore = null, pad = this.clearR) {
    for (const o of this.obstacles) {
      if (ignore && ignore.has(o.id)) continue;
      if (o.type === "circle") {
        if (distPointSegment(o.x, o.z, ax, az, bx, bz) < o.r + pad) return false;
      } else if (segmentHitsBox(ax, az, bx, bz, o.minX - pad, o.maxX + pad, o.minZ - pad, o.maxZ + pad)) return false;
    }
    return true;
  }

  /**
   * Waypoints from a to b (b last), or null when b cannot be reached.
   * `ignore` is a Set of obstacle ids the cat may enter (the bed it is heading for, the bed it
   * is leaving). Obstacles that already contain the start are ignored automatically.
   */
  route(ax, az, bx, bz, ignore = null) {
    const ign = new Set(ignore || []);
    for (const id of this.containing(ax, az)) ign.add(id);
    if (this.segmentClear(ax, az, bx, bz, ign)) return [{ x: bx, z: bz }];

    const n = this.nodes.length;
    const S = n, G = n + 1;
    const pos = (i) => (i === S ? { x: ax, z: az } : i === G ? { x: bx, z: bz } : this.nodes[i]);
    const fromStart = [], toGoal = [];
    for (let i = 0; i < n; i++) {
      const p = this.nodes[i];
      if (this.segmentClear(ax, az, p.x, p.z, ign)) fromStart.push(i);
      if (this.segmentClear(p.x, p.z, bx, bz, ign)) toGoal.push(i);
    }
    if (!fromStart.length || !toGoal.length) return null;
    const goalSet = new Set(toGoal);

    // A* over at most ~100 nodes: a plain array scan is quicker than a heap here.
    const g = new Float64Array(n + 2).fill(Infinity);
    const prev = new Int32Array(n + 2).fill(-1);
    const done = new Uint8Array(n + 2);
    const h = (i) => { const p = pos(i); return Math.hypot(p.x - bx, p.z - bz); };
    g[S] = 0;
    const open = new Set([S]);
    while (open.size) {
      let cur = -1, best = Infinity;
      for (const i of open) { const f = g[i] + h(i); if (f < best) { best = f; cur = i; } }
      open.delete(cur);
      if (cur === G) break;
      done[cur] = 1;
      const cp = pos(cur);
      const nbrs = cur === S ? fromStart : this.nodes[cur].links;
      const relax = (j) => {
        if (done[j]) return;
        const jp = pos(j);
        const ng = g[cur] + Math.hypot(jp.x - cp.x, jp.z - cp.z);
        if (ng < g[j]) { g[j] = ng; prev[j] = cur; open.add(j); }
      };
      for (const j of nbrs) relax(j);
      if (cur !== S && goalSet.has(cur)) relax(G);
    }
    if (prev[G] === -1) return null;
    const path = [];
    for (let i = G; i !== S; i = prev[i]) path.push(pos(i));
    path.reverse();
    return path.map((p) => ({ x: p.x, z: p.z }));
  }

  /**
   * The hard check: moves p = {x, z} out of every obstacle it overlaps (except ignored ones) and
   * back inside the garden. Returns true if it had to move the point.
   */
  project(p, ignore = null, bodyR = this.bodyR) {
    let moved = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.obstacles) {
        if (ignore && ignore.has(o.id)) continue;
        if (o.type === "circle") {
          const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + bodyR;
          if (d < min) {
            const k = d < EPS ? 1 : 1 / d;
            p.x = o.x + (d < EPS ? min : dx * k * min);
            p.z = o.z + (d < EPS ? 0 : dz * k * min);
            moved = true;
          }
        } else {
          const x0 = o.minX - bodyR, x1 = o.maxX + bodyR, z0 = o.minZ - bodyR, z1 = o.maxZ + bodyR;
          if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
            const dl = p.x - x0, dr = x1 - p.x, dn = p.z - z0, df = z1 - p.z;
            const m = Math.min(dl, dr, dn, df);
            if (m === dl) p.x = x0; else if (m === dr) p.x = x1; else if (m === dn) p.z = z0; else p.z = z1;
            moved = true;
          }
        }
      }
      const r = Math.hypot(p.x, p.z);
      if (r > this.walkR) { p.x *= this.walkR / r; p.z *= this.walkR / r; moved = true; }
    }
    return moved;
  }

  /* ── The graph ───────────────────────────────────────────────────────── */

  #buildGraph() {
    const c = this.clearR + 0.14;
    const raw = [];
    for (const o of this.obstacles) {
      if (o.type === "rect") {
        raw.push([o.minX - c, o.minZ - c], [o.maxX + c, o.minZ - c], [o.maxX + c, o.maxZ + c], [o.minX - c, o.maxZ + c]);
      } else {
        const rr = (o.r + c) / Math.cos(Math.PI / 8);
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; raw.push([o.x + Math.cos(a) * rr, o.z + Math.sin(a) * rr]); }
      }
    }
    for (const [x, z] of raw) {
      if (Math.hypot(x, z) > this.walkR - 0.1) continue;
      if (!this.pointFree(x, z, this.clearR + 0.02)) continue;
      this.nodes.push({ x, z, links: [] });
    }
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        if (this.segmentClear(a.x, a.z, b.x, b.z)) { a.links.push(j); b.links.push(i); }
      }
    }
  }
}

/* ── Geometry helpers ────────────────────────────────────────────────────── */

/** Distance from (x, z) to an obstacle's edge (negative inside). Rectangles use the larger of the
    two axis gaps, so "within d of a rectangle" is the same square-cornered box the segment test uses. */
export function distToObstacle(o, x, z) {
  if (o.type === "circle") return Math.hypot(x - o.x, z - o.z) - o.r;
  const dx = Math.max(o.minX - x, 0, x - o.maxX);
  const dz = Math.max(o.minZ - z, 0, z - o.maxZ);
  if (dx === 0 && dz === 0) return -Math.min(x - o.minX, o.maxX - x, z - o.minZ, o.maxZ - z);
  return Math.max(dx, dz);
}

export function distPointSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az;
  const L = vx * vx + vz * vz;
  let t = L < EPS ? 0 : ((px - ax) * vx + (pz - az) * vz) / L;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

/** Liang–Barsky: does segment a→b cross the box? */
export function segmentHitsBox(ax, az, bx, bz, x0, x1, z0, z1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const clip = (p, q) => {
    if (Math.abs(p) < EPS) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t0 <= t1;
}

/** Heading helpers. A yaw of 0 faces +x; the model's forward is (cos yaw, -sin yaw) in (x, z). */
export const yawTo = (dx, dz) => Math.atan2(-dz, dx);
export const wrapAngle = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
