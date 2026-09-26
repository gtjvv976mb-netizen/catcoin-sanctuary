/* Small tiling textures drawn in code at start-up (nothing to download): lawn, earth, gravel,
   stone and bark, each seamless, soft and bright to suit the painted look. The terrain blends the
   first four; bark is for the tree trunks. Each is `size` pixels square (256 on phones, 512 on
   desktops), with mipmaps and anisotropic filtering so they stay crisp at a glance and calm far off. */

import * as THREE from "three";
import { makeRandom } from "./rng.js";

/** Periodic value noise on a `period`-cell lattice (so it tiles), 0..1. */
function noiseField(rnd, period) {
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = rnd.next();
  return (u, v) => {
    const x = u * period, y = v * period;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i, j) => g[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
function fbm(fields, u, v) {
  let s = 0, w = 0.5, n = 0;
  for (const f of fields) { s += f(u, v) * w; n += w; w *= 0.5; }
  return s / n;
}

function makeCanvas(size) {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(size, size) : Object.assign(document.createElement("canvas"), { width: size, height: size });
  return c;
}

/** Fills a canvas from f(u, v) → [r, g, b] (0..255), worked out at half size and scaled up
    smoothly (the noise is soft; the crisp detail is drawn on top at full size). */
function fill(size, f) {
  const c = makeCanvas(size), ctx = c.getContext("2d");
  const n = size >> 1, low = makeCanvas(n), lctx = low.getContext("2d");
  const img = lctx.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const [r, g, b] = f(x / n, y / n);
    const i = (y * n + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  lctx.putImageData(img, 0, 0);
  // Tile it 3×3 while scaling, so the smoothing wraps round the edges too.
  ctx.imageSmoothingEnabled = true;
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) ctx.drawImage(low, dx * size, dy * size, size, size);
  return { c, ctx };
}

/** Draws `draw(ctx, x, y)` at (x, y) and at its wrapped copies, so shapes cross the edges seamlessly. */
function wrapped(ctx, size, x, y, r, draw) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    if (x + dx < -r || x + dx > size + r || y + dy < -r || y + dy > size + r) continue;
    draw(ctx, x + dx, y + dy);
  }
}

const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Lawn: soft greens with tiny blade strokes and clover. Bright and fairly flat (the vertex tint does the rest). */
function lawn(size, rnd) {
  const n = [noiseField(rnd, 4), noiseField(rnd, 8), noiseField(rnd, 16), noiseField(rnd, 32), noiseField(rnd, 64)];
  const { c, ctx } = fill(size, (u, v) => {
    const k = fbm(n, u, v);
    const col = mixc([176, 204, 150], [222, 240, 196], k);
    return col.map((x) => x + (rnd.next() - 0.5) * 10);
  });
  const s = size / 256;
  for (let i = 0; i < 1600 * s * s; i++) {
    const x = rnd.range(0, size), y = rnd.range(0, size), len = rnd.range(3, 7) * s, a = rnd.range(-0.6, 0.6) - Math.PI / 2;
    const light = rnd.chance(0.5), al = light ? rnd.range(0.25, 0.5) : rnd.range(0.12, 0.28), lw = rnd.range(0.7, 1.3) * s;
    wrapped(ctx, size, x, y, len, (g, px, py) => {
      g.strokeStyle = light ? `rgba(245,255,225,${al})` : `rgba(90,130,70,${al})`;
      g.lineWidth = lw;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
    });
  }
  return c;
}

/** Earth: warm brown, crumbly, with little pebbles and root-dark flecks. */
function earth(size, rnd) {
  const n = [noiseField(rnd, 4), noiseField(rnd, 8), noiseField(rnd, 16), noiseField(rnd, 48), noiseField(rnd, 96)];
  const { c, ctx } = fill(size, (u, v) => {
    const k = fbm(n, u, v);
    return mixc([150, 108, 72], [204, 162, 112], k).map((x) => x + (rnd.next() - 0.5) * 16);
  });
  const s = size / 256;
  for (let i = 0; i < 260 * s * s; i++) {
    const x = rnd.range(0, size), y = rnd.range(0, size), r = rnd.range(0.8, 2.4) * s;
    const t = rnd.range(0, 1);
    wrapped(ctx, size, x, y, r + 2, (g, px, py) => {
      g.fillStyle = `rgba(90,62,40,0.35)`; g.beginPath(); g.ellipse(px + 0.6 * s, py + 0.8 * s, r, r * 0.8, 0, 0, 7); g.fill();
      g.fillStyle = `rgb(${200 + t * 30},${176 + t * 30},${140 + t * 30})`; g.beginPath(); g.ellipse(px, py, r, r * 0.8, 0, 0, 7); g.fill();
    });
  }
  return c;
}

/** Gravel: rounded pebbles in creams and warm greys, each with a soft shadow and a highlight. */
function gravel(size, rnd) {
  const n = [noiseField(rnd, 8), noiseField(rnd, 32)];
  const { c, ctx } = fill(size, (u, v) => mixc([168, 152, 132], [196, 182, 160], fbm(n, u, v)));
  const s = size / 256;
  const tones = [[236, 226, 208], [222, 208, 186], [210, 198, 182], [244, 236, 222], [200, 184, 164], [226, 214, 200]];
  for (let i = 0; i < 1500 * s * s; i++) {
    const x = rnd.range(0, size), y = rnd.range(0, size), r = rnd.range(2.2, 5.2) * s, a = rnd.range(0, Math.PI), e = rnd.range(0.6, 0.95);
    const [R, G, B] = rnd.pick(tones), l = rnd.range(-12, 12);
    wrapped(ctx, size, x, y, r + 3, (g, px, py) => {
      g.fillStyle = "rgba(80,66,52,0.35)"; g.beginPath(); g.ellipse(px + 1.1 * s, py + 1.4 * s, r, r * e, a, 0, 7); g.fill();
      g.fillStyle = `rgb(${R + l},${G + l},${B + l})`; g.beginPath(); g.ellipse(px, py, r, r * e, a, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,250,0.35)"; g.beginPath(); g.ellipse(px - r * 0.3, py - r * 0.3 * e, r * 0.4, r * 0.28 * e, a, 0, 7); g.fill();
    });
  }
  return c;
}

/** Stone: pale weathered rock with a few cracks and lichen dots. */
function stone(size, rnd) {
  const n = [noiseField(rnd, 3), noiseField(rnd, 6), noiseField(rnd, 12), noiseField(rnd, 24), noiseField(rnd, 64)];
  const cracks = noiseField(rnd, 6);
  const { c, ctx } = fill(size, (u, v) => {
    const k = fbm(n, u, v);
    let col = mixc([160, 154, 146], [218, 212, 200], k);
    const cr = Math.abs(cracks(u, v) - 0.5);
    if (cr < 0.012) col = mixc(col, [110, 104, 98], 1 - cr / 0.012);
    return col.map((x) => x + (rnd.next() - 0.5) * 12);
  });
  const s = size / 256;
  for (let i = 0; i < 90 * s * s; i++) {
    const x = rnd.range(0, size), y = rnd.range(0, size), r = rnd.range(1.5, 4) * s, fs = rnd.chance(0.5) ? "rgba(196,206,120,0.45)" : "rgba(230,196,120,0.4)";
    wrapped(ctx, size, x, y, r, (g, px, py) => { g.fillStyle = fs; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); });
  }
  return c;
}

/** Bark: vertical ridges (the trunk's u runs round it, v up it). */
function bark(size, rnd) {
  const n = [noiseField(rnd, 8), noiseField(rnd, 16), noiseField(rnd, 32)];
  const ridge = noiseField(rnd, 12);
  return fill(size, (u, v) => {
    const r = ridge(u * 1.0 + fbm(n, u, v * 0.25) * 0.15, v * 0.08);
    const k = 0.55 + 0.45 * Math.sin(r * 40);
    return mixc([150, 128, 108], [236, 222, 204], k * 0.7 + fbm(n, u, v) * 0.3);
  }).c;
}

let cache = null;
/**
 * The shared textures, made once.
 * @param {THREE.WebGLRenderer} renderer  for the anisotropy the device allows
 * @param {number} size  256 or 512
 */
export function groundTextures(renderer, size = 512) {
  if (cache) return cache;
  const rnd = makeRandom("textures-v1");
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (canvas, srgb = true) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
    return t;
  };
  cache = {
    lawn: tex(lawn(size, rnd)),
    earth: tex(earth(size, rnd)),
    gravel: tex(gravel(size, rnd)),
    stone: tex(stone(size, rnd)),
    bark: tex(bark(Math.min(size, 256), rnd)),
  };
  return cache;
}
