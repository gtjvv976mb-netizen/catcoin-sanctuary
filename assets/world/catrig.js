/* A quadruped cat rig for the cats that have their own model (assets/models/cats/<TICKER>.glb).

   Higgsfield's rigging and animation library is for people (biped skeletons, human clips), so
   the cats are rigged here instead, at load time, from the shape of each model:

   1. findRig(positions): every model is a cat standing on all fours (made that way on purpose:
      scripts/make-cat-models.py, notes in scripts/CAT-MODELS.md), normalized to y up, facing
      +X, 1 unit tall, feet on y = 0. The four paws are the clusters of points on the ground
      (front/hind by x, left/right by z); the belly and back lines come from the middle of the
      body; the head is the high point ahead of the front legs; the tail is followed from the
      rump to its furthest point and cut into four joints.
   2. One skeleton, the same bone names for every cat (so one clip set drives them all):
        root > pelvis > spine > chest > neck > head
               pelvis > tail1 > tail2 > tail3 > tail4
               pelvis > thigh.L/R > shin.L/R > foot.L/R      (hind legs)
               chest  > arm.L/R   > forearm.L/R > paw.L/R    (front legs)
      Bones have no rest rotation, so each clip's angles read in model axes: z turns in the
      side view (+ lifts the nose, swings a leg forward), y turns left/right, x rolls.
   3. skinWeights(): each vertex belongs to a region (a leg, the tail, the head and neck, or the
      body) and is weighted to that region's bones and the body bone it hangs from by inverse
      distance to the bone segments (up to four influences), so joints bend smoothly.
   4. makeClips(rig): the clips, built from pose functions and sampled into AnimationClips:
      walk, trot, run, stalk (low creep), stand, sniff, greet (tail straight up), sit, look,
      pant, groom (paw to mouth, licks), loaf, sleep (curled, nose to tail), knead, stretch
      (play bow), crouch, wiggle (bottom wiggle before a pounce), pounce (stretched leap), eat
      (head down, chewing), scratch (claws on a tree). Poses that lower the body carry a root
      height track worked out from the rig's leg lengths, so paws stay on the ground.

   Walking clips are not played by the clock: the renderer sets their time from the distance the
   cat has moved (cyclesPerUnit), so the paws don't slide. */

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
  const yt = Math.max(yb + 0.1, pct(mid.map((p) => p.y), 0.97));
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
  const legTop = yb + 0.35 * (yt - yb);
  return {
    H, L: x1 - x0, W: z1 - z0, zc, yb, yt, yMid, frontX, hindX, d, paws, headC, noseX, tail,
    pelvis: V(hindX, yMid, zc), chest: V(frontX, yMid, zc), spine: V((frontX + hindX) / 2, yMid, zc),
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
    const paw = rig.paws[end + s];
    const top = V(paw.x, rig.legTop, paw.z * 0.75 + rig.zc * 0.25);
    const knee = top.clone().lerp(paw, 0.5); knee.x += end === "h" ? 0.02 : -0.01;
    const ankle = V(paw.x, Math.min(0.1, rig.legTop * 0.22), paw.z);
    const up = add(`${a}.${s}`, top, end === "h" ? pelvis : chest);
    const mid = add(`${b}.${s}`, knee, up);
    add(`${c}.${s}`, ankle, mid);
  }
  root.updateMatrixWorld(true);
  return { root, bones, skeleton: new THREE.Skeleton(list) };
}

function segDist(p, a, b) {
  const ab = _v1.subVectors(b, a), t = Math.max(0, Math.min(1, _v2.subVectors(p, a).dot(ab) / Math.max(1e-9, ab.lengthSq())));
  return _v3.copy(a).addScaledVector(ab, t).distanceTo(p);
}
const _v1 = V(), _v2 = V(), _v3 = V();

/** Skin weights for positions (Float32Array) against a rig and its skeleton. Returns { index, weight } attributes. */
export function skinWeights(pos, rig, sk) {
  const names = sk.skeleton.bones.map((b) => b.name);
  const id = (nm) => names.indexOf(nm);
  const at = (nm) => sk.bones[nm].userData.at;
  // Each bone's segment: from its joint to its child's (or an end point).
  const seg = {};
  const endOf = { head: V(rig.noseX, rig.headC.y, rig.zc), tail4: rig.tail[4], chest: rig.neck, root: rig.pelvis };
  for (const b of sk.skeleton.bones) {
    const kid = b.children.find((c) => c.isBone && !c.name.startsWith("tail") && !/^(thigh|arm)/.test(c.name)) || b.children.find((c) => c.isBone);
    let end = endOf[b.name] || (kid ? kid.userData.at : null);
    if (!end && /^(foot|paw)/.test(b.name)) { const s = b.name.slice(-1), e = b.name.startsWith("foot") ? "h" : "f"; end = rig.paws[e + s].clone(); end.x += 0.04; }
    seg[b.name] = [b.userData.at, end || b.userData.at];
  }
  const n = pos.length / 3, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), p = V();
  const tailBase = rig.tail[0], neckX = rig.neck.x - 0.02, bodyR = (rig.yt - rig.yb) * 0.75;
  for (let i = 0; i < n; i++) {
    p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    let allowed;
    // The nearest paw column, for leg points.
    let leg = null, best = Infinity;
    for (const k of ["fL", "fR", "hL", "hR"]) { const q = rig.paws[k], dd = Math.hypot(p.x - q.x, (p.z - q.z) * 1.2); if (dd < best) { best = dd; leg = k; } }
    const s = leg[1], front = leg[0] === "f";
    const inTail = p.x < tailBase.x + 0.01 && p.y > rig.yb + 0.2 * (rig.yt - rig.yb) && p.distanceTo(tailBase) > 0.015;
    const inLeg = p.y < rig.legTop + 0.04 && best < Math.max(0.09, rig.W * 0.28) && !(p.y > rig.yb - 0.02 && Math.abs(p.x - (rig.frontX + rig.hindX) / 2) < rig.d * 0.3);
    if (inTail && !inLeg) allowed = ["pelvis", "tail1", "tail2", "tail3", "tail4"];
    else if (inLeg) allowed = front ? ["chest", `arm.${s}`, `forearm.${s}`, `paw.${s}`] : ["pelvis", `thigh.${s}`, `shin.${s}`, `foot.${s}`];
    else if (p.x > neckX && p.y > rig.yMid) allowed = ["chest", "neck", "head"];
    else allowed = ["pelvis", "spine", "chest", "neck"];
    const torso = allowed[0] === "pelvis" && allowed[1] === "spine";
    const cand = allowed.map((nm) => {
      let dd = segDist(p, seg[nm][0], seg[nm][1]);
      if (torso && nm !== "neck") dd = Math.max(0.005, dd - bodyR * 0.3);
      return [id(nm), 1 / Math.pow(dd + 0.012, 4)];
    }).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = cand.reduce((s2, c) => s2 + c[1], 0);
    cand.forEach((c, k) => { idx[i * 4 + k] = c[0]; wt[i * 4 + k] = c[1] / sum; });
  }
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

/**
 * The clip set for one rig. Angles are shared; heights (how far the body sinks to sit or lie)
 * come from this cat's legs, so paws and bottoms meet the ground.
 */
export function makeClips(rig) {
  const d = rig.d, lt = rig.legTop, yb = rig.yb;
  const clips = {};
  const S = Math.sin;
  // Walking: a lateral-sequence gait (hind L, fore L, hind R, fore R), a quarter cycle apart.
  const gait = (u, { amp = 0.36, lift = 0.7, phase = { hL: 0, fL: 0.25, hR: 0.5, fR: 0.75 }, crouch = 0, spineFlex = 0, tailUp = 0.45, head = 0 } = {}) => {
    const p = { lift: -crouch * lt * 0.45 + Math.abs(S(TAU * u * 2)) * 0.008 };
    for (const [k, [a, b, c]] of Object.entries(LEG)) {
      const ph = TAU * (u + phase[k]);
      const ang = amp * S(ph);
      const bend = -lift * Math.max(0, Math.cos(ph)) ** 1.5;
      const cr = crouch;
      if (k[0] === "h") p[a] = [ang + cr * 0.7, 0, 0], p[b] = [bend * 0.6 - cr * 1.35, 0, 0], p[c] = [-bend * 0.3 + cr * 0.65, 0, 0];
      else p[a] = [ang + cr * 0.55, 0, 0], p[b] = [bend - cr * 1.15, 0, 0], p[c] = [-bend * 0.5 + cr * 0.6, 0, 0];
    }
    p.pelvis = [spineFlex * S(TAU * u * 2) * 0.5, S(TAU * u) * 0.05, S(TAU * u) * 0.03];
    p.chest = [-spineFlex * S(TAU * u * 2), -S(TAU * u) * 0.06, 0];
    p.neck = [-0.05 + head - crouch * 0.25 + S(TAU * u * 2) * 0.03, S(TAU * u) * 0.04, 0];
    p.head = [crouch * 0.3 - S(TAU * u * 2) * 0.03, 0, 0];
    tail(p, u, tailUp, 0.25);
    return p;
  };
  const tail = (p, u, up, sway, curl = 0) => {
    for (let k = 1; k <= 4; k++) p[`tail${k}`] = [(k === 1 ? up : up * 0.15 - curl * 0.1), S(TAU * u - k * 0.7) * sway * (0.4 + k * 0.2) + curl, 0];
  };
  clips.walk = sampleClip("walk", 1, 32, (u) => gait(u));
  clips.trot = sampleClip("trot", 1, 32, (u) => gait(u, { amp: 0.45, lift: 0.9, phase: { hL: 0, fR: 0, hR: 0.5, fL: 0.5 }, tailUp: 0.6 }));
  clips.run = sampleClip("run", 1, 32, (u) => gait(u, { amp: 0.75, lift: 1.1, phase: { hL: 0, hR: 0.08, fL: 0.5, fR: 0.58 }, spineFlex: 0.22, tailUp: 0.2 }));
  clips.stalk = sampleClip("stalk", 1, 32, (u) => gait(u, { amp: 0.28, lift: 0.5, crouch: 0.55, tailUp: -0.25, head: -0.1 }));

  // Standing still: breathing, a slow look about, a lazy tail.
  const stand = (u, extra = {}) => {
    const p = { lift: S(TAU * u * 2) * 0.004, chest: [S(TAU * u * 2) * 0.012, 0, 0], neck: [0, S(TAU * u) * 0.25, 0], head: [S(TAU * u * 3) * 0.04, S(TAU * u + 1) * 0.15, 0] };
    tail(p, u, 0.35, 0.3);
    return Object.assign(p, extra);
  };
  clips.stand = sampleClip("stand", 8, 12, (u) => stand(u));
  clips.sniff = sampleClip("sniff", 3, 16, (u) => {
    const p = stand(u);
    p.chest = [-0.1, 0, 0]; p.neck = [-1.35 + S(TAU * u * 3) * 0.08, S(TAU * u * 2) * 0.25, 0]; p.head = [0.3 + S(TAU * u * 11) * 0.04, 0, 0];
    p["arm.L"] = [0.12, 0, 0]; p["arm.R"] = [0.12, 0, 0]; p["forearm.L"] = [-0.15, 0, 0]; p["forearm.R"] = [-0.15, 0, 0];
    return p;
  });
  clips.greet = sampleClip("greet", 3, 16, (u) => {
    const p = stand(u, { neck: [0.12, 0, 0], head: [0.1, S(TAU * u) * 0.12, S(TAU * u * 2) * 0.08] });
    p.tail1 = [1.25, 0, 0]; p.tail2 = [0.05, 0, 0]; p.tail3 = [0.05, 0, 0]; p.tail4 = [-0.5 + S(TAU * u * 3) * 0.2, S(TAU * u * 2) * 0.3, 0];
    return p;
  });

  // Sitting: the body pitches up about the hips; the hind legs fold flat; the front legs stay upright.
  const sitPitch = 0.62;
  const sitDrop = d * Math.sin(sitPitch) * 0.95;
  const sit = (u, extra = {}) => {
    const b = S(TAU * u * 2) * 0.01;
    const p = {
      lift: -sitDrop, pelvis: [sitPitch, 0, 0], spine: [0.05 + b, 0, 0], chest: [0.05, 0, 0],
      "thigh.L": [0.95, 0, 0.05], "thigh.R": [0.95, 0, -0.05], "shin.L": [-2.3, 0, 0], "shin.R": [-2.3, 0, 0], "foot.L": [0.75, 0, 0], "foot.R": [0.75, 0, 0],
      "arm.L": [-sitPitch - 0.1, 0, 0], "arm.R": [-sitPitch - 0.1, 0, 0], "forearm.L": [0.02, 0, 0], "forearm.R": [0.02, 0, 0], "paw.L": [0.05, 0, 0], "paw.R": [0.05, 0, 0],
      neck: [-sitPitch * 0.55, S(TAU * u) * 0.3, 0], head: [-0.12 + S(TAU * u * 3) * 0.04, S(TAU * u + 1) * 0.2, 0],
    };
    tail(p, u, -sitPitch - 0.5, 0.12, 0);
    p.tail2 = [-0.4, 0.5 + S(TAU * u) * 0.1, 0]; p.tail3 = [0, 0.5, 0]; p.tail4 = [0, 0.4 + S(TAU * u * 2) * 0.15, 0];
    return Object.assign(p, extra);
  };
  clips.sit = sampleClip("sit", 8, 12, (u) => sit(u));
  clips.look = sampleClip("look", 6, 12, (u) => sit(u, { neck: [-sitPitch * 0.45 + 0.1, S(TAU * u) * 0.55, 0], head: [0.1, S(TAU * u * 2) * 0.2, S(TAU * u) * 0.1] }));
  clips.pant = sampleClip("pant", 1, 24, (u) => sit(u, { spine: [0.05 + S(TAU * u * 3) * 0.03, 0, 0], head: [-0.2, 0, 0] }));
  clips.groom = sampleClip("groom", 2.4, 20, (u) => {
    const lick = Math.max(0, S(TAU * u * 3));
    return sit(u, {
      "arm.R": [-sitPitch + 1.35, 0.25, -0.2], "forearm.R": [-1.9, 0, 0], "paw.R": [-0.4 + lick * 0.15, 0, 0],
      neck: [-sitPitch * 0.4 - 0.15, -0.35, 0], head: [-0.35 - lick * 0.18, -0.2, -0.15],
    });
  });
  clips.knead = sampleClip("knead", 1.2, 24, (u) => {
    const a = Math.max(0, S(TAU * u)), b = Math.max(0, -S(TAU * u));
    return sit(u, { pelvis: [sitPitch * 0.6, 0, 0], lift: -sitDrop * 0.7, "arm.L": [-sitPitch * 0.6 + 0.35 + a * 0.35, 0, 0], "forearm.L": [-0.2 - a * 0.9, 0, 0], "arm.R": [-sitPitch * 0.6 + 0.35 + b * 0.35, 0, 0], "forearm.R": [-0.2 - b * 0.9, 0, 0], neck: [-0.2, 0, 0], head: [-0.15, 0, 0] });
  });

  // Lying: every leg tucked under; the belly on the ground.
  const loafDrop = Math.max(0, yb - 0.02);
  const loaf = (u, extra = {}) => {
    const b = S(TAU * u * 2) * 0.012;
    const p = {
      lift: -loafDrop, chest: [b, 0, 0],
      "thigh.L": [1.1, 0, 0.12], "thigh.R": [1.1, 0, -0.12], "shin.L": [-2.5, 0, 0], "shin.R": [-2.5, 0, 0], "foot.L": [1.2, 0, 0], "foot.R": [1.2, 0, 0],
      "arm.L": [1.25, 0, 0], "arm.R": [1.25, 0, 0], "forearm.L": [-2.5, 0, 0], "forearm.R": [-2.5, 0, 0], "paw.L": [1.1, 0, 0], "paw.R": [1.1, 0, 0],
      neck: [-0.18, S(TAU * u) * 0.2, 0], head: [0.02, 0, 0],
    };
    tail(p, u, -0.55, 0.08, 0);
    p.tail2 = [-0.3, 0.55, 0]; p.tail3 = [0, 0.55, 0]; p.tail4 = [0, 0.5 + S(TAU * u) * 0.12, 0];
    return Object.assign(p, extra);
  };
  clips.loaf = sampleClip("loaf", 8, 12, (u) => loaf(u));
  // Asleep: curled round, nose to tail, breathing slowly.
  clips.sleep = sampleClip("sleep", 6, 10, (u) => {
    const b = S(TAU * u) * 0.02;
    const p = loaf(u, {
      pelvis: [0, 0.45, 0.25], spine: [b, 0.5, 0], chest: [-0.05, 0.5, 0], neck: [-1.2, 0.7, 0], head: [0.5, 0.35, 0.4],
      "arm.L": [1.35, 0.3, 0], "arm.R": [1.35, 0.3, 0],
    });
    p.lift = -loafDrop - 0.02;
    for (let k = 1; k <= 4; k++) p[`tail${k}`] = [k === 1 ? -0.6 : 0, -0.62, 0];
    return p;
  });
  clips.eat = sampleClip("eat", 1.4, 20, (u) => {
    const chew = Math.max(0, S(TAU * u * 2));
    const p = stand(0.2, { chest: [-0.15, 0, 0], neck: [-1.65, 0, 0], head: [0.35 - chew * 0.15, 0, 0] });
    p["arm.L"] = [0.2, 0, 0.05]; p["arm.R"] = [0.2, 0, -0.05]; p["forearm.L"] = [-0.35, 0, 0]; p["forearm.R"] = [-0.35, 0, 0]; p["paw.L"] = [0.15, 0, 0]; p["paw.R"] = [0.15, 0, 0];
    p.lift = -0.03;
    return p;
  });
  // Stretch: a play bow, front legs out, bottom up, then a long hind stretch.
  clips.stretch = sampleClip("stretch", 2.2, 20, (u) => {
    const k = S(Math.PI * Math.min(1, u * 1.1));
    const p = stand(0.3);
    p.pelvis = [-0.3 * k, 0, 0]; p.chest = [0.05 * k, 0, 0];
    p["arm.L"] = [1.15 * k, 0, 0]; p["arm.R"] = [1.15 * k, 0, 0]; p["forearm.L"] = [0.05 * k, 0, 0]; p["forearm.R"] = [0.05 * k, 0, 0]; p["paw.L"] = [-0.8 * k, 0, 0]; p["paw.R"] = [-0.8 * k, 0, 0];
    p["thigh.L"] = [0.3 * k, 0, 0]; p["thigh.R"] = [0.3 * k, 0, 0];
    p.neck = [0.25 * k, 0, 0]; p.head = [0.1 * k, 0, 0.05 * k];
    p.lift = -d * Math.sin(0.3) * 0.9 * k;
    tail(p, u, 0.9 * k, 0.1);
    return p;
  }, false);
  // Crouch and wiggle: low, eyes on the prey, the bottom swinging side to side before the pounce.
  const crouch = (u, w) => {
    const p = gait(0.25, { amp: 0, lift: 0, crouch: 0.75, tailUp: -0.3, head: -0.05 });
    p.pelvis = [0.12, S(TAU * u * 4) * 0.22 * w, S(TAU * u * 4) * 0.1 * w];
    p.chest = [-0.06, -S(TAU * u * 4) * 0.08 * w, 0];
    p.neck = [-0.1, 0, 0]; p.head = [0.2, 0, 0];
    p.tail4 = [0, S(TAU * u * 5) * 0.5, 0];
    return p;
  };
  clips.crouch = sampleClip("crouch", 2, 16, (u) => crouch(u, 0));
  clips.wiggle = sampleClip("wiggle", 1, 30, (u) => crouch(u, 1));
  clips.pounce = sampleClip("pounce", 0.6, 30, (u) => {
    const k = S(Math.PI * u);
    const p = stand(0);
    p["arm.L"] = [1.3 * k, 0, 0.1]; p["arm.R"] = [1.3 * k, 0, -0.1]; p["forearm.L"] = [0.2 * k, 0, 0]; p["forearm.R"] = [0.2 * k, 0, 0]; p["paw.L"] = [-0.6 * k, 0, 0]; p["paw.R"] = [-0.6 * k, 0, 0];
    p["thigh.L"] = [-0.9 * k, 0, 0]; p["thigh.R"] = [-0.9 * k, 0, 0]; p["shin.L"] = [0.4 * k, 0, 0]; p["shin.R"] = [0.4 * k, 0, 0]; p["foot.L"] = [-0.5 * k, 0, 0]; p["foot.R"] = [-0.5 * k, 0, 0];
    p.pelvis = [0.15 * k, 0, 0]; p.chest = [0.1 * k, 0, 0]; p.neck = [0.15 * k, 0, 0];
    tail(p, u, 0.2, 0);
    return p;
  }, false);
  // Claws on the cat tree: reaching up, pulling down with one paw then the other.
  clips.scratch = sampleClip("scratch", 1.2, 24, (u) => {
    const a = S(TAU * u), rear = 0.85;
    const p = stand(0.2);
    p.pelvis = [rear, 0, 0]; p.spine = [0.1, 0, 0]; p.lift = -d * Math.sin(rear) * 0.35;
    p["thigh.L"] = [-rear + 0.3, 0, 0]; p["thigh.R"] = [-rear + 0.3, 0, 0]; p["shin.L"] = [-0.5, 0, 0]; p["shin.R"] = [-0.5, 0, 0]; p["foot.L"] = [0.2, 0, 0]; p["foot.R"] = [0.2, 0, 0];
    p["arm.L"] = [0.4 + a * 0.35, 0, 0]; p["arm.R"] = [0.4 - a * 0.35, 0, 0]; p["forearm.L"] = [-0.2 - Math.max(0, a) * 0.5, 0, 0]; p["forearm.R"] = [-0.2 - Math.max(0, -a) * 0.5, 0, 0];
    p.neck = [-rear * 0.8, 0, 0]; p.head = [-0.1, 0, 0];
    tail(p, u, -0.4, 0.2);
    return p;
  });
  return clips;
}

/** How many walk cycles per unit of ground covered, for a cat drawn at `scale` (model units -> world). */
export function cyclesPerUnit(rig, scale, amp = 0.36) {
  const stride = 2 * rig.legTop * Math.sin(amp) * 2; // each paw travels ±amp; two steps per cycle per side
  return 1 / Math.max(0.05, stride * scale);
}
