import { rpc } from "./rpc.mjs";
for (const m of process.argv.slice(2)) {
  const r = await rpc("getAccountInfo", [m, { encoding: "base64", commitment: "confirmed" }]);
  const b = Buffer.from(r.value.data[0], "base64"); const s = b.toString("latin1"); const i = s.indexOf("http");
  const len = b.readUInt32LE(i - 4); console.log(m, r.value.owner, b.subarray(i, i + len).toString("utf8"));
}
