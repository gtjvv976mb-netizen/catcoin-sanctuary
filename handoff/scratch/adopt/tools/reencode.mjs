import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).results;
const u8 = (n) => Buffer.from([n]); const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const str = (s) => { const x = Buffer.from(s, "utf8"); const l = Buffer.alloc(4); l.writeUInt32LE(x.length); return Buffer.concat([l, x]); };
const out = [];
for (const r of d) {
  const ix = r.instructions.find((i) => i.namedAccounts); const a = ix.decoded;
  const mine = Buffer.concat([Buffer.from("25be7ede2c9aab11", "hex"), u8(a.decimals), str(a.name), str(a.symbol), str(a.uri), u8(0), u64(a.supply), u64(a.totalSellA), u64(a.totalFundRaisingB), u8(a.migrateType), u64(0), u64(0), u64(0), u8(a.ammFeeOn), u8(0), Buffer.alloc(10)]).toString("hex");
  out.push({ label: r.label, signature: r.signature, byteIdentical: mine === ix.dataHex, len: mine.length / 2 });
}
console.log(JSON.stringify(out, null, 1)); fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
