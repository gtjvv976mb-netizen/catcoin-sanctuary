/* A quadruped cat rig for the cats that have their own model (assets/models/cats/<TICKER>.glb).

   Ready-made rigging services (Higgsfield's, Meshy's auto-rigging) are for people: biped
   skeletons and human clips. So the cats are rigged here instead, at load time, from the shape of
   each model:

   1. findRig(positions, triangles): every model is a cat standing on all fours (made that way on
      purpose: scripts/make-cat-models.py, notes in scripts/CAT-MODELS.md), normalized to y up,
      facing +X, 1 unit tall, feet on y = 0. The four paws are the clusters of points on the ground
      (front/hind by x, left/right by z); the belly line is where rays straight up between the legs
      first meet the body, the back line comes from the middle of the body (for a big cartoon head
      sitting over the body, the back is where the body narrows into the neck, or where it widens
      into the head); the head is the high point ahead of the front legs; the tail is followed
      along its own surface from its end to where it flares into the rump, and cut into four
      joints (so an S, a hook or a spiral keeps its joints inside it). Each leg's joints are placed
      on its own centre line, in a cat's proportions (thigh and shin about equal, a shorter foot),
      with the hip and shoulder up inside the body; legJoin notes how far down a pair of legs the
      model has joined into one piece. (Without the triangles, older and simpler guesses stand in.)
   2. One skeleton, the same bone names for every cat (so one clip set drives them all):
        root > pelvis > spine > chest > neck > head
               pelvis > tail1 > tail2 > tail3 > tail4
               pelvis > thigh.L/R > shin.L/R > foot.L/R      (hind legs)
               chest  > arm.L/R   > forearm.L/R > paw.L/R    (front legs)
      Bones have no rest rotation, so each clip's angles read in model axes: z turns in the
      side view (+ lifts the nose, swings a leg forward), y turns left/right, x rolls.
   3. skinWeights(): each point goes to the bone it lies nearest (in units of that bone's
      thickness) among the bones it may belong to (a left leg only takes left-side points, the
      head everything past a plane across the neck and near the head, a leg everything inside its
      own column, the tail only up to where it meets the body, in bands along its length, ...);
      where two bones that don't meet share an edge, the point nearer a bone both meet goes to it;
      then the weights are blurred along the mesh surface (welded where Meshy cut its UVs per
      triangle), so joints bend over a band of skin instead of tearing, and only between bones that
      meet there (and between two legs the model joined, which stretch evenly rather than tear).
   4. makeClips(rig): the clips, posed by targets rather than fixed angles, so one set fits long
      legs, stubby legs and big heads: two-bone IK puts every paw where the pose wants it (on the
      ground, folded under, raised to the mouth) and every tail is aimed along a curve. walk, trot,
      run, stalk (low creep), stand, sniff, greet (tail straight up), sit, look, pant, groom (paw
      to mouth, licks), knead, loaf (sphinx), sleep (curled, nose to tail), eat (head down,
      chewing), stretch (play bow), crouch, wiggle (bottom wiggle before a pounce), pounce
      (stretched leap), scratch (reared up on a tree), a clip for every action in catmotion.js,
      pivot (turning on the spot) and stop:<gait>:<k> (pulling up). Sitting and lying poses are
      lowered until the rump and belly just touch the ground. A paw comes up to the face only as
      far as that cat's legs go without dragging its skin along, and the head comes down to meet it.

   Walking clips are not played by the clock: the renderer sets their time from the distance the
   cat has moved (cyclesPerUnit, GAIT_RATE). Each paw stays planted while it carries weight and the
   body moves over it at the same rate, so the paws don't slide. */

import * as THREE from "three";
import { ACTIONS, transDur } from "./catmotion.js";
import { MAX_SCALE, MIN_SCALE } from "./traits.js";

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pct = (arr, p) => { if (!arr.length) return 0; const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]; };
const mean = (pts) => pts.reduce((m, p) => m.add(p), V()).divideScalar(Math.max(1, pts.length));

/** The mesh as a graph: points at the same place welded into one (Meshy cuts its UVs per
    triangle), each welded point's neighbours in nb[start[u]] .. nb[start[u + 1] - 1]; uid maps a
    point to its welded one, up holds the welded points. elen: the mean length of its edges. */
function meshGraph(pos, index, edges = true) {
  const n = pos.length / 3, key = new Map(), uid = new Int32Array(n);
  let U = 0;
  for (let i = 0; i < n; i++) {
    const k = (Math.round(pos[i * 3] * 2e4) + 65536) + (Math.round(pos[i * 3 + 1] * 2e4) + 65536) * 131072 + (Math.round(pos[i * 3 + 2] * 2e4) + 65536) * 17179869184;
    let u = key.get(k); if (u === undefined) { u = U++; key.set(k, u); } uid[i] = u;
  }
  const up = new Float32Array(U * 3);
  for (let i = 0; i < n; i++) { const o = uid[i] * 3; up[o] = pos[i * 3]; up[o + 1] = pos[i * 3 + 1]; up[o + 2] = pos[i * 3 + 2]; }
  if (!edges) return { n, U, uid, up, start: null, nb: null, elen: 0.02 };
  const nt = index ? index.length : n, deg = new Int32Array(U + 1), E = new Set();
  let elen = 0, ecount = 0;
  const link = (a, b) => { if (a === b) return; const k = a < b ? a * U + b : b * U + a; if (E.has(k)) return; E.add(k); deg[a]++; deg[b]++;
    if (ecount < 20000) { elen += Math.hypot(up[a * 3] - up[b * 3], up[a * 3 + 1] - up[b * 3 + 1], up[a * 3 + 2] - up[b * 3 + 2]); ecount++; } };
  for (let t = 0; t + 2 < nt; t += 3) { const a = uid[index ? index[t] : t], b = uid[index ? index[t + 1] : t + 1], c = uid[index ? index[t + 2] : t + 2]; link(a, b); link(b, c); link(c, a); }
  const start = new Int32Array(U + 1);
  for (let u = 0; u < U; u++) start[u + 1] = start[u] + deg[u];
  const nb = new Int32Array(start[U]), fill = start.slice(0, U);
  for (const k of E) { const a = Math.floor(k / U), b = k - a * U; nb[fill[a]++] = b; nb[fill[b]++] = a; }
  return { n, U, uid, up, start, nb, elen: ecount ? elen / ecount : 0.02 };
}

/** Distances along the mesh surface (its edges) from welded point `src`, over the points where
    allowed[u] is set (all when null); Infinity where it can't reach. */
function geodesic(G, src, allowed = null) {
  const dist = new Float64Array(G.U).fill(Infinity), heap = [];
  const push = (u, d) => { heap.push([d, u]); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  if (src < 0) return dist;
  dist[src] = 0; push(src, 0);
  const up = G.up;
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    for (let s = G.start[u]; s < G.start[u + 1]; s++) {
      const v = G.nb[s];
      if (allowed && !allowed[v]) continue;
      const nd = d + Math.hypot(up[u * 3] - up[v * 3], up[u * 3 + 1] - up[v * 3 + 1], up[u * 3 + 2] - up[v * 3 + 2]);
      if (nd < dist[v]) { dist[v] = nd; push(v, nd); }
    }
  }
  return dist;
}

/** How wide (across, in z) the mesh is where the plane at height y cuts it, between x = xa and xb. */
function sliceWidth(pos, index, y, xa, xb) {
  let z0 = Infinity, z1 = -Infinity;
  for (let t = 0; t + 2 < index.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = index[t + e] * 3, b = index[t + (e + 1) % 3] * 3, ya = pos[a + 1], yb = pos[b + 1];
      if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
      const f = (y - ya) / (yb - ya), x = pos[a] + (pos[b] - pos[a]) * f;
      if (x < xa || x > xb) continue;
      const z = pos[a + 2] + (pos[b + 2] - pos[a + 2]) * f;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
  }
  return z1 > z0 ? z1 - z0 : 0;
}

/** The lowest point of the surface straight above (x, z), higher than yMin (Infinity if none): a
    vertical ray against the mesh's triangles (`index`, or every three points if null). */
function underside(pos, index, x, z, yMin) {
  let best = Infinity;
  const nt = index ? index.length : pos.length / 3;
  for (let t = 0; t + 2 < nt; t += 3) {
    const a = (index ? index[t] : t) * 3, b = (index ? index[t + 1] : t + 1) * 3, c = (index ? index[t + 2] : t + 2) * 3;
    const d = (pos[b + 2] - pos[c + 2]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 2] - pos[c + 2]);
    if (Math.abs(d) < 1e-12) continue;
    const l1 = ((pos[b + 2] - pos[c + 2]) * (x - pos[c]) + (pos[c] - pos[b]) * (z - pos[c + 2])) / d;
    if (l1 < 0 || l1 > 1) continue;
    const l2 = ((pos[c + 2] - pos[a + 2]) * (x - pos[c]) + (pos[a] - pos[c]) * (z - pos[c + 2])) / d, l3 = 1 - l1 - l2;
    if (l2 < 0 || l3 < 0) continue;
    const y = l1 * pos[a + 1] + l2 * pos[b + 1] + l3 * pos[c + 1];
    if (y > yMin && y < best) best = y;
  }
  return best;
}

/** The tail's thickness: the spread of the ring of points half way along it (0.012 .. 0.08). */
function tailR0(tailRing, tailPts, tailBase, span) {
  const ring = tailRing || tailPts.filter((p) => { const dd = p.distanceTo(tailBase); return dd > span * 0.35 && dd < span * 0.65; });
  if (ring.length > 6) { const c = mean(ring); return Math.max(0.012, Math.min(0.08, pct(ring.map((p) => p.distanceTo(c)), 0.7))); }
  return 0.025;
}

/** The bone layout for a normalized standing cat (positions: Float32Array of x,y,z; `index`, the
    mesh's triangles, optional: with it the belly line is found on the surface itself). */
export function findRig(pos, index = null) {
  const n = pos.length / 3, P = [];
  let G0 = null;
  const graph = () => G0 || (G0 = meshGraph(pos, index));
  let H = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    P.push(V(x, y, z)); H = Math.max(H, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const zc = (z0 + z1) / 2;
  // Paws: points close to the ground, split front/hind by a two-means on x, then left/right by z.
  let low = P.filter((p) => p.y < 0.06 * H);
  if (low.length < 8) low = P.slice().sort((a, b) => a.y - b.y).slice(0, Math.max(8, n >> 6));
  let cf = pct(low.map((p) => p.x), 0.8), ch = pct(low.map((p) => p.x), 0.2);
  for (let k = 0; k < 8; k++) {
    const f = low.filter((p) => Math.abs(p.x - cf) < Math.abs(p.x - ch)), h = low.filter((p) => Math.abs(p.x - cf) >= Math.abs(p.x - ch));
    if (f.length) cf = mean(f).x; if (h.length) ch = mean(h).x;
  }
  const paws = {};
  for (const [end, cx] of [["f", cf], ["h", ch]]) {
    const pts = low.filter((p) => (end === "f") === (Math.abs(p.x - cf) < Math.abs(p.x - ch)));
    const L = pts.filter((p) => p.z >= zc), R = pts.filter((p) => p.z < zc);
    const w = Math.max(0.04, (z1 - z0) * 0.18);
    paws[end + "L"] = L.length ? mean(L) : V(cx, 0, zc + w);
    paws[end + "R"] = R.length ? mean(R) : V(cx, 0, zc - w);
    for (const s of ["L", "R"]) paws[end + s].y = 0;
  }
  const frontX = (paws.fL.x + paws.fR.x) / 2, hindX = (paws.hL.x + paws.hR.x) / 2, d = Math.max(0.1, frontX - hindX);
  // Belly and back lines from the middle of the body.
  const mid = P.filter((p) => p.x > hindX + 0.25 * d && p.x < frontX - 0.25 * d && Math.abs(p.z - zc) < (z1 - z0) * 0.3);
  let yb = Math.max(0.12 * H, pct(mid.map((p) => p.y), 0.04));
  // With the triangles, the belly is where rays straight up the middle, between the legs, first
  // meet the body: the lowest points in the middle may be the legs themselves (a cat standing with
  // its legs splayed in under it, or a wide cat whose legs are near its middle), and taking them for
  // the belly would leave the cat nothing to lower when it sits or lies down.
  if (index) {
    const pz = Math.max(0.01, Math.min(...Object.values(paws).map((q) => Math.abs(q.z - zc)))), hits = [];
    for (let i = 0; i <= 8; i++) for (const s of [-0.3, 0, 0.3]) {
      const y = underside(pos, index, hindX + d * (0.25 + 0.5 * i / 8), zc + s * pz, 0.02 * H);
      if (y < Infinity) hits.push(y);
    }
    if (hits.length >= 6) yb = Math.max(0.12 * H, pct(hits, 0.3));
  }
  let yt = Math.max(yb + 0.1, pct(mid.map((p) => p.y), 0.97)), headOver = false;
  // A big cartoon head can sit right over the body (chibi cats): then the body's cross-section,
  // going up, narrows at the neck and widens again into the head. The back is at the neck.
  {
    const band = P.filter((p) => p.x > hindX + 0.25 * d && p.x < frontX - 0.25 * d);
    const bins = 24, w = [], step = (yt - yb) / bins;
    for (let b = 0; b < bins; b++) { const zs = band.filter((p) => p.y >= yb + (b - 0.5) * step && p.y < yb + (b + 1.5) * step).map((p) => p.z); w.push(zs.length > 12 ? pct(zs, 0.97) - pct(zs, 0.03) : null); }
    for (let b = 0; b < bins; b++) if (w[b] === null) w[b] = w[b - 1] ?? w.find((v) => v !== null) ?? 0; // thin slices: as the one below
    const sm = w.map((v, b) => [w[b - 1] ?? v, v, w[b + 1] ?? v].sort((x, y) => x - y)[1]); // median of three
    // (With the triangles, the mesh is also cut through at each height, for widths that don't
    // depend on how many points a low-poly model happens to have there.)
    const sw = index ? Array.from({ length: bins }, (_, b) => sliceWidth(pos, index, yb + (b + 0.5) * step, hindX + 0.25 * d, frontX - 0.25 * d)) : null;
    // (Measured on the cut, when there is one, the widths are also smoothed three at a time.)
    const W = sw ? sw.map((v, b) => [sw[b - 1] ?? v, v, sw[b + 1] ?? v].sort((x, y) => x - y)[1]) : sm;
    let cut = -1;
    for (let b = 3; b < bins - 3; b++) {
      const below = Math.max(...W.slice(0, b + 1)), above = W.slice(b + 1);
      // A neck: narrower than the body below it, with a head above much wider than the body; or no
      // neck at all, a head half as wide again as the body sitting straight on it (the body's
      // sides straight up to it, not the rounded underside of an ordinary body widening).
      const flat = sw && b >= 4 && sw[b] > 0 ? Math.min(...sw.slice(b - 3, b + 1).filter((v) => v > 0)) / Math.max(...sw.slice(0, b + 1)) : 0;
      if ((W[b] < 0.85 * below && above.filter((v) => v > below * 1.35).length >= 3) || (flat > 0.65 && sw.slice(b + 1, b + 5).filter((v) => v > sw[b] * 1.5).length >= 3)) {
        let m = b; while (m + 1 < bins && W[m + 1] <= W[m]) m++;
        cut = m; break;
      }
    }
    if (cut > 0) yt = Math.max(yb + 0.1, yb + (cut + 0.5) * step);
    headOver = cut > 0;
  }
  let yMid = (yb + yt) / 2;
  // The body's width across the middle (for a cat rolled onto its side).
  const midZ = P.filter((p) => p.x > hindX + 0.25 * d && p.x < frontX - 0.25 * d && p.y > yb && p.y < yt).map((p) => p.z);
  const bodyW = midZ.length > 12 ? pct(midZ, 0.97) - pct(midZ, 0.03) : (z1 - z0) * 0.7;
  // Head: the high points ahead of the middle of the body.
  let headPts = P.filter((p) => p.x > (frontX + hindX) / 2 && p.y > yt - 0.02);
  let headC = headPts.length > 10 ? mean(headPts) : V(frontX + 0.2 * d, yt + 0.15, zc);
  let noseX = Math.max(headC.x + 0.05, pct(headPts.map((p) => p.x), 0.98));
  // Tail: from behind the rump to its furthest point, in four joints.
  const tailBase = V(hindX - 0.22 * d, yb + 0.72 * (yt - yb), zc);
  // (A tail may hang down: low points count too, unless they are by a hind leg or at the ground.)
  const offLegs = (p) => p.y > 0.25 * yb && ["hL", "hR"].every((k) => Math.hypot(p.x - paws[k].x, p.z - paws[k].z) > Math.max(0.12, (z1 - z0) * 0.4));
  const tailPts = P.filter((p) => p.x < tailBase.x && (p.y > yb + 0.25 * (yt - yb) || offLegs(p)));
  let tailTip = V(x0, yt, zc);
  if (tailPts.length) { let best = -1; for (const p of tailPts) { const dd = p.distanceTo(tailBase); if (dd > best) { best = dd; tailTip = p.clone(); } } }
  let tail = [tailBase.clone()];
  const span = tailTip.distanceTo(tailBase);
  for (let k = 1; k <= 4; k++) {
    const r0 = span * (k - 0.5) / 4, r1 = span * (k + 0.5) / 4;
    const ring = tailPts.filter((p) => { const dd = p.distanceTo(tailBase); return dd >= r0 && dd < r1; });
    tail.push(k === 4 ? tailTip.clone() : ring.length ? mean(ring) : tailBase.clone().lerp(tailTip, k / 4));
  }
  let tailRing = null;
  // With the triangles, the tail is followed along its own surface rather than by straight-line
  // distance: from its end (the point furthest from the rump) back to the rump, walking along the
  // skin, the joints sit in the rings a quarter, a half and three quarters of the way. So a tail
  // that curls (an S, a hook, a spiral) keeps its joints inside it, in order, where a ring by
  // straight-line distance would cut across the curl and put a joint in the air between two turns.
  if (index && tailPts.length > 20) {
    const G = graph(), near = (q) => { let b = -1, bd = Infinity; for (let u = 0; u < G.U; u++) { const dd = Math.hypot(G.up[u * 3] - q.x, G.up[u * 3 + 1] - q.y, G.up[u * 3 + 2] - q.z); if (dd < bd) { bd = dd; b = u; } } return b; };
    let root = -1, rd = Infinity;
    for (const p of tailPts) { const dd = p.distanceTo(tailBase); if (dd < rd) { rd = dd; root = p; } }
    // (The end: of the tail's points well out from the rump, the one furthest along the skin; a
    // tail curled back on itself ends inside the curl, not at the point furthest off.)
    const r = near(root), g0 = geodesic(G, r), far = near(tailTip), gf = geodesic(G, far), inT = new Uint8Array(G.U);
    for (let i = 0; i < n; i++) { const p = P[i]; if (p.x < tailBase.x && (p.y > yb + 0.25 * (yt - yb) || offLegs(p))) inT[G.uid[i]] = 1; }
    let tip = far;
    for (let u = 0; u < G.U; u++) if (inT[u] && gf[u] < 0.4 * g0[far] && g0[u] < Infinity && g0[u] > g0[tip]) tip = u;
    const gt = geodesic(G, tip);
    let Lg = gt[r];
    if (Lg > 0.5 * span && Lg < 4 * span) {
      const at = (u) => V(G.up[u * 3], G.up[u * 3 + 1], G.up[u * 3 + 2]);
      const ringAt = (g, band) => { const pts = []; for (let u = 0; u < G.U; u++) if (Math.abs(gt[u] - g) < band) pts.push(at(u)); return pts; };
      const ring = (f, band) => ringAt(Lg * f, band);
      // Where the tail meets the body: walking back from the end, the first ring much wider than
      // the tail (the tail's root flares into the rump). The rump above the tail's root (a big
      // head can make the back look higher than it is) is not tail.
      { const N = 24, rs = [], cs = [];
        for (let j = 1; j <= N; j++) { const q = ringAt(Lg * j / N, Lg / (2 * N)); const c = q.length >= 3 ? mean(q) : null; cs.push(c); rs.push(c ? pct(q.map((p) => p.distanceTo(c)), 0.7) : 0); }
        const ref = pct(rs.slice(Math.round(N * 0.1), Math.round(N * 0.5)).filter((v) => v > 0), 0.5);
        for (let j = Math.round(N * 0.45); j < N; j++) if (ref > 0 && rs[j] > Math.max(2.2 * ref, ref + 0.03) && cs[j]) {
          if (cs[j].x < hindX && cs[j].y > yb) { tail[0] = cs[j]; Lg = Lg * (j + 1) / N; }
          break;
        }
      }
      for (let k = 1; k <= 3; k++) { const q = ring(1 - k / 4, Lg / 16); if (q.length >= 3) tail[k] = mean(q); }
      tailTip = at(tip); tail[4] = tailTip.clone();
      tailRing = ring(0.5, Lg / 24); if (tailRing.length < 6) tailRing = ring(0.5, Lg / 12);
    }
  }
  // A tail carried up over the back reaches into the middle of the body's points and would pass for the
  // back itself, putting the back line, the spine and the hips too high (a sitting cat's bottom then
  // stays up off the ground): with the tail followed, the back is found again without it (unless the
  // back was set at a neck's narrowing, which the tail does not reach).
  if (!headOver && tailPts.length > 20 && span > 0.12 * (x1 - x0)) {
    const tr = Math.max(2 * tailR0(tailRing, tailPts, tailBase, span), 0.03), nearTail = (p) => { for (let k = 1; k <= 4; k++) if (segDist(p, tail[k - 1], tail[k]) < tr) return true; return false; };
    const ys = mid.filter((p) => !nearTail(p)).map((p) => p.y);
    if (ys.length > 30) {
      const yt2 = Math.max(yb + 0.1, pct(ys, 0.97));
      if (yt2 < yt - 0.02) {
        yt = yt2; yMid = (yb + yt) / 2;
        headPts = P.filter((p) => p.x > (frontX + hindX) / 2 && p.y > yt - 0.02 && !nearTail(p));
        headC = headPts.length > 10 ? mean(headPts) : V(frontX + 0.2 * d, yt + 0.15, zc);
        noseX = Math.max(headC.x + 0.05, pct(headPts.map((p) => p.x), 0.98));
      }
    }
  }
  // Legs: each leg's centre line, found from slices of the mesh around its paw (so the joints sit
  // inside the leg even when the model's legs are straight columns or bent), from the paw up to
  // the belly; the top joint (hip or shoulder) sits up inside the body, as a real cat's does.
  const legR = Math.max(0.07, (z1 - z0) * 0.3);
  const nearest = (p) => { let k0 = null, b0 = Infinity; for (const k of ["fL", "fR", "hL", "hR"]) { const q = paws[k], dd = Math.hypot(p.x - q.x, (p.z - q.z) * 1.2); if (dd < b0) { b0 = dd; k0 = k; } } return [k0, b0]; };
  const own = { fL: [], fR: [], hL: [], hR: [] };
  // With the triangles, each leg's own skin: grown up from its paw along the surface, below the belly
  // (all four at once, so legs that touch are split where they meet). Without, the points nearest a paw.
  let lab = null;
  if (index) {
    const G = graph(), KS = ["fL", "fR", "hL", "hR"];
    lab = new Int8Array(G.U).fill(-1);
    let q = [];
    for (let u = 0; u < G.U; u++) {
      if (G.up[u * 3 + 1] > 0.02 * H + 0.005) continue;
      let bk = -1, bd = legR * 0.8;
      KS.forEach((k, j) => { const dd = Math.hypot(G.up[u * 3] - paws[k].x, (G.up[u * 3 + 2] - paws[k].z) * 1.2); if (dd < bd) { bd = dd; bk = j; } });
      if (bk >= 0) { lab[u] = bk; q.push(u); }
    }
    while (q.length) {
      const next = [];
      for (const u of q) for (let s = G.start[u]; s < G.start[u + 1]; s++) { const v = G.nb[s]; if (lab[v] === -1 && G.up[v * 3 + 1] < yb) { lab[v] = lab[u]; next.push(v); } }
      q = next;
    }
    for (let u = 0; u < G.U; u++) if (lab[u] >= 0) own[KS[lab[u]]].push(V(G.up[u * 3], G.up[u * 3 + 1], G.up[u * 3 + 2]));
    if (KS.some((k) => own[k].length < 12)) { lab = null; for (const k of KS) own[k] = []; }
  }
  if (!lab) for (const p of P) if (p.y < yb + 0.1 * (yt - yb)) { const [k, dd] = nearest(p); if (dd < legR) own[k].push(p); }
  const legs = {};
  for (const k of ["fL", "fR", "hL", "hR"]) {
    const pts = own[k], paw = paws[k], front = k[0] === "f";
    // The leg's centre line, followed up from the paw slice by slice: each slice's middle, of the points
    // near the one below (so fur, a belly or the other leg beside it at that height is left out).
    const line = [], band = 0.02 * H;
    let c = V(paw.x, 0, paw.z), rc = Math.max(0.03, legR * 0.3);
    for (let y = 0.05 * H; y < yb; y += band) {
      const sl = pts.filter((p) => Math.abs(p.y - y) < band && Math.hypot(p.x - c.x, p.z - c.z) < Math.max(0.06, 2.2 * rc));
      if (sl.length >= 4) { const m = mean(sl); c = V(m.x, y, m.z); rc = Math.max(0.015, pct(sl.map((p) => Math.hypot(p.x - m.x, p.z - m.z)), 0.75)); }
      line.push([y, c.x, c.z, rc]);
    }
    const at = (y) => { if (!line.length) return V(paw.x, y, paw.z); let i = 0; while (i < line.length - 1 && line[i + 1][0] <= y) i++; const [yy, x, zz] = line[i]; return V(x, y, zz); };
    const rAt = (y) => { let r0 = legR * 0.4; for (const [yy, , , rr] of line) if (yy <= y) r0 = rr; return r0; };
    // A cat's leg in proportion: thigh and shin about equal, the foot shorter (hind); upper arm,
    // forearm, and a short paw (front). Each joint sits on the leg's own centre line.
    const topY = yb + (front ? 0.5 : 0.45) * (yt - yb);
    const knee = at(topY * (front ? 0.58 : 0.6)), low = at(topY * (front ? 0.17 : 0.25)), up = at(Math.min(yb * 0.9, topY * 0.8));
    // (measured low on the leg, below the skirt of fur a long-haired cat's belly hangs down to, and
    // never more than a tenth of the cat's height: a fur skirt taken for a fat leg would make the
    // leg's bones take the flank above it)
    const r = Math.min(0.1 * H, rAt(Math.min(yb * 0.45, topY * 0.35))), rMid = Math.max(0.02, Math.min(legR * 0.6, rAt(Math.min(yb * 0.6, topY * 0.45))));
    const top = V(up.x + (front ? -0.03 : 0.03) * d, topY, zc + (up.z - zc) * 0.6);
    const kn = V(knee.x + (front ? -0.01 : 0.02) * d, knee.y, knee.z), lo = V(low.x + (front ? 0 : -0.02) * d, low.y, low.z);
    // (the knee in front of the line from hip to hock, the elbow behind the one from shoulder to wrist,
    // as a cat's bend: so the leg folds the way its own joints do, and stands as the model does)
    const lx = top.x + (lo.x - top.x) * (top.y - kn.y) / Math.max(1e-6, top.y - lo.y);
    kn.x = front ? Math.min(kn.x, lx - 0.012) : Math.max(kn.x, lx + 0.012);
    // (rMid: the leg's thickness half way up, fur skirt and all, for telling the leg's own skin from
    // the body's when the skin is sampled)
    legs[k] = { top, knee: kn, low: lo, toe: V(paw.x + (front ? 0.035 : 0.03), 0, paw.z), r: Math.max(0.02, Math.min(legR * 0.6, r)), rMid };
  }
  // Thickness of the body, neck, head and tail, for weighting skin by distance relative to size.
  const headR = Math.max(0.06, pct(headPts.map((p) => p.distanceTo(headC)), 0.6));
  const tailR = tailR0(tailRing, tailPts, tailBase, span);
  const legTop = (legs.hL.top.y + legs.hR.top.y + legs.fL.top.y + legs.fR.top.y) / 4;
  // Legs the model has joined together (forelegs modelled as one column, paws touching): how far
  // down (a share of the belly's height) the left and right leg of each pair meet. 1: apart right
  // up to the belly. A cat whose forelegs are one piece down to the paws can't lift one of them
  // high without stretching the skin between them into a sheet, so it grooms differently.
  const legJoin = { f: 1, h: 1 };
  if (lab) {
    const G = graph();
    for (let u = 0; u < G.U; u++) for (let s = G.start[u]; s < G.start[u + 1]; s++) {
      const v = G.nb[s], a = lab[u], b = lab[v];
      if (a < 0 || b < 0 || a === b || (a >> 1) !== (b >> 1)) continue;
      const end = a < 2 ? "f" : "h";
      legJoin[end] = Math.min(legJoin[end], Math.min(G.up[u * 3 + 1], G.up[v * 3 + 1]) / yb);
    }
  }
  // A stub tail (a pom-pom on a round body, or none): what was followed is the rump itself, so
  // the tail bones hold still and ride on the hips.
  const tailStub = span < 0.12 * (x1 - x0);
  // A sample of the skin, each point with the bone it goes with (roughly as skinWeights gives it: a
  // leg's column below the belly by height, the head past the neck, the body by its nearest joint),
  // so the clips can rest a lying body and its folded legs on the ground by their skin, not their bones.
  const skin = (() => {
    const step = Math.max(1, Math.floor(n / 900)), pts = [], bone = [], LK = ["hL", "hR", "fL", "fR"], SEG = { h: ["thigh", "shin", "foot"], f: ["arm", "forearm", "paw"] };
    const neck = V(frontX + 0.04 * d, yb + 0.5 * (yt - yb) + 0.25 * (yt - yb), zc), hj = V(frontX + 0.14 * d + (headC.x - frontX) * 0.35, (yt + headC.y) / 2, zc);
    const hd = V().subVectors(hj, neck), hp = neck.clone().addScaledVector(hd, 0.3); headPlane(hd);
    const body = [["pelvis", V(hindX + 0.05 * d, 0, 0)], ["spine", V((frontX + hindX) / 2, 0, 0)], ["chest", V(frontX - 0.05 * d, 0, 0)]];
    // (a tail hanging down to the ground behind the rump would be taken for the rump's own skin, and hold
    // a sitting cat's bottom up off the ground: nothing near the tail's own line, behind the hips, counts)
    const nearTail = (p) => { if (p.x > hindX || tailStub) return false; const rr = Math.max(2 * tailR, 0.03); for (let k = 1; k <= 4; k++) if (segDist(p, tail[k - 1], tail[k]) < rr) return true; return false; };
    for (let i = 0; i < n; i += step) {
      const p = P[i];
      if (p.x < hindX - 0.22 * d && p.y > yb) continue; // (the tail is laid on the ground by its own joints)
      if (nearTail(p)) continue;
      let nm = null;
      if (p.y < yb) {
        let bk = null, bd = Infinity;
        for (const k of LK) { const g = legs[k], line = p.y > g.knee.y ? [g.knee, g.top] : p.y > g.low.y ? [g.low, g.knee] : [g.toe, g.low], t = Math.max(0, Math.min(1, (p.y - line[0].y) / Math.max(1e-6, line[1].y - line[0].y))); const dd = Math.hypot(p.x - (line[0].x + (line[1].x - line[0].x) * t), p.z - (line[0].z + (line[1].z - line[0].z) * t)) / Math.max(0.03, g.rMid); if (dd < bd) { bd = dd; bk = k; } }
        if (bk && bd < 1.8) { const g = legs[bk], s = SEG[bk[0]]; nm = `${p.y > g.knee.y ? s[0] : p.y > g.low.y ? s[1] : s[2]}.${bk[1]}`; }
        // (a fat paw, a boot or a shoe, wider than the leg above it: the leg's end all the same, so a
        // folded paw is rested on the ground by all of it)
        else if (bk && bd < 4 && p.y < legs[bk].low.y) nm = `${SEG[bk[0]][2]}.${bk[1]}`;
        else if (p.y < 0.6 * yb || (p.y < 0.9 * yb && bd < 3.5)) continue; // (low down, off every leg's line but by one: a leg's all the same, not the body's)
      }
      if (!nm && (p.x - hp.x) * hd.x + (p.y - hp.y) * hd.y > 0 && (p.y > hj.y || p.distanceTo(headC) < 1.4 * headR + 0.02)) nm = "head";
      if (!nm) { let bd = Infinity; for (const [b, at] of body) { const dd = Math.abs(p.x - at.x); if (dd < bd) { bd = dd; nm = b; } } }
      pts.push(p.x, p.y, p.z); bone.push(nm);
    }
    return { pts: Float32Array.from(pts), bone };
  })();
  return {
    H, L: x1 - x0, W: z1 - z0, bodyW, zc, yb, yt, yMid, frontX, hindX, d, paws, headC, noseX, tail, tailStub, legs, headR, tailR, bodyR: Math.max(0.05, (yt - yb) / 2),
    // The underside and back of the body (rump, belly), to keep them on or above the ground.
    legR,
    under: [V(hindX - 0.3 * d, yb + 0.35 * (yt - yb), zc), V(hindX - 0.18 * d, yb + 0.08 * (yt - yb), zc), V(hindX, yb, zc), V((frontX + hindX) / 2, yb, zc), V(frontX, yb, zc)],
    pelvis: V(hindX + 0.05 * d, yMid, zc), chest: V(frontX - 0.05 * d, yMid, zc), spine: V((frontX + hindX) / 2, yMid, zc),
    neck: V(frontX + 0.04 * d, yMid + 0.25 * (yt - yb), zc), headJoint: V(frontX + 0.14 * d + (headC.x - frontX) * 0.35, (yt + headC.y) / 2, zc),
    legTop, legLen: legTop, legJoin, skin,
    // Whether the head sits right over the body (the back was found at the neck's narrowing): then
    // the head's round reaches back over the body; otherwise skin behind the neck is back, not head.
    headOver,
  };
}

const LEGS = [["thigh", "shin", "foot", "h"], ["arm", "forearm", "paw", "f"]];

/** How far round the head (in head radii from its centre) skin on the head's side of the neck plane
    still counts as head: hair or a crest swept back off the head. */
const HEAD_ROUND = 1.3;
/** The normal of the plane across the neck that the head begins at: the way from the neck joint to
    the head joint in the side view (`hd` turned in place: z dropped, unit length). */
function headPlane(hd) { hd.z = 0; return hd.normalize(); }
/** Whether a point lies on the neck itself: within NECK_R body radii of the line from the neck joint
    to the head joint, along the neck's length (a little short of the head joint). A head carried high
    on a thick neck or a ruff puts the nape and the top of the neck on the head's side of the neck
    plane and inside the head's round; without this they would go to the head (or, behind the plane,
    to the chest), leaving the neck bone no skin, and the neck's whole turn would fall on one seam. */
const NECK_R = 0.9, NECK_T = [0, 0.9];
function onNeck(p, rig, nd, nl) {
  const dx = p.x - rig.neck.x, dy = p.y - rig.neck.y, dz = p.z - rig.neck.z, t = (dx * nd.x + dy * nd.y) / nl;
  if (t < NECK_T[0] || t > NECK_T[1]) return false;
  const px = dx - t * nl * nd.x, py = dy - t * nl * nd.y;
  return Math.hypot(px, py, dz) < NECK_R * rig.bodyR;
}
/** A ruff beside the neck: alongside most of the neck's length, within 1.7 body radii of its line, and
    outside the head's own round (0.95 of its radius from its centre). */
function onNeckWide(p, rig, nd, nl) {
  const dx = p.x - rig.neck.x, dy = p.y - rig.neck.y, dz = p.z - rig.neck.z, t = (dx * nd.x + dy * nd.y) / nl;
  if (t < 0 || t > 0.85 || p.distanceTo(rig.headC) < 0.95 * rig.headR || p.x < rig.neck.x - 0.6 * rig.bodyR) return false;
  const px = dx - t * nl * nd.x, py = dy - t * nl * nd.y;
  return Math.hypot(px, py, dz) < 1.7 * rig.bodyR;
}

/** The skeleton for a rig: bones placed at the rig's joints, rest rotations all identity. */
export function buildSkeleton(rig) {
  const bones = {}, list = [];
  const add = (name, at, parent) => {
    const b = new THREE.Bone(); b.name = name;
    b.userData.at = at.clone();
    b.position.copy(parent ? at.clone().sub(parent.userData.at) : at);
    if (parent) parent.add(b);
    bones[name] = b; list.push(b); return b;
  };
  const root = add("root", V(0, 0, 0), null);
  const pelvis = add("pelvis", rig.pelvis, root);
  const spine = add("spine", rig.spine, pelvis);
  const chest = add("chest", rig.chest, spine);
  const neck = add("neck", rig.neck, chest);
  add("head", rig.headJoint, neck);
  let t = pelvis;
  for (let k = 0; k < 4; k++) t = add(`tail${k + 1}`, rig.tail[k], t);
  for (const [a, b, c, end] of LEGS) for (const s of ["L", "R"]) {
    const g = rig.legs[end + s];
    const up = add(`${a}.${s}`, g.top, end === "h" ? pelvis : chest);
    const mid = add(`${b}.${s}`, g.knee, up);
    add(`${c}.${s}`, g.low, mid);
  }
  root.updateMatrixWorld(true);
  return { root, bones, skeleton: new THREE.Skeleton(list) };
}

function segDist(p, a, b) {
  const ab = _v1.subVectors(b, a), t = Math.max(0, Math.min(1, _v2.subVectors(p, a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
  return _v3.copy(a).addScaledVector(ab, t).distanceTo(p);
}
const _v1 = V(), _v2 = V(), _v3 = V();

/** How far skin weights blend across a joint, in model units (the model is 1 tall). */
export const BLEND = 0.055;

/** Leg labels from a <KEY>.legs.json run-length string ("b120,03,b5,1": b = not a leg, 0-3 = hL, hR,
    fL, fR, each with a count) for a copy of n points: a Uint8Array (255 = not a leg), or null if the
    runs don't add up to n. */
export function decodeLegs(str, n) {
  const out = new Uint8Array(n).fill(255);
  let i = 0;
  for (const tok of String(str).split(",")) {
    const m = /^([0-3b])(\d*)$/.exec(tok);
    if (!m) return null;
    const c = m[2] ? +m[2] : 1;
    if (i + c > n) return null;
    if (m[1] !== "b") out.fill(+m[1], i, i + c);
    i += c;
  }
  return i === n ? out : null;
}

/**
 * Skin weights for positions (Float32Array) against a rig and its skeleton; `index` (the mesh's
 * triangle indices, optional) lets the weights be smoothed along the surface. Returns { index, weight }.
 *
 * Every point first goes to the one bone it lies nearest, measured against each bone's thickness
 * (a point on the belly is nearer the spine, in body widths, than a thigh), among the bones it may
 * belong to (a left leg only takes left-side points, the tail only points behind the hips, ...).
 * Then the weights are blurred across the surface (the mesh welded where Meshy cut its UVs), so
 * a joint bends over a band of skin instead of tearing along the line between two bones.
 */
export function skinWeights(pos, rig, sk, index = null, legs = null) {
  const bonesList = sk.skeleton.bones, names = bonesList.map((b) => b.name), B = names.length;
  const seg = {}, rad = {};
  // The body's three bones share its skin in thirds along its length (rump and loins, the middle,
  // the chest and shoulders), whatever the joints' places: the chest joint sits at the shoulders,
  // where the back bends into the neck, and a chest whose skin began there would own a hand's width
  // of the back and leave the loins against the nape, a step of two joints' turn at one seam.
  const yMid = rig.yMid ?? (rig.yb + rig.yt) / 2, cut1 = V(rig.hindX + 0.38 * rig.d, yMid, rig.zc), cut2 = V(rig.hindX + 0.68 * rig.d, yMid, rig.zc);
  const startOf = { spine: cut1, chest: cut2 };
  const endOf = { head: V(rig.noseX, rig.headC.y, rig.zc), tail4: rig.tail[4], pelvis: cut1, spine: cut2, chest: rig.neck, root: rig.pelvis };
  for (const b of bonesList) {
    const kid = b.children.find((c) => c.isBone && !c.name.startsWith("tail") && !/^(thigh|arm)/.test(c.name)) || b.children.find((c) => c.isBone);
    let end = endOf[b.name] || (kid ? kid.userData.at : null);
    if (!end && /^(foot|paw)/.test(b.name)) end = rig.legs[(b.name.startsWith("foot") ? "h" : "f") + b.name.slice(-1)].toe;
    seg[b.name] = [startOf[b.name] || b.userData.at, end || b.userData.at];
    const leg = /\.(L|R)$/.test(b.name) ? rig.legs[(/^(thigh|shin|foot)/.test(b.name) ? "h" : "f") + b.name.slice(-1)] : null;
    rad[b.name] = leg ? leg.r * (/^(thigh|arm)/.test(b.name) ? 1.6 : 1) : b.name.startsWith("tail") ? rig.tailR : b.name === "head" ? rig.headR : b.name === "neck" ? rig.bodyR * 0.8 : rig.bodyR;
  }
  const n = pos.length / 3;
  // Weld: points at the same place are one point (Meshy's per-triangle UV cuts split them); with
  // triangles, each point's neighbours too.
  const tri = !!(index || n % 3 === 0), G = meshGraph(pos, index, tri), { U, uid, up } = G;
  // Each bone: its segment, thickness and which points it may take.
  const midX = (rig.pelvis.x + rig.chest.x) / 2, p = V();
  // The head's side of a plane across the neck (a third of the way to the head joint): points
  // there go to the neck and head only, however far back a big cartoon head reaches.
  const hd = V().subVectors(rig.headJoint, rig.neck), hp = rig.neck.clone().addScaledVector(hd, 0.3);
  const nl = Math.max(1e-6, Math.hypot(hd.x, hd.y)); headPlane(hd);
  const neckI = names.indexOf("neck");
  const info = bonesList.map((b, i) => {
    const nm = b.name, lr = nm.match(/\.(L|R)$/);
    return { i, a: seg[nm][0], b: seg[nm][1], r: rad[nm], root: nm === "root", tail: nm.startsWith("tail"), head: nm === "head", headOk: nm === "head" || nm === "neck", side: lr ? lr[1] : null, hind: /^(thigh|shin|foot)/.test(nm) };
  });
  // The welded mesh's neighbours (when it has triangles): for the legs' pieces and the blur.
  const nb = tri ? G.nb : null, start = tri ? G.start : null;
  // How far a point is from a leg's centre line at its own height, in units of the leg's radius.
  const LK = ["hL", "hR", "fL", "fR"], lower = { hL: "L", hR: "R", fL: "L", fR: "R" };
  const colDist = (k, q) => {
    const g = rig.legs[k], line = [g.toe, g.low, g.knee, g.top];
    let a = line[0], b = line[1];
    for (let j = 1; j < 4; j++) { a = line[j - 1]; b = line[j]; if (q.y <= line[j].y) break; }
    const t = Math.max(0, Math.min(1, (q.y - a.y) / Math.max(1e-6, b.y - a.y)));
    return Math.hypot(q.x - (a.x + (b.x - a.x) * t), q.z - (a.z + (b.z - a.z) * t)) / g.r;
  };
  // (and where, fore and aft, that centre line is at a point's height; and whether a pair of legs stands
  // far apart, one set well ahead of the other)
  const colX = (k, q) => {
    const g = rig.legs[k], line = [g.toe, g.low, g.knee, g.top];
    let a = line[0], b = line[1];
    for (let j = 1; j < 4; j++) { a = line[j - 1]; b = line[j]; if (q.y <= line[j].y) break; }
    return a.x + (b.x - a.x) * Math.max(0, Math.min(1, (q.y - a.y) / Math.max(1e-6, b.y - a.y)));
  };
  const apart = { h: Math.abs(rig.legs.hL.toe.x - rig.legs.hR.toe.x) > 0.15 * rig.H, f: Math.abs(rig.legs.fL.toe.x - rig.legs.fR.toe.x) > 0.15 * rig.H };
  const legOf = { hL: ["thigh.L", "shin.L", "foot.L"], hR: ["thigh.R", "shin.R", "foot.R"], fL: ["arm.L", "forearm.L", "paw.L"], fR: ["arm.R", "forearm.R", "paw.R"] };
  // Each leg's own piece of the mesh: cut the surface level at the highest height (from the belly
  // down) where the four paws' pieces are still apart, and take what hangs from each paw. A
  // generated model's legs can be fat, bent or fused to a low belly; the mesh still says where
  // one leg ends.
  let piece = null;
  // Leg labels made offline (assets/models/cats/<KEY>.legs.json by scripts/cowork-legs.mjs, from a
  // rigging service's own split of the model; one per point: 0-3 = hL, hR, fL, fR, 255 = not a leg)
  // stand in for the split grown from the paws, for the cats whose legs the model fuses (paws
  // touching, forelegs webbed into one column) where that split webs them together.
  if (legs && legs.length === n) {
    piece = new Int8Array(U).fill(-1);
    for (let i = 0; i < n; i++) if (legs[i] < 4) piece[uid[i]] = legs[i];
    piece.fused = true; piece.given = true;
  }
  if (nb && !piece) {
    // The points each paw stands on (each point to its nearest paw only).
    const pawPts = LK.map(() => []);
    for (let u = 0; u < U; u++) {
      if (up[u * 3 + 1] > 0.02 * rig.H + 0.005) continue;
      let bk = -1, bd2 = rig.legR * 0.8;
      LK.forEach((k, j) => { const q = rig.paws[k], dd = Math.hypot(up[u * 3] - q.x, (up[u * 3 + 2] - q.z) * 1.2); if (dd < bd2) { bd2 = dd; bk = j; } });
      if (bk >= 0) pawPts[bk].push(u);
    }
    if (pawPts.every((a2) => a2.length)) {
      for (let f = 1.0; f >= 0.35 && !piece; f -= 0.08) {
        const cutY = rig.yb * f, lab = new Int8Array(U).fill(-1);
        let clash = false;
        for (let k = 0; k < 4 && !clash; k++) {
          const q = [];
          for (const u of pawPts[k]) { if (lab[u] === -1) { lab[u] = k; q.push(u); } else if (lab[u] !== k) clash = true; }
          while (q.length && !clash) {
            const u = q.pop();
            for (let s2 = start[u]; s2 < start[u + 1]; s2++) {
              const v = nb[s2];
              if (up[v * 3 + 1] >= cutY) continue;
              if (lab[v] === -1) { lab[v] = k; q.push(v); } else if (lab[v] !== k) { clash = true; break; }
            }
          }
        }
        if (!clash) piece = lab;
      }
      // Legs that touch (paws together, webbing): grow all four paws' pieces at once below the
      // belly, so each point goes to the paw it is nearest along the surface; above the knee a
      // point must also be inside that leg's column (below).
      if (!piece) {
        const lab = new Int8Array(U).fill(-1);
        let q = [];
        pawPts.forEach((a2, k) => { for (const u of a2) if (lab[u] === -1) { lab[u] = k; q.push(u); } });
        while (q.length) {
          const next = [];
          for (const u of q) for (let s2 = start[u]; s2 < start[u + 1]; s2++) { const v = nb[s2]; if (lab[v] === -1 && up[v * 3 + 1] < rig.yb) { lab[v] = lab[u]; next.push(v); } }
          q = next;
        }
        // (and where two legs of a pair meet, each point goes to the one whose column it is nearer: the
        // growth alone, step by step over an uneven mesh, can carry one leg's label over the other's
        // inner side, which then tears away from it as they step apart)
        for (let u = 0; u < U; u++) {
          const k = lab[u];
          if (k < 0) continue;
          const o = k ^ 1; p.set(up[u * 3], up[u * 3 + 1], up[u * 3 + 2]);
          if (colDist(LK[o], p) * rig.legs[LK[o]].r < colDist(LK[k], p) * rig.legs[LK[k]].r) lab[u] = o;
        }
        piece = lab; piece.fused = true;
      }
    }
  }
  // The tail, along its length: walking the skin from its end, a point is tail only up to where
  // the tail meets the body (not the rump round its root, nor a flank it lies against, whose skin
  // would go with a tail swung up), and in the band of the bone that holds that stretch of it. So a
  // tail that curls keeps each turn on its own bone, instead of a turn going to whichever bone's
  // line happens to pass nearest (which tears a curl into flat strips when the tail moves).
  let tg = null, tRoot = 0;
  const tailIdx = [1, 2, 3, 4].map((k) => names.indexOf(`tail${k}`));
  if (nb && !rig.tailStub) {
    const near = (q) => { let b = -1, bd = Infinity; for (let u = 0; u < U; u++) { const dd = Math.hypot(up[u * 3] - q.x, up[u * 3 + 1] - q.y, up[u * 3 + 2] - q.z); if (dd < bd) { bd = dd; b = u; } } return b; };
    tg = geodesic(G, near(rig.tail[4]));
    tRoot = tg[near(rig.tail[0])];
    if (!(tRoot > 0 && tRoot < Infinity)) tg = null;
  }
  const tailBand = (u) => tailIdx[Math.min(3, Math.max(0, Math.floor((1 - tg[u] / tRoot) * 4)))];
  const seed = new Int32Array(U);
  for (let u = 0; u < U; u++) {
    p.set(up[u * 3], up[u * 3 + 1], up[u * 3 + 2]);
    const side = p.z >= rig.zc ? "L" : "R", mid = Math.abs(p.z - rig.zc) < 0.01;
    // (Past the plane, and either above the head joint or near the head: where the head sits nearly
    // straight above the neck the plane is almost level, and the top of the shoulders behind it is
    // back, not head; hair or a crest swept back high off the head is still head.)
    // (A head sitting right over the body (headOver) begins at the neck's narrowing all round, its back
    // half hanging over the back: there everything above that line and inside the head's round is head.)
    const inRound = p.distanceTo(rig.headC) < HEAD_ROUND * rig.headR + 0.02;
    const headSide = ((p.x - hp.x) * hd.x + (p.y - hp.y) * hd.y > 0 && (p.y > rig.headJoint.y || (inRound && (rig.headOver || p.x > rig.neck.x - 0.25 * rig.headR)))) || (rig.headOver && inRound && p.y > rig.yt + 0.01), under = p.y < rig.yb - 0.01;
    // Inside a leg's column (below the top of the leg): that leg's bones only. (Above the knee a
    // point must also lie within the leg's own column: a long-haired cat's belly fur hangs below its
    // belly line and grows into the leg's piece from the paw, and would go up with a lifted leg.)
    let inLeg = piece ? (piece[u] >= 0 ? LK[piece[u]] : null) : null;
    if (inLeg && !piece.given && p.y > rig.legs[inLeg].knee.y && colDist(inLeg, p) > (piece.fused ? 1.3 : 1.6)) inLeg = null;
    // (and where the model set a pair of legs far apart, mid-stride, the belly between them, grown into the
    // hindmost paw's piece below the belly line, is the body's: a point between the two columns and well out
    // from both would otherwise go down under the ground with the leg folded to sit)
    else if (inLeg && !piece.given && apart[inLeg[0]] && p.y > rig.legs[inLeg].low.y && colDist(inLeg, p) > 3) {
      const o = LK[LK.indexOf(inLeg) ^ 1], x1 = colX(inLeg, p), x2 = colX(o, p), m = Math.max(rig.legs[inLeg].r, rig.legs[o].r);
      if (p.x > Math.min(x1, x2) + m && p.x < Math.max(x1, x2) - m) inLeg = null;
    }
    // (and a point hanging between the two legs of a pair, below the knee yet well out from both columns
    // (two and a half times the leg's thickness), is a ruff or a belly hanging low between them, not a leg:
    // grown into a paw's piece, or taken by a rigging service for a fifth leg, it would swing with the leg)
    else if (inLeg && p.y > rig.legs[inLeg].low.y && colDist(inLeg, p) > 2.5) {
      const o = LK[LK.indexOf(inLeg) ^ 1], g1 = rig.legs[inLeg], g2 = rig.legs[o], m = 1.5 * Math.max(g1.r, g2.r);
      const z1 = g1.low.z + (g1.knee.z - g1.low.z) * Math.max(0, Math.min(1, (p.y - g1.low.y) / Math.max(1e-6, g1.knee.y - g1.low.y))), z2 = g2.low.z + (g2.knee.z - g2.low.z) * Math.max(0, Math.min(1, (p.y - g2.low.y) / Math.max(1e-6, g2.knee.y - g2.low.y)));
      if (p.z > Math.min(z1, z2) + m && p.z < Math.max(z1, z2) - m && colDist(o, p) > 2.5) inLeg = null;
    }
    if (!piece && !headSide && p.y < rig.legTop) {
      let bestc = Infinity;
      for (const k of LK) {
        if ((lower[k] !== side && !mid) || (k[0] === "h" ? p.x > midX : p.x < midX)) continue;
        const c = colDist(k, p);
        if (c < bestc) { bestc = c; inLeg = k; }
      }
      // Below the knee a point is always leg (a fat paw is wider than the column); higher up,
      // only inside the column.
      if (inLeg && p.y > rig.legs[inLeg].knee.y && bestc > 1.3) inLeg = null;
    }
    let best = 0, bd = Infinity;
    for (const f of info) {
      if (f.root) continue;
      if (inLeg) { if (!legOf[inLeg].includes(names[f.i]) || (/^(thigh|arm)/.test(names[f.i]) && p.y < rig.legs[inLeg].knee.y - 0.01)) continue; } // (below the knee, the shin's or forearm's, however thick the thigh)
      else if (f.tail) { if (p.x > rig.pelvis.x || (tg && tg[u] < Infinity && tg[u] > tRoot * 1.04 + 0.005)) continue; }
      else if (headSide) { if (!f.headOk) continue; }
      else if (f.head) continue;
      else if (f.side) {
        if ((f.side !== side && !mid) || (f.hind ? p.x > midX : p.x < midX)) continue;
        if (!/^(thigh|arm)/.test(names[f.i]) && !under) continue; // above the belly, only a leg's top bone
      }
      const dd = segDist(p, f.a, f.b) / f.r;
      if (dd < bd) { bd = dd; best = f.i; }
    }
    // The neck's own skin: on the neck (see onNeck), whether on the head's side of the plane (the
    // nape under a high-held head) or behind it (the throat and the top of the neck above the
    // shoulders, which by distance alone would go to the chest).
    // (and, on the head's side of the plane, a ruff beside the neck: alongside the neck's length yet
    // outside the head's round, whatever its thickness, it is neck, not head: a head bowed to a paw would
    // otherwise carry the ruff's skin away from the shoulders')
    if (!inLeg && neckI > 0 && !info[best].tail && (onNeck(p, rig, hd, nl) || (headSide && onNeckWide(p, rig, hd, nl))) && (headSide || ((p.x - rig.neck.x) * hd.x + (p.y - rig.neck.y) * hd.y > 0 && p.y > rig.neck.y - 0.3 * rig.bodyR))) best = neckI;
    // (Well out along the tail, it is tail whatever lies nearer.)
    // (A piece of the tail the model left unjoined, a tuft or a tip, goes to the bone it is nearest.)
    if (tg && !inLeg && tg[u] < tRoot * 0.8) best = tailBand(u);
    else if (tg && info[best].tail && tg[u] < Infinity) best = tailBand(u);
    seed[u] = best;
  }
  // A tail the model has laid against the body (its tip resting on the rump, a curl against a flank or
  // a hind leg): well out along it, its skin shares edges with the body's, and any swing of it would tear
  // them. Noted on the rig (tailTouch) for the clips, which then move such a tail only a little.
  // (or its end curled back onto its own root: tail4 against tail1 or tail2)
  if (nb && tg) {
    const tk = names.map((nm) => (/^tail[34]$/.test(nm) ? 1 : /^(pelvis|spine|chest|thigh\.|shin\.)/.test(nm) ? 2 : /^tail[12]$/.test(nm) ? 3 : 0));
    const t4 = names.indexOf("tail4");
    let c = 0;
    // (three such edges are enough: even a tip that just grazes the rump is torn off it by a swing)
    for (let u = 0; u < U && c < 10; u++) { const a = seed[u]; if (tk[a] !== 1) continue; for (let s2 = start[u]; s2 < start[u + 1]; s2++) { const b = tk[seed[nb[s2]]]; if (b === 2 || (b === 3 && a === t4)) c++; } }
    if (c >= 3) rig.tailTouch = true;
  }
  // Whether a foreleg's skin touches a hind leg's (the paws set together under a short round body).
  let touchFH = false;
  if (nb) {
    const endOfBone = names.map((nm) => (/^(thigh|shin|foot)\./.test(nm) ? 1 : /^(arm|forearm|paw)\./.test(nm) ? 2 : 0));
    // (touching below the knees, legs against legs: the pieces of an ordinary cat's legs meet only along
    // the strip of belly they grew up to, which is no reason to blend a hind leg into a foreleg)
    const kneeY = Math.min(...LK.map((k) => rig.legs[k].knee.y));
    let touches = 0;
    for (let u = 0; u < U && touches < 6; u++) { if (up[u * 3 + 1] > kneeY) continue; for (let s2 = start[u]; s2 < start[u + 1]; s2++) { const v = nb[s2], e1 = endOfBone[seed[u]], e2 = endOfBone[seed[v]]; if (e1 && e2 && e1 !== e2 && up[v * 3 + 1] <= kneeY) touches++; } }
    touchFH = touches >= 6;
  }
  // Weight can only spread to a bone's family (parent, grandparent, children, grandchildren,
  // siblings): a joint blends the bones that meet there, never far-off ones.
  const fam = bonesList.map((b) => {
    const set = new Set([b]);
    const par = b.parent?.isBone ? b.parent : null;
    if (par) { set.add(par); if (par.parent?.isBone) set.add(par.parent); for (const c of par.children) if (c.isBone) set.add(c); }
    for (const c of b.children) if (c.isBone) { set.add(c); for (const g of c.children) if (g.isBone) set.add(g); }
    // (Two legs a model has joined together, paws or legs touching, blend where they meet: the
    // skin between them stretches evenly as one steps, instead of tearing along the seam.)
    const lr = b.name.match(/^(thigh|shin|foot|arm|forearm|paw)\.(L|R)$/), own = [...set];
    if (lr) { const o = lr[2] === "L" ? "R" : "L", hind = /^(thigh|shin|foot)$/.test(lr[1]); for (const nm of hind ? ["thigh", "shin", "foot"] : ["arm", "forearm", "paw"]) set.add(sk.bones[`${nm}.${o}`]); }
    // (So do a foreleg and a hind leg the model has set touching, stumpy legs close under a round body.)
    if (lr && touchFH) for (const nm of /^(thigh|shin|foot)$/.test(lr[1]) ? ["arm", "forearm", "paw"] : ["thigh", "shin", "foot"]) for (const sd of ["L", "R"]) set.add(sk.bones[`${nm}.${sd}`]);
    const F = [...set].map((x) => bonesList.indexOf(x)).filter((j) => j > 0);
    F.own = own.map((x) => bonesList.indexOf(x)).filter((j) => j > 0);
    return F;
  });
  // Where two bones that don't meet share an edge of the skin (a forearm's top against the flank,
  // the back of the head against the shoulders), nothing could blend them and the edge would tear:
  // of its two points, the one nearer a bone both of them meet (the upper arm, the neck) moves to
  // it, so the skin there bends over a band like any joint.
  if (nb) {
    const depth = bonesList.map((b) => { let d2 = 0; for (let q = b.parent; q?.isBone; q = q.parent) d2++; return d2; });
    const inFam = fam.map((F) => new Set(F)), q2 = V();
    for (let pass = 0; pass < 3; pass++) {
      let moved = 0;
      for (let u = 0; u < U; u++) for (let s2 = start[u]; s2 < start[u + 1]; s2++) {
        const v = nb[s2], a = seed[u], c = seed[v];
        if (u > v || a === c || inFam[a].has(c)) continue;
        let bridge = -1;
        for (const j of fam[a].own) if (fam[c].own.includes(j) && (bridge < 0 || depth[j] > depth[bridge])) bridge = j;
        if (bridge < 0) continue;
        const f = info[bridge];
        p.set(up[u * 3], up[u * 3 + 1], up[u * 3 + 2]); q2.set(up[v * 3], up[v * 3 + 1], up[v * 3 + 2]);
        if (segDist(p, f.a, f.b) <= segDist(q2, f.a, f.b)) seed[u] = bridge; else seed[v] = bridge;
        moved++;
      }
      if (!moved) break;
    }
  }
  const W = new Float32Array(U * B);
  for (let u = 0; u < U; u++) W[u * B + seed[u]] = 1;
  // Blur along the surface: rounds of averaging with the neighbours, as many as it takes to
  // spread about BLEND for this mesh's edge length.
  const blur = (rounds) => {
    let A = W, T = new Float32Array(W);
    for (let r = 0; r < rounds; r++) {
      for (let u = 0; u < U; u++) {
        const o = u * B, s0 = start[u], s1 = start[u + 1], k = s1 - s0, F = fam[seed[u]];
        if (!k) continue;
        const f = 0.5 / k;
        for (let j = 0; j < F.length; j++) {
          const c = F[j];
          let acc = 0;
          for (let s2 = s0; s2 < s1; s2++) acc += A[nb[s2] * B + c];
          T[o + c] = A[o + c] * 0.5 + acc * f;
        }
      }
      [A, T] = [T, A];
    }
    W.set(A);
  };
  if (nb) blur(Math.max(2, Math.min(28, Math.round((BLEND / G.elen) ** 2))));
  // Each joint's two bones blended across the whole band of skin where they meet, by distance along
  // the skin from the line between them (one pass over the mesh from every such line): as wide as the
  // body is thick where it bends (the back, the neck), a leg's thickness at a hip, shoulder, knee or
  // elbow, the tail's at its joints. A back rounded to sleep, a neck bowed to wash, a leg raised to lick
  // then bend over a band of skin as wide as the part, not a crease the width of the blur (which tears
  // into a sheet); the head's own skin stays as it is shaped (only a narrow band where it meets the neck).
  if (nb) {
    const inF = fam.map((F) => new Set(F.own));
    const kind = names.map((nm) => (nm === "head" ? "head" : ["pelvis", "spine", "chest", "neck"].includes(nm) ? "body" : /^(thigh|arm)/.test(nm) ? "top" : /^(shin|foot|forearm|paw)/.test(nm) ? "leg" : nm.startsWith("tail") ? "tail" : "root"));
    const legRad = names.map((nm) => { const m = nm.match(/^(thigh|shin|foot|arm|forearm|paw)\.(L|R)$/); return m ? rig.legs[(/^(thigh|shin|foot)$/.test(m[1]) ? "h" : "f") + m[2]].r : 0; });
    const bodyR = Math.max(0.06, rig.bodyR);
    // (A hip or shoulder sits up inside the body, and the skin of the flank between the belly line and
    // the joint goes with the leg's top bone as much as with the body: so on the body's side the band
    // is as deep as the joint is above the belly line, not a thin leg's width, which would fold a cat
    // rearing up or raising a paw along a crease and tear it into a sheet.)
    const flank = names.map((nm) => { const m = nm.match(/^(thigh|arm)\.(L|R)$/); return m ? Math.max(0, rig.legs[(m[1] === "thigh" ? "h" : "f") + m[2]].top.y - rig.yb) : 0; });
    // (and on the leg's side, down half the thigh's or upper arm's length: the skin over a hip or a
    // shoulder moves less than the knee's, and a rearing or a leg lifted to the ear turns the joint a
    // whole right angle and more)
    const thigh = names.map((nm) => { const m = nm.match(/^(thigh|arm)\.(L|R)$/); if (!m) return 0; const g = rig.legs[(m[1] === "thigh" ? "h" : "f") + m[2]]; return Math.max(0, g.top.y - g.knee.y); });
    // (how far into bone a's side the blend with bone b reaches)
    // (the head's band, over the nape and the back of the skull (the face keeps a narrow one, below): a
    // head bowed to a paw turns most of a right angle at the neck, and the nape's skin takes it up over
    // nearly half the head, as a cat's does, or it tears into a hood)
    const width = (a, b) => 1.5 * (kind[a] === "head" ? 0.4 * rig.headR : kind[a] === "body" && kind[b] === "body" ? bodyR : kind[a] === "body" && kind[b] === "head" ? 0.8 * bodyR : kind[a] === "tail" || kind[b] === "tail" ? Math.max(2 * rig.tailR, 0.045) : kind[a] === "body" && kind[b] === "top" ? Math.max(1.2 * legRad[b], 0.6 * flank[b], 0.036) : kind[a] === "top" && kind[b] === "body" ? Math.max(1.2 * legRad[a], 0.5 * thigh[a], 0.03) : 1.2 * Math.max(legRad[a], legRad[b], 0.03));
    const heap = [];
    const push = (u, d) => { heap.push([d, u]); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    const el = (u, v) => Math.hypot(up[u * 3] - up[v * 3], up[u * 3 + 1] - up[v * 3 + 1], up[u * 3 + 2] - up[v * 3 + 2]);
    // (A shin or forearm against the belly or the chest, not jointed to it, blends into the bone
    // between them, the thigh or the upper arm, which then bends the skin between them as one joint
    // does; so do two body bones a joint apart, the spine against the nape, the head against the chest.)
    const par = bonesList.map((bb) => (bb.parent?.isBone ? bonesList.indexOf(bb.parent) : -1));
    const partner = (a, b) => {
      const legBody = (kind[a] === "leg" && kind[b] === "body") || (kind[b] === "leg" && kind[a] === "body");
      const bodyBody = (kind[a] === "body" || kind[a] === "head") && (kind[b] === "body" || kind[b] === "head");
      if (!legBody && !bodyBody) return b;
      return par[par[a]] === b ? par[a] : par[par[b]] === a ? par[b] : b;
    };
    // Every seam a bone's skin has with another's, and how far along the skin each point of it is from
    // that seam (one search per seam, over that bone's own points): a point near two seams (the back
    // above the hips, between the loins and the chest; the belly between two legs) then blends with
    // both, by its distance from each, instead of with whichever is nearer, which would give two
    // neighbouring points two different partners and tear the edge between them.
    // (Across a leg's seam with the body, blended into the bone between (a shin's against the belly into the
    // thigh), each side takes a share of the far side's bone too: the two sides then meet at the seam with
    // nearly the same weights, where with the bone between alone they would each still keep half of their
    // own and step by a half from one to the other, a hard seam in all but name, which a folded hind leg
    // tears along.)
    const seams = new Map(); // "a,bo" -> [u, d, ...]
    const farOf = new Map(), halfOf = new Set(); // "a,bo" -> the far bone c, for a seam blended through a bone between (halfOf: at half the share)
    for (let u = 0; u < U; u++) for (let s2 = start[u]; s2 < start[u + 1]; s2++) {
      const v = nb[s2], a = seed[u], c = seed[v];
      if (a === c || !inF[a].has(c)) continue;
      const bo = partner(a, c); if (bo <= 0) continue;
      const k = a * B + bo; let L = seams.get(k); if (!L) seams.set(k, (L = [])); L.push(u, el(u, v) / 2);
      // (Only across a leg's seam with the body: the body's side takes half the share (belly skin that took a
      // shin's full share would go up with a hind leg lifted to the ear, and tear from the belly's other
      // side; with none, the groin tears along the seam when the shins fold flat against the belly). The
      // body's own seams a joint apart, the nape against the loins, the head against the chest, keep to the
      // bone between: skin of the back that took the head's share would bunch when the head bows.)
      if (bo !== c && (kind[a] === "leg" || kind[c] === "leg")) { const k2 = a * B + c; let L2 = seams.get(k2); if (!L2) { seams.set(k2, (L2 = [])); farOf.set(k2, bo); if (kind[a] === "body") halfOf.add(k2); } L2.push(u, el(u, v) / 2); }
    }
    const dist = new Float64Array(U), NP = 4, pb = new Int16Array(U * NP).fill(-1), pt = new Float32Array(U * NP), pn = new Uint8Array(U), pfar = new Uint8Array(U);
    for (const [k, L] of seams) {
      const a = Math.floor(k / B), bo = k - a * B, far = farOf.get(k), share = halfOf.has(k) ? 0.25 : 0.5, Rw = width(a, far ?? bo), Rh = Rw * 0.3;
      dist.fill(Infinity); heap.length = 0;
      for (let i = 0; i < L.length; i += 2) if (L[i + 1] < dist[L[i]]) { dist[L[i]] = L[i + 1]; push(L[i], L[i + 1]); }
      while (heap.length) {
        const [d, u] = pop(); if (d > dist[u] || d >= Rw) continue;
        for (let s2 = start[u]; s2 < start[u + 1]; s2++) { const v = nb[s2]; if (seed[v] !== a) continue; const nd = d + el(u, v); if (nd < dist[v]) { dist[v] = nd; push(v, nd); } }
      }
      for (let u = 0; u < U; u++) {
        if (!(dist[u] < Rw)) continue;
        // (Over the face, the head's own band stays narrow: a turned head keeps its shape; the nape and the
        // back of the skull, behind the head's centre, bend over the full band, else a head bowed to a paw on
        // a short thick neck folds its skin along a crease and tears it into a hood. The narrowing eases in
        // over the back half of the head, a hard edge to it being a seam of its own; and it is the head's
        // alone: a neck's skin up inside the head's round blends as a neck's does.)
        let R = Rw;
        if (kind[a] === "head") {
          const dx = up[u * 3] - rig.headC.x, dy = up[u * 3 + 1] - rig.headC.y, dz = up[u * 3 + 2] - rig.headC.z;
          const face = 1 - Math.max(smooth((Math.hypot(dx, dy, dz) - 0.9 * rig.headR) / (0.4 * rig.headR)), smooth((-(dx * hd.x + dy * hd.y) - 0.1 * rig.headR) / (0.5 * rig.headR)));
          R = Rw + (Rh - Rw) * face;
        }
        if (!(dist[u] < R)) continue;
        const t = share * (1 - smooth(dist[u] / R)), c = pn[u];
        if (far !== undefined) pfar[u] = 1;
        if (c < NP) { pb[u * NP + c] = bo; pt[u * NP + c] = t; pn[u] = c + 1; }
        else { let m = 0; for (let j = 1; j < NP; j++) if (pt[u * NP + j] < pt[u * NP + m]) m = j; if (t > pt[u * NP + m]) { pb[u * NP + m] = bo; pt[u * NP + m] = t; } }
      }
    }
    for (let u = 0; u < U; u++) {
      const c = pn[u]; if (!c) continue;
      const a = seed[u], o = u * B;
      let tot = 0, mass = W[o + a];
      for (let j = 0; j < c; j++) { tot += pt[u * NP + j]; mass += W[o + pb[u * NP + j]]; }
      if (mass <= 1e-4) continue;
      const keep = pfar[u] ? 1 / 3 : 0.5, sc = tot > 1 - keep ? (1 - keep) / tot : 1; // (the bone's own skin keeps at least half of itself; a third where it meets a bone across one between)
      W[o + a] = mass * (1 - tot * sc);
      for (let j = 0; j < c; j++) W[o + pb[u * NP + j]] = mass * pt[u * NP + j] * sc;
    }
  }
  // (and a last light blur, two rounds, over the bands: where three seams meet in one place (the groin, a
  // shoulder against the elbow) two points a hair apart can come out of the bands with a step between them,
  // and a step over next to nothing tears as any leg moves)
  if (nb) blur(2);
  // (A paw's or a hind foot's own bone takes no skin more than half way up to the elbow or knee: a low-poly
  // copy's long thin triangle, one edge from the paw right up to the elbow, would otherwise pass the paw's
  // weight up the blur to the elbow, whose skin would then go out with the paw.)
  if (nb) for (const k of LK) {
    const g = rig.legs[k], e = names.indexOf(legOf[k][2]), span = Math.max(1e-6, g.knee.y - g.low.y);
    for (let u = 0; u < U; u++) { const t = (up[u * 3 + 1] - g.low.y) / span; if (t > 0.5) W[u * B + e] *= 1 - smooth((t - 0.5) / 0.35); }
  }
  // The four strongest bones per point, shared by every copy of it.
  const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
  const ui = new Uint16Array(U * 4), uw = new Float32Array(U * 4);
  const ti = [0, 0, 0, 0], tw = [0, 0, 0, 0];
  for (let u = 0; u < U; u++) {
    ti.fill(0); tw.fill(0);
    for (const j of fam[seed[u]]) {
      const w = W[u * B + j];
      if (w <= tw[3]) continue;
      let k = 3; while (k > 0 && tw[k - 1] < w) { tw[k] = tw[k - 1]; ti[k] = ti[k - 1]; k--; }
      tw[k] = w; ti[k] = j;
    }
    const sum = tw[0] + tw[1] + tw[2] + tw[3] || 1;
    for (let k = 0; k < 4; k++) { ui[u * 4 + k] = ti[k]; uw[u * 4 + k] = tw[k] / sum; }
  }
  for (let i = 0; i < n; i++) { const o = uid[i] * 4; for (let k = 0; k < 4; k++) { idx[i * 4 + k] = ui[o + k]; wt[i * 4 + k] = uw[o + k]; } }
  return { index: new THREE.Uint16BufferAttribute(idx, 4), weight: new THREE.Float32BufferAttribute(wt, 4) };
}

/* ── Clips ─────────────────────────────────────────────────────────────── */

/** A cat's way of moving (traits.js styleOf gives one per cat; every value optional). The defaults are
    an ordinary adult: tempo 1 (idle loops and posture changes; kittens quicker, old or heavy cats
    slower), stride / lift / bob multipliers, sway (hip roll, a heavy cat's waddle), crouch (body
    lowered while walking), tail (-0.4 tucked .. 0 relaxed .. 1 straight up with a hooked tip), head
    (carried low .. high), sitTall (slumped .. regal sit), loafTuck (sphinx .. paws folded under). */
export const DEFAULT_STYLE = Object.freeze({ tempo: 1, stride: 1, lift: 1, bob: 1, sway: 0, crouch: 0, tail: 0, head: 0, sitTall: 0.5, loafTuck: 0.3, scale: 1 });
const STYLE_RANGE = { tempo: [0.6, 1.5], stride: [0.75, 1.25], lift: [0.5, 1.5], bob: [0.3, 2], sway: [0, 1], crouch: [0, 0.4], tail: [-0.5, 1], head: [-0.4, 0.4], sitTall: [0, 1], loafTuck: [0, 1], scale: [MIN_SCALE, MAX_SCALE] };
/** A full style: the defaults, with the given values clamped to what the clips can show. */
export function clipStyle(style) {
  const s = { ...DEFAULT_STYLE };
  for (const k in STYLE_RANGE) { const v = style?.[k]; if (typeof v === "number" && Number.isFinite(v)) s[k] = Math.min(STYLE_RANGE[k][1], Math.max(STYLE_RANGE[k][0], v)); }
  return s;
}

/** legTo's memory of each leg's direction from the key before, while a clip is being sampled. */
const FOLD = { on: false, dt: 1 / 30, st: { hL: { has: false, th: 0 }, hR: { has: false, th: 0 }, fL: { has: false, th: 0 }, fR: { has: false, th: 0 } } };
const E = new THREE.Euler(), Q = new THREE.Quaternion(), Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), V1 = V(), V2 = V();
const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);
const qEuler = (r, out) => out.setFromEuler(E.set(r[2] || 0, r[1] || 0, r[0] || 0, "ZYX"));
/**
 * Samples a pose function into a clip. A pose is { bone: [z, y, x] radians (Euler ZYX) or { q: [x, y, z, w] } }
 * plus `lift`, `shift`, `side` (the root's offset, model units). Loops end exactly where they start
 * (a mannerism's loop, which begins with its way in, ends where its cycle starts: `ud.enter` s in);
 * `ud` goes to clip.userData ({ loop, kind, posture, dur, fade, enter, cyc }).
 */
function sampleClip(name, dur, fps, fn, ud = {}, warm = null) {
  const loop = ud.loop !== false && !ud.enter;
  // (A mannerism's way in is keyed at 30 a second, its cycle at the clip's own rate.)
  const n0 = ud.enter ? Math.max(2, Math.ceil(ud.enter * 30)) : 0, n1 = Math.max(2, Math.round((dur - (ud.enter || 0)) * fps));
  const frames = n0 + n1 + 1;
  const times = new Float32Array(frames), root = new Float32Array(frames * 3);
  let names = null, per = null;
  for (let f = 0; f < frames; f++) {
    const u = f < n0 ? (f / n0) * (ud.enter / dur) : ((ud.enter || 0) + ((f - n0) / n1) * (dur - (ud.enter || 0))) / dur;
    times[f] = u * dur;
    // (`warm`, for a clip that carries on from the middle of another: poses that clip's keys up to
    // there first, so the legs' memory of their way (legTo) is as it was in it, and this one begins
    // exactly on its frame)
    if (f === 0) { for (const k in FOLD.st) FOLD.st[k].has = false; FOLD.dt = (warm && warm()) || 1 / 30; } else FOLD.dt = times[f] - times[f - 1];
    FOLD.on = true;
    const pose = fn(loop && f === frames - 1 ? 0 : u);
    FOLD.on = false;
    if (!names) { names = Object.keys(pose).filter((k) => k !== "lift" && k !== "shift" && k !== "side"); per = names.map(() => new Float32Array(frames * 4)); }
    for (let i = 0; i < names.length; i++) {
      const r = pose[names[i]], a = per[i], o = f * 4;
      if (r.q) Q.fromArray(r.q); else qEuler(r, Q);
      // Keep each track on one side of the quaternion sphere (no sign flips between keys).
      if (f && Q.x * a[o - 4] + Q.y * a[o - 3] + Q.z * a[o - 2] + Q.w * a[o - 1] < 0) Q.set(-Q.x, -Q.y, -Q.z, -Q.w);
      Q.toArray(a, o);
    }
    root[f * 3] = pose.shift || 0; root[f * 3 + 1] = pose.lift || 0; root[f * 3 + 2] = pose.side || 0;
  }
  const tracks = names.map((b, i) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, per[i]));
  tracks.push(new THREE.VectorKeyframeTrack("root.position", times, root)); // the root rests at the origin
  const clip = new THREE.AnimationClip(name, dur, tracks);
  clip.userData = { loop: ud.loop !== false, dur, fade: 0.15, ...ud };
  return clip;
}

/** Sides: left legs +z. For every leg: [upper, lower, end] names. */
const LEG = { hL: ["thigh.L", "shin.L", "foot.L"], hR: ["thigh.R", "shin.R", "foot.R"], fL: ["arm.L", "forearm.L", "paw.L"], fR: ["arm.R", "forearm.R", "paw.R"] };
const KEYS = ["hL", "hR", "fL", "fR"];
const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const len2 = (a, b) => Math.max(0.01, Math.hypot(b.x - a.x, b.y - a.y));
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const z = (r) => (r ? r[0] || 0 : 0);

/**
 * The rig's side view, for posing by targets: where each joint is at rest (x forward, y up) and
 * the rest direction and length of every leg and tail segment.
 */
export function kinematics(rig) {
  const legs = {};
  for (const k of KEYS) {
    const g = rig.legs[k];
    legs[k] = { top: g.top, knee: g.knee, a: [ang(g.top, g.knee), ang(g.knee, g.low), ang(g.low, g.toe)], l: [len2(g.top, g.knee), len2(g.knee, g.low), len2(g.low, g.toe)], toe: g.toe, hind: k[0] === "h", side: k[1] === "L" ? 1 : -1 };
    legs[k].reach = legs[k].l[0] + legs[k].l[1] + legs[k].l[2];
  }
  const tail = [];
  for (let k = 1; k <= 4; k++) tail.push({ a: ang(rig.tail[k - 1], rig.tail[k]), l: len2(rig.tail[k - 1], rig.tail[k]) });
  // (a tail modelled lying against the body (skinWeights' tailTouch) swings only a little: free is how
  // much of a pose's tail curve it takes)
  return { legs, tail, stub: !!rig.tailStub, free: rig.tailTouch ? 0.3 : 1, P0: rig.pelvis, S0: rig.spine, C0: rig.chest, N0: rig.neck, H0: rig.headJoint, T0: rig.tail[0] };
}

/** Forward kinematics of the body: where the hips, shoulders, neck and head end up for a pose's root
    offset and its pelvis, spine and chest turns (lean and roll included, so a swaying body keeps its
    planted paws still). `neckW` is the neck's pitch in the world (the head is steadied that way). */
function body(K, p, neckW = 0) {
  const qP = qEuler(p.pelvis, new THREE.Quaternion()), qS = qEuler(p.spine, new THREE.Quaternion()).premultiply(qP), qC = qEuler(p.chest, new THREE.Quaternion()).premultiply(qS);
  const aP = z(p.pelvis), aS = aP + z(p.spine), aC = aS + z(p.chest);
  const pel = V(K.P0.x + (p.shift || 0), K.P0.y + (p.lift || 0), K.P0.z + (p.side || 0));
  const spi = V1.subVectors(K.S0, K.P0).applyQuaternion(qP).add(pel).clone();
  const che = V1.subVectors(K.C0, K.S0).applyQuaternion(qS).add(spi).clone();
  const nec = V1.subVectors(K.N0, K.C0).applyQuaternion(qC).add(che).clone();
  const qN = qEuler([neckW - aC, 0, 0], Q1).premultiply(qC);
  const hed = V1.subVectors(K.H0, K.N0).applyQuaternion(qN).add(nec).clone();
  const top = {};
  for (const k of KEYS) {
    const L = K.legs[k], hind = L.hind, q = hind ? qP : qC, at = V1.subVectors(L.top, hind ? K.P0 : K.C0).applyQuaternion(q).add(hind ? pel : che);
    top[k] = { x: at.x, y: at.y, z: at.z, q };
  }
  return { aP, aC, pel, spi, che, nec, hed, top, qP, qS, qC };
}

/**
 * Two-bone IK for one leg: puts the toe at `toe` (x, y; y = 0 is the ground) with the last segment
 * (hind foot or front paw) pointing along `end` (radians in the side view; the rest direction if
 * null). Hind knees bend forward, front elbows back. Sideways, the toe goes `dz` out from where it
 * stands at rest (model units, + away from the body; so a planted paw stays put however the hips
 * sway), the leg's plane leaning to reach it; `twist` turns the knee or elbow out about the line
 * from hip to toe (radians), which leaves the toe where it is. The rotations written are relative to
 * the parent bone, whatever its lean and roll.
 */
function legTo(K, p, B, k, toe, end = null, twist = 0, dz = 0) {
  const L = K.legs[k], [l1, l2, l3] = L.l, T = B.top[k];
  const e = end === null ? L.a[2] : end;
  // The leg is solved in its hip's or shoulder's own heading (a body turned or curled round carries
  // its legs round with it): the toe taken into that frame, the leg's turn put back at the end. (toe.z,
  // when given, is where the toe goes across, in the world.)
  const q = T.q, psi = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y)), cp = Math.cos(psi), sp = Math.sin(psi); // (the heading of its side-to-side axis: a girdle pitched right over still faces the same way)
  const wx = toe.x - T.x, wz = (toe.z !== undefined ? toe.z : L.toe.z + L.side * dz) - T.z;
  const rx = wx * cp - wz * sp;
  // Where the toe must be from the hip: ty down (or up), tz across; the leg's own rest offsets across
  // (zk to the knee, zt to the toe) stay as they are in its plane.
  const ty = toe.y - T.y, tz = wx * sp + wz * cp, zk = L.knee.z - L.top.z, zt0 = L.toe.z - L.top.z;
  // (Near the hip's height the plane's lean is ill-conditioned: with the toe's rest offset across held
  // in the plane, a toe a little further in or out than at rest would lean the plane right over for a
  // frame as it passes, and whip the leg round. So within two offsets of that height the in-plane
  // offset follows the toe's own offset across instead, and the plane stays upright; further off it
  // is the rest offset again, and the plane leans as a leg does.)
  // (and the further the toe is out of the leg's rest line across, the wider that band: a paw raised to
  // the shoulder's height a little out to the side (batting at the water) would otherwise lean the
  // leg's plane over one way just below the shoulder and the other way just above it, and flip the
  // whole leg over in a frame as it passes; no wider than a third of the leg, where a leg lying out to
  // the side along the ground keeps its lean)
  const W = Math.min(2 * Math.abs(zt0) + 3 * Math.abs(tz - zt0), Math.max(2 * Math.abs(zt0), 0.35 * L.reach)) + 1e-6;
  const r2 = ty * ty + tz * tz, zt = tz + (zt0 - tz) * smooth(Math.abs(ty) / W);
  const Y = (ty < 0 ? -1 : 1) * Math.sqrt(Math.max(1e-8, r2 - zt * zt));
  let rho = Math.atan2(tz, ty) - Math.atan2(zt, Y);
  rho = Math.atan2(Math.sin(rho), Math.cos(rho));
  // In the leg's plane: x as in the side view, Y along the leaning "down".
  const lx = rx - l3 * Math.cos(e), ly = Y - l3 * Math.sin(e);
  const dx = lx, d = Math.hypot(dx, ly), dmin = Math.abs(l1 - l2) + 1e-4, c = Math.min(l1 + l2 - 1e-4, Math.max(dmin, d));
  // A leg folded right up has its end almost at the hip, where the way to it means nothing (it
  // would swing about from one frame to the next): there the folded leg eases to lie as a cat's
  // does, a hind leg forward along the belly, a foreleg down under the chest.
  const foldR = 2 * dmin, wf = d < foldR ? 1 - smooth(d / foldR) : 0, fx = L.hind ? 0.95 : -0.3, fy = L.hind ? -0.3 : -0.95;
  let th = wf ? Math.atan2((ly / Math.max(d, 1e-9)) * (1 - wf) + fy * wf, (dx / Math.max(d, 1e-9)) * (1 - wf) + fx * wf) : Math.atan2(ly, dx);
  // (While a clip is sampled, key by key, a leg whose end is near its hip (a hind leg folded flat under
  // a shallow body) turns from where it was the key before, at most so far a key: near the hip the way
  // to the end means little and would spin the leg round as the end passes by; a planted paw's end
  // stays where it is, so this changes nothing for it.)
  // (so much a key of 1/30 s; a key further from the one before may turn further: the same rate whatever
  // the clip's own rate, and a frame between two keys turns only its share)
  const FS = FOLD.st[k], nearR = 0.45 * L.reach;
  if (FOLD.on && d < nearR && FS.has) { const lim = (0.08 + 0.6 * (d / nearR)) * Math.min(3, FOLD.dt * 30), dth = Math.atan2(Math.sin(th - FS.th), Math.cos(th - FS.th)); th = FS.th + Math.max(-lim, Math.min(lim, dth)); }
  FS.th = th; FS.has = true;
  const A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + c * c - l2 * l2) / (2 * l1 * c))));
  const a1 = L.hind ? th + A : th - A;
  const kx = l1 * Math.cos(a1), ky = l1 * Math.sin(a1);
  const a2 = Math.atan2(ly - ky, dx - kx);
  const w1 = a1 - L.a[0], w2 = a2 - L.a[1], w3 = e - L.a[2];
  const [n1, n2, n3] = LEG[k];
  // The upper bone in the world: Rz(w1) in its plane, the plane leant by rho, then turned about the
  // hip-toe line, then turned to the girdle's heading; made relative to the parent.
  Q1.setFromAxisAngle(AX, rho).multiply(Q2.setFromAxisAngle(AZ, w1));
  if (twist) {
    const cr = Math.cos(rho), sr = Math.sin(rho);
    const ax = V1.set(rx, ty, tz).normalize(), kn = V2.set(kx, ky * cr - zk * sr, ky * sr + zk * cr);
    kn.addScaledVector(ax, -kn.dot(ax));
    const turn = (ax.x * kn.y - ax.y * kn.x) * L.side >= 0 ? twist : -twist; // (ax × kn).z points the knee out
    Q1.premultiply(Q2.setFromAxisAngle(ax, turn));
  }
  if (psi) Q1.premultiply(Q2.setFromAxisAngle(AY, psi));
  Q1.premultiply(Q2.copy(T.q).invert());
  p[n1] = { q: Q1.toArray() }; p[n2] = [w2 - w1, 0, 0]; p[n3] = [w3 - w2, 0, 0];
}

/** How far each tail joint may turn in the side view from its rest relation to the bone before it
    (root first), rad. */
const TAIL_TURN = [0.75, 1.3, 1.3, 1.3];
/** The tail along a curve: `dirs` are the four segments' directions in the side view (radians:
    PI points straight back, PI/2 up), `side` how far each swings out to the side (+ to the left). */
function tailTo(K, p, B, dirs, side = [0, 0, 0, 0]) {
  if (K.stub) { for (let k = 1; k <= 4; k++) p[`tail${k}`] = [0, (side[k - 1] || 0) * 0.15, 0]; return; }
  let prev = B.aP;
  for (let k = 0; k < 4; k++) {
    // Pitched to its direction in the side view, then swung out sideways (the same swing whichever
    // way the model's tail pointed at rest).
    // (No one joint of the tail turns more than TAIL_TURN from how it stood at rest, the root against the
    // hips (which a body reared up on its haunches would otherwise fold the tail's root right under): what
    // a joint can't turn the next ones take up, and the tail as a whole still curves the way it is aimed.)
    const T = K.tail[k], want = (dirs[k] - T.a) * K.free, lim = TAIL_TURN[k], turn = want - prev, w = prev + Math.max(-lim, Math.min(lim, Math.atan2(Math.sin(turn), Math.cos(turn)))), rel = T.a + w - prev;
    Q1.setFromAxisAngle(AZ, rel).multiply(Q2.setFromAxisAngle(AY, -(side[k] || 0) * K.free)).multiply(Q2.setFromAxisAngle(AZ, -T.a));
    p[`tail${k + 1}`] = { q: Q1.toArray() };
    prev = w;
  }
}

/** How far a cat's body moves in one walk cycle, in model units, in its own style's stride (a trot,
    run or stalk cycle covers 1 / GAIT_RATE[gait] times as much). */
export const walkStride = (rig, style, fit = null) => 1.1 * rig.legTop * (style ? clipStyle(style).stride : 1) * fitOf(fit, "gait");
/** A model's fit (makeClips' third argument) for knob k: 0.3..1, 1 when unsaid. */
const fitOf = (fit, k) => { const v = fit ? fit[k] : undefined; return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0.3, v)) : 1; };
/** The renderer steps trot, run and stalk cycles this much slower (or faster) per unit walked. */
export const GAIT_RATE = { walk: 1, trot: 0.8, run: 0.55, stalk: 1.3 };
/** How far (rad) a cat turns on the spot in one cycle of its "pivot" clip. */
export const PIVOT_TURN = 0.7;
/** How many pull-up clips each gait has (stop:<gait>:<k>, pulling up at phase k / STOPS). */
export const STOPS = 8;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const win = (u, a, b) => smooth((u - a) / (b - a));
const bump = (u, a, b) => { const s = (u - a) / (b - a); return s <= 0 || s >= 1 ? 0 : Math.sin(Math.PI * s); };
const lerp = (a, b, t) => a + (b - a) * t;
/** A paw's step from u = a to b: [how far along it has moved, how high it is lifted (0..1)]. It
    lifts before it moves and is down before it stops, so it never slides; the lift eases off the
    ground and onto it (no kick at lift-off, no slap on landing). */
const stepAt = (u, a, b) => { const s = (u - a) / (b - a); return s <= 0 ? [0, 0] : s >= 1 ? [1, 0] : [smoother((s - 0.2) / 0.6), smooth(s / 0.3) * smooth((1 - s) / 0.3)]; };
const lerpN = (A, B, t) => A.map((v, i) => v + (B[i] - v) * t);
/** A value that holds, then moves quickly and smoothly to the next: [[u, v], ...] (u ascending,
    wrapping round a loop), each move taking `mv` of the loop. How a cat turns its head: glance, hold. */
const holds = (u, keys, mv = 0.04) => {
  let v = keys[keys.length - 1][1];
  for (const [k, val] of keys) { if (u < k) break; v = lerp(v, val, smoother((u - k) / mv)); }
  return v;
};

/* Posture changes are keyframed: each part of the body (the body itself, head, each leg, tail) has
   its own keys, joined by monotone cubics (Fritsch–Carlson), so a planted paw stays exactly put
   between two equal keys and nothing overshoots; the IK then places the legs on every frame. */
function pchip(us, vs) {
  const n = us.length, m = vs[0].length, d = [], t = [];
  for (let i = 0; i < n - 1; i++) { const h = us[i + 1] - us[i]; d.push(vs[i].map((v, j) => (vs[i + 1][j] - v) / h)); }
  for (let i = 0; i < n; i++) {
    const ti = new Float64Array(m);
    if (i > 0 && i < n - 1) for (let j = 0; j < m; j++) {
      const a = d[i - 1][j], b = d[i][j];
      if (a * b <= 0) continue;
      const h0 = us[i] - us[i - 1], h1 = us[i + 1] - us[i], w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
      ti[j] = (w1 + w2) / (w1 / a + w2 / b);
    }
    t.push(ti);
  }
  return (u, out) => {
    let i = 0; while (i < n - 2 && u > us[i + 1]) i++;
    const h = us[i + 1] - us[i], s = clamp01((u - us[i]) / h), s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    for (let j = 0; j < m; j++) out[j] = h00 * vs[i][j] + h10 * h * t[i][j] + h01 * vs[i + 1][j] + h11 * h * t[i + 1][j];
    return i;
  };
}

// A pose spec, flattened for keyframing: root [lift, shift, side, roll], pelvis/spine/chest [z, y, x],
// neck and head [world pitch, y, x], each leg [toe x, toe y, end angle, twist, dz], tail [4 dirs, 4
// sides]. `roll` turns the whole body over about its long axis after the legs are placed (lying on
// its side or back): legs, neck, head and tail are then given as if the cat were upright.
const PARTS = [["body", 0, 13], ["head", 13, 19], ["hL", 19, 24], ["hR", 24, 29], ["fL", 29, 34], ["fR", 34, 39], ["tail", 39, 47]];
const flat = (s) => Float64Array.from([s.root[0], s.root[1], s.root[2] || 0, s.root[3] || 0, ...s.pelvis, ...s.spine, ...s.chest, ...s.neck, ...s.head, ...KEYS.flatMap((k) => s.legs[k]), ...s.tail]);
const unflat = (v) => ({ root: [v[0], v[1], v[2], v[3]], pelvis: [v[4], v[5], v[6]], spine: [v[7], v[8], v[9]], chest: [v[10], v[11], v[12]], neck: [v[13], v[14], v[15]], head: [v[16], v[17], v[18]],
  legs: { hL: Array.from(v.subarray(19, 24)), hR: Array.from(v.subarray(24, 29)), fL: Array.from(v.subarray(29, 34)), fR: Array.from(v.subarray(34, 39)) }, tail: Array.from(v.subarray(39, 47)) });

/** The knobs a model's fit (makeClips' third argument) may turn down, and the clips each one governs:
    scripts/fit-clips.mjs measures them, one model at a time, on its far and full copies' own skin. */
export const FIT_KNOBS = { gait: ["walk", "trot", "run"], groom: ["groom"], legLick: ["legLick"], earScratch: ["earScratch"], beckon: ["beckon"], hindStand: ["hindStand"], scratch: ["scratch"], flop: ["flop"], roll: ["roll"], sleep: ["sleep", "curlUp", "wake"], stretch: ["stretch"], leap: ["hop", "pounce"], stalk: ["stalk"], dab: ["dab"] };

/**
 * The clip set for one rig, in a cat's own style (optional; see DEFAULT_STYLE). Every leg is posed by
 * where its paw goes (two-bone IK), every tail by where it points, so one set of poses fits
 * long-legged, short-legged and big-headed cats alike: walking paws stay planted while the body passes
 * over them; sitting and lying cats fold their legs onto the ground whatever their length. There is a
 * clip for every action in catmotion.js ACTIONS: gaits (one cycle each, stepped by distance), loops,
 * once-through moves and posture changes (whose first and last frames are the postures' own poses).
 * clip.userData: { loop, kind, posture, dur (s), fade (s: how long a blend into it should take) }.
 */
export function makeClips(rig, style = {}, fit = null) {
  const st = clipStyle(style), tempo = st.tempo;
  // How far this model's own skin lets each mannerism go (FIT_KNOBS: 0.3..1 of the full move, 1 when
  // unsaid), measured offline on the model's own triangles by scripts/fit-clips.mjs (assets/models/cats/fit.json):
  // a paw comes up less far, a body rears or rolls less, a sleeper curls less, a stride is shorter, where the
  // full move would stretch this model's skin into a sheet.
  const amp = (k) => fitOf(fit, k);
  const K = kinematics(rig), lt = rig.legTop, bh = rig.yt - rig.yb;
  const clips = {};
  const S = Math.sin, C = Math.cos, PI = Math.PI;
  const rest = (k) => ({ x: K.legs[k].toe.x, y: 0 });
  const restE = (k) => K.legs[k].a[2];
  // A hind foot laid down (sitting, lying): its toes on the ground and its hock just clear of it, by
  // the leg's own thickness there (a thick-legged cat's foot slopes more).
  const flatE = (k) => -Math.asin(Math.min(0.85, (rig.legs[k].r * 1.1 + 0.006) / K.legs[k].l[2]));
  const leg = (x, y, e, twist = 0, dz = 0) => [x, y, e, twist, dz];
  // A heavy cat (one that sways) stands and walks with its paws a little wider apart.
  const wide = 0.015 * st.sway;
  const planted = (k) => leg(rest(k).x, 0, restE(k), 0, wide);
  // (a model whose skin won't take a full stride (its fit's gait: long fur standing in for a leg, a body
  // on stubs) takes shorter, lower steps, more of them for the ground covered: cyclesPerUnit with the same fit)
  const stride0 = walkStride(rig, st, fit), stepLift = st.lift * amp("gait");
  // How heavy-bodied the cat is (0 slim or ordinary .. 1 round): a round cat can't get a hind paw up
  // to its ear or past its head, and its skin won't stretch that far either.
  const heavy = Math.min(1, clamp01(((rig.bodyW || rig.W * 0.7) / lt - 0.75) / 0.45) + st.sway * 0.4);
  // How big a cartoon head is for the cat (0 an ordinary cat's .. 1 a chibi's): a big head, heavy on a
  // short neck, bows less (swung far down it would go into the body or the ground, and its collar up
  // over its face); it gets down to the ground by crouching instead.
  const headBig = clamp01((rig.headR / Math.max(0.1, lt) - 0.42) / 0.4), bow = 1 - 0.45 * headBig;
  // How stubby the legs are for the body (0 an ordinary cat .. 1 a chibi, or a long-haired cat whose belly
  // fur hangs to its paws): the legs' free length below the belly line against the body's depth. Such a
  // cat's leg bones own its flank and belly skin, which a leg swung far (a paw to the face, the forelegs
  // folded under a crouch, a rearing) would tear; and it is deep-bodied (deep) when its body is round for
  // its height: a ball already, which curls up less.
  const stubby = clamp01((0.6 - rig.yb / Math.max(0.05, bh)) / 0.4), deep = clamp01((rig.bodyR / Math.max(0.1, lt) - 0.4) / 0.25);
  // (all told, how round the cat is: wide, deep or short-legged, its legs' skin one with its flanks)
  const round = clamp01(heavy + 0.6 * Math.max(deep, stubby));
  const clip = (name, dur, fps, fn, ud = {}) => (clips[name] = sampleClip(name, dur, fps, fn, { kind: ACTIONS[name]?.kind, posture: ACTIONS[name]?.posture, ...ud }));
  const loopDur = (s) => s * tempo;
  const T = (dirs, sides) => [...dirs, ...sides];

  // The skin (findRig's sample of it), each bone's reduced to its outermost points (however a bone is
  // turned, the lowest point of its skin is one of them): a lying body and its folded legs rest on the
  // ground by their skin, not by their bones (a fat belly, a thick forearm laid flat, a hock folded
  // under: none sunk into the lawn).
  const AT = { pelvis: rig.pelvis, spine: rig.spine, chest: rig.chest, neck: rig.neck, head: rig.headJoint };
  for (const k of KEYS) { const [a, b, c] = LEG[k]; AT[a] = rig.legs[k].top; AT[b] = rig.legs[k].knee; AT[c] = rig.legs[k].low; }
  const SKIN = {};
  if (rig.skin && rig.skin.bone.length > 40) {
    const by = {}, P = rig.skin.pts, dirs = [];
    rig.skin.bone.forEach((b, i) => (by[b] ||= []).push(i));
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (a || b || c) dirs.push([a, b, c]);
    for (const b in by) {
      const at = AT[b], list = by[b], keep = new Set();
      if (!at) continue;
      for (const [a, bb, c] of dirs) { let best = -Infinity, bi = -1; for (const i of list) { const dd = P[i * 3] * a + P[i * 3 + 1] * bb + P[i * 3 + 2] * c; if (dd > best) { best = dd; bi = i; } } keep.add(bi); }
      SKIN[b] = Float64Array.from([...keep].flatMap((i) => [P[i * 3] - at.x, P[i * 3 + 1] - at.y, P[i * 3 + 2] - at.z]));
    }
  }
  const hasSkin = !!(SKIN.pelvis && SKIN.chest);
  // The lowest point of bone b's skin, the bone turned by q with its joint at height y0.
  const lowB = (b, q, y0) => { const S0 = SKIN[b]; if (!S0) return Infinity; let lo = Infinity; for (let i = 0; i < S0.length; i += 3) { const y = V1.set(S0[i], S0[i + 1], S0[i + 2]).applyQuaternion(q).y; if (y < lo) lo = y; } return lo + y0; };
  const lowTorso = (B) => Math.min(lowB("pelvis", B.qP, B.pel.y), lowB("spine", B.qS, B.spi.y), lowB("chest", B.qC, B.che.y));
  // The lowest point of a leg's skin as posed (p) on the body B.
  const lq1 = new THREE.Quaternion(), lq2 = new THREE.Quaternion(), lq3 = new THREE.Quaternion(), lv = V();
  const legLow = (p, B, k) => {
    const [n1, n2, n3] = LEG[k], g = rig.legs[k], T = B.top[k];
    lq1.fromArray(p[n1].q).premultiply(T.q); lq2.copy(lq1).multiply(qEuler(p[n2], Q2)); lq3.copy(lq2).multiply(qEuler(p[n3], Q2));
    const ky = T.y + lv.subVectors(g.knee, g.top).applyQuaternion(lq1).y, ay = ky + lv.subVectors(g.low, g.knee).applyQuaternion(lq2).y;
    legLow.upper = lowB(n1, lq1, T.y);
    return Math.min(lowB(n2, lq2, ky), lowB(n3, lq3, ay));
  };
  // A resting pose's folded legs, each raised just enough that its skin rests on the ground rather than
  // in it (a forepaw tucked under the chest goes up into the chest's fur, not down into the lawn).
  // (`cap`: at most this much of a raise for a leg: a paw whose fur hangs below it is not held up in the
  // air for the sake of its fur, which the grass hides)
  const bakeLegs = (s, cap = Infinity) => {
    const out = { ...s.legs };
    if (!hasSkin) return out;
    for (let it = 0; it < 2; it++) {
      const p = pose({ ...s, legs: out }), B = body(K, { lift: s.root[0], shift: s.root[1], side: s.root[2], pelvis: s.pelvis, spine: s.spine, chest: s.chest }, s.neck[0]);
      for (const k of KEYS) { const g = out[k]; if (g[1] > 0.25 * lt) continue; const lo = legLow(p, B, k); if (lo < -0.004) out[k] = [g[0], Math.min(s.legs[k][1] + cap, g[1] - 0.002 - lo), g[2], g[3], g[4]]; }
    }
    return out;
  };
  // Rolled over by r, the body goes up (or down) by as much as its skin needs to rest on the ground
  // as it did upright (without a skin sample: the body taken as an ellipse across).
  const halfH = bh / 2, halfW = Math.max(0.06, (rig.bodyW || rig.W * 0.7) / 2);
  const rollLiftOf = (p, r) => {
    if (!r) return 0;
    if (!hasSkin) return Math.sqrt((halfH * C(r)) ** 2 + (halfW * S(r)) ** 2) - halfH;
    // (to rest as low as the plain body, lying straight at that height, would)
    if (p.lift !== refAt) { refAt = p.lift; refLo = lowTorso(body(K, { lift: p.lift, pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0] })); }
    return refLo - lowTorso(body(K, { lift: p.lift, shift: p.shift, side: p.side, pelvis: [p.pelvis[0], p.pelvis[1], p.pelvis[2] + r], spine: p.spine, chest: p.chest }));
  };
  let refAt = NaN, refLo = 0;
  // A spec -> the pose: the body, then the legs by IK, the tail along its curve (off the ground), the
  // head steadied in the world (neck and head pitches are world angles in a spec), then the roll.
  const pose = (s) => {
    const roll = s.root[3] || 0;
    const p = { lift: s.root[0], shift: s.root[1], side: s.root[2], pelvis: s.pelvis.slice(), spine: s.spine.slice(), chest: s.chest.slice() };
    const B = body(K, p, s.neck[0]);
    p.neck = [s.neck[0] - B.aC, s.neck[1], s.neck[2]]; p.head = [s.head[0] - s.neck[0], s.head[1], s.head[2]];
    tailTo(K, p, B, s.tail.slice(0, 4), s.tail.slice(4, 8));
    // Rolled over, no paw goes below the ground: one that would is lifted straight up (in the world)
    // just clear of it, so it neither sinks in nor scrapes along.
    const sr = S(roll), cr = C(roll), pelY = K.P0.y + s.root[0], pelZ = K.P0.z + (s.root[2] || 0), rl = rollLiftOf(p, roll);
    const lifted = {};
    for (const k of KEYS) {
      const g = s.legs[k], L = K.legs[k];
      let y = g[1], dz = g[4];
      if (roll) {
        const yw = pelY + rl + (y - pelY) * cr - (L.toe.z + L.side * dz - pelZ) * sr;
        if (yw < 0.012) { const up = 0.012 - yw; y += up * cr; dz -= up * sr * L.side; }
      }
      lifted[k] = [y, dz];
      legTo(K, p, B, k, { x: g[0], y }, g[2], g[3], dz);
    }
    // (and rolled over, a leg's skin too, not only its toe: a long leg or a fat paw laid out along the
    // ground would otherwise lie in it; the leg is lifted straight up in the world by what it lacks)
    if (roll && hasSkin) {
      const BR = body(K, { lift: p.lift + rl, shift: p.shift, side: p.side, pelvis: [p.pelvis[0], p.pelvis[1], p.pelvis[2] + roll], spine: p.spine, chest: p.chest }, s.neck[0]);
      for (const k of KEYS) {
        const lo = Math.min(legLow(p, BR, k), legLow.upper);
        if (lo < 0.008) { const g = s.legs[k], L = K.legs[k], up = Math.min(0.15, 0.012 - lo), [y, dz] = lifted[k]; legTo(K, p, B, k, { x: g[0], y: y + up * cr }, g[2], g[3], dz - up * sr * L.side); }
      }
    }
    if (roll) { p.pelvis[2] += roll; p.lift += rl; }
    groundTail(p);
    return p;
  };
  // The tail lies along the ground rather than going into it: walking the tail in the world, a
  // segment whose end would be below the ground swings up (about the level line across it) just
  // enough to rest on it.
  const TREST = [1, 2, 3, 4].map((k) => V().subVectors(rig.tail[k], rig.tail[k - 1])), TB = V().subVectors(K.T0, K.P0);
  const tq = new THREE.Quaternion(), tw = new THREE.Quaternion(), tl = new THREE.Quaternion(), tv = V(), tn = V(), tp = V();
  // While a posture change is sampled (key by key, in order) each segment remembers which way it
  // went across the ground, and one lying on the ground turns from there at most TM.lim a key: a
  // tail uncurling round the body sweeps round along the ground instead of flicking from one side
  // to the other as a segment passes the vertical. (Free again near the end: it ends on the pose.)
  const TM = { on: false, lim: 0.35, dir: new Float64Array(8), has: [false, false, false, false] };
  const groundTail = (p) => {
    if (K.stub) return;
    const clear = rig.tailR + 0.004;
    qEuler(p.pelvis, tw);
    tp.copy(TB).applyQuaternion(tw).add(V1.set(K.P0.x + (p.shift || 0), K.P0.y + (p.lift || 0), K.P0.z + (p.side || 0)));
    // Which way along the ground a segment that meets it goes: its own way, but a segment hanging
    // nearly straight down leans on the way the one before it went (else a hair's difference between
    // two frames would lay it down forwards in one and backwards in the next, and in between it
    // would stab into the ground).
    let px = -1, pz = 0;
    for (let k = 0; k < 4; k++) {
      const name = `tail${k + 1}`, r = p[name];
      if (r.q) tl.fromArray(r.q); else qEuler(r, tl);
      tq.copy(tw).multiply(tl);
      tv.copy(TREST[k]).applyQuaternion(tq);
      const l = tv.length(), want = clear - tp.y;
      if (tp.y + tv.y < clear && l > 1e-6) {
        // (Leaning only as much as it is laid out: one that just grazes the ground keeps its way.)
        const h0 = Math.hypot(tv.x, tv.z) / l, vy = Math.max(-l, Math.min(l, want)), h1 = Math.sqrt(Math.max(0, l * l - vy * vy)) / l;
        const lean = 2 * l * Math.max(0, h1 - h0) * Math.max(0, 1 - h0 / 0.6);
        let hx = tv.x + px * lean, hz = tv.z + pz * lean;
        if (TM.on && TM.has[k]) {
          const a0 = Math.atan2(TM.dir[k * 2 + 1], TM.dir[k * 2]), d = Math.atan2(hz, hx) - a0, w = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.abs(w) > TM.lim) { const a = a0 + Math.sign(w) * TM.lim, m = Math.hypot(hx, hz); hx = Math.cos(a) * m; hz = Math.sin(a) * m; }
        }
        const hs = (h1 * l) / Math.max(1e-6, Math.hypot(hx, hz));
        tn.set(hx * hs, vy, hz * hs);
        tq.premultiply(Q2.setFromUnitVectors(V2.copy(tv).divideScalar(l), tn.divideScalar(l)));
        p[name] = { q: tl.copy(tw).invert().multiply(tq).toArray() };
        tv.copy(TREST[k]).applyQuaternion(tq);
      }
      // (Only a segment that really goes somewhere along the ground steers the next: a steep one's
      // way across flips about as it passes the vertical.)
      const hv = Math.hypot(tv.x, tv.z), sw = Math.max(0, Math.min(1, (hv / Math.max(1e-6, tv.length()) - 0.3) / 0.5));
      if (TM.on && hv > 0.08 * tv.length()) { TM.dir[k * 2] = tv.x / hv; TM.dir[k * 2 + 1] = tv.z / hv; TM.has[k] = true; }
      if (sw > 0) { const qx = px + (tv.x / hv - px) * sw, qz = pz + (tv.z / hv - pz) * sw, ql = Math.hypot(qx, qz); if (ql > 1e-6) { px = qx / ql; pz = qz / ql; } }
      tp.add(tv); tw.copy(tq);
    }
  };
  // A spec drawn part of the way (wa) to A and (wb) to B: for once-through moves to begin and end
  // exactly on their posture's own pose.
  const settle = (s, A, wa, B, wb) => {
    if (wa <= 0 && wb <= 0) return s;
    const v = flat(s), a = flat(A), b = flat(B);
    for (let i = 0; i < v.length; i++) v[i] = v[i] + (a[i] - v[i]) * wa + (b[i] - v[i]) * wb;
    return unflat(v);
  };
  /* Mannerisms that take a cat out of its posture's plain pose (a paw up to wash, a hind leg up to lick,
     over onto its side, up on its hind legs). Blended straight from the plain pose, joint angles mixed,
     a raised paw swings out wide on its way and a body rolling over sinks through the ground; so each
     such loop's clip begins on the plain pose and goes into the move the way a cat does (a paw lifted
     clear and carried up, the body rolled over as a body rolls), `enter` seconds, and then loops the
     move itself; and the way out is a clip of its own (exitFor), made for the very moment the cat is at,
     back to the plain pose or on into the next mannerism of the same posture. */
  const with_ = (base, o) => ({ ...base, ...o, legs: { ...base.legs, ...(o.legs || {}) } });
  const POSED = {};
  // Two specs mixed, w of the way from A to B. A leg that goes somewhere moves as a leg does, about its
  // hip or shoulder (never straight through it, where the knee would flip over): folding in, it folds
  // first and then swings round (a paw leaves the ground and then travels); reaching out, it swings
  // first and then straightens (a paw comes over its place and then down onto it). It swings round
  // by the front, never up over the back.
  // (`lift`, per leg: a paw taken off the ground up to a raised place, or put back, is drawn in towards
  // the body on its way, by that share of the leg's reach half way, as a paw is picked up: swung straight
  // out along its arc it would sweep low over the lawn, and a furry cat's forelegs drag their fur into
  // a sheet between them.)
  const mixV = new Float64Array(47);
  const mix = (A, B, w, lift = null) => {
    const a = flat(A), b = flat(B), v = mixV;
    for (let i = 0; i < 47; i++) v[i] = a[i] + (b[i] - a[i]) * w;
    const BA = bodyOf(A), BB = bodyOf(B), BM = bodyOf(unflat(v));
    for (const [k, i0] of PARTS.slice(2, 6)) {
      if (Math.hypot(b[i0] - a[i0], b[i0 + 1] - a[i0 + 1]) < 0.03 * lt) continue;
      const ha = BA.top[k], hb = BB.top[k], hm = BM.top[k], L = K.legs[k];
      const ax = a[i0] - ha.x, ay = a[i0 + 1] - ha.y, bx = b[i0] - hb.x, by = b[i0 + 1] - hb.y;
      const ra = Math.hypot(ax, ay), rb = Math.hypot(bx, by), ta = Math.atan2(ay, ax), tb = Math.atan2(by, bx);
      let wr = w, wt = w;
      // (but a leg folding right up, to under half its reach (a paw brought to the face), goes straight there,
      // radius and angle together: folded first, its elbow would stick out behind and drag the flank's skin)
      if (Math.abs(rb - ra) > 0.08 * L.reach && !(rb < ra && rb < 0.55 * L.reach)) { const early = smooth(w / 0.65), late = smooth((w - 0.35) / 0.65); if (rb < ra) { wr = early; wt = late; } else { wr = late; wt = early; } }
      // (such a paw comes up under the chest first, then reaches out: its swing round a little late)
      const lk = lift && lift[k] ? lift[k] : 0;
      if (lk) wt = rb > ra - 0.3 * L.reach && tb > ta ? smooth((w - 0.2) / 0.8) : wt;
      const r = ra + (rb - ra) * wr - lk * L.reach * S(PI * w), th = ta + (tb - ta) * wt;
      v[i0] = hm.x + r * C(th); v[i0 + 1] = hm.y + r * S(th);
      for (let j = 2; j < 5; j++) v[i0 + j] = a[i0 + j] + (b[i0 + j] - a[i0 + j]) * wt;
    }
    return unflat(v);
  };
  /** A mannerism: `spec(u)` its pose at u (0..1) round its cycle of `cyc` s, `base` the plain pose it
      starts from and ends on; o.enter / o.exit: how long its way in and out take (s), o.to: {mannerism:
      s} for a way straight on into another. */
  const posed = (name, cyc, fps, spec, base, o = {}) => {
    const enter = (o.enter ?? 0.5) * Math.min(1.25, tempo), dur = enter + cyc;
    const at = (t) => {
      const s = spec(((((t - enter) / cyc) % 1) + 1) % 1);
      return t >= enter ? s : mix(base, s, smoother(t / enter), o.lift);
    };
    POSED[name] = { at, cyc, enter, dur, base, exit: o.exit ?? 0.45, to: o.to || {}, posture: ACTIONS[name].posture, lift: o.lift || null };
    clip(name, dur, fps, (v) => pose(at(v * dur)), { fade: o.fade ?? 0.2, enter, cyc, exits: true });
    POSED[name].times = clips[name].tracks[0].times;
  };
  // The way out of a mannerism from `t` s into its clip: the move carries on as it eases back to the
  // plain pose (or into the loop of mannerism `to`, arriving at its cycle's start), so it leaves at the
  // speed it was going and arrives at rest. Made when first wanted; the last few are kept.
  const exits = new Map();
  const exitFor = (name, t, to = null) => {
    const P = POSED[name];
    if (!P) return null;
    const Q = to && to !== name && POSED[to]?.posture === P.posture ? POSED[to] : null, k = Math.round(Math.min(P.dur, Math.max(0, t)) * 30);
    const key = `exit:${name}:${k}:${Q ? to : "base"}`;
    let c = exits.get(key);
    if (c) return c;
    const t0 = k / 30, dur = Q ? P.to[to] ?? Math.max(P.exit, Q.enter) : P.exit;
    const wrapP = (tt) => (tt < P.dur ? tt : P.enter + ((tt - P.enter) % P.cyc));
    // (the mannerism's own keys up to this moment are posed first (sampleClip's warm), so the way out
    // begins exactly on the clip's frame: a leg folded near its hip keeps the way it was going)
    const tw = wrapP(t0), warm = () => { FOLD.on = true; let prev = 0; for (const t of P.times) { if (t >= tw - 1e-6) break; FOLD.dt = t - prev; pose(P.at(t)); prev = t; } FOLD.on = false; return Math.max(1e-3, tw - prev); };
    c = sampleClip(key, dur, 30, (v) => {
      const B = Q ? Q.at(Q.enter + (((((v - 1) * dur) % Q.cyc) + Q.cyc) % Q.cyc)) : P.base;
      return pose(mix(P.at(wrapP(t0 + v * dur)), B, smoother(v), Q ? null : P.lift));
    }, { loop: false, kind: "once", posture: P.posture, dur, fade: 0.1, exitOf: name, into: Q ? to : null, at: Q ? Q.enter : 0 }, warm);
    // (and its first key is the mannerism's own frame at that moment, between two of its keys as the
    // mixer shows it, so the way out begins on the very frame on screen)
    for (const tr of c.tracks) { const src = clips[name].tracks.find((t) => t.name === tr.name); if (src) tr.values.set(src.createInterpolant().evaluate(tw), 0); }
    exits.set(key, c);
    if (exits.size > 12) exits.delete(exits.keys().next().value);
    return c;
  };
  Object.defineProperty(clips, "exitFor", { value: exitFor, enumerable: false });
  const bodyOf = (s, rolled = false) => {
    const p = { lift: s.root[0], shift: s.root[1], side: s.root[2], pelvis: s.pelvis, spine: s.spine, chest: s.chest }, r = rolled ? s.root[3] || 0 : 0;
    if (r) { p.lift += rollLiftOf(p, r); p.pelvis = [s.pelvis[0], s.pelvis[1], s.pelvis[2] + r]; }
    return body(K, p, s.neck[0]);
  };
  // A point on the head (given in the model's rest coordinates) in the world, for a posed spec.
  const headPoint = (s, pt) => {
    const B = bodyOf(s, true);
    const qN = qEuler([s.neck[0] - B.aC, s.neck[1], s.neck[2]], new THREE.Quaternion()).premultiply(B.qC);
    const qH = qEuler([s.head[0] - s.neck[0], s.head[1], s.head[2]], new THREE.Quaternion()).premultiply(qN);
    const hed = V().subVectors(K.H0, K.N0).applyQuaternion(qN).add(B.nec);
    return V().subVectors(pt, K.H0).applyQuaternion(qH).add(hed);
  };

  // How far to lower the body so every paw can reach the ends of a stance `sweep` long (a model's
  // legs are straight at rest, so a cat walks on slightly bent legs, as real cats do).
  const bend = (sweep) => {
    let need = 0;
    for (const k of KEYS) {
      const L = K.legs[k], off = Math.abs(L.toe.x - L.top.x) + sweep / 2, r = 0.95 * L.reach;
      need = Math.max(need, L.top.y - Math.sqrt(Math.max(0, r * r - off * off)));
    }
    return Math.max(0, need);
  };
  // How far to lift (or drop) a pose so the lowest point of the body's underside sits at `clear`.
  // (by its skin, the body bent as given: `sp`, `ch` the spine's and chest's pitch; else by the rig's
  // underside line)
  const ground = (pitch, clear = 0.012, sp = 0, ch = 0) => {
    if (hasSkin) return clear - 0.008 - lowTorso(body(K, { lift: 0, pelvis: [pitch, 0, 0], spine: [sp, 0, 0], chest: [ch, 0, 0] }));
    let lo = Infinity;
    for (const q of rig.under) { const [, dy] = rot2(q.x - K.P0.x, q.y - K.P0.y, pitch); lo = Math.min(lo, K.P0.y + dy); }
    return clear - lo;
  };
  // (As ground, for a spec whose body is also yawed or rolled: the lift that rests its torso's skin at
  // `clear`; a rump rolled onto one haunch would otherwise dip its side into the lawn.)
  const groundAt = (s, clear = 0.012) => (hasSkin ? clear - 0.008 - lowTorso(body(K, { lift: 0, shift: s.root[1], side: s.root[2], pelvis: s.pelvis, spine: s.spine, chest: s.chest })) : ground(s.pelvis[0], clear, s.spine[0], s.chest[0]));
  // The neck pitch (in the world) that puts the head joint at height y.
  const Ln = Math.hypot(K.H0.x - K.N0.x, K.H0.y - K.N0.y), phi0 = Math.atan2(K.H0.y - K.N0.y, K.H0.x - K.N0.x);
  const neckFor = (B, y) => Math.asin(Math.max(-1, Math.min(1, (y - B.nec.y) / Ln))) - phi0;
  const restHed = K.H0.y;

  /** The tail's carriage: -0.4 tucked low, 0 a relaxed low curve (the tip turning up), 1 straight up
      with the tip hooked over (a friendly greeting). Four segment directions. */
  const tailShape = (c) => {
    const LOW = [PI + 1.05, PI + 0.8, PI + 0.55, PI + 0.35], MID = [PI + 0.45, PI + 0.2, PI - 0.1, PI - 0.35], UP = [PI / 2 + 0.22, PI / 2 + 0.05, PI / 2 - 0.3, PI / 2 - 1.05];
    return c < 0 ? lerpN(MID, LOW, Math.min(1, -c / 0.4)) : lerpN(MID, UP, Math.min(1, c));
  };
  const tailSway = (u, amp, lag = 0.7) => [0, amp * 0.5 * S(TAU * u - lag), amp * 0.8 * S(TAU * u - 2 * lag), amp * S(TAU * u - 3 * lag)];

  /* ── Gaits ── */
  // Each paw is planted for `duty` of the cycle and slides back under the body as the body moves on
  // (so it stays still on the ground), then swings forward in an arc. The head is held level and
  // steady (the neck takes up the body's bob, pitch and sway), the hips and shoulders roll gently
  // over the leg that carries them, and the tail sways a beat behind.
  const gaitSpec = (u, g) => {
    const stride = stride0 / g.rate, sweep = stride * g.duty;
    // (a stubby or deep-bodied cat creeps less low: its folded forelegs would drag its flank)
    const lower = (g.crouch * (1 - 0.6 * round) + st.crouch * 0.5) * lt + bend(sweep);
    const bob = g.bob * st.bob * lt, sway = 1 + st.sway * 2.5;
    const lift = -lower - bob * (1 - C(TAU * (u - (g.hi ?? 0.31)) * (g.bobs ?? 2))) / 2;
    const rollP = g.roll * sway * C(TAU * (u - (g.rollAt ?? 0.81))), yawP = g.yaw * sway * C(TAU * u);
    const rollC = g.roll * 0.7 * C(TAU * (u - (g.rollAt ?? 0.81) + 0.25)), yawC = g.yaw * 0.8 * C(TAU * (u - 0.75));
    const flexW = g.flex ? C(TAU * (u + 0.05)) : 0; // gallop: back rounded (+) as the hind legs come under, stretched (-) at full reach
    const pelvis = [g.flex * flexW * 0.45, yawP, rollP], spine = [g.flex * flexW * 0.25, 0, 0], chest = [-g.flex * flexW * 1.15, yawC - yawP, rollC - rollP];
    const B0 = body(K, { lift, pelvis, spine, chest }, 0);
    const yh = restHed - lower * (g.headLow ?? 0.85) - bob * 0.25 + st.head * 0.12 * lt - (g.headDrop || 0) * lt;
    // (the head is held, not frozen: a slight nod twice a stride, a beat after the body's)
    const nod = (g.nod || 0) * C(TAU * (u - (g.hi ?? 0.31) - 0.1) * 2);
    const spec = { root: [lift, 0, 0], pelvis, spine, chest, neck: [neckFor(B0, yh), -yawC * 0.9, -rollC * 0.8], head: [-0.06 + st.head * 0.4 + (g.headPitch || 0) + nod, 0, 0], legs: {}, tail: null };
    for (const k of KEYS) {
      const L = K.legs[k], f = (((u + g.phase[k]) % 1) + 1) % 1, r0 = rest(k);
      let x, y, e = L.a[2];
      if (f < g.duty) { x = r0.x + sweep * (0.5 - f / g.duty); y = 0; }
      else {
        const s = (f - g.duty) / (1 - g.duty), sh = g.swing ? g.swing(s) : [smooth(s), S(PI * s) ** 0.8];
        x = r0.x + sweep * (sh[0] - 0.5); y = g.lift * stepLift * lt * sh[1]; e = L.a[2] + (L.hind ? 0.45 : -0.6) * S(PI * s) * amp("gait");
      }
      spec.legs[k] = leg(x, y, e, 0, wide);
    }
    const dirs = tailShape(Math.max(-0.45, Math.min(1, st.tail + (g.tail || 0)))).map((a, i) => a + (g.tailWave || 0) * S(TAU * u * 2 - i * 0.9));
    spec.tail = T(dirs, g.tailSides ? g.tailSides(u) : tailSway(u, g.tailSway ?? 0.22, 0.7));
    return spec;
  };
  const gait = (u, g) => pose(gaitSpec(u, g));
  const FPS = 32;
  const GAITS = {
    walk: { rate: GAIT_RATE.walk, duty: 0.62, lift: 0.1, phase: { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 }, crouch: 0, bob: 0.016, roll: 0.035, yaw: 0.05, tail: -0.05, nod: 0.026 },
    trot: { rate: GAIT_RATE.trot, duty: 0.45, lift: 0.16, phase: { hL: 0, fR: 0, hR: 0.5, fL: 0.5 }, crouch: 0, bob: 0.024, roll: 0.025, yaw: 0.035, rollAt: 0.75, tail: 0.1, tailSway: 0.14, nod: 0.02 },
    run: { rate: GAIT_RATE.run, duty: 0.32, lift: 0.22, phase: { hL: 0, hR: 0.1, fR: 0.4, fL: 0.52 }, crouch: 0, flex: 0.2, bob: 0.05, bobs: 1, hi: 0.93, roll: 0.02, yaw: 0.02, tail: -0.1, tailWave: 0.06, headLow: 1, headPitch: -0.04,
      tailSides: (u) => [0, 0.04 * S(TAU * u), 0.06 * S(TAU * u - 0.8), 0.08 * S(TAU * u - 1.6)] },
    // Stalking: low and slow, each paw lifted, held and placed with care; head low, level and still;
    // tail low, only its tip twitching.
    stalk: { rate: GAIT_RATE.stalk, duty: 0.74, lift: 0.08, phase: { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 }, crouch: 0.28 * amp("stalk"), bob: 0.004, roll: 0.02, yaw: 0.02, tail: -0.35, headLow: 1, headDrop: 0.12, headPitch: 0.1,
      swing: (s) => [smoother((s - 0.12) / 0.76), S(PI * Math.min(1, s * 1.15)) ** 0.5],
      tailSides: (u) => [0, 0, 0.04 * S(TAU * u), 0.3 * S(TAU * u * 3) * S(TAU * u * 2)] },
  };
  for (const [name, g] of Object.entries(GAITS)) clip(name, 1, FPS, (u) => gait(u, g));
  /* ── Standing ── */
  // The glances of an idle cat: head still, a quick turn to look, a hold, back again.
  const glance = (u, a = 0.3) => holds(u, [[0.18, a], [0.4, -a * 0.6], [0.62, 0], [0.8, a * 0.4], [0.93, 0]]);
  const tilt = (u, a = 0.12) => holds(u, [[0.42, a], [0.58, 0]], 0.05);
  const standSpec = (u = 0, o = {}) => {
    const br = S(TAU * u * 3), g = o.still ? 0 : glance(u, 0.28);
    return { root: [br * 0.002, 0, 0], pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [br * 0.01, 0, 0],
      neck: [st.head * 0.5, g, 0], head: [-0.03 + st.head * 0.3, g * 0.4, o.still ? 0 : tilt(u, 0.1)],
      legs: { hL: planted("hL"), hR: planted("hR"), fL: planted("fL"), fR: planted("fR") },
      tail: T(tailShape(st.tail).map((a) => a + 0.04 * S(TAU * u)), [0, 0.12 * S(TAU * u), 0.2 * S(TAU * u - 0.8), 0.26 * S(TAU * u - 1.6)]) };
  };
  const STAND = standSpec(0);
  clip("stand", loopDur(8), 10, (u) => pose(standSpec(u)));
  // Turning on the spot: the paws step round the body's middle in turn, each planted where it lands
  // while the body turns over it (in the body's frame it goes round the other way, so on the ground
  // it stays put), then lifted and set down further round. One cycle is PIVOT_TURN of a turn to the
  // left; the renderer steps it by the angle turned, backwards for a turn to the right.
  clip("pivot", 1, FPS, (u) => {
    const duty = 0.62, ph = { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 }, th = PIVOT_TURN * duty;
    const cx = 0, cz = 0; // (the body turns about its origin, where the sim places the cat)
    const lower = bend(0.12), s0 = standSpec(0, { still: true });
    const spec = { ...s0, root: [-lower, 0, 0], legs: {} };
    spec.neck = [neckFor(body(K, { lift: -lower, pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0] }), restHed - lower * 0.85), 0, 0];
    for (const k of KEYS) {
      const L = K.legs[k], f = (((u + ph[k]) % 1) + 1) % 1, rx = rest(k).x - cx, rz = L.toe.z + L.side * wide - cz;
      let b, y = 0, e = L.a[2];
      if (f < duty) b = th * (0.5 - f / duty);
      else { const w = (f - duty) / (1 - duty); b = th * (smooth(w) - 0.5); y = 0.08 * stepLift * lt * S(PI * w) ** 0.8; e += (L.hind ? 0.35 : -0.45) * S(PI * w); }
      const x = cx + rx * C(b) + rz * S(b), zz = cz - rx * S(b) + rz * C(b);
      spec.legs[k] = leg(x, y, e, 0, (zz - L.toe.z) * L.side);
    }
    return pose(spec);
  }, { kind: "gait", posture: "move" });
  clip("sniff", loopDur(3), 15, (u) => { const s = standSpec(u, { still: true }); s.root[0] = -0.02 - 0.1 * headBig * lt; s.chest = [-0.12 - 0.08 * headBig, 0, 0]; s.neck = [-1.0 * bow + S(TAU * u * 3) * 0.06, S(TAU * u * 2) * 0.3, 0]; s.head = [-0.55 * bow + S(TAU * u * 11) * 0.04, S(TAU * u * 2) * 0.15, 0]; return pose(s); }, { fade: 0.3 });
  clip("greet", loopDur(3), 15, (u) => { const s = standSpec(u, { still: true }); s.neck = [0.14, S(TAU * u) * 0.12, S(TAU * u) * 0.08]; s.head = [0.08, S(TAU * u) * 0.15, S(TAU * u * 2) * 0.08];
    s.tail = T(tailShape(1).map((a, i) => a + (i === 3 ? S(TAU * u * 2) * 0.2 : 0)), [0, 0.05 * S(TAU * u), 0.1 * S(TAU * u - 0.6), 0.2 * S(TAU * u - 1.2)]); return pose(s); }, { fade: 0.3 });
  clip("eat", loopDur(1.4), 20, (u) => { const s = standSpec(0, { still: true }); s.root[0] = -0.03 - 0.14 * headBig * lt; s.chest = [-0.18 - 0.1 * headBig, 0, 0]; s.neck = [-1.2 * bow, 0, 0]; s.head = [-0.85 * bow - Math.max(0, S(TAU * u * 2)) * 0.12, 0, 0]; return pose(s); }, { fade: 0.35 });
  // Cheek rub: the head pushed forward and to one side, rubbed along, then the other cheek; the body
  // leans in, the tail up.
  posed("headBunt", loopDur(2.6), 15, (u) => {
    const s = standSpec(u, { still: true }), side = holds(u, [[0.05, 1], [0.5, -1]], 0.12), push = S(PI * ((u * 2) % 1)) ** 2;
    s.root[1] = 0.03 * push; s.chest = [-0.06 - 0.06 * push, side * 0.08, 0]; s.pelvis = [0, 0, side * 0.03];
    s.neck = [-0.25 - 0.15 * push, side * (0.25 + 0.25 * push), side * 0.2]; s.head = [-0.25 - 0.2 * push, side * 0.35, side * (0.35 + 0.2 * push)];
    s.tail = T(tailShape(Math.max(0.6, st.tail)), [0, 0.05 * S(TAU * u), 0.1 * S(TAU * u - 0.6), 0.2 * S(TAU * u - 1.2)]);
    return s;
  }, STAND, { enter: 0.45, exit: 0.4 });
  // Up on the hind legs to see over something: body upright, forepaws curled in front of the chest.
  posed("hindStand", loopDur(3), 12, (u) => {
    // (sat up like a meerkat: the hocks down flat on the ground where the feet stood, the hips just above
    // them, so the thighs stay folded rather than turning a right angle against the hips; a big cartoon
    // head, heavy up top, rears up less: bolt upright it reads as falling over backwards)
    // (a cat whose skin won't take the full rear (its fit) sits up less far, its hips lower, nearer a sit)
    const s = standSpec(u, { still: true }), rear = 1.1 * (1 - 0.45 * headBig) * (1 - 0.35 * round) * amp("hindStand"), b = S(TAU * u) * 0.03;
    const Bq = body(K, { pelvis: [rear, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0] }, 0);
    const hipX = (Bq.top.hL.x + Bq.top.hR.x) / 2, footX = (rest("hL").x + rest("hR").x) / 2;
    const hh = (K.legs.hL.l[0] + K.legs.hL.l[1]) * lerp(0.55, 0.8 - 0.15 * round, amp("hindStand")) + rig.legs.hL.r;
    s.root = [-(Bq.top.hL.y - hh), footX - hipX - 0.02 - 0.1 * lt, 0]; s.pelvis = [rear + b, 0, S(TAU * u) * 0.02]; s.spine = [0.05, 0, 0]; s.chest = [0.05 - b, 0, 0];
    const g = holds(u, [[0.1, 0.5], [0.45, -0.4], [0.8, 0]], 0.06);
    s.neck = [0.35, g, 0]; s.head = [0.1, g * 0.4, 0];
    for (const k of ["hL", "hR"]) s.legs[k] = leg(rest(k).x, 0.012, flatE(k), 0.25);
    const B = bodyOf(s);
    for (const k of ["fL", "fR"]) { const t = B.top[k], R = K.legs[k].reach, bat = k === "fL" ? S(TAU * u * 2) * 0.01 : 0; s.legs[k] = leg(t.x + R * 0.28, t.y - R * 0.42 + bat, -PI / 2 - 0.5); }
    s.tail = T([PI + 0.5, PI + 0.9, PI + 0.3, PI - 0.1], [0, 0.1 * S(TAU * u), 0.2 * S(TAU * u - 0.8), 0.3 * S(TAU * u - 1.6)]);
    return s;
  }, STAND, { enter: 0.65, exit: 0.55 });

  /* ── Sitting ── */
  // Sitting: the bottom on the ground, the body pitched up until the front legs (nearly straight)
  // reach the ground, the hind legs folded with the feet flat forward on the ground where they stood,
  // the tail round the paws. A regal cat sits taller (sitTall), a slumped one lower.
  const reachF = (K.legs.fL.reach + K.legs.fR.reach) / 2, lh3 = (K.legs.hL.l[2] + K.legs.hR.l[2]) / 2;
  const hindX = (rest("hL").x + rest("hR").x) / 2;
  const tallFrac = 0.8 + 0.16 * st.sitTall;
  // (and the hips no higher than the folded hind legs hold them, hocks on the ground: a deep body
  // pitched up on its rump would otherwise stand the cat on its hind feet)
  const hipMax = 0.75 * (K.legs.hL.l[0] + K.legs.hL.l[1]) + rig.legs.hL.r;
  let aWant = null, aCap = 0.05, aHip = 0.05;
  for (let a = 0.05; a <= 1.051; a += 0.02) {
    const B = body(K, { lift: ground(a), pelvis: [a, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0] }), y = (B.top.fL.y + B.top.fR.y) / 2;
    if (y <= reachF * 0.97) aCap = a;
    if ((B.top.hL.y + B.top.hR.y) / 2 <= hipMax) aHip = a;
    if (aWant === null && y > reachF * tallFrac) aWant = a;
  }
  let sitPitch = Math.max(0.05, Math.min(aWant ?? 1.05, aCap, aHip)), sitBend = 0;
  // A cat sits with its back well up (40 degrees and more; a regal one near upright). A long body
  // on short legs can't pitch up that far in one straight line (its shoulders would rise past
  // where its forelegs reach the ground), so, as such a cat does, its back curves: the rump and
  // loins steep, the chest leaning back less.
  const aMin = Math.min(0.7 + 0.25 * st.sitTall, Math.max(0.3, aHip));
  if (sitPitch < aMin) {
    const sh = (b) => { const B = body(K, { lift: ground(aMin), pelvis: [aMin, 0, 0], spine: [-b, 0, 0], chest: [-0.6 * b, 0, 0] }); return (B.top.fL.y + B.top.fR.y) / 2; };
    let b = 0;
    while (b < (aMin - 0.15) / 1.6 && sh(b) > reachF * tallFrac) b += 0.02;
    sitPitch = aMin; sitBend = b;
  }
  const sitSpine = 0.04 - sitBend, sitChest = 0.02 - 0.6 * sitBend;
  let sitLift = ground(sitPitch, 0.012, sitSpine, sitChest);
  const sitBody = { lift: sitLift, pelvis: [sitPitch, 0, 0], spine: [sitSpine, 0, 0], chest: [sitChest, 0, 0] };
  const sitB0 = body(K, sitBody);
  let sitShift = hindX - ((sitB0.top.hL.x + sitB0.top.hR.x) / 2 + 0.95 * lh3);
  let sitB = body(K, { ...sitBody, shift: sitShift });
  const sitFront = (k) => { const t = sitB.top[k], R = K.legs[k].reach * 0.985; return t.x + Math.sqrt(Math.max(0, R * R - t.y * t.y)) + 0.005; };
  const sitHead = [0.25 * sitPitch + 0.06 + (st.sitTall - 0.5) * 0.2 + st.head * 0.5, 0.25 * sitPitch - 0.04 + (st.sitTall - 0.5) * 0.1 + st.head * 0.3];
  const SIT_TAIL = [PI + 1.25, PI + 0.25, PI - 0.05, PI - 0.1], SIT_SIDE = [0, 0.5, 0.7, 0.6];
  let sitLegs = null;
  const sitSpec = (u = 0, o = {}) => {
    const br = S(TAU * u * 3), g = o.still ? 0 : glance(u, 0.3);
    return { root: [sitLift, sitShift, 0], pelvis: [sitPitch, 0, 0], spine: [sitSpine + br * 0.01, 0, 0], chest: [sitChest, 0, 0],
      neck: [sitHead[0], g, 0], head: [sitHead[1], g * 0.5, o.still ? 0 : tilt(u, 0.12)],
      legs: sitLegs ? { ...sitLegs } : { hL: leg(rest("hL").x, 0.012, Math.min(-0.22, flatE("hL")), 0.2), hR: leg(rest("hR").x, 0.012, Math.min(-0.22, flatE("hR")), 0.2), fL: leg(sitFront("fL"), 0, restE("fL")), fR: leg(sitFront("fR"), 0, restE("fR")) },
      tail: T(SIT_TAIL, [SIT_SIDE[0], SIT_SIDE[1], SIT_SIDE[2] + S(TAU * u) * 0.08, SIT_SIDE[3] + S(TAU * u * 2) * 0.15]) };
  };
  // (A long-legged cat whose hips sit low, its rump on the ground: with a hock right under the hip, or
  // behind it, the hind leg folds flat and its knee goes through the ground. The hocks go forward of the
  // hips, the body a little further back over its feet, until both knees clear the ground; the body
  // comes up for what is left. Then each folded leg is rested on the ground by its skin, not its bones.)
  // (the knee, and how far the hock lies below the hip: a hock up at the hip's height folds the leg
  // backwards, the knee behind the hip)
  const foldOf = (p, B, k) => { const g = rig.legs[k], T = B.top[k]; lq1.fromArray(p[LEG[k][0]].q).premultiply(T.q); lq2.copy(lq1).multiply(qEuler(p[LEG[k][1]], Q2)); const ky = T.y + lv.subVectors(g.knee, g.top).applyQuaternion(lq1).y; return [ky, T.y - (ky + lv.subVectors(g.low, g.knee).applyQuaternion(lq2).y)]; };
  const hindCap = 0.02 + 0.5 * (rig.legs.hL.r + rig.legs.hR.r) / 2;
  sitLegs = bakeLegs(sitSpec(0), hindCap);
  for (let it = 0, back = 0; it < 24; it++) {
    const s = sitSpec(0, { still: true }), p = pose(s), B = bodyOf(s), L = foldOf(p, B, "hL"), R = foldOf(p, B, "hR");
    const knee = Math.min(L[0], R[0]), drop = Math.min(L[1], R[1]), want = 0.1 * (K.legs.hL.l[0] + K.legs.hL.l[1]);
    if (knee >= 0.02 && drop >= want) break;
    if (back < 0.3 * lt) { sitShift -= 0.03 * lt; back += 0.03 * lt; } else sitLift += Math.max(0.02 - knee, want - drop, 0.01);
    sitB = body(K, { ...sitBody, lift: sitLift, shift: sitShift });
    sitLegs = null; sitLegs = bakeLegs(sitSpec(0), hindCap);
  }
  const SIT = sitSpec(0);
  clip("sit", loopDur(8), 10, (u) => pose(sitSpec(u)));
  // (a cat with a deep ruff for its head turns its head less far: the ruff's skin would twist with it)
  const lookK = 1 - 0.4 * clamp01((rig.bodyR / Math.max(0.05, rig.headR) - 1.6) / 1.4);
  clip("look", loopDur(6), 12, (u) => { const s = sitSpec(u, { still: true }), g = lookK * holds(u, [[0.05, 0.7], [0.3, 0.2], [0.5, -0.65], [0.75, -0.1], [0.92, 0]], 0.05);
    s.neck = [sitHead[0] + 0.12, g, 0]; s.head = [sitHead[1] + 0.1, g * 0.35, holds(u, [[0.1, 0.18], [0.3, 0], [0.55, -0.15], [0.75, 0]], 0.06)]; return pose(s); }, { fade: 0.25 });
  clip("pant", loopDur(1), 24, (u) => { const s = sitSpec(u, { still: true }); s.spine = [sitSpine + S(TAU * u * 3) * 0.03, 0, 0]; s.head[0] = sitHead[1] - 0.12; return pose(s); }, { fade: 0.25 });
  // Sitting mannerisms that bring a paw and the head together (grooming, licking a leg, scratching an
  // ear) are posed the way a cat does them: the paw comes up only as far as that cat's leg goes
  // without dragging the skin of its chest or flank after it, and the head comes down and round to
  // meet it. How far a paw may come up: a slim cat's forepaw to its mouth; a round one's (thick
  // short legs) to its chest; one whose forelegs the model joined into one piece hardly lifts a
  // forepaw alone at all (it licks its chest and shoulder instead).
  const freeF = smooth(((rig.legJoin?.f ?? 1) - 0.3) / 0.5), freeH = smooth(((rig.legJoin?.h ?? 1) - 0.3) / 0.5);
  const lift = freeF * (1 - 0.55 * heavy) * (1 - 0.5 * stubby) * amp("groom");
  // (and the elbow folds at most so far: 140 degrees, less for a cat whose skin won't take it)
  const elbowMax = 1.4 + 1.05 * amp("groom");
  const MOUTH = V(rig.noseX - 0.25 * rig.headR, rig.headC.y - 0.35 * rig.headR, rig.zc);
  // A foreleg posed by its joints, from the shoulder: the upper arm swung forward from hanging
  // straight down by a1, the forearm folded up from it by a2, the paw turned up by a3 (radians, side
  // view), brought in towards the middle by `in_` of its own offset from it.
  const armUp = (s, k, a1, a2, a3, in_ = 0.5) => {
    const t = bodyOf(s).top[k], L = K.legs[k], t1 = -PI / 2 + a1, t2 = t1 + a2, t3 = t2 + a3;
    return leg(t.x + L.l[0] * C(t1) + L.l[1] * C(t2) + L.l[2] * C(t3), t.y + L.l[0] * S(t1) + L.l[1] * S(t2) + L.l[2] * S(t3), t3, 0.15, -Math.abs(L.toe.z - rig.zc) * in_);
  };
  // Where a leg's end is in the world for a pose spec (its x, y and z, as legTo places it).
  const endOf = (g, k) => V(g[0], g[1], K.legs[k].toe.z + K.legs[k].side * g[4]);
  // The neck and head turned (within a cat's reach) so that a point on the head (rest coordinates)
  // comes as near as it can to `to`: the neck's pitch and turn, and the head's pitch, found by a
  // few rounds of trying each a little either way. `lim`: how far the neck may bend down from the
  // chest (rad).
  // (A head as big as its neck is long, on a ruff: bowed as far as an ordinary cat's, its nape's skin
  // parts from the shoulders' into a hood. Such a head bows less; the paw meets it higher.)
  const shortNeck = clamp01((1 - Math.hypot(K.H0.x - K.N0.x, K.H0.y - K.N0.y) / Math.max(0.05, rig.headR)) / 0.25);
  // (and a mane or a ruff, a body thick about the shoulders for its head: bowed deep, the head drags
  // the mane's fur after it)
  const ruff = clamp01((rig.bodyR / Math.max(0.05, rig.headR) - 1.6) / 1.4);
  // (licking the chest or a leg, the neck bows further than for a wash: those are down in front of the
  // chest, below the shoulders, where a neck bowed only as far as a wash takes it can't bring the mouth)
  const LICK_BOW = 1.65;
  const meet = (s, pt, to, lim = 1.1, rise = 0.6) => {
    const k = (1 - 0.7 * headBig) * (1 - 0.45 * shortNeck) * (1 - 0.4 * ruff), kk = k * Math.min(1, lim / 1.1); // (turned and pitched no further than bowed, for a bow held back by the fit)
    const P = [[0, sitHead[0] - lim * k, sitHead[0] + rise * k], [1, -0.7 * kk, 0.7 * kk], [2, -0.9 * kk, 0.3 * kk]];
    const get = (j) => (j === 0 ? s.neck[0] : j === 1 ? s.neck[1] : s.head[0] - s.neck[0]);
    const set = (j, v) => { if (j === 0) { const r = s.head[0] - s.neck[0]; s.neck[0] = v; s.head[0] = v + r; } else if (j === 1) { s.neck[1] = v; s.head[1] = v * 0.5; } else s.head[0] = s.neck[0] + v; };
    for (const [j, lo, hi] of P) set(j, Math.min(hi, Math.max(lo, get(j))));
    // (a head that can't get all the way there stays nearer how it started, rather than twisting
    // round for the last bit)
    const v0 = P.map(([j]) => get(j)), cost = () => headPoint(s, pt).distanceToSquared(to) + 0.004 * P.reduce((a, [j], i) => a + (get(j) - v0[i]) ** 2, 0);
    let best = cost();
    for (const step of [0.24, 0.12, 0.06, 0.03, 0.015]) for (let rep = 0; rep < 2; rep++) for (const [j, lo, hi] of P) {
      const w0 = get(j);
      for (const dv of [step, -step]) {
        const v = Math.min(hi, Math.max(lo, w0 + dv)); if (v === w0) continue;
        set(j, v); const c = cost();
        if (c < best - 1e-9) { best = c; break; } set(j, w0);
      }
    }
    return headPoint(s, pt).distanceTo(to);
  };

  // (The groomed paw's pose: as near the bowed head's mouth as the leg goes within this cat's reach,
  // the upper arm swung forward at most so far, the elbow folded at most 150 degrees.)
  const groomArm = (() => {
    const s = sitSpec(0, { still: true }); s.neck = [sitHead[0] - 0.35, -0.2, 0]; s.head = [sitHead[1] - 0.55, -0.1, 0];
    const m = headPoint(s, MOUTH), a1max = 0.3 * amp("groom") + 0.5 * lift;
    let best = [0.3, 1.6], bd = Infinity;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 12; j++) {
      const a1 = a1max * i / 10, a2 = 1.2 + (elbowMax - 1.2) * j / 12, g = armUp(s, "fR", a1, a2, 0.45, 0.55), e = endOf(g, "fR");
      const dd = e.distanceTo(m) + 0.02 * a1; // (of equally near poses, the one with the arm less swung up)
      if (dd < bd) { bd = dd; best = [a1, a2]; }
    }
    return best;
  })();
  // Grooming: a forepaw raised and licked, the head bowed to it, then the paw wiped over the face
  // from the ear down while the head tips into it. A cat whose forelegs are one piece licks its
  // chest and shoulder instead, the head going from one side to the other.
  // (the licking pose, found once: the paw where it goes, the head bowed to it)
  // (a cat whose skin won't take the full move (its fit) also bows less: the paw and the face meet half way)
  const groomBow = amp("groom");
  const GROOM = (() => {
    const s = sitSpec(0, { still: true });
    s.legs.fR = armUp(s, "fR", groomArm[0], groomArm[1], 0.45, 0.55);
    s.neck = [sitHead[0] - 0.3 * groomBow, -0.2, 0]; s.head = [sitHead[1] - 0.5 * groomBow, -0.1, 0];
    meet(s, MOUTH, endOf(s.legs.fR, "fR").add(V(-0.012, 0.01, 0)), 1.1 * groomBow, 0.6 * groomBow);
    return s;
  })();
  // (a paw that, raised as far as this cat's leg and skin let it, still stops well short of the bowed
  // mouth (a round or stubby cat, a toned-down move) would only wave in the air by the face: such a cat
  // licks its chest and shoulder instead, as a cat whose forelegs are one piece does)
  const pawWash = lift > 0.2 && headPoint(GROOM, MOUTH).distanceTo(endOf(GROOM.legs.fR, "fR")) < 0.36 * lt;
  const CHEEK = V(rig.headC.x + 0.05 * rig.headR, rig.headC.y + 0.1 * rig.headR, rig.zc - 0.75 * rig.headR);
  // (The wiping pose, found once: the paw as near the cheek of the tipped head as the arm goes with the
  // upper arm swung a little further up than for the lick and the elbow folded at most 150 degrees; a
  // paw dragged the rest of the way to the cheek would tear the skin of the shoulder and the elbow.)
  const armFor = (s, k, to, a1max, a2max, a3, in_) => {
    let best = [0.3, 1.6], bd = Infinity;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 12; j++) {
      const a1 = a1max * i / 10, a2 = 1.2 + (a2max - 1.2) * j / 12, dd = endOf(armUp(s, k, a1, a2, a3, in_), k).distanceTo(to) + 0.02 * a1;
      if (dd < bd) { bd = dd; best = [a1, a2]; }
    }
    return best;
  };
  const wipeArm = (() => {
    const s = sitSpec(0, { still: true }); s.neck = GROOM.neck.slice(); s.head = GROOM.head.slice();
    s.neck[0] -= 0.12; s.neck[2] = -0.12; s.head[0] -= 0.08; s.head[1] -= 0.2; s.head[2] = -0.4;
    return armFor(s, "fR", headPoint(s, CHEEK), groomArm[0] + 0.2, elbowMax, 0.85, 0.55);
  })();
  posed("groom", loopDur(2.4), 20, (u) => {
    const lick = Math.max(0, S(TAU * u * 3)) * (1 - win(u, 0.55, 0.62)), wipe = bump(u, 0.6, 0.98), down = win(u, 0.6, 0.7) * (1 - win(u, 0.9, 0.98));
    const s = sitSpec(u, { still: true });
    if (pawWash) {
      // (the paw over the cheek from the ear down, as far as this cat's arm goes; the head tipped
      // down and into it, so the face rubs along the paw)
      s.neck = GROOM.neck.slice(); s.head = GROOM.head.slice();
      s.neck[0] -= 0.12 * wipe; s.neck[2] = -0.12 * wipe; s.head[0] += -0.1 * lick - 0.08 * wipe; s.head[1] -= 0.2 * wipe; s.head[2] = -0.4 * wipe;
      const wk = wipe * clamp01((lift - 0.35) / 0.5);
      s.legs.fR = armUp(s, "fR", lerp(groomArm[0], wipeArm[0], wk), lerp(groomArm[1], wipeArm[1], wk), 0.45 + 0.4 * wipe + 0.12 * lick, 0.55);
      // (the cheek comes to the paw, from the ear down, as far as the neck goes)
      if (wk > 0) { const c = headPoint(s, CHEEK), e = endOf(s.legs.fR, "fR").addScaledVector(V(0, 1, 0), -0.25 * rig.headR * (1 - down)); meet(s, CHEEK, c.lerp(e, wk), 1.1 * groomBow, 0.6 * groomBow); }
    } else {
      // (the chest just below the chin, then the right shoulder: the chest drawn in a little and the head
      // bowed right down into the fur, as far as a lick goes (LICK_BOW), and never back up off it: the
      // chest is below the shoulders, where a head bowed only as far as a wash takes it can't get)
      const side = holds(u, [[0.05, 0], [0.5, 0.45]], 0.12);
      s.spine = [sitSpine - 0.05 * groomBow, 0, 0]; s.chest = [sitChest - 0.1 * groomBow, 0, 0];
      const B = bodyOf(s), t = B.top.fR;
      const spot = V(lerp(B.che.x + 0.9 * rig.bodyR * 0.7, t.x + 0.25 * rig.bodyR, side), lerp(B.che.y + 0.1 * rig.bodyR, t.y - 0.15 * rig.bodyR, side), lerp(rig.zc, t.z - 0.4 * rig.bodyR, side));
      s.neck = [sitHead[0] - 0.9 * groomBow, 0.3 * side, 0]; s.head = [sitHead[1] - 1.1 * groomBow, 0.15 * side, 0];
      meet(s, MOUTH, spot, LICK_BOW * groomBow, -0.2 * groomBow);
      s.head[0] += -0.1 * Math.max(0, S(TAU * u * 5)); s.head[2] = -0.3 * side;
    }
    return s;
  }, SIT, { enter: 0.65, exit: 0.4 }); // (the paw lifted with care: quicker, a kitten's forearm snapped up)
  // Kneading: the forepaws treading in turn, eyes half shut.
  posed("knead", loopDur(1.2), 24, (u) => {
    const a = Math.max(0, S(TAU * u)), b = Math.max(0, -S(TAU * u)), h = 0.06 * (0.4 + 0.6 * freeF);
    const s = sitSpec(u, { still: true }); s.neck[0] = sitHead[0] - 0.12; s.head[0] = sitHead[1] - 0.1;
    s.legs.fL = leg(s.legs.fL[0] + a * 0.02, a * h * lt, restE("fL") - a * 0.5); s.legs.fR = leg(s.legs.fR[0] + b * 0.02, b * h * lt, restE("fR") - b * 0.5);
    return s;
  }, SIT, { enter: 0.3, exit: 0.3 });
  // Licking a hind leg: sat back on the rump, the back curled forward over the belly and round to
  // the leg's side, one hind leg raised in front (a slim cat's well up, its foot by the face: the
  // "cello"; a round one's lower, the knee up by the chest), the head bowed down and round to it,
  // licking along the leg in long strokes while the leg is held still for the tongue; the other
  // hind foot laid on the lawn, the forepaw on the leg's side braced out wide.
  // (the pose found once: the head bowed as far as this cat's neck goes, the leg then placed, no
  // higher than it goes, where its foot or shin passes nearest the mouth, and the head then brought
  // to the leg: the mouth on the leg, not staring out over it)
  // (where a leg's joints are for a spec's leg g on the body B: [hip, knee, hock, toe] in the world)
  const q1_ = new THREE.Quaternion(), q2_ = new THREE.Quaternion(), q3_ = new THREE.Quaternion(), lp_ = {};
  const legPts = (B, k, g) => {
    legTo(K, lp_, B, k, { x: g[0], y: g[1] }, g[2], g[3], g[4]);
    const r = rig.legs[k], T0 = B.top[k], [n1, n2, n3] = LEG[k];
    q1_.fromArray(lp_[n1].q).premultiply(T0.q); q2_.copy(q1_).multiply(qEuler(lp_[n2], Q2)); q3_.copy(q2_).multiply(qEuler(lp_[n3], Q2));
    const top = V(T0.x, T0.y, T0.z), knee = V().subVectors(r.knee, r.top).applyQuaternion(q1_).add(top);
    const hock = V().subVectors(r.low, r.knee).applyQuaternion(q2_).add(knee), toe = V().subVectors(r.toe, r.low).applyQuaternion(q3_).add(hock);
    return [top, knee, hock, toe];
  };
  // (the point of a leg's line (from the hip down, the thigh's front half on) nearest p: [point, distance, place along it 0..3])
  const nearLeg = (P, p) => {
    let best = null;
    for (let i = 0; i < 3; i++) {
      const a = P[i], ab = V().subVectors(P[i + 1], a), t = clamp01(V().subVectors(p, a).dot(ab) / Math.max(1e-9, ab.lengthSq())), q = a.clone().addScaledVector(ab, t), d = q.distanceTo(p);
      if ((i || t > 0.5) && (!best || d < best[1])) best = [q, d, i + t];
    }
    return best;
  };
  const alongLeg = (P, w) => { const i = Math.min(2, Math.floor(w)), t = w - i; return P[i].clone().lerp(P[i + 1], t); };
  const LICK = (() => {
    const a = amp("legLick"), up = (1 - round) * freeH * a;
    const lean = Math.min(1.3, sitPitch + 0.15 + 0.1 * up), phMax = 0.25 + 1.05 * up, Lh = K.legs.hL, r = rig.legs.hL.r;
    const k = (1 - 0.7 * headBig) * (1 - 0.45 * shortNeck) * (1 - 0.4 * ruff), c = 0.8 * a;
    const s = sitSpec(0, { still: true });
    s.pelvis = [lean, 0.12, 0.06]; s.spine = [sitSpine - 0.12 - 0.4 * c, -0.08 * a, 0]; s.chest = [sitChest - 0.14 - 0.6 * c, -0.12 * a, 0.04 * a]; s.root[0] = groundAt(s) + 0.012;
    s.legs.hR = leg(rest("hR").x - 0.02, 0.015, Math.min(-0.06, flatE("hR")), 0.35); // (the foot laid as flat as its thickness lets it lie on the lawn)
    s.legs.fL = leg(s.legs.fL[0] + 0.02, 0, restE("fL"), 0, 0.06);
    s.tail = T([PI + 1.0, PI + 0.3, PI + 0.05, PI], [0, -0.3, -0.4, -0.3]);
    const BL = bodyOf(s), t = BL.top.hL;
    let out = null;
    // the head bowed down and round to the leg's side, as far as this cat's neck goes and the leg can come
    // up to meet it: of a deep bow and shallower ones, the one whose mouth the raised leg's foot or shin
    // comes nearest (a shallower bow only for a leg that comes that much nearer)
    for (const b of [1, 0.85, 0.7, 0.55, 0.4]) {
      s.neck = [sitHead[0] - LICK_BOW * a * k * b, -(0.1 + 0.3 * b) * k, 0]; s.head = [s.neck[0] + (sitHead[1] - sitHead[0]) - 0.5 * a * k * b, -(0.05 + 0.15 * b) * k, -0.2];
      const M = headPoint(s, MOUTH);
      // the leg: of the ways it goes up (raised no higher than this cat's leg goes: ph, from the hip), the
      // one whose foot or shin passes nearest the mouth (a little lower preferred: no higher than needed)
      let best = null;
      for (let i = 0; i <= 7; i++) for (let j = 0; j <= 4; j++) for (let e = 0; e <= 2; e++) for (const dz of [0.05, -0.02, -0.09]) {
        const ph = -0.1 + (phMax + 0.1) * i / 7, ext = Lh.reach * (0.6 + 0.35 * j / 4);
        const g = leg(t.x + ext * C(ph), Math.max(0.03, t.y + ext * S(ph)), ph + 0.2 + 0.35 * e, 0.3, dz);
        const d = nearLeg(legPts(BL, "hL", g), M)[1] + 0.04 * lt * (ph + 0.1) / (phMax + 0.1);
        if (!best || d < best[0]) best = [d, g];
      }
      s.legs.hL = best[1];
      const P = legPts(BL, "hL", best[1]), [, dd, w] = nearLeg(P, M), cost = Math.max(0, dd - r) + 0.3 * lt * (1 - b);
      if (!out || cost < out.cost) out = { s: { ...s, neck: s.neck.slice(), head: s.head.slice(), legs: { ...s.legs } }, P, w, r, d: dd, b, cost };
    }
    // (and the head, licking, bows deeper or turns, but never comes up off the leg)
    out.rise = (out.s.neck[0] + 0.08 - sitHead[0]) / Math.max(0.05, k);
    return out;
  })();
  posed("legLick", loopDur(2.4), 20, (u) => {
    const lick = Math.max(0, S(TAU * u * 4)), slide = 0.5 - 0.5 * C(TAU * u), L0 = LICK.s;
    const s = { ...L0, root: L0.root.slice(), pelvis: L0.pelvis.slice(), spine: L0.spine.slice(), chest: L0.chest.slice(), neck: L0.neck.slice(), head: L0.head.slice(), legs: { ...L0.legs }, tail: L0.tail.slice() };
    s.spine[0] += S(TAU * u * 3) * 0.008;
    s.tail[7] += S(TAU * u) * 0.1;
    // (the tongue's strokes run up the leg from below the place the mouth came to, the head following:
    // the mouth on the leg's skin, not its bone)
    const w = Math.max(0.5, Math.min(2.9, LICK.w + 0.35 - 0.7 * slide)), q = alongLeg(LICK.P, w), hp = headPoint(s, MOUTH);
    const to = q.addScaledVector(V().subVectors(hp, q).normalize(), LICK.r * 1.05);
    meet(s, MOUTH, to, LICK_BOW * amp("legLick"), LICK.rise);
    s.head[0] += -0.08 * lick;
    return s;
  }, SIT, { enter: 0.75, exit: 0.55 });
  // Ear scratch: leaning over onto one haunch, the head tipped down and round towards the hind paw,
  // which comes up to the ear and scratches fast (about 6.5 strokes a second, in a burst). A round
  // cat's paw doesn't get all the way; it scratches at the air by its cheek, as fat cats do.
  const EAR = V(rig.headC.x - 0.3 * rig.headR, rig.headC.y + 0.45 * rig.headR, rig.zc + 0.55 * rig.headR);
  const earPose = (() => {
    const s = sitSpec(0, { still: true });
    s.pelvis = [sitPitch - 0.08, 0, -0.12]; s.chest = [sitChest, -0.12, 0.1]; s.root[0] = groundAt(s) + 0.012;
    const kb = (1 - 0.6 * headBig) * lerp(0.4, 1, amp("earScratch"));
    s.neck = [sitHead[0] - 0.55 * kb, -0.45 * kb, 0.35 * kb]; s.head = [sitHead[1] - 0.4 * kb, -0.2 * kb, 0.6 * kb];
    const hip = bodyOf(s).top.hL, Lh = K.legs.hL, H0 = V(hip.x, hip.y, hip.z);
    const far = Lh.reach * (0.85 - 0.35 * round) * lerp(0.35, 1, amp("earScratch"));
    // (the paw comes up outside the flank, never in through the body: no nearer the middle than it
    // stands, whatever side of the head the ear is on)
    const clampTo = (q) => { const d = V().subVectors(q, H0), l = d.length(), f = l > far ? H0.clone().addScaledVector(d, far / l) : q.clone(); f.z = Math.max(f.z, Lh.toe.z + 0.02, rig.zc + 0.5 * (rig.bodyW || rig.W * 0.7) + 0.02); return f; };
    // the head comes down to where the paw can get, then the paw goes to the ear
    meet(s, EAR, clampTo(headPoint(s, EAR)), 1.2 * lerp(0.4, 1, amp("earScratch")), 0.1);
    const ear = headPoint(s, EAR), foot = clampTo(ear);
    return { s, foot, dir: V().subVectors(foot, H0).normalize() };
  })();
  posed("earScratch", loopDur(1.2), 40, (u) => {
    const burst = u < 0.8 ? S(PI * u / 0.8) ** 0.3 : 0, sc = S(TAU * u * 6.5) * burst;
    const E0 = earPose, s = { ...E0.s, root: E0.s.root.slice(), neck: E0.s.neck.slice(), head: E0.s.head.slice(), legs: { ...E0.s.legs }, tail: E0.s.tail.slice() };
    s.tail = sitSpec(u, { still: true }).tail;
    // (strokes along the leg, about 5% of the cat's height, the head giving a little with each)
    const f = E0.foot.clone().addScaledVector(E0.dir, -0.045 * lt / 0.5 * (0.5 + 0.5 * sc)).add(V(0, 0.012 * sc, 0));
    const Lh = K.legs.hL;
    s.legs.hL = leg(f.x, f.y, Math.atan2(E0.dir.y, E0.dir.x) + 0.3, 0.15, (f.z - Lh.toe.z) * Lh.side);
    s.legs.hR = leg(rest("hR").x - 0.01, 0.015, Math.min(-0.06, flatE("hR")), 0.35);
    s.head[0] += 0.03 * sc; s.head[2] += 0.04 * sc;
    return s;
  }, SIT, { enter: 0.62, exit: 0.45 });
  // Beckoning (the maneki-neko): one forepaw raised in front of the chest (as high beside the face as
  // this cat's leg goes), the paw curled, bending down and back up at the wrist, the forearm dipping
  // with it; the head tipped a little, looking out.
  posed("beckon", loopDur(1.6), 20, (u) => {
    const w = 0.5 - 0.5 * C(TAU * u * 2), up = freeF * (1 - 0.3 * heavy) * amp("beckon");
    const s = sitSpec(u, { still: true }); s.head = [sitHead[1], 0, -0.12]; s.neck = [sitHead[0] + 0.04, 0.05, 0];
    s.legs.fL = armUp(s, "fL", 0.3 + 0.55 * up - 0.12 * w, 1.1 + 0.9 * up - 0.1 * w, 0.2 - 1.2 * w, 0.1);
    return s;
  }, SIT, { enter: 0.45, exit: 0.5 });
  // Chattering at a bird: staring up, the jaw's tremor running through the head, the tail tip twitching.
  posed("chatter", loopDur(1.2), 40, (u) => {
    const on = u < 0.7 ? S(PI * u / 0.7) ** 0.4 : 0, tr = S(TAU * u * 12) * on;
    const s = sitSpec(u, { still: true }); s.chest = [sitChest + 0.04, 0, 0]; s.neck = [sitHead[0] + 0.45, 0, 0]; s.head = [sitHead[1] + 0.35 + tr * 0.035, 0, tr * 0.01];
    s.tail[7] += 0.35 * S(TAU * u * 4); s.tail[6] += 0.12 * S(TAU * u * 4 - 0.6);
    return s;
  }, SIT, { enter: 0.35, exit: 0.35 });
  // Yawn (a mouth that can't open, so the head does it): head lifted high, back arched a little, a
  // hold, then a lick of the lips and back to the sit.
  clip("yawn", 2 * tempo, 20, (u) => {
    const up = win(u, 0.05, 0.3) * (1 - win(u, 0.72, 0.92)), smack = bump(u, 0.85, 0.97) * 0.08;
    const s = sitSpec(0, { still: true });
    s.spine = [sitSpine - 0.08 * up, 0, 0]; s.chest = [sitChest + 0.1 * up, 0, 0];
    s.neck = [sitHead[0] + 0.4 * up, 0, 0]; s.head = [sitHead[1] + 0.62 * up + S(TAU * u * 5) * 0.012 * up - smack, 0, 0.1 * up];
    return pose(s);
  }, { loop: false, fade: 0.2, dur: 2 * tempo });

  /* ── Lying ── */
  // Lying (sphinx): belly on the ground, hind legs folded alongside with the feet where they stood,
  // forelegs flat in front, or tucked under the chest (loafTuck).
  const loafLift = ground(0);
  const loafB0 = body(K, { lift: loafLift, pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0] });
  const loafShift = hindX - ((loafB0.top.hL.x + loafB0.top.hR.x) / 2 + 1.05 * lh3);
  const loafB = body(K, { lift: loafLift, shift: loafShift, pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0] });
  // (Sphinx forelegs lie flat: the elbow down just behind the shoulder, the forearm along the
  // ground with its underside on the grass, not sunk into it; `reach` below 0.85 draws the paws in.)
  const sphinx = (k, reach = 0.85) => {
    const t = loafB.top[k], L = K.legs[k], r = Math.min(0.1, rig.legs[k].r * 0.95), h = t.y - r;
    if (h >= L.l[0] * 0.98 || h <= 0) return leg(t.x + (L.l[1] + L.l[2]) * reach, 0.012, -0.04);
    // (the paw itself angled down so its toes rest on the ground)
    const e = Math.asin(Math.max(-0.8, Math.min(0, (0.015 - r) / L.l[2])));
    const flat = t.x + L.l[1] - Math.sqrt(L.l[0] ** 2 - h * h) + L.l[2] * C(e), near = t.x + (L.l[1] + L.l[2]) * 0.45;
    return leg(lerp(near, flat, clamp01((reach - 0.35) / 0.5)), 0.015, e);
  };
  const tucked = (k, f) => { const t = loafB.top[k], L = K.legs[k]; return leg(t.x + (L.l[1] + L.l[2]) * 0.45 * (1 - f) - 0.01 * f, 0.02, -(PI - 0.05)); };
  const tuck = Math.max(st.loafTuck, stubby >= 0.9 ? 0.85 : 0), tuckLate = tuck >= 0.5, sphReach = stubby >= 0.9 ? 0.35 : 0.85 - 0.5 * Math.min(0.5, tuck);
  const loafFront = (k) => (tuckLate ? tucked(k, (tuck - 0.5) * 2) : sphinx(k, sphReach));
  let loafLegs = { hL: leg(rest("hL").x, 0.012, flatE("hL"), 0.45), hR: leg(rest("hR").x, 0.012, flatE("hR"), 0.45), fL: loafFront("fL"), fR: loafFront("fR") };
  const loafSpec = (u = 0, o = {}) => {
    const br = S(TAU * u * 3), g = o.still ? 0 : glance(u, 0.25);
    return { root: [loafLift, loafShift, 0], pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [br * 0.01, 0, 0],
      neck: [-0.15 + st.head * 0.5, g, 0], head: [-0.1 + st.head * 0.3, g * 0.5, o.still ? 0 : tilt(u, 0.1)],
      legs: { ...loafLegs },
      // (the tail laid down along the ground and round the flank, the tip free to twitch)
      tail: T([PI + 1.2, PI + 0.75, PI + 0.45, PI + 0.2], [0, 0.45, 0.7, 0.75 + S(TAU * u) * 0.12]) };
  };
  loafLegs = bakeLegs(loafSpec(0));
  const LOAF = loafSpec(0);
  clip("loaf", loopDur(8), 10, (u) => pose(loafSpec(u)));
  // Dabbing at the water from a loaf: up on the elbows, one forepaw lifted and batting down.
  posed("dab", loopDur(1.4), 24, (u) => {
    const s = loafSpec(u, { still: true }), strike = (bump(u, 0, 0.45) + 0.4 * bump(u, 0.6, 0.85)) * amp("dab");
    s.pelvis = [0.1 * amp("dab"), 0, 0]; s.neck = [-0.5 * bow, 0.05, 0]; s.head = [-0.6 * bow, 0, 0.05];
    s.legs.fR = sphinx("fR", 0.8); s.legs.fL = sphinx("fL", 0.8);
    // (the forelegs rested on the ground by their skin, as the loaf's are, the body pitched up as it is here)
    Object.assign(s.legs, bakeLegs(s));
    const t = bodyOf(s).top.fL, L = K.legs.fL, x0 = s.legs.fL[0];
    s.legs.fL = leg(lerp(x0, t.x + L.reach * 0.55, strike), s.legs.fL[1] + strike * L.reach * 0.35, -0.04 + strike * (PI / 2 - 0.6), 0, 0.02);
    s.tail[7] += 0.3 * S(TAU * u * 2);
    return s;
  }, LOAF, { enter: 0.6, exit: 0.4 });

  /* ── Rolled over: the body turns about its long axis (root roll); legs, head and tail are posed as
     if it were upright. ── */
  // The head down on the ground (or just clear of it): `set` turns the neck from `lo` (into the
  // ground) towards `hi` only as far as it takes.
  // (The head's lowest point is found from its own skin's outermost points, so ears and a chin rest on
  // the ground rather than going into it; without a skin sample, from its round. A head that can't be
  // got clear even at `hi`, a big head on a body rolled right over, is lifted clear body and all.)
  // (within 1.8 of the head's radius: the ears too, which a head laid down on its side rests on)
  const HSK = SKIN.head ? Float64Array.from(Array.from({ length: SKIN.head.length / 3 }, (_, i) => i).filter((i) => Math.hypot(SKIN.head[i * 3] + K.H0.x - rig.headC.x, SKIN.head[i * 3 + 1] + K.H0.y - rig.headC.y, SKIN.head[i * 3 + 2] + K.H0.z - rig.headC.z) < 1.8 * rig.headR + 0.02).flatMap((i) => [SKIN.head[i * 3], SKIN.head[i * 3 + 1], SKIN.head[i * 3 + 2]])) : null, hpt = V();
  // (and the neck's: the sample's points along the neck, from the neck joint most of the way to the head
  // joint, which turn with the neck: a long or thick neck, a ruff, would otherwise go through the ground
  // under a head laid down beside a body rolled onto its back)
  const NSK = (() => {
    if (!rig.skin) return null;
    const P = rig.skin.pts, out = [], nd = V().subVectors(K.H0, K.N0), nl = Math.max(1e-6, nd.length()); nd.divideScalar(nl);
    for (let i = 0; i < P.length / 3; i++) {
      const px = P[i * 3] - K.N0.x, py = P[i * 3 + 1] - K.N0.y, pz = P[i * 3 + 2] - K.N0.z, t = (px * nd.x + py * nd.y + pz * nd.z) / nl;
      if (t < 0.05 || t > 0.9) continue;
      if (Math.hypot(px - t * nl * nd.x, py - t * nl * nd.y, pz - t * nl * nd.z) < 1.2 * rig.bodyR) out.push(px, py, pz);
    }
    return Float64Array.from(out);
  })();
  const hq = new THREE.Quaternion(), hqN = new THREE.Quaternion();
  const headLow = (s) => {
    if (!HSK || HSK.length < 9) return headPoint(s, rig.headC).y - rig.headR * 0.95;
    // (the head's frame once, then its sample points through it)
    const B = bodyOf(s, true);
    qEuler([s.neck[0] - B.aC, s.neck[1], s.neck[2]], hqN).premultiply(B.qC);
    qEuler([s.head[0] - s.neck[0], s.head[1], s.head[2]], hq).premultiply(hqN);
    const hy = hpt.subVectors(K.H0, K.N0).applyQuaternion(hqN).y + B.nec.y;
    let lo = Infinity;
    for (let i = 0; i < HSK.length; i += 3) { const y = hpt.set(HSK[i], HSK[i + 1], HSK[i + 2]).applyQuaternion(hq).y; if (y < lo) lo = y; }
    lo += hy;
    if (NSK) for (let i = 0; i < NSK.length; i += 3) { const y = hpt.set(NSK[i], NSK[i + 1], NSK[i + 2]).applyQuaternion(hqN).y + B.nec.y; if (y < lo) lo = y; }
    return lo;
  };
  const headOnGround = (s, set, lo, hi, clear = 0.012) => {
    set(hi); const top = headLow(s); if (top < clear) { s.root[0] += clear - top; return; }
    set(lo); if (headLow(s) >= clear) return;
    for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; set(m); if (headLow(s) >= clear) hi = m; else lo = m; }
    set(hi);
  };
  // Flop: on its side in the sun, legs out loose, head down on its cheek, a slow stretch now and then.
  // (a cat whose skin won't take the full flop (its fit) rolls less far over, its legs drawn in more)
  const FLOP_ROLL = 1.38 * lerp(0.7, 1, amp("flop")), flopReach = lerp(0.65, 0.8, amp("flop"));
  posed("flop", loopDur(8), 10, (u) => {
    const br = S(TAU * u * 3), str = bump(u, 0.45, 0.8) ** 2;
    const s = { root: [loafLift, loafShift, 0, FLOP_ROLL], pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [br * 0.012, 0, 0],
      neck: [0.05, 0, 0], head: [0.1 + 0.1 * str, 0.15, -0.1], legs: {},
      tail: T([PI + 0.1, PI, PI - 0.05, PI - 0.1 + 0.25 * S(TAU * u * 2)], [0, -0.1, -0.15, -0.2 + 0.2 * S(TAU * u * 2)]) };
    const B = bodyOf(s);
    for (const k of KEYS) {
      const L = K.legs[k], t = B.top[k], down = k[1] === "L"; // lying on its left side
      const a = L.hind ? -0.25 - 0.2 * str : 0.35 + 0.35 * str, r = L.reach * (flopReach + (down ? 0.02 : -0.08) + 0.12 * str);
      s.legs[k] = leg(t.x + r * S(a), t.y - r * C(a), L.hind ? -0.3 - 0.4 * str : -0.2 - 0.3 * str, 0, down ? -0.03 : 0.07);
    }
    headOnGround(s, (v) => { s.neck[1] = v; }, -0.6, 0.9);
    return s;
  }, LOAF, { enter: 0.95, exit: 0.8, to: { roll: 0.75 } }); // (the way over onto its side unhurried: a short thick hind leg unfolding from the loaf in less turns too fast)
  // Rolling on its back: paws curled up, wriggling from shoulder to shoulder, head rubbing the ground.
  // (A big cartoon head can't lie face-up under a body rolled onto its back: such a cat rolls less far.)
  // (a cat whose skin won't take the full roll over onto its back stops short of it, on its side)
  const ROLL = lerp(FLOP_ROLL + 0.25, 2.55 - 0.7 * headBig, amp("roll"));
  posed("roll", loopDur(3), 15, (u) => {
    const w = S(TAU * u), w2 = S(TAU * u * 2), r = ROLL + 0.22 * w;
    const s = { root: [loafLift, loafShift, 0, r], pelvis: [0, 0, 0], spine: [0, 0, -0.18 * w], chest: [0.05, 0, -0.12 * w],
      neck: [0.3, 0.2 * w, 0.2 * w], head: [0.5, 0.25 * w, 0.2 * w], legs: {},
      tail: T([PI + 0.2, PI + 0.1, PI, PI - 0.1], [0, 0.2 * w, 0.3 * w, 0.4 * S(TAU * u - 1)]) };
    const B = bodyOf(s);
    for (const k of KEYS) {
      const L = K.legs[k], t = B.top[k], paddle = (k === "fL" ? w2 : k === "fR" ? -w2 : 0) * 0.04;
      // (the forepaws curled loosely, the elbows not folded right up: a tight fold tears the skin over them)
      // (and less tightly curled, longer, at a smaller fit: the elbow's fold is what tears)
      const cu = lerp(0.72, 0.48, amp("roll"));
      s.legs[k] = L.hind ? leg(t.x + L.reach * 0.3, t.y - L.reach * (cu + 0.02), -0.4, 0.3) : leg(t.x + L.reach * 0.3 + paddle, t.y - L.reach * cu + paddle, -PI / 2 - 0.5 * amp("roll"), 0.2);
    }
    headOnGround(s, (v) => { s.neck[0] = v; s.head[0] = v + 0.2; }, 0.4, -1.4 * lerp(0.4, 1, amp("roll")));
    return s;
  }, LOAF, { enter: 1.1, exit: 0.8, to: { flop: 0.75 } });

  /* ── Asleep ── */
  // A leg's place in its hip's or shoulder's own frame (relative, so it goes round with a body that
  // curls or uncurls: a cat folding up to sleep keeps its paws tucked against itself), and back.
  const toRel = (spec, k) => {
    const g = spec.legs[k], Bs = bodyOf(spec), t = Bs.top[k], L = K.legs[k], a = L.hind ? Bs.aP : Bs.aC;
    const w = V().set(g[0] - t.x, g[1] - t.y, L.toe.z + L.side * g[4] - t.z).applyQuaternion(Q2.copy(t.q).invert());
    return [w.x, w.y, g[2] - a, g[3], w.z];
  };
  const fromRel = (B, k, r) => {
    const L = K.legs[k], t = B.top[k], a = L.hind ? B.aP : B.aC, w = V1.set(r[0], r[1], r[4]).applyQuaternion(t.q);
    return leg(t.x + w.x, t.y + w.y, r[2] + a, r[3], (t.z + w.z - L.toe.z) * L.side);
  };
  // Curled up asleep: lying half over on its left side, the back rounded towards the belly in one curve (the
  // loins, chest and neck each taking a share, so no one joint folds the skin), the head come down to
  // rest on the ground by its forepaws, the legs drawn up loosely against the belly, the tail wrapped
  // round the hind legs towards the nose; breathing slowly. Seen from above a C, from the belly side
  // paws and a sleeping face, from the back a round back, the head and the tail (rolled right over onto
  // its side, the back seen from behind was a long smooth log). A big cartoon head curls less; a
  // round body (no waist to bend) lies less far over.
  const SLEEP_ROLL = 0.8 - 0.15 * heavy, curl = (1 - 0.45 * headBig) * (1 - 0.3 * heavy) * (1 - 0.5 * deep) * amp("sleep");
  // A round cat (deep-bodied, wide or stubby: no waist to curl, and rolled onto its side it reads as a
  // featureless log) sleeps in its loaf instead, as such cats do: the chin down on the forepaws, the
  // back rounded a little, the tail wrapped along its flank; curling up and waking are then the head
  // going down and coming up.
  // (so does one whose skin won't take the curl: its fit under a half)
  const loafSleep = round >= 0.4 || amp("sleep") < 0.5;
  const sleepSpec = loafSleep ? (u = 0) => {
    const b = S(TAU * u * 2) * 0.008;
    const s = loafSpec(0, { still: true });
    s.spine = [0.06 + b, 0, 0]; s.chest = [0.06 - b * 0.5, 0, 0];
    s.tail = T([PI + 1.2, PI + 1.0, PI + 0.8, PI + 0.55], [0, 0.6, 0.9, 1.05]);
    // (the neck down, the face kept nearly level, chin tucked, so the chin rests on the paws)
    const pawTop = 0.02 + rig.legs.fL.r + rig.legs.fR.r;
    s.neck = [-0.9 * bow, 0, 0]; s.head = [-0.35 * bow, 0, 0];
    const d0 = s.head[0] - s.neck[0];
    headOnGround(s, (v) => { s.neck[0] = v; s.head[0] = v + d0; }, -1.3 * bow, -0.1, pawTop);
    return s;
  } : (u = 0) => {
    const b = S(TAU * u * 2) * 0.012, cr = C(SLEEP_ROLL), sr = S(SLEEP_ROLL);
    // (each joint turned about the upright of the world, which for a body lying over is its belly's way)
    const bend = (th, br = 0) => [-th * sr + br, th * cr, 0];
    const CK = 1.3;
    const s = { root: [loafLift, loafShift, 0, SLEEP_ROLL], pelvis: [0, 0, 0], spine: bend(0.5 * curl * CK, b), chest: bend(0.55 * curl * CK, -b * 0.5), neck: [0, 0, 0], head: [0, 0, 0],
      legs: {}, tail: T([PI + 1.1, PI + 1.8, PI + 2.4, PI + 2.9], [-0.3, -0.15, -0.05, 0]) };
    const B = bodyOf(s), nk = 0.6 * curl * CK, hd = 0.35 * curl * CK;
    s.neck = [B.aC - nk * sr, nk * cr, 0]; s.head = [s.neck[0] - hd * sr, hd * cr * 0.8, -0.25];
    for (const k of KEYS) {
      // (in the body's own frame: hind knees drawn up, forelegs bent at the wrist in front of the chest;
      // the upper pair a little further forward, as they lie on the lower)
      const L = K.legs[k], up = k[1] === "R", R0 = L.reach;
      s.legs[k] = L.hind ? fromRel(B, k, [R0 * (0.38 + (up ? 0.06 : 0)), -R0 * 0.42, -0.25, 0.25, up ? 0.03 : -0.03]) : fromRel(B, k, [R0 * (0.3 + (up ? 0.06 : 0)), -R0 * 0.5, -1.25, 0, up ? 0.02 : -0.03]);
    }
    // (the head down until it rests on the ground)
    const d0 = s.head[0] - s.neck[0];
    headOnGround(s, (v) => { s.neck[0] = v; s.head[0] = v + d0; }, B.aC - 1.2, B.aC + 0.3);
    return s;
  };
  const SLEEP = sleepSpec(0);
  clip("sleep", loopDur(6), 8, (u) => pose(sleepSpec(u)), { fade: 0.4 });

  /* ── Whole-body moves (once through; the view sets their time from progress) ── */
  // Shake: a quick wave of shaking from the head, through the shoulders to the hips and tail.
  clip("shake", 0.8, 60, (u) => {
    const s = standSpec(0, { still: true }), f = TAU * u * 7.5; // ≈9.4 Hz, a wave of 3-4 shakes down the body
    const hd = bump(u, 0, 0.45) ** 0.7, ch = bump(u, 0.12, 0.62) ** 0.7, pv = bump(u, 0.3, 0.8) ** 0.7, tl = bump(u, 0.45, 0.98) ** 0.7;
    const rP = 0.2 * S(f - 1.6) * pv;
    s.pelvis = [0, 0.04 * S(f - 1.6) * pv, rP]; s.chest = [0, 0.05 * S(f - 0.8) * ch, 0.28 * S(f - 0.8) * ch - rP];
    s.neck = [s.neck[0] + 0.1 * hd, 0.15 * S(f) * hd, 0.5 * S(f) * hd]; s.head = [s.head[0] + 0.05 * hd, 0.1 * S(f) * hd, 0.4 * S(f) * hd];
    s.root[0] = -0.01 * Math.max(hd, ch);
    s.tail = T(s.tail.slice(0, 4).map((a, i) => a - 0.3 * tl + 0.1 * S(f - 2.4 - i) * tl), s.tail.slice(4).map((a, i) => a + 0.25 * S(f - 2.4 - i * 0.7) * tl));
    return pose(s);
  }, { loop: false, dur: 0.8 });
  // Stretch: a play bow (forepaws walked out, chest down, bottom up), then forward over the forepaws
  // with one hind leg stretched out behind, then back to standing.
  clip("stretch", 2.2 * tempo, 20, (u) => {
    const k = win(u, 0.05, 0.25) * (1 - win(u, 0.42, 0.55)) * amp("stretch"), f = win(u, 0.52, 0.64) * (1 - win(u, 0.82, 0.95)) * amp("stretch");
    const s = standSpec(0, { still: true });
    s.root = [-0.07 * k * lt - 0.03 * f, 0.06 * f * lt, 0]; s.pelvis = [-0.36 * k - 0.05 * f, 0, 0]; s.chest = [0.1 * k, 0, 0];
    s.neck[0] += 0.1 * k + 0.1 * f; s.head[0] += 0.05 * k + 0.05 * f; s.head[2] = 0.05 * k;
    const B = bodyOf(s);
    for (const kk of ["fL", "fR"]) {
      const t = B.top[kk], L = K.legs[kk], out = t.x + (L.l[1] + L.l[2]) * 0.95, r0 = rest(kk).x, o = kk === "fL" ? 0 : 0.06;
      const [g1, a1] = stepAt(u, 0.04 + o, 0.17 + o), [g2, a2] = stepAt(u, 0.43 + o * 0.6, 0.53 + o * 0.6), go = g1 * (1 - g2);
      s.legs[kk] = leg(lerp(r0, out, go), 0.012 * go + 0.03 * lt * (a1 + a2), lerp(restE(kk), -0.04, go) - 0.5 * (a1 + a2));
    }
    // (the hind paw lifts, reaches back, holds, and comes back down to its place)
    const [h1, ha1] = stepAt(u, 0.56, 0.7), [h2, ha2] = stepAt(u, 0.78, 0.9), hx = h1 * (1 - h2);
    s.legs.hL = leg(rest("hL").x - hx * K.legs.hL.reach * 0.45, hx * 0.06 * lt + 0.03 * lt * (ha1 + ha2), restE("hL") + hx * 0.9);
    const up = tailShape(Math.min(1, st.tail + 0.8 * k + 0.2 * f)), base = tailShape(st.tail);
    s.tail = s.tail.map((a, i) => (i < 4 ? a + up[i] - base[i] : a + 0.15 * (k + f) * S(TAU * u * 2)));
    return pose(s);
  }, { loop: false, dur: 2.2 * tempo });
  // Hunting crouch and the bottom wiggle before a pounce.
  const crouchSpec = (u = 0, w = 0) => {
    const s = standSpec(0, { still: true });
    // (The wiggle is all in the hindquarters: the rump swings from side to side about the
    // shoulders, which hold still, so the head stays locked on the prey.)
    const wy = S(TAU * u * 4) * 0.08 * w, wr = S(TAU * u * 4) * 0.05 * w;
    s.root = [-0.42 * lt, 0, Math.sin(wy) * (K.C0.x - K.P0.x)]; s.pelvis = [0.06, wy, wr]; s.chest = [-0.06, -wy, -wr];
    s.neck = [neckFor(bodyOf(s), restHed - 0.42 * lt * 0.95), 0, 0]; s.head = [0.08, 0, 0];
    for (const k of ["hL", "hR"]) s.legs[k] = leg(rest(k).x, Math.max(0, S(TAU * u * 4 + (k === "hL" ? 0 : PI))) * 0.03 * w * lt, restE(k));
    s.tail = T([PI + 0.2, PI + 0.05, PI - 0.05, PI - 0.4], [0, 0, 0.1 * S(TAU * u * 3), 0.5 * S(TAU * u * 5)]);
    return s;
  };
  const CROUCH = crouchSpec(0, 0);
  clip("crouch", loopDur(2), 12, (u) => pose(crouchSpec(u, 0)), { fade: 0.3 });
  // Pulling up: from any moment of a gait to standing square, each paw that is not yet where it
  // stands takes a last short step there, lifted clear (a paw in the air lands there), one after
  // another in the gait's order, while the body settles; nothing is dragged over the ground. The
  // renderer plays stop:<gait>:<k> (k of STOPS, the phase it pulled up at) on its own clock between
  // the gait and a standing loop. A stalk pulls up into the hunting crouch.
  for (const [name, g] of Object.entries(GAITS)) for (let k = 0; k < STOPS; k++) {
    const phi = k / STOPS, A0 = gaitSpec(phi, g), dur = (name === "stalk" ? 0.55 : 0.42) * tempo, END = name === "stalk" ? CROUCH : STAND, a0 = flat(A0), b0 = flat(END), v = new Float64Array(47);
    const legsAt = KEYS.map((kk) => ({ k: kk, f: (((phi + g.phase[kk]) % 1) + 1) % 1 }));
    const stance = legsAt.filter((q) => q.f < g.duty && Math.abs(A0.legs[q.k][0] - rest(q.k).x) > 0.012).sort((p, q) => q.f - p.f);
    const when = {}; stance.forEach((q, i) => { when[q.k] = [0.06 + i * 0.22, 0.06 + i * 0.22 + 0.4]; });
    const h = Math.max(0.03, 0.05 * stepLift) * lt;
    clip(`stop:${name}:${k}`, dur, 30, (u) => {
      const w = smooth(u / 0.85);
      for (let i = 0; i < 47; i++) v[i] = lerp(a0[i], b0[i], w);
      const s2 = unflat(v);
      for (const q of legsAt) {
        const g0 = A0.legs[q.k], g1 = END.legs[q.k], o = s2.legs[q.k];
        if (q.f >= g.duty) {
          // (in the air: it comes down on its place, lifted clear on the way even if it had only
          // just left the ground)
          const [go, arc] = stepAt(u, 0, 0.5);
          o[0] = lerp(g0[0], g1[0], go); o[1] = Math.max(g0[1] * (1 - smooth(u / 0.5)), h * arc); o[2] = lerp(g0[2], g1[2], smooth(u / 0.5));
        } else if (when[q.k]) {
          const [go, arc] = stepAt(u, when[q.k][0], Math.min(1, when[q.k][1]));
          o[0] = lerp(g0[0], g1[0], go); o[1] = h * arc; o[2] = lerp(g0[2], g1[2], go) + (K.legs[q.k].hind ? 0.45 : -0.6) * arc;
        } else { o[0] = g0[0]; o[1] = 0; o[2] = lerp(g0[2], g1[2], w); }
      }
      return pose(s2);
    }, { loop: false, kind: "once", posture: "stand", dur, fade: 0.08 });
  }
  clip("wiggle", 1, 30, (u) => pose(crouchSpec(u, 1)), { fade: 0.2 });
  // A leap. The sim carries the cat along its arc from u = 0.25 to 0.75; the clip does the rest:
  // gather (crouch), push off with the nose up as the hind legs straighten, legs tucked (hop) or
  // stretched fore and aft (pounce) in the air, forepaws reaching down to land with the nose down,
  // the landing taken up in a crouch, then standing.
  const leap = (u, pounce) => {
    const s = pounce ? crouchSpec(0, 0) : standSpec(0, { still: true });
    const gather = (pounce ? 1 : win(u, 0, 0.18)) * (1 - win(u, 0.17, 0.28)), air = win(u, 0.25, 0.4) * (1 - win(u, 0.62, 0.76)), land = win(u, 0.7, 0.8) * (1 - win(u, 0.84, 1));
    const pitch = (0.45 * win(u, 0.16, 0.28) * (1 - win(u, 0.35, 0.55)) - 0.32 * win(u, 0.5, 0.72) * (1 - win(u, 0.74, 0.9))) * amp("leap");
    s.root = [-(pounce ? 0.42 : 0.3) * lt * gather - 0.22 * lt * land, 0, 0];
    s.pelvis = [pitch + 0.06 * gather, 0, 0]; s.chest = [-0.06 * gather + 0.05 * air, 0, 0];
    const B = bodyOf(s);
    // (the head held level as the body gathers and lands, but carried up with the body as it pitches up to
    // spring and down to land, and in the air carried half with it: held level against the whole pitch,
    // the neck would fold the head back into the shoulders at take-off)
    const carry = 0.6 * clamp01(Math.abs(pitch) / 0.4);
    s.neck = [lerp(neckFor(B, restHed + s.root[0] * 0.8), B.aC + STAND.neck[0], carry) * (1 - air) + ((pounce ? -0.1 : 0.05) + 0.5 * B.aC) * air, 0, 0]; s.head = [0.05 - 0.2 * win(u, 0.55, 0.8) * (1 - win(u, 0.85, 1)), 0, 0];
    for (const k of KEYS) {
      const L = K.legs[k], t = B.top[k], r0 = rest(k);
      const lk = lerp(0.7, 1, amp("leap")), off = L.hind ? (pounce ? [-0.55 * lk, -0.55] : [0.05, -0.55]) : (pounce ? [0.62 * lk, -0.5] : [0.25 * lk, -0.6]);
      // Off the ground the paw rises before it swings; coming down it is over its spot before it lands.
      const [a0, a1, b0, b1] = L.hind ? [0.22, 0.36, 0.66, 0.77] : [0.17, 0.31, 0.61, 0.72];
      const ay = win(u, a0, a1) * (1 - win(u, b0, b1)), ax = win(u, a0 + 0.3 * (a1 - a0), a1) * (1 - win(u, b0, b0 + 0.7 * (b1 - b0)));
      s.legs[k] = leg(lerp(r0.x, t.x + L.reach * off[0], ax), ay * Math.max(0.01, t.y + L.reach * off[1]), L.a[2] + ay * (L.hind ? (pounce ? -1.2 : 0.8) : (pounce ? 0.2 : -0.9)));
    }
    // The tail streams out low in the air, eased from how it was carried before the leap and back
    // to its own carriage after (a tail carried high would otherwise whip round as it lands).
    const air0 = T(tailShape(pounce ? -0.1 : 0.1).map((a) => a - 0.25 * air), [0, 0, 0, 0]), tail0 = (pounce ? CROUCH : STAND).tail;
    const w0 = 1 - win(u, 0.04, 0.3), w1 = win(u, 0.6, 0.97);
    s.tail = air0.map((a, i) => lerp(lerp(a, tail0[i], w0), STAND.tail[i], w1));
    // Starts exactly as it stood (or crouched) and ends standing, whatever this cat's style.
    return pose(settle(s, pounce ? CROUCH : STAND, 1 - win(u, 0, 0.08), STAND, win(u, 0.9, 1)));
  };
  clip("hop", 0.6, 40, (u) => leap(u, false), { loop: false, dur: 0.6, fade: 0.1 });
  clip("pounce", 0.6, 40, (u) => leap(u, true), { loop: false, dur: 0.6, fade: 0.1 });
  // Claws on the cat tree: reared up against the trunk on its hind legs, the forelegs reaching out
  // nearly straight to the bark, the paws pulling down it in turn.
  // (The forelegs reach the trunk straight out from the shoulders, not folded up to the face: an elbow
  // folded double, or a foreleg swung far up past the chest, tears the skin at the elbow and the armpit
  // of most models. The body rears up to meet them, so the shoulder turns no further than a stride's
  // reach; a cat whose skin won't take the full rear (its fit) rears less and reaches lower on the
  // trunk, the shoulder turning no further for it.)
  posed("scratch", loopDur(1.2), 24, (u) => {
    // (the forelegs 0.4 rad above level at the full rear, and lower by most of what the rear falls short
    // of it: the shoulder turns about as far whatever the rear)
    const a = S(TAU * u), rear = 1.1 * (1 - 0.45 * headBig) * amp("scratch"), phi = 0.4 - 0.8 * (1.1 - rear);
    const s = standSpec(0, { still: true }); s.root = [-0.04, 0, 0]; s.pelvis = [rear, 0, 0]; s.spine = [0.05, 0, 0]; s.chest = [0, 0, 0]; s.neck = [rear * 0.3, 0, 0]; s.head = [rear * 0.2, 0, 0];
    const B = bodyOf(s);
    for (const k of ["hL", "hR"]) s.legs[k] = leg(rest(k).x + 0.03, 0, restE(k));
    for (const k of ["fL", "fR"]) {
      // (the bark 0.9 of the leg's reach out from the shoulder, phi above level; each paw drawn down a
      // tenth of the reach and back towards the body, in turn, the paw flat against the trunk)
      const t = B.top[k], L = K.legs[k], sd = k === "fL" ? a : -a;
      s.legs[k] = leg(t.x + L.reach * (0.9 * C(phi) - 0.1 * (0.5 - 0.5 * sd)), t.y + L.reach * (0.9 * S(phi) + 0.1 * sd), 1.0);
    }
    s.tail = T([PI + 0.6, PI + 0.4, PI + 0.2, PI], [0, 0.15 * S(TAU * u), 0.2 * S(TAU * u), 0.25 * S(TAU * u)]);
    return s;
  }, STAND, { enter: 0.6, exit: 0.55, lift: { fL: 0.3, fR: 0.3 } });

  /* ── Posture changes ── */
  // plan[part] = keys [u, spec | "A" | "B", step height?] between the implied [0, A] and [1, B]
  // (parts: body, head, hL, hR, fL, fR, tail). A leg key with a step height is reached by a step: the
  // paw lifts on its way there (and flexes, as in a walk).
  // plan.rel: the legs are keyed in their hips' or shoulders' own frame rather than the world's, so
  // they go round with a body that curls or uncurls (a cat folding up to sleep keeps its paws
  // tucked against itself); for moves where no paw bears weight.
  const change = (name, A, B, plan = {}) => {
    // (forelegs the model joined into one piece step together: one stepping alone would tear the other's skin)
    // (whatever their own schedules: the right foreleg then keeps to the left's keys, each key's pose its own)
    if (freeF < 0.3 && plan.fL && plan.fR) { plan.fL = plan.fL.map((k) => [k[0], k[1], k[2] && Math.max(Math.min(k[2], 0.012), k[2] * 0.4)]); plan.fR = plan.fL.map((k) => k.slice()); }
    const a = flat(A), b = flat(B), ev = [];
    for (const [part, i0, i1] of PARTS) {
      const keys = [[0, "A"], ...(plan[part] || []), [1, "B"]], leg = part.length === 2, rel = leg && plan.rel;
      const vs = keys.map(([, v]) => (rel ? toRel(v === "A" ? A : v === "B" ? B : v, part) : (v === "A" ? a : v === "B" ? b : flat(v)).slice(i0, i1)));
      ev.push({ i0, n: i1 - i0, f: pchip(keys.map((k) => k[0]), vs), vs, us: keys.map((k) => k[0]), steps: keys.map((k) => k[2] || 0), hind: part[0] === "h", leg, rel, k: part });
    }
    const v = new Float64Array(47), tmp = new Float64Array(13);
    const dur = transDur(name, tempo);
    clip(name, dur, 30, (u) => {
      if (u === 0) TM.has.fill(false);
      TM.on = true; TM.lim = 0.35 + Math.max(0, u - 0.85) * 20;
      let Bu = null;
      for (const e of ev) {
        if (e.rel) {
          // (the body is keyed first in PARTS, so it is where it is by now)
          Bu = Bu || bodyOf(unflat(v));
          const i = e.f(u, tmp), h = e.steps[i + 1];
          if (h) { const [go, arc] = stepAt(u, e.us[i], e.us[i + 1]), A0 = e.vs[i], B0 = e.vs[i + 1]; for (let j = 0; j < e.n; j++) tmp[j] = lerp(A0[j], B0[j], go); tmp[1] += h * lt * arc; tmp[2] += (e.hind ? 0.45 : -0.6) * arc * Math.min(1, h / 0.03); }
          const g = fromRel(Bu, e.k, tmp);
          for (let j = 0; j < 5; j++) v[e.i0 + j] = g[j];
          continue;
        }
        const i = e.f(u, tmp), h = e.steps[i + 1];
        if (e.leg && h) {
          // A step: the paw lifts, then moves, then comes down, flexing on the way as in a walk (a
          // low shuffle, a paw folded under, flexes less).
          // (The paw's angle turns over the whole step, not only while it moves: a paw folded under
          // or brought out turns over gently instead of flicking round.)
          const [go, arc] = stepAt(u, e.us[i], e.us[i + 1]), A0 = e.vs[i], B0 = e.vs[i + 1], turn = smooth((u - e.us[i]) / (e.us[i + 1] - e.us[i]));
          for (let j = 0; j < e.n; j++) v[e.i0 + j] = lerp(A0[j], B0[j], j === 2 ? turn : go);
          v[e.i0 + 1] += h * lt * arc; v[e.i0 + 2] += (e.hind ? 0.45 : -0.6) * arc * Math.min(1, h / 0.03);
        } else for (let j = 0; j < e.n; j++) v[e.i0 + j] = tmp[j];
      }
      const P = pose(unflat(v));
      TM.on = false;
      return P;
    }, { loop: false, dur, fade: 0.12 });
  };
  const halfSit = (f) => { const a = sitPitch * f; return { root: [lerp(0, ground(a) + 0.01, smooth(f * 1.3)), sitShift * f, 0], pelvis: [a, 0, 0], spine: [sitSpine * f, 0, 0], chest: [sitChest * f, 0, 0] }; };
  // Sitting down: the forelegs stay straight and planted while the hindquarters fold and the rump
  // goes down behind the hind feet (which stay put, the hocks coming down to the ground); then the
  // chest comes up, the forepaws take a small step back under the shoulders, and the tail sweeps
  // round them.
  change("sitDown", STAND, SIT, {
    body: [[0.55, with_(STAND, halfSit(0.62))]],
    head: [[0.15, "A"]],
    // (the hocks come down to the ground as the sitting cat's do, the foot laid as flat as its thickness lets
    // it lie on the lawn rather than in it)
    hL: [[0.05, "A"], [0.55, with_(STAND, { legs: { hL: leg(rest("hL").x, 0.006, Math.min(-0.1, flatE("hL")), 0.25) } })]], hR: [[0.08, "A"], [0.58, with_(STAND, { legs: { hR: leg(rest("hR").x, 0.006, Math.min(-0.1, flatE("hR")), 0.25) } })]],
    // (each forepaw a real step back, lifted clear, not dragged)
    fL: [[0.5, "A"], [0.78, "B", 0.05]], fR: [[0.64, "A"], [0.94, "B", 0.05]],
    tail: [[0.55, with_(STAND, { tail: T(tailShape(-0.2), [0, 0, 0, 0]) })]],
  });
  // Standing up: the tail comes off the paws, the hind legs push the rump up and the body levels;
  // the forepaws step forward as the shoulders come over them.
  change("standUp", SIT, STAND, {
    // (forelegs the model joined into one piece step forward before the chest is half way up: stepped
    // while it rises over them, their shared skin creases at the armpits)
    body: [[0.12, "A"], [freeF < 0.3 ? 0.62 : 0.5, with_(STAND, halfSit(0.5))]],
    head: [[0.1, "A"]],
    hL: [[0.1, "A"], [0.62, "B"]], hR: [[0.12, "A"], [0.64, "B"]],
    fL: [[0.36, "A"], [0.68, "B", 0.05]], fR: [[0.58, "A"], [0.92, "B", 0.05]],
    // (the tail comes off the paws all the way up, not in a flick at the start)
    tail: [[0.08, "A"], [0.5, with_(SIT, { tail: T(lerpN(SIT_TAIL, STAND.tail.slice(0, 4), 0.35), SIT_SIDE.map((v) => v * 0.4)) })]],
  });
  // Lying down: the front end goes down first (the forepaws reach forward, elbows to the ground: a
  // brief bow), then the hind end folds down; the paws last tucked under if that is how this cat lies.
  // (the sphinx forelegs a cat that lies with its paws tucked brings out on the way down and up, resting on
  // the lawn by their skin, as the loaf's own legs do)
  const sph = (() => { const g = bakeLegs(with_(LOAF, { legs: { fL: sphinx("fL", sphReach), fR: sphinx("fR", sphReach) } })); return { fL: g.fL, fR: g.fR }; })();
  // (the forelegs laid out for the bow, the front end at its lowest: resting on the lawn by their skin, as the
  // loaf's do, not with the elbows sunk in it)
  const bowBody = with_(STAND, { root: [loafLift * 0.35, loafShift * 0.5, 0], pelvis: [-0.28, 0, 0], spine: [0, 0, 0], chest: [0.06, 0, 0] });
  const sphBow = bakeLegs(with_(bowBody, { legs: sph }), 0.3 * lt);
  const sphA = with_(STAND, { legs: { fL: sphBow.fL, fR: sphBow.fR } }), sphB = with_(LOAF, { legs: sph });
  change("lieDown", STAND, LOAF, {
    body: [[0.42, bowBody]],
    head: [[0.2, "A"]],
    fL: [[0.08, "A"], [0.3, sphA, 0.04], ...(tuckLate ? [[0.52, sphB], [0.84, "B", 0.012]] : [])], fR: [[0.16, "A"], [0.38, sphA, 0.04], ...(tuckLate ? [[0.62, sphB], [0.98, "B", 0.012]] : [])],
    hL: [[0.4, "A"]], hR: [[0.44, "A"]],
    tail: [[0.4, "A"]],
  });
  // Getting up: paws out from under (if tucked), the forelegs push the chest up, the forepaws step back
  // under the shoulders, then the hind legs rise.
  const upF = (k) => with_(STAND, { legs: { [k]: planted(k) } });
  change("getUp", LOAF, STAND, {
    body: [[tuckLate ? 0.3 : 0.04, "A"], [tuckLate ? 0.55 : 0.45, with_(LOAF, { root: [loafLift + 0.2 * lt, loafShift * 0.6, 0], pelvis: [0.28, 0, 0], spine: [0.02, 0, 0], chest: [0.02, 0, 0] })]],
    head: [[0.05, "A"]],
    fL: [...(tuckLate ? [[0.27, sphB, 0.012]] : [[0.05, "A"]]), [tuckLate ? 0.33 : 0.22, sphB], [tuckLate ? 0.5 : 0.4, upF("fL"), 0.05]],
    fR: [...(tuckLate ? [[0.08, "A"], [0.36, sphB, 0.012]] : [[0.1, "A"]]), [tuckLate ? 0.41 : 0.3, sphB], [tuckLate ? 0.6 : 0.5, upF("fR"), 0.05]],
    hL: [[tuckLate ? 0.55 : 0.45, "A"]], hR: [[tuckLate ? 0.58 : 0.48, "A"]],
    tail: [[0.4, "A"]],
  });
  // From sitting to lying: the forepaws walk forward as the chest goes down; the rump stays.
  const low = with_(SIT, { root: [lerp(sitLift, loafLift, 0.5) + 0.02, lerp(sitShift, loafShift, 0.5), 0], pelvis: [sitPitch * 0.45, 0, 0] });
  const sitSph = with_(SIT, { legs: sph });
  change("sitToLie", SIT, LOAF, {
    body: [[0.15, "A"], [0.55, low]],
    head: [[0.1, "A"]],
    fL: [[0.05, "A"], [0.38, sitSph, 0.04], ...(tuckLate ? [[0.55, sphB], [0.86, "B", 0.012]] : [])], fR: [[0.2, "A"], [0.52, sitSph, 0.04], ...(tuckLate ? [[0.64, sphB], [0.98, "B", 0.012]] : [])],
    tail: [[0.2, with_(SIT, { tail: T(SIT_TAIL, [0, 0.2, 0.3, 0.3]) })]],
  });
  // From lying to sitting: the forelegs push the chest up and the forepaws step back under it.
  change("lieToSit", LOAF, SIT, {
    // (forelegs the model joined into one piece push the chest right up first and only then step back under
    // it: stepped back while the chest still rises over them, their shared skin creases at the armpits)
    body: [[tuckLate ? 0.32 : 0.03, "A"], [tuckLate ? 0.62 : freeF < 0.3 ? 0.22 : 0.5, low]],
    head: [[0.05, "A"]],
    fL: [...(tuckLate ? [[0.29, sphB, 0.012]] : [[0.02, "A"]]), [tuckLate ? 0.35 : 0.2, sphB], [tuckLate ? 0.66 : 0.55, "B", 0.04]], fR: [...(tuckLate ? [[0.08, "A"], [0.38, sphB, 0.012]] : [[0.08, "A"]]), [tuckLate ? 0.44 : 0.35, sphB], [tuckLate ? 0.84 : 0.75, "B", 0.04]],
    tail: [[0.4, with_(LOAF, { tail: T(SIT_TAIL, [0, 0.2, 0.3, 0.3]) })]],
  });
  // Curling up to sleep: the head goes down a little, then the cat rolls over onto its side as its
  // back rounds, its legs coming along folded against it, the tail sweeping round; last the head
  // settles onto the ground. (The legs are keyed in their hips' and shoulders' own frames, so they
  // go round with the body instead of being left behind on the ground.)
  const SLEEP_UP = loafSleep ? with_(SLEEP, { neck: LOAF.neck.slice(), head: LOAF.head.slice() }) : with_(SLEEP, { neck: [SLEEP.neck[0] + 0.55 * curl, SLEEP.neck[1] * 0.6, 0], head: [SLEEP.head[0] + 0.75 * curl, SLEEP.head[1] * 0.6, 0.05] });
  change("curlUp", LOAF, SLEEP, {
    rel: true,
    fL: [[0.1, "A"], [0.78, "B"]], fR: [[0.16, "A"], [0.82, "B"]],
    hL: [[0.14, "A"], [0.8, "B"]], hR: [[0.2, "A"], [0.85, "B"]],
    body: [[0.12, "A"], [0.82, "B"]],
    head: [[0.08, "A"], [0.6, SLEEP_UP]],
    tail: [[0.3, "A"], [0.92, "B"]],
  });
  // Waking: the head comes up first, then the cat rolls back onto its belly as its back straightens,
  // the legs coming under it, the tail uncurling (before the body is upright: a tail curled under an
  // upright cat would go into the ground).
  change("wake", SLEEP, LOAF, {
    rel: true,
    head: [[0.04, "A"], [0.32, SLEEP_UP], [0.8, "B"]],
    body: [[0.22, "A"], [0.82, "B"]],
    tail: [[0.12, "A"], [0.62, "B"]],
    hL: [[0.25, "A"], [0.84, "B"]], hR: [[0.28, "A"], [0.88, "B"]],
    fL: [[0.2, "A"], [0.8, "B"]], fR: [[0.24, "A"], [0.86, "B"]],
  });
  return clips;
}

/** How many walk cycles per unit of ground covered, for a cat drawn at `scale` (model units -> world)
    walking in its own style (its stride) and its model's fit (the same fit as its clips'). */
export function cyclesPerUnit(rig, scale, style, fit = null) {
  return 1 / Math.max(0.02, walkStride(rig, style, fit) * scale);
}
