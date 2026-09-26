/* Drawing the cats. Every pose of every coat is one InstancedMesh, so thirty cats cost about
   ten draw calls: each frame, every cat writes one matrix (and its coat tint) into the mesh
   for the pose it is in. The models are the generated cat-*.glb and ginger-*.glb; each is
   unit-sized per pose and faces +x, so each pose gets its own scale to one cat size. */

import * as THREE from "three";
import { POSES } from "./cats.js";
import { CAT } from "./layout.js";

/** Each pose's scale to one cat size (the prototype's FIT table): a sitting cat is CAT.size tall. */
const FIT = {
  sit: (b) => CAT.size / b.y,
  walk: (b) => (CAT.size * 0.95) / b.y,
  loaf: (b) => (CAT.size * 1.05) / b.x,
  stretch: (b) => (CAT.size * 1.2) / b.x,
  sleep: (b) => (CAT.size * 0.8) / Math.max(b.x, b.z),
};
/** Small heading corrections, measured: the cream walking cat was modelled turned about 40° off +x. */
const YAW_FIX = { "cat-walk": -0.66 };

/** Loads the ten cat models and works out, for each, the matrix that fits it to one cat size. */
export async function loadCatModels(loader, base = "assets/models/") {
  const out = { cat: {}, ginger: {} };
  await Promise.all(["cat", "ginger"].flatMap((coat) => POSES.map(async (pose) => {
    const gltf = await loader.loadAsync(`${base}${coat}-${pose}.glb`);
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    let mesh = null;
    root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) throw new Error(`no mesh in ${coat}-${pose}.glb`);
    const fix = new THREE.Matrix4().makeRotationY(YAW_FIX[`${coat}-${pose}`] || 0);
    const toModel = new THREE.Matrix4().multiplyMatrices(fix, mesh.matrixWorld);
    // Measure the posed model exactly (vertex by vertex; quantized attributes read fine).
    const box = new THREE.Box3(), v = new THREE.Vector3(), p = mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(toModel));
    const size = box.getSize(new THREE.Vector3());
    const s = FIT[pose](size);
    const fit = new THREE.Matrix4().makeScale(s, s, s)
      .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2))
      .multiply(toModel);
    const material = mesh.material;
    material.color?.set(0xffffff);
    out[coat][pose] = { geometry: mesh.geometry, material, fit, len: size.x * s, height: size.y * s, width: size.z * s };
  })));
  return out;
}

const _m = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Color();

export class CatHerd {
  /**
   * @param {THREE.Scene} scene
   * @param {object} models   from loadCatModels
   * @param {object} sim      from createSanctuary
   * @param {Map} tints       cat id → "#hex"
   */
  constructor(scene, models, sim, tints) {
    this.models = models;
    this.sim = sim;
    this.meshes = [];
    this.lookup = new Map(); // InstancedMesh → [cat per instance]
    this.tints = new Map([...tints].map(([id, hex]) => [id, new THREE.Color(hex || "#ffffff")]));
    const perCoat = { cat: 0, ginger: 0 };
    for (const c of sim.cats) perCoat[c.model]++;
    this.byKey = {};
    for (const coat of ["cat", "ginger"]) {
      if (!perCoat[coat]) continue;
      for (const pose of POSES) {
        const md = models[coat][pose];
        const im = new THREE.InstancedMesh(md.geometry, md.material, perCoat[coat]);
        im.name = `${coat}-${pose}`;
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false; // the cats move; the whole garden is in view anyway
        for (let i = 0; i < perCoat[coat]; i++) im.setColorAt(i, _c.set(0xffffff)); // creates the tint attribute before first draw
        im.count = 0;
        scene.add(im);
        this.meshes.push(im);
        this.byKey[`${coat}-${pose}`] = im;
        this.lookup.set(im, []);
      }
    }
  }

  /** Writes every cat's matrix into the mesh for its pose. */
  update() {
    for (const im of this.meshes) { im.count = 0; this.lookup.get(im).length = 0; }
    for (const cat of this.sim.cats) {
      const im = this.byKey[`${cat.model}-${cat.pose}`];
      const md = this.models[cat.model][cat.pose];
      this.matrixFor(cat, md, _m);
      const i = im.count++;
      im.setMatrixAt(i, _m);
      im.setColorAt(i, this.tints.get(cat.id) || _c.set(0xffffff));
      this.lookup.get(im)[i] = cat;
    }
    for (const im of this.meshes) {
      im.visible = im.count > 0;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.boundingSphere = null; // recomputed on demand when picking
    }
  }

  /** world = T(position + bob) · Ry(yaw) · [tilt about a pivot along the body] · S(breath) · fit */
  matrixFor(cat, md, out) {
    const a = cat.anim;
    out.makeRotationY(cat.yaw).setPosition(cat.x, cat.y + a.bob, cat.z);
    if (a.pitch || a.roll || a.pivot) {
      const px = a.pivot * md.len * 0.5;
      out.multiply(_t.makeTranslation(px, 0, 0));
      if (a.pitch) out.multiply(_r.makeRotationZ(a.pitch));
      if (a.roll) out.multiply(_r.makeRotationX(a.roll));
      out.multiply(_t.makeTranslation(-px, 0, 0));
    }
    if (a.sx !== 1 || a.sy !== 1 || a.sz !== 1) out.multiply(_t.makeScale(a.sx, a.sy, a.sz));
    return out.multiply(md.fit);
  }

  /** The cat under a ray, if any. */
  pick(raycaster) {
    const hits = raycaster.intersectObjects(this.meshes.filter((m) => m.visible), false);
    for (const h of hits) { const cat = this.lookup.get(h.object)?.[h.instanceId]; if (cat) return cat; }
    return null;
  }

  /** A point just above the cat's head, for the tag that follows it. */
  headPoint(cat, out) {
    const md = this.models[cat.model][cat.pose];
    return out.set(cat.x, cat.y + md.height + 0.15, cat.z);
  }

  /** The middle of the cat, for "nearest cat to a tap" picking on small screens. */
  midPoint(cat, out) {
    const md = this.models[cat.model][cat.pose];
    return out.set(cat.x, cat.y + md.height * 0.5, cat.z);
  }

  /** Triangles drawn for cats this frame (for the stats line). */
  triangles() {
    let n = 0;
    for (const im of this.meshes) if (im.visible) n += (im.geometry.index ? im.geometry.index.count / 3 : im.geometry.attributes.position.count / 3) * im.count;
    return n;
  }
}

