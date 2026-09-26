import path from "node:path";
const { buildOptions } = await import("/home/user/Cat-Intelligence-Agency/build.mjs");
const { createRequire } = await import("node:module");
const esbuild = createRequire("/home/user/Cat-Intelligence-Agency/build.mjs")("esbuild");
const res = {};
for (const [name, entry] of [["adopt-full-min", "entry.mjs"], ["stonkfun-only-min", "entry-min.mjs"]]) {
  const r = await esbuild.build({ ...buildOptions({ outdir: path.resolve("out") }), entryPoints: { [name]: path.resolve(entry) }, outdir: path.resolve("out"), minify: true, metafile: true, logLevel: "warning" });
  const ins = Object.keys(r.metafile.inputs);
  res[name] = { bytes: Object.values(r.metafile.outputs)[0].bytes, pullsExecutor: ins.filter((f) => f.includes("vendor/executor")).map((f) => f.replace(/^.*vendor\/executor\//, "")), pullsPumpfun: ins.some((f) => f.includes("bots/cashcat/pumpfun.mjs")), pullsConfig: ins.some((f) => f.includes("src/lib/config.mjs")) };
}
console.log(JSON.stringify(res, null, 1));
