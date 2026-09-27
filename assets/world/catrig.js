/* A quadruped cat rig for the cats that have their own model (assets/models/cats/<TICKER>.glb).

   Ready-made rigging services (Higgsfield's, Meshy's auto-rigging) are for people: biped
   skeletons and human clips. So the cats are rigged here instead, at load time, from the shape of
   each model:

   1. findRig(positions): every model is a cat standing on all fours (made that way on purpose:
      scripts/make-cat-models.py, notes in scripts/CAT-MODELS.md), normalized to y up, facing
      +X, 1 unit tall, feet on y = 0. The four paws are the clusters of points on the ground
      (front/hind by x, left/right by z); the belly and back lines come from the middle of the
      body (for a big cartoon head sitting over the body, the back is where the body narrows into
      the neck); the head is the high point ahead of the front legs; the tail is followed from the
      rump to its furthest point and cut into four joints. Each leg's joints are placed on its own
      centre line, in a cat's proportions (thigh and shin about equal, a shorter foot), with the
      hip and shoulder up inside the body.
   2. One skeleton, the same bone names for every cat (so one clip set drives them all):
        root > pelvis > spine > chest > neck > head
               pelvis > tail1 > tail2 > tail3 > tail4
               pelvis > thigh.L/R > shin.L/R > foot.L/R      (hind legs)
               chest  > arm.L/R   > forearm.L/R > paw.L/R    (front legs)
      Bones have no rest rotation, so each clip's angles read in model axes: z turns in the
      side view (+ lifts the nose, swings a leg forward), y turns left/right, x rolls.
   3. skinWeights(): each point goes to the bone it lies nearest (in units of that bone's
      thickness) among the bones it may belong to (a left leg only takes left-side points, the
      head everything past a plane across the neck, a leg everything inside its own column, ...); then the weights are blurred along the
      mesh surface (welded where Meshy cut its UVs per triangle), so joints bend over a band of
      skin instead of tearing, and only between bones that meet there.
   4. makeClips(rig): the clips, posed by targets rather than fixed angles, so one set fits long
      legs, stubby legs and big heads: two-bone IK puts every paw where the pose wants it (on the
      ground, folded under, raised to the mouth) and every tail is aimed along a curve. walk, trot,
      run, stalk (low creep), stand, sniff, greet (tail straight up), sit, look, pant, groom (paw
      to mouth, licks), knead, loaf (sphinx), sleep (curled, nose to tail), eat (head down,
      chewing), stretch (play bow), crouch, wiggle (bottom wiggle before a pounce), pounce
      (stretched leap), scratch (reared up on a tree). Sitting and lying poses are lowered until
      the rump and belly just touch the ground.

   Walking clips are not played by the clock: the renderer sets their time from the distance the
   cat has moved (cyclesPerUnit, GAIT_RATE). Each paw stays planted while it carries weight and the
   body moves over it at the same rate, so the paws don't slide. */

import * as THREE from "three";

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pct = (arr, p) => { if (!arr.length) return 0; const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))))]; };
const mean = (pts) => pts.reduce((m, p) => m.add(p), V()).divideScalar(Math.max(1, pts.length));

/** The bone layout for a normalized standing cat (positions: Float32Array of x,y,z). */
export function findRig(pos) {
  const n = pos.length / 3, P = [];
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
  const yb = Math.max(0.12 * H, pct(mid.map((p) => p.y), 0.04));
  let yt = Math.max(yb + 0.1, pct(mid.map((p) => p.y), 0.97));
  // A big cartoon head can sit right over the body (chibi cats): then the body's cross-section,
  // going up, narrows at the neck and widens again into the head. The back is at the neck.
  {
    const band = P.filter((p) => p.x > hindX + 0.25 * d && p.x < frontX - 0.25 * d);
    const bins = 24, w = [], step = (yt - yb) / bins;
    for (let b = 0; b < bins; b++) { const zs = band.filter((p) => p.y >= yb + b * step && p.y < yb + (b + 1) * step).map((p) => p.z); w.push(zs.length > 8 ? pct(zs, 0.95) - pct(zs, 0.05) : null); }
    for (let b = 0; b < bins; b++) if (w[b] === null) w[b] = w[b - 1] ?? w.find((v) => v !== null) ?? 0; // thin slices: as the one below
    let wmax = 0, cut = -1;
    for (let b = 3; b < bins - 2; b++) {
      wmax = Math.max(wmax, ...w.slice(0, b));
      const above = w.slice(b + 1);
      if (w[b] < 0.8 * wmax && above.filter((v) => v > w[b] * 1.3).length >= 3) {
        let m = b; while (m + 1 < bins && w[m + 1] <= w[m]) m++;
        cut = m; break;
      }
    }
    if (cut > 0) yt = Math.max(yb + 0.1, yb + (cut + 0.5) * step);
  }
  const yMid = (yb + yt) / 2;
  // Head: the high points ahead of the middle of the body.
  const headPts = P.filter((p) => p.x > (frontX + hindX) / 2 && p.y > yt - 0.02);
  const headC = headPts.length > 10 ? mean(headPts) : V(frontX + 0.2 * d, yt + 0.15, zc);
  const noseX = Math.max(headC.x + 0.05, pct(headPts.map((p) => p.x), 0.98));
  // Tail: from behind the rump to its furthest point, in four joints.
  const tailBase = V(hindX - 0.22 * d, yb + 0.72 * (yt - yb), zc);
  const tailPts = P.filter((p) => p.x < tailBase.x && p.y > yb + 0.25 * (yt - yb));
  let tailTip = V(x0, yt, zc);
  if (tailPts.length) { let best = -1; for (const p of tailPts) { const dd = p.distanceTo(tailBase); if (dd > best) { best = dd; tailTip = p.clone(); } } }
  const tail = [tailBase.clone()];
  const span = tailTip.distanceTo(tailBase);
  for (let k = 1; k <= 4; k++) {
    const r0 = span * (k - 0.5) / 4, r1 = span * (k + 0.5) / 4;
    const ring = tailPts.filter((p) => { const dd = p.distanceTo(tailBase); return dd >= r0 && dd < r1; });
    tail.push(k === 4 ? tailTip.clone() : ring.length ? mean(ring) : tailBase.clone().lerp(tailTip, k / 4));
  }
  // Legs: each leg's centre line, found from slices of the mesh around its paw (so the joints sit
  // inside the leg even when the model's legs are straight columns or bent), from the paw up to
  // the belly; the top joint (hip or shoulder) sits up inside the body, as a real cat's does.
  const legR = Math.max(0.07, (z1 - z0) * 0.3);
  const nearest = (p) => { let k0 = null, b0 = Infinity; for (const k of ["fL", "fR", "hL", "hR"]) { const q = paws[k], dd = Math.hypot(p.x - q.x, (p.z - q.z) * 1.2); if (dd < b0) { b0 = dd; k0 = k; } } return [k0, b0]; };
  const own = { fL: [], fR: [], hL: [], hR: [] };
  for (const p of P) if (p.y < yb + 0.1 * (yt - yb)) { const [k, dd] = nearest(p); if (dd < legR) own[k].push(p); }
  const legs = {};
  for (const k of ["fL", "fR", "hL", "hR"]) {
    const pts = own[k], paw = paws[k], front = k[0] === "f";
    const slice = (y, band = 0.03 * H) => { const s = pts.filter((p) => Math.abs(p.y - y) < band && p.y < yb); return s.length >= 6 ? s : null; };
    const at = (y) => { const s = slice(y); if (!s) return V(paw.x, y, paw.z); const m = mean(s); return V(m.x, y, m.z); };
    // A cat's leg in proportion: thigh and shin about equal, the foot shorter (hind); upper arm,
    // forearm, and a short paw (front). Each joint sits on the leg's own centre line.
    const topY = yb + (front ? 0.5 : 0.45) * (yt - yb);
    const knee = at(topY * (front ? 0.58 : 0.6)), low = at(topY * (front ? 0.17 : 0.25)), up = at(Math.min(yb * 0.9, topY * 0.8));
    const s0 = slice(Math.min(yb * 0.6, topY * 0.45), 0.05 * H);
    const cx = s0 ? mean(s0) : paw;
    const r = s0 ? pct(s0.map((p) => Math.hypot(p.x - cx.x, p.z - cx.z)), 0.75) : legR * 0.4;
    const top = V(up.x + (front ? -0.03 : 0.03) * d, topY, zc + (up.z - zc) * 0.6);
    legs[k] = { top, knee: V(knee.x + (front ? -0.01 : 0.02) * d, knee.y, knee.z), low: V(low.x + (front ? 0 : -0.02) * d, low.y, low.z), toe: V(paw.x + (front ? 0.035 : 0.03), 0, paw.z), r: Math.max(0.02, Math.min(legR * 0.6, r)) };
  }
  // Thickness of the body, neck, head and tail, for weighting skin by distance relative to size.
  const headR = Math.max(0.06, pct(headPts.map((p) => p.distanceTo(headC)), 0.6));
  let tailR = 0.025;
  { const ring = tailPts.filter((p) => { const dd = p.distanceTo(tailBase); return dd > span * 0.35 && dd < span * 0.65; });
    if (ring.length > 6) { const c = mean(ring); tailR = Math.max(0.012, Math.min(0.08, pct(ring.map((p) => p.distanceTo(c)), 0.7))); } }
  const legTop = (legs.hL.top.y + legs.hR.top.y + legs.fL.top.y + legs.fR.top.y) / 4;
  return {
    H, L: x1 - x0, W: z1 - z0, zc, yb, yt, yMid, frontX, hindX, d, paws, headC, noseX, tail, legs, headR, tailR, bodyR: Math.max(0.05, (yt - yb) / 2),
    // The underside and back of the body (rump, belly), to keep them on or above the ground.
    legR,
    under: [V(hindX - 0.3 * d, yb + 0.35 * (yt - yb), zc), V(hindX - 0.18 * d, yb + 0.08 * (yt - yb), zc), V(hindX, yb, zc), V((frontX + hindX) / 2, yb, zc), V(frontX, yb, zc)],
    pelvis: V(hindX + 0.05 * d, yMid, zc), chest: V(frontX - 0.05 * d, yMid, zc), spine: V((frontX + hindX) / 2, yMid, zc),
    neck: V(frontX + 0.04 * d, yMid + 0.25 * (yt - yb), zc), headJoint: V(frontX + 0.14 * d + (headC.x - frontX) * 0.35, (yt + headC.y) / 2, zc),
    legTop, legLen: legTop,
  };
}

const LEGS = [["thigh", "shin", "foot", "h"], ["arm", "forearm", "paw", "f"]];

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
export function skinWeights(pos, rig, sk, index = null) {
  const bonesList = sk.skeleton.bones, names = bonesList.map((b) => b.name), B = names.length;
  const seg = {}, rad = {};
  const endOf = { head: V(rig.noseX, rig.headC.y, rig.zc), tail4: rig.tail[4], chest: rig.neck, root: rig.pelvis };
  for (const b of bonesList) {
    const kid = b.children.find((c) => c.isBone && !c.name.startsWith("tail") && !/^(thigh|arm)/.test(c.name)) || b.children.find((c) => c.isBone);
    let end = endOf[b.name] || (kid ? kid.userData.at : null);
    if (!end && /^(foot|paw)/.test(b.name)) end = rig.legs[(b.name.startsWith("foot") ? "h" : "f") + b.name.slice(-1)].toe;
    seg[b.name] = [b.userData.at, end || b.userData.at];
    const leg = /\.(L|R)$/.test(b.name) ? rig.legs[(/^(thigh|shin|foot)/.test(b.name) ? "h" : "f") + b.name.slice(-1)] : null;
    rad[b.name] = leg ? leg.r * (/^(thigh|arm)/.test(b.name) ? 1.6 : 1) : b.name.startsWith("tail") ? rig.tailR : b.name === "head" ? rig.headR : b.name === "neck" ? rig.bodyR * 0.8 : rig.bodyR;
  }
  const n = pos.length / 3;
  // Weld: points at the same place are one point (Meshy's per-triangle UV cuts split them).
  const key = new Map(), uid = new Int32Array(n);
  let U = 0;
  for (let i = 0; i < n; i++) {
    const k = (Math.round(pos[i * 3] * 2e4) + 65536) + (Math.round(pos[i * 3 + 1] * 2e4) + 65536) * 131072 + (Math.round(pos[i * 3 + 2] * 2e4) + 65536) * 17179869184;
    let u = key.get(k); if (u === undefined) { u = U++; key.set(k, u); } uid[i] = u;
  }
  const up = new Float32Array(U * 3);
  for (let i = 0; i < n; i++) { const o = uid[i] * 3; up[o] = pos[i * 3]; up[o + 1] = pos[i * 3 + 1]; up[o + 2] = pos[i * 3 + 2]; }
  // Each bone: its segment, thickness and which points it may take.
  const midX = (rig.pelvis.x + rig.chest.x) / 2, p = V();
  // The head's side of a plane across the neck (a third of the way to the head joint): points
  // there go to the neck and head only, however far back a big cartoon head reaches.
  const hd = V().subVectors(rig.headJoint, rig.neck), hp = rig.neck.clone().addScaledVector(hd, 0.3);
  hd.z = 0; hd.normalize();
  const info = bonesList.map((b, i) => {
    const nm = b.name, lr = nm.match(/\.(L|R)$/);
    return { i, a: seg[nm][0], b: seg[nm][1], r: rad[nm], root: nm === "root", tail: nm.startsWith("tail"), head: nm === "head", headOk: nm === "head" || nm === "neck", side: lr ? lr[1] : null, hind: /^(thigh|shin|foot)/.test(nm) };
  });
  // The welded mesh's neighbours (when it has triangles): for the legs' pieces and the blur.
  let nb = null, start = null, elen = 0, ecount = 0;
  if (index || n % 3 === 0) {
    const nt = index ? index.length : n, deg = new Int32Array(U + 1);
    const edges = new Set();
    const link = (a2, b2) => { if (a2 === b2) return; const k = a2 < b2 ? a2 * U + b2 : b2 * U + a2; if (edges.has(k)) return; edges.add(k); deg[a2]++; deg[b2]++;
      if (ecount < 20000) { elen += Math.hypot(up[a2 * 3] - up[b2 * 3], up[a2 * 3 + 1] - up[b2 * 3 + 1], up[a2 * 3 + 2] - up[b2 * 3 + 2]); ecount++; } };
    for (let t = 0; t + 2 < nt; t += 3) { const a2 = uid[index ? index[t] : t], b2 = uid[index ? index[t + 1] : t + 1], c2 = uid[index ? index[t + 2] : t + 2]; link(a2, b2); link(b2, c2); link(c2, a2); }
    start = new Int32Array(U + 1);
    for (let u = 0; u < U; u++) start[u + 1] = start[u] + deg[u];
    nb = new Int32Array(start[U]); const fill = start.slice(0, U);
    for (const k of edges) { const a2 = Math.floor(k / U), b2 = k - a2 * U; nb[fill[a2]++] = b2; nb[fill[b2]++] = a2; }
  }
  // How far a point is from a leg's centre line at its own height, in units of the leg's radius.
  const LK = ["hL", "hR", "fL", "fR"], lower = { hL: "L", hR: "R", fL: "L", fR: "R" };
  const colDist = (k, q) => {
    const g = rig.legs[k], line = [g.toe, g.low, g.knee, g.top];
    let a = line[0], b = line[1];
    for (let j = 1; j < 4; j++) { a = line[j - 1]; b = line[j]; if (q.y <= line[j].y) break; }
    const t = Math.max(0, Math.min(1, (q.y - a.y) / Math.max(1e-6, b.y - a.y)));
    return Math.hypot(q.x - (a.x + (b.x - a.x) * t), q.z - (a.z + (b.z - a.z) * t)) / g.r;
  };
  const legOf = { hL: ["thigh.L", "shin.L", "foot.L"], hR: ["thigh.R", "shin.R", "foot.R"], fL: ["arm.L", "forearm.L", "paw.L"], fR: ["arm.R", "forearm.R", "paw.R"] };
  // Each leg's own piece of the mesh: cut the surface level at the highest height (from the belly
  // down) where the four paws' pieces are still apart, and take what hangs from each paw. A
  // generated model's legs can be fat, bent or fused to a low belly; the mesh still says where
  // one leg ends.
  let piece = null;
  if (nb) {
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
        piece = lab; piece.fused = true;
      }
    }
  }
  const seed = new Int32Array(U);
  for (let u = 0; u < U; u++) {
    p.set(up[u * 3], up[u * 3 + 1], up[u * 3 + 2]);
    const side = p.z >= rig.zc ? "L" : "R", mid = Math.abs(p.z - rig.zc) < 0.01;
    const headSide = (p.x - hp.x) * hd.x + (p.y - hp.y) * hd.y > 0, under = p.y < rig.yb - 0.01;
    // Inside a leg's column (below the top of the leg): that leg's bones only.
    let inLeg = piece ? (piece[u] >= 0 ? LK[piece[u]] : null) : null;
    if (inLeg && piece.fused && p.y > rig.legs[inLeg].knee.y && colDist(inLeg, p) > 1.3) inLeg = null;
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
      if (inLeg) { if (!legOf[inLeg].includes(names[f.i])) continue; }
      else if (f.tail) { if (p.x > rig.pelvis.x) continue; }
      else if (headSide) { if (!f.headOk) continue; }
      else if (f.head) continue;
      else if (f.side) {
        if ((f.side !== side && !mid) || (f.hind ? p.x > midX : p.x < midX)) continue;
        if (!/^(thigh|arm)/.test(names[f.i]) && !under) continue; // above the belly, only a leg's top bone
      }
      const dd = segDist(p, f.a, f.b) / f.r;
      if (dd < bd) { bd = dd; best = f.i; }
    }
    seed[u] = best;
  }
  // Weight can only spread to a bone's family (parent, grandparent, children, grandchildren,
  // siblings): a joint blends the bones that meet there, never far-off ones.
  const fam = bonesList.map((b) => {
    const set = new Set([b]);
    const par = b.parent?.isBone ? b.parent : null;
    if (par) { set.add(par); if (par.parent?.isBone) set.add(par.parent); for (const c of par.children) if (c.isBone) set.add(c); }
    for (const c of b.children) if (c.isBone) { set.add(c); for (const g of c.children) if (g.isBone) set.add(g); }
    return [...set].map((x) => bonesList.indexOf(x)).filter((j) => j > 0);
  });
  const W = new Float32Array(U * B);
  for (let u = 0; u < U; u++) W[u * B + seed[u]] = 1;
  // Blur along the surface: rounds of averaging with the neighbours, as many as it takes to
  // spread about BLEND for this mesh's edge length.
  if (nb) {
    const e = ecount ? elen / ecount : 0.02;
    const rounds = Math.max(2, Math.min(28, Math.round((BLEND / e) ** 2)));
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

const E = new THREE.Euler(), Q = new THREE.Quaternion();
/** A pose: { bone: [z, y, x] radians } plus `lift` (root height change, units of the model). */
function sampleClip(name, dur, fps, fn, loop = true) {
  const frames = Math.max(2, Math.round(dur * fps) + (loop ? 1 : 0));
  const times = [], per = {}, lift = [];
  for (let f = 0; f < frames; f++) {
    const t = (f / (frames - 1)) * dur; times.push(t);
    const pose = fn(t / dur);
    for (const [bone, r] of Object.entries(pose)) {
      if (bone === "lift" || bone === "shift") continue;
      (per[bone] ||= []).push(...Q.setFromEuler(E.set(r[2] || 0, r[1] || 0, r[0] || 0, "ZYX")).toArray());
    }
    lift.push(pose.shift || 0, pose.lift || 0, 0);
  }
  const tracks = Object.entries(per).map(([b, v]) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, v));
  tracks.push(new THREE.VectorKeyframeTrack("root.position", times, lift)); // the root rests at the origin
  const clip = new THREE.AnimationClip(name, dur, tracks);
  clip.userData = { loop };
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
    legs[k] = { top: g.top, a: [ang(g.top, g.knee), ang(g.knee, g.low), ang(g.low, g.toe)], l: [len2(g.top, g.knee), len2(g.knee, g.low), len2(g.low, g.toe)], toe: g.toe, hind: k[0] === "h" };
    legs[k].reach = legs[k].l[0] + legs[k].l[1] + legs[k].l[2];
  }
  const tail = [];
  for (let k = 1; k <= 4; k++) tail.push({ a: ang(rig.tail[k - 1], rig.tail[k]), l: len2(rig.tail[k - 1], rig.tail[k]) });
  return { legs, tail, P0: rig.pelvis, S0: rig.spine, C0: rig.chest, N0: rig.neck, H0: rig.headJoint, T0: rig.tail[0] };
}

/** Forward kinematics of the body in the side view: where the hips, shoulders and head end up for
    a pose's root shift/lift and its pelvis, spine and chest pitches. */
function body(K, p) {
  const rx = p.shift || 0, ry = p.lift || 0;
  const aP = z(p.pelvis), aS = aP + z(p.spine), aC = aS + z(p.chest);
  const at = (base, a, from, to) => { const [dx, dy] = rot2(to.x - from.x, to.y - from.y, a); return { x: base.x + dx, y: base.y + dy }; };
  const pel = { x: K.P0.x + rx, y: K.P0.y + ry };
  const spi = at(pel, aP, K.P0, K.S0), che = at(spi, aS, K.S0, K.C0);
  const aN = aC + z(p.neck), nec = at(che, aC, K.C0, K.N0), hed = at(nec, aN, K.N0, K.H0);
  const top = {};
  for (const k of KEYS) top[k] = K.legs[k].hind ? { ...at(pel, aP, K.P0, K.legs[k].top), pa: aP } : { ...at(che, aC, K.C0, K.legs[k].top), pa: aC };
  return { aP, aS, aC, aN, pel, che, nec, hed, top };
}

/**
 * Two-bone IK for one leg in the side view: puts the toe at `toe` (x, y; y = 0 is the ground) with
 * the last segment (hind foot or front paw) pointing along `end` (radians; the rest direction if
 * null). Hind knees bend forward, front elbows back. Writes the three bones' angles into the pose.
 */
function legTo(K, p, B, k, toe, end = null, roll = 0) {
  const L = K.legs[k], [l1, l2, l3] = L.l, T = B.top[k];
  const e = end === null ? L.a[2] : end;
  const lx = toe.x - l3 * Math.cos(e), ly = toe.y - l3 * Math.sin(e);
  const dx = lx - T.x, dy = ly - T.y, c = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, Math.hypot(dx, dy)));
  const th = Math.atan2(dy, dx), A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + c * c - l2 * l2) / (2 * l1 * c))));
  const a1 = L.hind ? th + A : th - A;
  const kx = T.x + l1 * Math.cos(a1), ky = T.y + l1 * Math.sin(a1);
  const a2 = Math.atan2(ly - ky, lx - kx);
  const w1 = a1 - L.a[0], w2 = a2 - L.a[1], w3 = e - L.a[2];
  const [n1, n2, n3] = LEG[k];
  p[n1] = [w1 - T.pa, 0, roll]; p[n2] = [w2 - w1, 0, 0]; p[n3] = [w3 - w2, 0, 0];
}

/** The tail along a curve: `dirs` are the four segments' directions in the side view (radians:
    PI points straight back, PI/2 up), `side` their turn to the side (y). */
function tailTo(K, p, B, dirs, side = [0, 0, 0, 0]) {
  let prev = B.aP;
  for (let k = 0; k < 4; k++) {
    const w = dirs[k] - K.tail[k].a;
    p[`tail${k + 1}`] = [w - prev, side[k] || 0, 0];
    prev = w;
  }
}
const curve = (a0, bend) => [a0, a0 + bend, a0 + 2 * bend, a0 + 3 * bend];

/** How far a cat's body moves in one walk cycle, in model units (other gaits: STRIDE[gait] times more). */
export const walkStride = (rig) => 1.1 * rig.legTop;
/** The renderer steps trot, run and stalk cycles this much slower (or faster) per unit walked. */
export const GAIT_RATE = { walk: 1, trot: 0.8, run: 0.55, stalk: 1.3 };

/**
 * The clip set for one rig. Every leg is posed by where its paw goes (two-bone IK), every tail by
 * where it points, so one set of poses fits long-legged, short-legged and big-headed cats alike:
 * walking paws stay planted while the body passes over them; sitting and lying cats fold their
 * legs onto the ground whatever their length.
 */
export function makeClips(rig) {
  const K = kinematics(rig), d = rig.d, lt = rig.legTop, yb = rig.yb;
  const clips = {};
  const S = Math.sin, C = Math.cos, PI = Math.PI;
  const ease = (x) => x * x * (3 - 2 * x);
  const rest = (k) => ({ x: K.legs[k].toe.x, y: 0 });
  const stride0 = walkStride(rig);

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
  // Walking gaits: each paw is planted for `duty` of the cycle and slides back under the body as the
  // body moves on (so it stays still on the ground), then swings forward in an arc.
  const gait = (u, { rate = 1, duty = 0.62, lift = 0.1, phase = { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 }, crouch = 0, flex = 0, bob = 0.008, tail = PI - 0.25, head = 0 } = {}) => {
    const stride = stride0 / rate, sweep = stride * duty;
    const p = { lift: -crouch * lt - bend(sweep) - bob * Math.abs(S(TAU * u * 2)), pelvis: [flex * S(TAU * u) * 0.5, S(TAU * u) * 0.05, S(TAU * u) * 0.03], spine: [0, 0, 0], chest: [-flex * S(TAU * u) * 0.8, -S(TAU * u) * 0.06, 0] };
    p.neck = [-0.05 + head - crouch * 0.6 + S(TAU * u * 2) * 0.03, S(TAU * u) * 0.05, 0];
    p.head = [crouch * 0.5 - S(TAU * u * 2) * 0.03, 0, 0];
    const B = body(K, p);
    for (const k of KEYS) {
      const L = K.legs[k], f = (u + phase[k]) % 1, r0 = rest(k);
      let x, y, e = L.a[2];
      if (f < duty) { x = r0.x + sweep * (0.5 - f / duty); y = 0; }
      else { const s = (f - duty) / (1 - duty); x = r0.x + sweep * (ease(s) - 0.5); y = lift * lt * S(PI * s) ** 0.8; e = L.a[2] + (L.hind ? 0.45 : -0.6) * S(PI * s); }
      legTo(K, p, B, k, { x, y }, e);
    }
    tailTo(K, p, B, curve(tail + S(TAU * u) * 0.04, -0.12), [0, S(TAU * u - 0.5) * 0.25, S(TAU * u - 1.2) * 0.3, S(TAU * u - 1.9) * 0.35]);
    return p;
  };
  clips.walk = sampleClip("walk", 1, 32, (u) => gait(u));
  clips.trot = sampleClip("trot", 1, 32, (u) => gait(u, { rate: GAIT_RATE.trot, duty: 0.45, lift: 0.16, phase: { hL: 0, fR: 0, hR: 0.5, fL: 0.5 }, bob: 0.014, tail: PI - 0.45 }));
  clips.run = sampleClip("run", 1, 32, (u) => gait(u, { rate: GAIT_RATE.run, duty: 0.32, lift: 0.22, phase: { hL: 0, hR: 0.08, fL: 0.5, fR: 0.58 }, flex: 0.22, bob: 0.03, tail: PI - 0.1 }));
  clips.stalk = sampleClip("stalk", 1, 32, (u) => gait(u, { rate: GAIT_RATE.stalk, duty: 0.72, lift: 0.07, crouch: 0.28, bob: 0.003, tail: PI + 0.15, head: 0.1 }));

  // Standing: paws planted, breathing, a slow look about, a lazy tail; `extra` bends it.
  const stand = (u, extra = {}, tail = null) => {
    const p = { lift: S(TAU * u * 2) * 0.003, pelvis: [0, 0, S(TAU * u) * 0.01], spine: [0, 0, 0], chest: [S(TAU * u * 2) * 0.012, 0, 0], neck: [0, S(TAU * u) * 0.25, 0], head: [S(TAU * u * 3) * 0.04, S(TAU * u + 1) * 0.15, 0] };
    Object.assign(p, extra);
    const B = body(K, p);
    for (const k of KEYS) legTo(K, p, B, k, extra.toes?.[k] || rest(k));
    delete p.toes;
    tailTo(K, p, B, tail || curve(PI + 0.55 + S(TAU * u) * 0.05, -0.28), [0, S(TAU * u) * 0.2, S(TAU * u - 0.8) * 0.3, S(TAU * u - 1.6) * 0.35]);
    return p;
  };
  clips.stand = sampleClip("stand", 8, 12, (u) => stand(u));
  clips.sniff = sampleClip("sniff", 3, 16, (u) => stand(u, { chest: [-0.12, 0, 0], neck: [-1.1 + S(TAU * u * 3) * 0.08, S(TAU * u * 2) * 0.3, 0], head: [0.35 + S(TAU * u * 11) * 0.04, 0, 0], lift: -0.02 }));
  clips.greet = sampleClip("greet", 3, 16, (u) => stand(u, { neck: [0.12, 0, S(TAU * u) * 0.1], head: [0.1, S(TAU * u) * 0.12, S(TAU * u * 2) * 0.1] },
    [PI / 2 + 0.12, PI / 2 + 0.05, PI / 2 - 0.3, PI / 2 - 1.1 + S(TAU * u * 2) * 0.2]));
  clips.eat = sampleClip("eat", 1.4, 20, (u) => stand(0.2, { lift: -0.03, chest: [-0.18, 0, 0], neck: [-1.35, 0, 0], head: [0.45 - Math.max(0, S(TAU * u * 2)) * 0.15, 0, 0] }));

  // How far to lift (or drop) a pose so the lowest point of the body's underside sits at `clear`.
  const ground = (p, clear = 0.012) => {
    const B = body(K, { ...p, lift: 0, shift: 0 });
    let lo = Infinity;
    for (const q of rig.under) { const [dx, dy] = rot2(q.x - K.P0.x, q.y - K.P0.y, B.aP); lo = Math.min(lo, K.P0.y + dy); void dx; }
    return clear - lo;
  };
  // Sitting: the bottom on the ground, the body pitched up until the front legs (nearly straight)
  // reach the ground, the hind legs folded with the feet flat forward, the tail round the paws.
  const reachF = (K.legs.fL.reach + K.legs.fR.reach) / 2;
  let sitPitch = 0.3, sitLift = 0;
  for (let a = 0.3; a <= 0.95; a += 0.025) {
    sitPitch = a; sitLift = ground({ pelvis: [a, 0, 0] });
    const B = body(K, { lift: sitLift, pelvis: [a, 0, 0] });
    if ((B.top.fL.y + B.top.fR.y) / 2 > reachF * 0.9) break;
  }
  const sit = (u, extra = {}) => {
    const b = S(TAU * u * 2) * 0.01;
    const p = { lift: sitLift, pelvis: [sitPitch, 0, 0], spine: [0.04 + b, 0, 0], chest: [0.02, 0, 0], neck: [-sitPitch * 0.75, S(TAU * u) * 0.3, 0], head: [-0.1 + S(TAU * u * 3) * 0.04, S(TAU * u + 1) * 0.2, 0] };
    Object.assign(p, extra);
    const B = body(K, p);
    for (const k of ["hL", "hR"]) { const T = B.top[k]; legTo(K, p, B, k, { x: T.x + K.legs[k].l[2] * 0.95, y: 0.015 }, -0.06, k === "hL" ? 0.12 : -0.12); }
    for (const k of ["fL", "fR"]) if (!extra[LEG[k][0]]) { const T = B.top[k], R = K.legs[k].reach * 0.985; legTo(K, p, B, k, extra.toes?.[k] || { x: T.x + Math.sqrt(Math.max(0, R * R - T.y * T.y)) + 0.005, y: 0 }); }
    delete p.toes;
    tailTo(K, p, B, [PI + 1.25, PI + 0.25, PI - 0.05, PI - 0.1], [0, 0.5, 0.7 + S(TAU * u) * 0.08, 0.6 + S(TAU * u * 2) * 0.15]);
    return p;
  };
  clips.sit = sampleClip("sit", 8, 12, (u) => sit(u));
  clips.look = sampleClip("look", 6, 12, (u) => sit(u, { neck: [-sitPitch * 0.7 + 0.1, S(TAU * u) * 0.6, 0], head: [0.1, S(TAU * u * 2) * 0.2, S(TAU * u) * 0.12] }));
  clips.pant = sampleClip("pant", 1, 24, (u) => sit(u, { spine: [0.04 + S(TAU * u * 3) * 0.03, 0, 0], head: [-0.2, 0, 0] }));
  clips.groom = sampleClip("groom", 2.4, 20, (u) => {
    const lick = Math.max(0, S(TAU * u * 3));
    const p = sit(u, { neck: [-sitPitch * 0.75 - 0.35, -0.3, 0], head: [-0.25 - lick * 0.2, -0.25, -0.2] });
    const B = body(K, p), T = B.top.fR, L = K.legs.fR;
    // The right forepaw raised to the mouth, paw turned up.
    legTo(K, p, B, "fR", { x: B.hed.x + (rig.noseX - K.H0.x) * 0.5, y: B.hed.y - 0.02 - lick * 0.02 }, PI / 2 + 0.2, -0.25);
    void T; void L;
    return p;
  });
  clips.knead = sampleClip("knead", 1.2, 24, (u) => {
    const a = Math.max(0, S(TAU * u)), b = Math.max(0, -S(TAU * u));
    const p0 = { lift: sitLift, pelvis: [sitPitch * 0.7, 0, 0] }, B0 = body(K, p0);
    return sit(u, { pelvis: [sitPitch * 0.7, 0, 0], neck: [-sitPitch * 0.5, 0, 0], head: [-0.15, 0, 0],
      toes: { fL: { x: B0.top.fL.x + 0.1 * d + a * 0.02, y: a * 0.06 * lt }, fR: { x: B0.top.fR.x + 0.1 * d + b * 0.02, y: b * 0.06 * lt } } });
  });

  // Lying (sphinx): belly on the ground, forelegs flat in front, hind legs tucked alongside.
  const loafLift = ground({});
  const loaf = (u, extra = {}) => {
    const b = S(TAU * u * 2) * 0.01;
    const p = { lift: loafLift, pelvis: [0, 0, 0], spine: [0, 0, 0], chest: [b, 0, 0], neck: [-0.15, S(TAU * u) * 0.2, 0], head: [0.05, 0, 0] };
    Object.assign(p, extra);
    const B = body(K, p);
    for (const k of ["hL", "hR"]) { const T = B.top[k]; legTo(K, p, B, k, { x: T.x + K.legs[k].l[2] * 1.05, y: 0.012 }, -0.05, k === "hL" ? 0.2 : -0.2); }
    for (const k of ["fL", "fR"]) { const T = B.top[k], L = K.legs[k]; legTo(K, p, B, k, extra.fold ? { x: T.x - 0.01, y: 0.02 } : { x: T.x + (L.l[1] + L.l[2]) * 0.85, y: 0.012 }, extra.fold ? PI - 0.1 : -0.04); }
    delete p.fold;
    tailTo(K, p, B, [PI + 0.9, PI + 0.1, PI, PI - 0.05], [0, 0.45, 0.55, 0.5 + S(TAU * u) * 0.12]);
    return p;
  };
  clips.loaf = sampleClip("loaf", 8, 12, (u) => loaf(u));
  // Asleep: curled round, nose to tail, paws folded under, breathing slowly.
  clips.sleep = sampleClip("sleep", 6, 10, (u) => {
    const b = S(TAU * u) * 0.02;
    const p = loaf(u, { lift: loafLift - 0.01, pelvis: [0, -0.5, 0.12], spine: [b, 0.5, 0], chest: [0, 0.5, -0.1], neck: [-0.6, 0.75, 0], head: [0.3, 0.35, 0.4], fold: true });
    const B = body(K, p);
    tailTo(K, p, B, [PI + 0.9, PI + 0.1, PI, PI], [0, -0.7, -0.8, -0.7]);
    return p;
  });

  // Stretch: a play bow, forelegs flat out in front, chest down, bottom up.
  clips.stretch = sampleClip("stretch", 2.2, 20, (u) => {
    const k = S(PI * Math.min(1, u * 1.1));
    const p = { pelvis: [-0.32 * k, 0, 0], spine: [0, 0, 0], chest: [0.08 * k, 0, 0], neck: [0.3 * k, 0, 0], head: [0.1 * k, 0, 0.05 * k], lift: -0.06 * k };
    const B = body(K, p);
    for (const kk of ["hL", "hR"]) legTo(K, p, B, kk, rest(kk));
    for (const kk of ["fL", "fR"]) { const T = B.top[kk], L = K.legs[kk], lie = { x: T.x + (L.l[1] + L.l[2]) * 0.95, y: 0.012 }, r0 = rest(kk); legTo(K, p, B, kk, { x: r0.x + (lie.x - r0.x) * k, y: 0.012 * k }, K.legs[kk].a[2] + (-0.04 - K.legs[kk].a[2]) * k); }
    tailTo(K, p, B, curve(PI / 2 + 0.35 * (1 - k) + 0.2, -0.1), [0, 0.1 * S(TAU * u), 0.15 * S(TAU * u), 0.2 * S(TAU * u)]);
    return p;
  }, false);
  // Hunting crouch, the bottom wiggle before a pounce, and the pounce.
  const crouch = (u, w) => {
    const p = { lift: -0.42 * lt, pelvis: [0.06, S(TAU * u * 4) * 0.2 * w, S(TAU * u * 4) * 0.08 * w], spine: [0, 0, 0], chest: [-0.06, -S(TAU * u * 4) * 0.08 * w, 0], neck: [-0.35, 0, 0], head: [0.45, 0, 0] };
    const B = body(K, p);
    for (const k of KEYS) { const r0 = rest(k), tread = K.legs[k].hind ? Math.max(0, S(TAU * u * 4 + (k === "hL" ? 0 : PI))) * 0.03 * w * lt : 0; legTo(K, p, B, k, { x: r0.x + (K.legs[k].hind ? 0.02 : 0.05), y: tread }); }
    tailTo(K, p, B, [PI + 0.2, PI + 0.05, PI - 0.05, PI - 0.4], [0, 0, 0.1 * S(TAU * u * 3), 0.5 * S(TAU * u * 5)]);
    return p;
  };
  clips.crouch = sampleClip("crouch", 2, 16, (u) => crouch(u, 0));
  clips.wiggle = sampleClip("wiggle", 1, 30, (u) => crouch(u, 1));
  clips.pounce = sampleClip("pounce", 0.6, 30, (u) => {
    const k = S(PI * u), up = 0.12 * lt * k;
    const p = { lift: up, pelvis: [0.18 * k, 0, 0], spine: [-0.05 * k, 0, 0], chest: [0.05 * k, 0, 0], neck: [0.1 * k, 0, 0], head: [-0.05 * k, 0, 0] };
    const B = body(K, p);
    for (const kk of ["fL", "fR"]) { const T = B.top[kk], L = K.legs[kk], a = -PI / 2 + 1.35 * k; legTo(K, p, B, kk, { x: T.x + L.reach * 0.97 * C(a), y: Math.max(0, T.y + L.reach * 0.97 * S(a)) }, a); }
    for (const kk of ["hL", "hR"]) { const T = B.top[kk], L = K.legs[kk], a = -PI / 2 - 0.9 * k; legTo(K, p, B, kk, { x: T.x + L.reach * 0.97 * C(a), y: Math.max(0, T.y + L.reach * 0.97 * S(a)) }, a); }
    tailTo(K, p, B, curve(PI - 0.1, 0.02), [0, 0, 0, 0]);
    return p;
  }, false);
  // Claws on the cat tree: reared up, paws high on the trunk pulling down in turn.
  clips.scratch = sampleClip("scratch", 1.2, 24, (u) => {
    const a = S(TAU * u), rear = 0.9;
    const p = { lift: -0.04, pelvis: [rear, 0, 0], spine: [0.05, 0, 0], chest: [0, 0, 0], neck: [-rear * 0.7, 0, 0], head: [-0.1, 0, 0] };
    const B = body(K, p);
    for (const k of ["hL", "hR"]) legTo(K, p, B, k, { x: rest(k).x + 0.03, y: 0 });
    for (const k of ["fL", "fR"]) { const T = B.top[k], L = K.legs[k], s = k === "fL" ? a : -a; legTo(K, p, B, k, { x: T.x + L.reach * 0.55, y: T.y + L.reach * (0.45 + 0.25 * s) }, PI / 2 - 0.3); }
    tailTo(K, p, B, curve(PI + 0.6, -0.2), [0, 0.15 * S(TAU * u), 0.2 * S(TAU * u), 0.25 * S(TAU * u)]);
    return p;
  });
  return clips;
}

/** How many walk cycles per unit of ground covered, for a cat drawn at `scale` (model units -> world). */
export function cyclesPerUnit(rig, scale) {
  return 1 / Math.max(0.02, walkStride(rig) * scale);
}
