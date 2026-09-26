import fs from "node:fs"; import zlib from "node:zlib";
const url = "https://api.mainnet-beta.solana.com";
const rpc = async (method, params) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error)); return j.result; };
const acc = await rpc("getAccountInfo", ["E6wT2uNeoWUvDrwdch1R8ETsyewR1ZM4WAwsa5hLJK5Z", { encoding: "base64" }]);
const b = Buffer.from(acc.value.data[0], "base64");
// anchor idl account: 8 disc, 32 authority, 4 len, data
const len = b.readUInt32LE(40);
const idl = JSON.parse(zlib.inflateSync(b.subarray(44, 44 + len)).toString("utf8"));
fs.writeFileSync("launchlab-idl.json", JSON.stringify({ readAt: new Date().toISOString(), slot: acc.context.slot, account: "E6wT2uNeoWUvDrwdch1R8ETsyewR1ZM4WAwsa5hLJK5Z", idl }, null, 1));
for (const ix of idl.instructions) console.log(ix.name, Buffer.from(ix.discriminator).toString("hex"), ix.accounts.length, ix.args.map(a => a.name + ":" + JSON.stringify(a.type)).join(", "));
for (const t of idl.types.filter(t => ["CurveParams", "MintParams", "VestingParams", "TransferFeeExtensionParams", "AmmCreatorFeeOn", "ConstantCurve", "FixedCurve", "LinearCurve"].includes(t.name))) console.log(t.name, JSON.stringify(t.type));
