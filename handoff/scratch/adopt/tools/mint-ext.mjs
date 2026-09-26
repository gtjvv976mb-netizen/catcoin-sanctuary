import fs from "node:fs"; import { createRequire } from "node:module";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json"); const { PublicKey } = require("@solana/web3.js");
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const EXT = { 1: "TransferFeeConfig", 12: "PermanentDelegate", 18: "MetadataPointer", 19: "TokenMetadata", 3: "MintCloseAuthority", 16: "TransferHook", 25: "ScaledUiAmount", 26: "Pausable" };
const k = (b) => { const z = b.every((x) => x === 0); return z ? null : new PublicKey(b).toBase58(); };
const out = [];
for (const l of d.launches) {
  const b = Buffer.from(l.mintAccount.base64, "base64");
  const mintAuthOpt = b.readUInt32LE(0), mintAuth = k(b.subarray(4, 36)), supply = b.readBigUInt64LE(36).toString(), decimals = b[44], init = b[45], freezeOpt = b.readUInt32LE(46), freeze = k(b.subarray(50, 82));
  const accountType = b[165]; let o = 166; const exts = [];
  while (o + 4 <= b.length) { const t = b.readUInt16LE(o), len = b.readUInt16LE(o + 2); if (t === 0 && len === 0) break; const v = b.subarray(o + 4, o + 4 + len);
    const e = { type: t, name: EXT[t] ?? String(t), len };
    if (t === 18) { e.authority = k(v.subarray(0, 32)); e.metadataAddress = k(v.subarray(32, 64)); }
    if (t === 19) { e.updateAuthority = k(v.subarray(0, 32)); e.mint = k(v.subarray(32, 64)); let p = 64; const s = () => { const n = v.readUInt32LE(p); const x = v.subarray(p + 4, p + 4 + n).toString("utf8"); p += 4 + n; return x; }; e.name = s(); e.symbol = s(); e.uri = s(); e.additional = v.readUInt32LE(p); }
    exts.push(e); o += 4 + len; }
  out.push({ label: l.label, mint: l.mint, mintAuthority: mintAuthOpt ? mintAuth : null, freezeAuthority: freezeOpt ? freeze : null, supply, decimals, initialized: init, accountType, extensions: exts });
}
console.log(JSON.stringify(out, null, 1)); fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
