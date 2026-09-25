/* Birds and butterflies. Both are instanced (one draw call each) and flap their wings in the
   vertex shader from a per-instance angle, so a whole flock costs no more than one bird.

   Birds fly in loose flocks along smooth looping paths high over the garden. Now and then a few
   leave their flock and glide down to rest: on the roof ridge, the porch roof, fence posts, the
   bird bath or the lawn. A cat may creep up on one on the lawn or at the bath and swat, but the
   bird is always off before the paw arrives (cats.js asks `startle`; the bird takes off at once).

   Butterflies wander over the flower beds and fields, dipping low, resting on flowers. A cat's
   leap startles one up and away; it drifts back down later.

   With reduced motion, the birds sit on the roof and fence and the butterflies rest on flowers,
   all still. */

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as L from "./layout.js";
import { makeRandom } from "./rng.js";

/* ── Shared: a material whose wing vertices turn about the body axis by a per-instance angle ── */

function flapMaterial(base) {
  base.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
        attribute float aWing;   // -1 left wing, +1 right wing, 0 body
        attribute vec2 aFlap;    // wing angle, fold (0 open, 1 folded)`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        if (aWing != 0.0) {
          float span = abs(transformed.z) * mix(1.0, 0.3, aFlap.y);
          float a = aFlap.x;
          transformed.y += span * sin(a);
          transformed.z = sign(transformed.z) * span * cos(a);
        }`)
      .replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
        if (aWing != 0.0) { objectNormal = normalize(vec3(objectNormal.x, cos(aFlap.x), -sign(position.z) * sin(aFlap.x))); }`);
  };
  base.customProgramCacheKey = () => "flap";
  return base;
}

function withWing(geo, wing, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute("uv");
  const n = g.attributes.position.count;
  const w = new Float32Array(n), col = new Float32Array(n * 3), c = new THREE.Color(color);
  const p = g.attributes.position;
  for (let i = 0; i < n; i++) { w[i] = Math.abs(p.getZ(i)) > 0.012 ? wing : 0; col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute("aWing", new THREE.BufferAttribute(w, 1));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
function tri(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3)); // both faces
  return g;
}

/* ── The bird: faces +x, wings along ±z ── */
function birdGeometry() {
  // A round little songbird: short plump body, big head, fan tail and swept-back tapering wings
  // (straight square wings and a pointed tail read as a toy plane from a distance).
  const body = new THREE.OctahedronGeometry(0.1, 1);
  body.scale(1.4, 0.95, 0.95);
  const head = new THREE.OctahedronGeometry(0.075, 1);
  head.translate(0.14, 0.07, 0);
  const beak = new THREE.ConeGeometry(0.018, 0.05, 4);
  beak.rotateZ(-Math.PI / 2); beak.translate(0.225, 0.06, 0);
  const tail = tri([-0.11, 0.02, 0], [-0.25, 0.04, 0.085], [-0.25, 0.04, -0.085]);
  const breast = new THREE.OctahedronGeometry(0.08, 1);
  breast.scale(1.15, 0.85, 0.95); breast.translate(0.06, -0.03, 0);
  const wing = (s) => {
    const A = [0.07, 0.03, 0.015 * s], B = [-0.09, 0.03, 0.015 * s], C = [0.035, 0.03, 0.17 * s], Dm = [-0.1, 0.03, 0.15 * s], E = [-0.21, 0.03, 0.33 * s];
    return [withWing(tri(A, B, Dm), s, 0xdedede), withWing(tri(A, Dm, C), s, 0xd6d6d6), withWing(tri(C, Dm, E), s, 0xc8c8c8)];
  };
  return mergeGeometries([
    withWing(body, 0, 0xffffff), withWing(head, 0, 0xffffff), withWing(tail, 0, 0xe0e0e0),
    withWing(breast, 0, 0xffe2c2), withWing(beak, 0, 0xf2b24b),
    ...wing(1), ...wing(-1),
  ].map((g) => { for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color", "aWing"].includes(k)) g.deleteAttribute(k); return g; }));
}

/* ── The butterfly: faces +x, wings along ±z, two lobes each ── */
function butterflyGeometry() {
  const body = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4);
  body.rotateZ(Math.PI / 2);
  const parts = [withWing(body, 0, 0x3a2a2a)];
  for (const s of [1, -1]) {
    parts.push(withWing(tri([0.02, 0, 0.013 * s], [0.12, 0.01, 0.13 * s], [-0.01, 0.01, 0.15 * s]), s, 0xffffff));
    parts.push(withWing(tri([0.0, 0, 0.013 * s], [-0.02, 0.01, 0.12 * s], [-0.1, 0.0, 0.08 * s]), s, 0xf2f2f2));
  }
  return mergeGeometries(parts.map((g) => { for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color", "aWing"].includes(k)) g.deleteAttribute(k); return g; }));
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/**
 * @param {THREE.Scene} scene
 * @param {object} o
 * @param {boolean} o.mobile
 * @param {Array} o.fencePosts   [{x, y, z}] tops of the fence posts
 * @param {Array} o.flowerFields [{x, z, r, y}] flower fields outside the fence
 * @param {(x:number, z:number) => boolean} o.lawnFree  true where a bird may land on the lawn
 * @param {(x:number, z:number, r:number) => boolean} o.catsNear  true when a cat is within r
 */
export function buildCritters(scene, { mobile = false, fencePosts = [], flowerFields = [], lawnFree = () => true, catsNear = () => false }) {
  const rnd = makeRandom("critters");

  /* ── Birds ── */
  const BIRD_COLORS = [0x8a6a4f, 0x7d5e44, 0x9b7b5c, 0x6b5a4a, 0x5d5a66, 0x7f8b99, 0xa0856a];
  const flocks = [];
  const flockSizes = mobile ? [5, 4, 3] : [7, 6, 5, 3];
  for (let f = 0; f < flockSizes.length; f++) {
    flocks.push({
      // Loops over and behind the cottage, not through the usual viewpoint in front of it.
      cx: rnd.range(-8, 8), cz: rnd.range(-12, -2), y0: rnd.range(8.5, 14),
      ax: rnd.range(16, 30), az: rnd.range(10, 16), ay: rnd.range(1.2, 3),
      wx: rnd.range(0.035, 0.055) * rnd.sign(), wz: rnd.range(0.045, 0.07), wy: rnd.range(0.08, 0.14),
      px: rnd.range(0, 6.28), pz: rnd.range(0, 6.28), py: rnd.range(0, 6.28),
      pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    });
  }
  const birds = [];
  flocks.forEach((fl, f) => {
    for (let k = 0; k < flockSizes[f]; k++) {
      birds.push({
        id: birds.length, flock: fl, state: "flying", reachable: false,
        off: new THREE.Vector3(rnd.range(-2.6, 2.6), rnd.range(-1, 1), rnd.range(-2.6, 2.6)),
        x: 0, y: 20, z: 0, yaw: 0, pitch: 0, bank: 0,
        phase: rnd.range(0, 6.28), rate: rnd.range(11, 14), wob: rnd.range(0, 100),
        color: rnd.pick(BIRD_COLORS), flap: 0, fold: 0, t: 0, from: null, to: null, stay: 0, hop: 0, peck: 0,
        scale: rnd.range(1.05, 1.3),
      });
    }
  });
  const birdMesh = new THREE.InstancedMesh(birdGeometry(), flapMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })), birds.length);
  birdMesh.geometry.setAttribute("aFlap", new THREE.InstancedBufferAttribute(new Float32Array(birds.length * 2), 2).setUsage(THREE.DynamicDrawUsage));
  birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  birds.forEach((b, i) => birdMesh.setColorAt(i, new THREE.Color(b.color)));
  birdMesh.castShadow = !mobile;
  birdMesh.frustumCulled = false;
  birdMesh.name = "birds";
  scene.add(birdMesh);

  const perchTaken = new Set();
  /** Somewhere for a bird to come down to: a spread of places, some the cats can reach. */
  function pickPerch(b) {
    const roll = rnd.next();
    const ridgeAt = (seg, u) => ({ x: seg.from.x + (seg.to.x - seg.from.x) * u, y: seg.from.y, z: seg.from.z + (seg.to.z - seg.from.z) * u });
    for (let tries = 0; tries < 12; tries++) {
      let p, kind;
      if (roll < 0.2) { p = ridgeAt(L.BIRD_PERCHES.ridge, rnd.next()); kind = "roof"; }
      else if (roll < 0.3) { p = ridgeAt(L.BIRD_PERCHES.porchRoof, rnd.next()); kind = "roof"; }
      else if (roll < 0.52 && fencePosts.length) { const f = rnd.pick(fencePosts); p = { ...f }; kind = "fence"; }
      else if (roll < 0.62) { const B = L.BIRD_BATH, a = rnd.range(0, 6.28); p = { x: B.x + Math.cos(a) * 0.38, y: B.top + 0.02, z: B.z + Math.sin(a) * 0.38 }; kind = "bath"; }
      else {
        const a = rnd.range(0, 6.28), d = rnd.range(4, L.GARDEN.walkR - 1.5);
        p = { x: Math.cos(a) * d, y: 0.02, z: Math.sin(a) * d }; kind = "lawn";
        if (!lawnFree(p.x, p.z) || catsNear(p.x, p.z, 1.8)) continue;
      }
      const key = `${Math.round(p.x * 3)},${Math.round(p.z * 3)}`;
      if (perchTaken.has(key)) continue;
      perchTaken.add(key);
      return { ...p, kind, key };
    }
    return null;
  }

  function flyToFlock(b, fast) {
    if (b.perch) perchTaken.delete(b.perch.key);
    b.perch = null;
    b.state = "takeoff";
    b.reachable = false;
    b.t = 0;
    b.dur = fast ? rnd.range(1.6, 2.2) : rnd.range(2.6, 3.4);
    b.from = new THREE.Vector3(b.x, b.y, b.z);
    // Up and away first: a control point above and beyond, away from whatever startled it.
    b.ctrl = new THREE.Vector3(b.x + rnd.range(-3, 3), b.y + rnd.range(4, 7), b.z + rnd.range(-3, 3));
  }

  let nextLanding = 6;
  function landSome(time) {
    // A few birds of one flock come down together, to one kind of place, near each other.
    const fl = rnd.pick(flocks);
    const free = birds.filter((b) => b.flock === fl && b.state === "flying");
    if (!free.length) return;
    const n = Math.min(free.length, rnd.int(1, 3));
    for (let k = 0; k < n; k++) {
      const b = free[k];
      const p = pickPerch(b);
      if (!p) continue;
      b.state = "landing"; b.t = 0; b.dur = rnd.range(3.2, 4.6);
      b.from = new THREE.Vector3(b.x, b.y, b.z);
      b.perch = p;
      b.ctrl = new THREE.Vector3((b.x + p.x) / 2, Math.max(b.y, p.y) + 2, (b.z + p.z) / 2);
    }
    nextLanding = time + rnd.range(7, 14);
  }

  /* ── Butterflies ── */
  const BUTTERFLY_COLORS = [0xffd84a, 0xfff6e6, 0xf59a3c, 0x8ec5ff, 0xf7a6c8, 0xffe98a, 0xc7a6ff];
  const homes = [
    ...L.FLOWER_BEDS.map((f) => ({ x: (f.minX + f.maxX) / 2, z: (f.minZ + f.maxZ) / 2, r: 2.2, y: 0.3 })),
    { x: 8, z: -9.8, r: 3, y: 0.5 }, // the herb patch
    { x: -9, z: 9.5, r: 3.5, y: 0.1 }, // by the pond
    { x: 4, z: 9, r: 4, y: 0 }, { x: -5, z: 12, r: 4, y: 0 }, { x: 10, z: 3, r: 4, y: 0 }, { x: -12, z: -4, r: 4, y: 0 }, { x: -2, z: -12, r: 4, y: 0 },
    ...flowerFields.map((f) => ({ ...f, r: f.r * 0.8 })),
  ];
  const nB = mobile ? 16 : 28;
  const butterflies = [];
  for (let i = 0; i < nB; i++) {
    const h = homes[i % homes.length];
    butterflies.push({
      id: i, home: h, x: h.x + rnd.range(-1, 1), y: (h.y || 0) + rnd.range(0.4, 1.2), z: h.z + rnd.range(-1, 1),
      vx: 0, vy: 0, vz: 0, tx: h.x, ty: 0.8, tz: h.z, retarget: 0, rest: 0, scared: 0,
      phase: rnd.range(0, 6.28), rate: rnd.range(15, 22), yaw: 0, color: rnd.pick(BUTTERFLY_COLORS), s: rnd.range(1.5, 2.0),
    });
  }
  const bMesh = new THREE.InstancedMesh(butterflyGeometry(), flapMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x201810 })), nB);
  bMesh.geometry.setAttribute("aFlap", new THREE.InstancedBufferAttribute(new Float32Array(nB * 2), 2).setUsage(THREE.DynamicDrawUsage));
  bMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  butterflies.forEach((b, i) => bMesh.setColorAt(i, new THREE.Color(b.color)));
  bMesh.frustumCulled = false;
  bMesh.name = "butterflies";
  scene.add(bMesh);

  /* ── Per frame ── */
  let time = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const bez = (a, c, b, u, out) => out.set(
    (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x,
    (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y,
    (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * c.z + u * u * b.z);

  function flockPos(fl, t, out) {
    return out.set(fl.cx + fl.ax * Math.sin(fl.wx * t + fl.px), fl.y0 + fl.ay * Math.sin(fl.wy * t + fl.py), fl.cz + fl.az * Math.sin(fl.wz * t + fl.pz));
  }
  function slotPos(b, t, out) {
    const fl = b.flock;
    flockPos(fl, t, out);
    flockPos(fl, t + 0.2, tmp2).sub(out);
    const yaw = Math.atan2(-tmp2.z, tmp2.x);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ox = b.off.x + Math.sin(t * 0.7 + b.wob) * 0.6, oz = b.off.z + Math.cos(t * 0.55 + b.wob) * 0.6;
    return out.set(out.x + ox * c + oz * s, out.y + b.off.y + Math.sin(t * 0.9 + b.wob) * 0.3, out.z - ox * s + oz * c);
  }

  function updateBirds(dt) {
    if (time > nextLanding) landSome(time);
    const fl = birdMesh.geometry.attributes.aFlap;
    birds.forEach((b, i) => {
      const px = b.x, py = b.y, pz = b.z;
      if (b.state === "flying") {
        slotPos(b, time, tmp);
        b.x = tmp.x; b.y = tmp.y; b.z = tmp.z;
        // Flap in bursts, glide between.
        const burst = Math.sin(time * 0.8 + b.wob) > -0.3;
        b.flap = burst ? 0.2 + Math.sin(time * b.rate + b.phase) * 0.8 : 0.34 + Math.sin(time * 2 + b.phase) * 0.05; // glide in a gentle V
        b.fold = 0;
      } else if (b.state === "landing") {
        b.t += dt;
        const u = Math.min(1, b.t / b.dur), e = 1 - (1 - u) * (1 - u);
        bez(b.from, b.ctrl, b.perch, e, tmp);
        b.x = tmp.x; b.y = tmp.y; b.z = tmp.z;
        b.flap = u > 0.8 ? Math.sin(time * b.rate * 1.3 + b.phase) * 1.0 : 0.12 + Math.sin(time * 3 + b.phase) * 0.08;
        b.fold = Math.max(0, (u - 0.85) / 0.15);
        if (u >= 1) { b.state = "perched"; b.stay = rnd.range(9, 22); b.t = 0; b.reachable = b.perch.kind === "lawn" || b.perch.kind === "bath"; b.hop = rnd.range(0.5, 2); b.yaw += rnd.range(-1, 1); }
      } else if (b.state === "perched") {
        b.t += dt;
        b.flap = -0.35; b.fold = 1;
        // Little hops and pecks on the lawn; looking about elsewhere.
        if ((b.hop -= dt) < 0) {
          b.hop = rnd.range(0.8, 2.6);
          b.yaw += rnd.range(-1.2, 1.2);
          if (b.perch.kind === "lawn") {
            const nx = b.x + Math.cos(b.yaw) * 0.18, nz = b.z - Math.sin(b.yaw) * 0.18;
            if (lawnFree(nx, nz)) { b.x = nx; b.z = nz; b.hopT = 0.25; }
          }
        }
        b.peck = b.perch.kind === "lawn" || b.perch.kind === "bath" ? Math.max(0, Math.sin(b.t * 3.1 + b.wob)) : 0;
        if (b.hopT > 0) b.hopT -= dt;
        b.y = b.perch.y + (b.hopT > 0 ? Math.sin((b.hopT / 0.25) * Math.PI) * 0.08 : 0);
        // A cat coming close sends it off (it never waits to be caught).
        if (b.t > b.stay || catsNear(b.x, b.z, b.perch.kind === "lawn" ? 0.75 : 0.5)) flyToFlock(b, true);
      } else if (b.state === "takeoff") {
        b.t += dt;
        const u = Math.min(1, b.t / b.dur), e = u * u * (3 - 2 * u);
        slotPos(b, time, tmp2);
        bez(b.from, b.ctrl, tmp2, e, tmp);
        b.x = tmp.x; b.y = tmp.y; b.z = tmp.z;
        b.flap = Math.sin(time * b.rate * 1.25 + b.phase) * 1.1;
        b.fold = Math.max(0, 1 - u * 4);
        if (u >= 1) b.state = "flying";
      }
      // Heading from movement (when moving), a bank into turns, a nose-up when climbing.
      const mx = b.x - px, my = b.y - py, mz = b.z - pz, sp = Math.hypot(mx, mz);
      if (b.state !== "perched" && sp > 1e-4) {
        const yaw = Math.atan2(-mz, mx);
        let d = yaw - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        b.yaw += d * Math.min(1, dt * 6);
        b.bank += (-d * 8 - b.bank) * Math.min(1, dt * 3);
        b.pitch = Math.atan2(my, sp) * 0.6;
      } else if (b.state === "perched") { b.bank *= 0.8; b.pitch = -b.peck * 0.5; }
      _e.set(b.bank * 0.5, b.yaw, b.pitch, "YXZ");
      _m.compose(_p.set(b.x, b.y + (b.state === "perched" ? 0.07 : 0), b.z), _q.setFromEuler(_e), _s.setScalar(b.scale * (b.state === "perched" ? 0.8 : 1)));
      birdMesh.setMatrixAt(i, _m);
      fl.setXY(i, b.flap, b.fold);
    });
    birdMesh.instanceMatrix.needsUpdate = true;
    fl.needsUpdate = true;
  }

  function updateButterflies(dt) {
    const fl = bMesh.geometry.attributes.aFlap;
    butterflies.forEach((b, i) => {
      if (b.rest > 0) {
        b.rest -= dt;
        b.vx = b.vy = b.vz = 0;
        fl.setXY(i, 0.9 + Math.sin(time * 1.4 + b.phase) * 0.35, 0);
      } else {
        if ((b.retarget -= dt) < 0 || Math.hypot(b.tx - b.x, b.tz - b.z) < 0.3) {
          const h = b.home, a = rnd.range(0, 6.28), d = Math.sqrt(rnd.next()) * h.r;
          b.tx = h.x + Math.cos(a) * d; b.tz = h.z + Math.sin(a) * d;
          b.ty = (h.y || 0) + (b.scared > 0 ? rnd.range(2.6, 4) : rnd.range(0.35, 1.5));
          b.retarget = rnd.range(1.5, 4);
          if (b.scared <= 0 && rnd.chance(0.12)) { b.ty = (h.y || 0) + 0.3; b.landing = true; }
        }
        const sp = b.scared > 0 ? 2.6 : 1.1;
        const ax = (b.tx - b.x), ay = (b.ty - b.y), az = (b.tz - b.z), al = Math.hypot(ax, ay, az) || 1;
        b.vx += ((ax / al) * sp - b.vx) * Math.min(1, dt * 1.8) + Math.sin(time * 3.3 + b.phase) * dt * 1.2;
        b.vz += ((az / al) * sp - b.vz) * Math.min(1, dt * 1.8) + Math.cos(time * 2.9 + b.phase) * dt * 1.2;
        b.vy += ((ay / al) * sp * 0.8 - b.vy) * Math.min(1, dt * 2.2);
        b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(time * 9 + b.phase) * dt * 0.35; b.z += b.vz * dt;
        b.y = Math.max(0.25, b.y);
        if (b.landing && Math.abs(b.y - b.ty) < 0.08 && Math.hypot(b.tx - b.x, b.tz - b.z) < 0.25) { b.rest = rnd.range(2, 5); b.landing = false; }
        const yaw = Math.atan2(-b.vz, b.vx);
        let d = yaw - b.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        b.yaw += d * Math.min(1, dt * 5);
        fl.setXY(i, Math.sin(time * b.rate + b.phase) * 1.1 + 0.25, 0);
      }
      if (b.scared > 0) b.scared -= dt;
      _e.set(0, b.yaw, 0.15);
      _m.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e), _s.setScalar(b.s));
      bMesh.setMatrixAt(i, _m);
    });
    bMesh.instanceMatrix.needsUpdate = true;
    fl.needsUpdate = true;
  }

  /** Reduced motion: every bird sits on the roof or a fence post, every butterfly rests on a flower. */
  function settle() {
    for (const b of birds) {
      if (b.perch) perchTaken.delete(b.perch.key);
      const u = rnd.next();
      const seg = u < 0.5 ? L.BIRD_PERCHES.ridge : L.BIRD_PERCHES.porchRoof;
      let p = u < 0.75 ? { x: seg.from.x + (seg.to.x - seg.from.x) * rnd.next(), y: seg.from.y, z: seg.from.z + (seg.to.z - seg.from.z) * rnd.next(), kind: "roof" } : { ...rnd.pick(fencePosts.length ? fencePosts : [{ x: 0, y: 4.86, z: 0 }]), kind: "fence" };
      p.key = `settled-${b.id}`;
      b.perch = p; b.state = "perched"; b.reachable = false; b.x = p.x; b.y = p.y; b.z = p.z; b.stay = Infinity; b.t = 0; b.flap = -0.35; b.fold = 1; b.pitch = 0; b.bank = 0; b.peck = 0;
    }
    for (const b of butterflies) { b.rest = Infinity; b.y = (b.home.y || 0) + 0.3; b.x = b.home.x + (b.x - b.home.x) * 0.5; b.z = b.home.z + (b.z - b.home.z) * 0.5; }
    draw();
  }
  function draw() {
    const fl = birdMesh.geometry.attributes.aFlap;
    birds.forEach((b, i) => {
      _e.set(b.bank * 0.5, b.yaw, b.pitch, "YXZ");
      _m.compose(_p.set(b.x, b.y + (b.state === "perched" ? 0.07 : 0), b.z), _q.setFromEuler(_e), _s.setScalar(b.scale * (b.state === "perched" ? 0.8 : 1)));
      birdMesh.setMatrixAt(i, _m); fl.setXY(i, b.flap, b.fold);
    });
    const bf = bMesh.geometry.attributes.aFlap;
    butterflies.forEach((b, i) => { _e.set(0, b.yaw, 0.15); _m.compose(_p.set(b.x, b.y, b.z), _q.setFromEuler(_e), _s.setScalar(b.s)); bMesh.setMatrixAt(i, _m); bf.setXY(i, 1.0, 0); });
    birdMesh.instanceMatrix.needsUpdate = true; bMesh.instanceMatrix.needsUpdate = true; fl.needsUpdate = true; bf.needsUpdate = true;
  }
  function wake() {
    for (const b of birds) if (b.stay === Infinity) { b.stay = rnd.range(2, 12); }
    for (const b of butterflies) b.rest = rnd.range(0, 3);
  }

  // Start with the flocks spread along their paths and one or two birds already down.
  for (const b of birds) { slotPos(b, 0, tmp); b.x = tmp.x; b.y = tmp.y; b.z = tmp.z; }

  let settled = false;
  return {
    birds,
    butterflies,
    meshes: [birdMesh, bMesh],
    /** Something (a cat) has startled a bird or a butterfly: it is off at once. */
    startle(thing) {
      if (!thing) return;
      if ("flock" in thing) { if (thing.state === "perched" || thing.state === "landing") flyToFlock(thing, true); }
      else { thing.scared = rnd.range(4, 7); thing.rest = 0; thing.landing = false; thing.retarget = 0; thing.vy = 2.2; }
    },
    update(dt, still) {
      if (still) { if (!settled) { settle(); settled = true; } return; }
      if (settled) { wake(); settled = false; }
      time += dt;
      updateBirds(dt);
      updateButterflies(dt);
    },
  };
}
