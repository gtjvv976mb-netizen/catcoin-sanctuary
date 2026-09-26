// Read + decode StonkFun platform config, global configs, curve rules and the 6 pools. READ-ONLY.
import fs from "node:fs"; import { createRequire } from "node:module"; import { rpc } from "./rpc.mjs";
const require = createRequire("/home/user/Cat-Intelligence-Agency/package.json");
const { PublicKey } = require("@solana/web3.js");
const LL = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj");
const PLATFORM = "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7";
const dec = JSON.parse(fs.readFileSync(process.argv[2], "utf8")).results;
const R = (b) => { let o = 0; const k = () => { const v = new PublicKey(b.subarray(o, o + 32)).toBase58(); o += 32; return v; };
  return { u8: () => b[o++], u16: () => { const v = b.readUInt16LE(o); o += 2; return v; }, u32: () => { const v = b.readUInt32LE(o); o += 4; return v; },
    u64: () => { const v = b.readBigUInt64LE(o); o += 8; return v.toString(); }, u128: () => { const lo = b.readBigUInt64LE(o), hi = b.readBigUInt64LE(o + 8); o += 16; return ((hi << 64n) + lo).toString(); },
    key: k, bytes: (n) => { const v = b.subarray(o, o + n); o += n; return v; }, skip: (n) => { o += n; }, get o() { return o; } }; };
const cstr = (x) => Buffer.from(x).toString("utf8").replace(/\0+$/, "");
function platformConfig(b) { const r = R(b); r.skip(8); return { epoch: r.u64(), platformFeeWallet: r.key(), platformNftWallet: r.key(), platformScale: r.u64(), creatorScale: r.u64(), burnScale: r.u64(), feeRate: r.u64(), name: cstr(r.bytes(64)), web: cstr(r.bytes(256)), img: cstr(r.bytes(256)), cpswapConfig: r.key(), creatorFeeRate: r.u64(), transferFeeExtensionAuth: r.key(), platformVestingWallet: r.key(), platformVestingScale: r.u64(), platformCpCreator: r.key(), restrictGlobalConfig: r.u8(), restrictCurveParam: r.u8(), curveRuleManager: r.key() }; }
function globalConfig(b) { const r = R(b); r.skip(8); return { epoch: r.u64(), curveType: r.u8(), index: r.u16(), migrateFee: r.u64(), tradeFeeRate: r.u64(), maxShareFeeRate: r.u64(), minBaseSupply: r.u64(), maxLockRate: r.u64(), minBaseSellRate: r.u64(), minBaseMigrateRate: r.u64(), minQuoteFundRaising: r.u64(), quoteMint: r.key(), protocolFeeOwner: r.key(), migrateFeeOwner: r.key(), migrateToAmmWallet: r.key(), migrateToCpswapWallet: r.key() }; }
function curveRule(b) { const r = R(b); r.skip(8); const out = { bump: r.u8(), version: r.u8(), platformConfig: r.key(), globalConfig: r.key(), epoch: r.u64() }; r.skip(64); const n = r.u32(); out.groups = [];
  for (let i = 0; i < n; i++) { const g = { groupId: r.u16(), epoch: r.u64(), constraints: [] }; const nc = r.u32(); for (let c = 0; c < nc; c++) g.constraints.push({ field: r.u8(), op: r.u8(), value: r.u128() }); out.groups.push(g); } return out; }
function poolState(b) { const r = R(b); r.skip(8); return { epoch: r.u64(), authBump: r.u8(), status: r.u8(), baseDecimals: r.u8(), quoteDecimals: r.u8(), migrateType: r.u8(), supply: r.u64(), totalBaseSell: r.u64(), virtualBase: r.u64(), virtualQuote: r.u64(), realBase: r.u64(), realQuote: r.u64(), totalQuoteFundRaising: r.u64(), quoteProtocolFee: r.u64(), platformFee: r.u64(), migrateFee: r.u64(), vesting: { totalLocked: r.u64(), cliff: r.u64(), unlock: r.u64(), startTime: r.u64(), allocatedShare: r.u64() }, globalConfig: r.key(), platformConfig: r.key(), baseMint: r.key(), quoteMint: r.key(), baseVault: r.key(), quoteVault: r.key(), creator: r.key(), tokenProgramFlag: r.u8(), ammCreatorFeeOn: r.u8(), platformVestingShare: r.u64() }; }
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, LL)[0].toBase58();
const out = { readAt: new Date().toISOString(), launches: [] };
const pc = await rpc("getAccountInfo", [PLATFORM, { encoding: "base64", commitment: "confirmed" }]);
out.slot = pc.context.slot; out.platformConfig = { address: PLATFORM, owner: pc.value.owner, dataLen: Buffer.from(pc.value.data[0], "base64").length, decoded: platformConfig(Buffer.from(pc.value.data[0], "base64")) };
const rw = await rpc("getAccountInfo", ["6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt", { encoding: "base64", commitment: "confirmed" }]);
out.platformConfigReward = { address: "6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt", decoded: platformConfig(Buffer.from(rw.value.data[0], "base64")) };
for (const l of dec) {
  const ix = l.instructions.find((i) => i.namedAccounts); const acc = Object.fromEntries(ix.namedAccounts.map((a) => [a.name, a.pubkey]));
  const cr = acc.extra_15;
  const derivedRule = pda([Buffer.from("platform_curve_rule"), new PublicKey(acc.platform_config).toBuffer(), new PublicKey(acc.global_config).toBuffer()]);
  const derivedPool = pda([Buffer.from("pool"), new PublicKey(acc.base_mint).toBuffer(), new PublicKey(acc.quote_mint).toBuffer()]);
  const derivedBaseVault = pda([Buffer.from("pool_vault"), new PublicKey(derivedPool).toBuffer(), new PublicKey(acc.base_mint).toBuffer()]);
  const derivedQuoteVault = pda([Buffer.from("pool_vault"), new PublicKey(derivedPool).toBuffer(), new PublicKey(acc.quote_mint).toBuffer()]);
  const derivedAuth = pda([Buffer.from("vault_auth_seed")]); const derivedEvent = pda([Buffer.from("__event_authority")]);
  const m = await rpc("getMultipleAccounts", [[acc.global_config, cr, acc.pool_state, acc.base_mint], { encoding: "base64", commitment: "confirmed" }]);
  const [g, c, p, mint] = m.value.map((v) => v && { owner: v.owner, data: Buffer.from(v.data[0], "base64") });
  out.launches.push({ label: l.label, mint: acc.base_mint, signature: l.signature,
    pdaChecks: { curveRule: { inTx: cr, derived: derivedRule, equal: cr === derivedRule }, pool: derivedPool === acc.pool_state, baseVault: derivedBaseVault === acc.base_vault, quoteVault: derivedQuoteVault === acc.quote_vault, authority: derivedAuth === acc.authority, eventAuthority: derivedEvent === acc.event_authority },
    globalConfig: { address: acc.global_config, owner: g.owner, decoded: globalConfig(g.data) },
    curveRule: { address: cr, owner: c.owner, decoded: curveRule(c.data) },
    pool: { address: acc.pool_state, owner: p.owner, decoded: poolState(p.data) },
    mintAccount: { owner: mint.owner, len: mint.data.length, base64: mint.data.toString("base64") } });
  console.error("ok", l.label);
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
