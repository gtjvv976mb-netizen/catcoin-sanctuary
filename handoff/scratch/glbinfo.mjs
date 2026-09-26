import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f);
  const jl = b.readUInt32LE(12);
  const j = JSON.parse(b.slice(20, 20 + jl).toString());
  console.log('==', f, 'nodes', j.nodes.length, 'meshes', j.meshes.length, 'materials', j.materials?.length, 'textures', j.textures?.length, 'ext', j.extensionsUsed);
  for (const n of j.nodes) console.log(' node', JSON.stringify({name:n.name, mesh:n.mesh, t:n.translation, r:n.rotation, s:n.scale, children:n.children}));
  for (const m of j.meshes) for (const p of m.primitives) { const a = j.accessors[p.attributes.POSITION]; const idx = j.accessors[p.indices]; console.log('  prim pos', a.componentType, a.normalized, a.count, 'min', a.min, 'max', a.max, 'tris', idx ? idx.count/3 : '-', 'mat', p.material); }
  for (const m of j.materials||[]) console.log('  mat', JSON.stringify(m).slice(0,300));
  console.log('  images', (j.images||[]).map(i=>i.mimeType));
}
