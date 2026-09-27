/* The quadruped rig (assets/world/catrig.js) on a simple box cat: joints in order, skin weights
   that add up and never cross from one leg to another, and clips that keep paws on the ground:
   planted while walking (no sliding), and on the ground when sitting or lying. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./helpers.mjs";

// catrig.js imports "three" as the page's import map names it; point that at the vendored copy.
const THREE_URL = pathToFileURL(path.join(ROOT, "assets/vendor/three/three.module.min.js")).href;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "catrig-"));
fs.writeFileSync(path.join(tmp, "catrig.mjs"), fs.readFileSync(path.join(ROOT, "assets/world/catrig.js"), "utf8").replace(/from "three"/, `from "${THREE_URL}"`));
const THREE = await import(THREE_URL);
const R = await import(pathToFileURL(path.join(tmp, "catrig.mjs")).href);

/** A box cat as a triangle mesh: body, head, four legs and a tail, 1 unit tall, facing +x. */
function boxCat() {
  const pos = [], idx = [];
  const box = (x0, x1, y0, y1, z0, z1, n = 8) => {
    const base = pos.length / 3, g = (i, j, k) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * j / n, z0 + (z1 - z0) * k / n];
    const id = new Map();
    const v = (i, j, k) => { const key = `${i},${j},${k}`; if (!id.has(key)) { id.set(key, pos.length / 3); pos.push(...g(i, j, k)); } return id.get(key); };
    const quad = (a, b, c, d) => idx.push(a, b, c, a, c, d);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      quad(v(a, b, 0), v(a + 1, b, 0), v(a + 1, b + 1, 0), v(a, b + 1, 0)); quad(v(a, b, n), v(a, b + 1, n), v(a + 1, b + 1, n), v(a + 1, b, n));
      quad(v(a, 0, b), v(a, 0, b + 1), v(a + 1, 0, b + 1), v(a + 1, 0, b)); quad(v(a, n, b), v(a + 1, n, b), v(a + 1, n, b + 1), v(a, n, b + 1));
      quad(v(0, a, b), v(0, a + 1, b), v(0, a + 1, b + 1), v(0, a, b + 1)); quad(v(n, a, b), v(n, a, b + 1), v(n, a + 1, b + 1), v(n, a + 1, b));
    }
    return base;
  };
  box(-0.4, 0.3, 0.35, 0.7, -0.15, 0.15);
  box(0.25, 0.5, 0.62, 1.0, -0.12, 0.12);
  for (const x of [-0.3, 0.2]) for (const z of [-0.1, 0.1]) box(x - 0.045, x + 0.045, 0, 0.42, z - 0.045, z + 0.045);
  box(-0.85, -0.38, 0.56, 0.63, -0.03, 0.03);
  return { pos: new Float32Array(pos), index: new Uint32Array(idx) };
}

const cat = boxCat();
const rig = R.findRig(cat.pos);
const sk = R.buildSkeleton(rig);

test("the rig finds four paws and puts each leg's joints in order down the leg", () => {
  for (const k of ["fL", "fR", "hL", "hR"]) {
    const g = rig.legs[k];
    assert.ok(g.top.y > g.knee.y && g.knee.y > g.low.y && g.low.y > 0, `${k}: joints top > knee > low > ground`);
    assert.ok(Math.abs(g.toe.y) < 1e-6, `${k}: toe on the ground`);
    assert.equal(g.toe.z > rig.zc, k[1] === "L", `${k}: on its own side`);
  }
  assert.ok(rig.legs.fL.toe.x > rig.legs.hL.toe.x, "front paws ahead of hind paws");
  assert.ok(rig.yb > 0.25 && rig.yb < 0.45 && rig.yt > 0.6, "belly and back lines");
});

test("skin weights add up to one, and no leg takes points from another leg", () => {
  const w = R.skinWeights(cat.pos, rig, sk, cat.index);
  const names = sk.skeleton.bones.map((b) => b.name);
  const n = cat.pos.length / 3;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) {
      const wt = w.weight.array[i * 4 + k], nm = names[w.index.array[i * 4 + k]];
      sum += wt;
      if (wt > 0.01 && /\.(L|R)$/.test(nm) && cat.pos[i * 3 + 1] < 0.3) {
        const side = cat.pos[i * 3 + 2] > rig.zc ? "L" : "R", hind = cat.pos[i * 3] < 0;
        assert.equal(nm.slice(-1), side, `point ${i} on the ${side} leg weighted to ${nm}`);
        assert.equal(/^(thigh|shin|foot)/.test(nm), hind, `point ${i} weighted to the wrong end's ${nm}`);
      }
    }
    assert.ok(Math.abs(sum - 1) < 1e-4, `point ${i} weights sum to ${sum}`);
  }
});

// Where a leg's toe is in a pose: the end bone's transform applied to the toe's rest offset.
const toeAt = (k) => {
  const end = sk.bones[{ hL: "foot.L", hR: "foot.R", fL: "paw.L", fR: "paw.R" }[k]];
  return rig.legs[k].toe.clone().sub(end.userData.at).applyMatrix4(end.matrixWorld);
};
function pose(clips, name, u) {
  const mixer = new THREE.AnimationMixer(sk.root);
  const a = mixer.clipAction(clips[name]); a.play(); a.time = u * clips[name].duration; mixer.update(0);
  sk.root.updateMatrixWorld(true);
  return mixer;
}

test("walking paws stay planted while they carry weight (no sliding), then lift clear", () => {
  const clips = R.makeClips(rig), stride = R.walkStride(rig);
  for (const k of ["hL", "fR"]) {
    // Ground position of the toe = its place under the body + how far the body has come.
    const ground = [], lifted = [];
    for (let f = 0; f < 40; f++) {
      const u = f / 40;
      pose(clips, "walk", u);
      const t = toeAt(k);
      if (t.y < 0.004) ground.push(t.x + stride * u); else lifted.push(t.y);
    }
    assert.ok(ground.length > 15, `${k}: planted for most of the cycle`);
    // One planted stretch (it may wrap round the cycle's end): it drifts under 2% of a stride (the
    // pelvis sways a little side to side, which the side-view IK leaves out).
    const spread = Math.max(...ground.map((g) => ((g % stride) + stride) % stride)) - Math.min(...ground.map((g) => ((g % stride) + stride) % stride));
    assert.ok(Math.min(spread, stride - spread) < stride * 0.02, `${k}: planted paw slides ${spread.toFixed(4)} of a ${stride.toFixed(3)} stride`);
    assert.ok(Math.max(...lifted) > 0.03, `${k}: the paw lifts as it swings forward`);
  }
});

test("sitting and lying cats keep all four paws on the ground and the body out of it", () => {
  const clips = R.makeClips(rig);
  for (const name of ["stand", "sit", "loaf", "crouch"]) {
    pose(clips, name, 0.3);
    for (const k of ["hL", "hR", "fL", "fR"]) assert.ok(Math.abs(toeAt(k).y) < 0.03, `${name}: ${k} toe at ${toeAt(k).y.toFixed(3)}`);
    const pelvis = new THREE.Vector3().setFromMatrixPosition(sk.bones.pelvis.matrixWorld);
    assert.ok(pelvis.y > 0.05, `${name}: pelvis above the ground (${pelvis.y.toFixed(3)})`);
  }
  pose(clips, "loaf", 0.3);
  const lying = new THREE.Vector3().setFromMatrixPosition(sk.bones.spine.matrixWorld).y;
  pose(clips, "stand", 0.3);
  const standing = new THREE.Vector3().setFromMatrixPosition(sk.bones.spine.matrixWorld).y;
  assert.ok(lying < standing - 0.2, "lying lowers the body onto the ground");
});

test("the renderer steps each gait by distance walked", () => {
  for (const g of ["walk", "trot", "run", "stalk"]) assert.ok(R.GAIT_RATE[g] > 0, g);
  assert.ok(Math.abs(R.cyclesPerUnit(rig, 2) * R.walkStride(rig) * 2 - 1) < 1e-9, "one walk cycle per stride");
});
