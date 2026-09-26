// Read-only: checks each StonkFun quote against the public RPC, gently (a few batched calls).
import fs from "node:fs";
import path from "node:path";
import {
  decodeGlobalConfig, decodeCurveRule, decodePlatformConfig, curveRuleAddress,
} from "/home/user/Cat-Intelligence-Agency/bots/cashcat/stonkfun.mjs";
import { LAUNCHLAB_PROGRAM, STONKFUN_PLATFORM_STANDARD, STONKFUN_PLATFORM_REWARD } from "/home/user/Cat-Intelligence-Agency/bots/lib/verified.mjs";
import { XSTOCK_BUILTIN } from "/home/user/Cat-Intelligence-Agency/src/lib/config.mjs";

const R = "/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launcher-design/raw";
const RPC = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let id = 0;
async function rpc(method, params) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    if (res.status === 429) { await sleep(3000 * (i + 1)); continue; }
    const j = await res.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    await sleep(1500);
    return j.result;
  }
  throw new Error("rate limited");
}

const pairs = JSON.parse(fs.readFileSync(path.join(R, "pairs-all.json"))).data.pairs;
const xs = pairs.filter((p) => p.category === "xstock");
const others = pairs.filter((p) => ["backpack", "prestock", "tessera"].includes(p.category));
const products = JSON.parse(fs.readFileSync(path.join(R, "xstocks-products.json")));
const bySol = new Map(products.filter((p) => p.addresses?.solana).map((p) => [p.addresses.solana, p]));

const readPricing = (dir, name) => { try { return JSON.parse(fs.readFileSync(path.join(R, dir, name + ".json"))).data; } catch { return null; } };

// 1. mints, parsed
async function parsedMints(list, file) {
  const out = [];
  for (let i = 0; i < list.length; i += 100) {
    const r = await rpc("getMultipleAccounts", [list.slice(i, i + 100).map((p) => p.mint), { encoding: "jsonParsed", commitment: "confirmed" }]);
    out.push(...r.value);
  }
  fs.writeFileSync(path.join(R, file), JSON.stringify(out.map((v, i) => ({ mint: list[i].mint, symbol: list[i].symbol, category: list[i].category, account: v })), null, 1));
  return out;
}
const summarizeMint = (acc) => {
  if (!acc) return { exists: false };
  const info = acc.data?.parsed?.info ?? {};
  const ext = Object.fromEntries((info.extensions ?? []).map((e) => [e.extension, e.state ?? true]));
  return {
    owner: acc.owner, decimals: info.decimals, mintAuthority: info.mintAuthority, freezeAuthority: info.freezeAuthority,
    extensions: Object.keys(ext),
    pausable: ext.pausableConfig ?? null,
    permanentDelegate: ext.permanentDelegate?.delegate ?? null,
    transferHook: ext.transferHook?.programId ?? null,
    transferFee: ext.transferFeeConfig ? { newer: ext.transferFeeConfig.newerTransferFee?.transferFeeBasisPoints, older: ext.transferFeeConfig.olderTransferFee?.transferFeeBasisPoints } : null,
    defaultAccountState: ext.defaultAccountState?.accountState ?? null,
    scaledUiAmount: ext.scaledUiAmountConfig ? { multiplier: ext.scaledUiAmountConfig.multiplier, authority: ext.scaledUiAmountConfig.authority } : null,
    metadata: ext.tokenMetadata ? { name: ext.tokenMetadata.name, symbol: ext.tokenMetadata.symbol, updateAuthority: ext.tokenMetadata.updateAuthority } : null,
    confidential: !!ext.confidentialTransferMint,
  };
};

const xMints = await parsedMints(xs, "rpc-xstock-mints.json");
const oMints = await parsedMints(others, "rpc-other-mints.json");

// 2. configs and curve rules
const rows = xs.map((p) => ({ p, pr: readPricing("pricing", p.symbol) }));
const orows = others.map((p) => {
  const pr = readPricing("pricing-other", `${p.category}-${p.symbol}`);
  return { p, pr };
});
const all = [...rows, ...orows].filter((r) => r.pr);
const keys = new Set([STONKFUN_PLATFORM_STANDARD, STONKFUN_PLATFORM_REWARD]);
for (const r of all) {
  r.cfg = r.pr.curve?.configId;
  r.rule = curveRuleAddress(STONKFUN_PLATFORM_STANDARD, r.cfg);
  r.ruleR = curveRuleAddress(STONKFUN_PLATFORM_REWARD, r.cfg);
  keys.add(r.cfg); keys.add(r.rule); keys.add(r.ruleR);
}
const keyList = [...keys];
const accs = [];
for (let i = 0; i < keyList.length; i += 100) {
  const r = await rpc("getMultipleAccounts", [keyList.slice(i, i + 100), { encoding: "base64", commitment: "confirmed" }]);
  accs.push(...r.value);
}
const acc = new Map(keyList.map((k, i) => [k, accs[i]]));
fs.writeFileSync(path.join(R, "rpc-launchlab-accounts.json"), JSON.stringify(keyList.map((k, i) => ({ address: k, owner: accs[i]?.owner ?? null, lamports: accs[i]?.lamports ?? null, dataBase64: accs[i]?.data?.[0] ?? null })), null, 1));
const dec = (a) => Buffer.from(a.data[0], "base64");
const plat = decodePlatformConfig(dec(acc.get(STONKFUN_PLATFORM_STANDARD)));
const platR = decodePlatformConfig(dec(acc.get(STONKFUN_PLATFORM_REWARD)));

function check(r) {
  const out = { symbol: r.p.symbol, category: r.p.category, mint: r.p.mint, launchable: r.p.launchable, launchLabReady: r.p.launchLabReady, pairsDecimals: r.p.decimals, pairsTokenProgram: r.p.tokenProgram };
  const pr = r.pr;
  out.pricing = { programOk: pr.curve.programId === LAUNCHLAB_PROGRAM, platformOk: pr.platform.standard === STONKFUN_PLATFORM_STANDARD, configId: r.cfg,
    shapeOk: pr.curve.curveType === "ConstantCurve" && pr.curve.migrateType === "cpmm" && pr.curve.baseDecimals === 6 && pr.curve.supply === "1000000000000000" && pr.curve.totalSellA === "793100000000000",
    vestingZero: ["totalLockedAmount", "cliffPeriod", "unlockPeriod"].every((k) => String(pr.curve.vesting?.[k]) === "0"),
    raiseRaw: pr.raise.raw, raiseUnits: pr.raise.units, startUsd: pr.marketCap?.startUsd, gradUsd: pr.marketCap?.graduationUsd, quoteUsd: pr.prices?.quoteUsd,
    cpmmCreatorFeeOn: pr.curve.cpmmCreatorFeeOn, migrateFeeRaw: pr.curve.migrateFeeRaw, pricingQuoteMintOk: pr.quote?.mint === r.p.mint,
    pricingDecimals: pr.quote?.decimals, pricingTokenProgram: pr.quote?.tokenProgram,
    ruleStdMatchesPda: pr.curveRule.standard === r.rule, ruleRewardMatchesPda: pr.curveRule.reward === r.ruleR };
  const c = acc.get(r.cfg);
  if (!c || c.owner !== LAUNCHLAB_PROGRAM) out.config = { exists: !!c, owner: c?.owner ?? null };
  else { const g = decodeGlobalConfig(dec(c)); out.config = { owner: "LaunchLab", quoteMintMatches: g.quoteMint === r.p.mint, curveType: g.curveType, index: g.index, tradeFeeRate: String(g.tradeFeeRate), migrateFee: String(g.migrateFee), minQuoteFundRaising: String(g.minQuoteFundRaising), raiseAboveMin: BigInt(pr.raise.raw) >= BigInt(g.minQuoteFundRaising) }; }
  const cr = acc.get(r.rule);
  if (!cr || cr.owner !== LAUNCHLAB_PROGRAM) out.rule = { exists: !!cr };
  else { const d = decodeCurveRule(dec(cr)); out.rule = { exists: true, platformOk: d.platformConfig === STONKFUN_PLATFORM_STANDARD, configOk: d.globalConfig === r.cfg, groups: d.groups.length, constraints: d.groups.map((g) => g.constraints.map((k) => `${k.field}:${k.op}:${k.value}`)) }; }
  const crr = acc.get(r.ruleR);
  out.ruleReward = { exists: !!crr && crr.owner === LAUNCHLAB_PROGRAM };
  return out;
}

const mintSummaries = new Map([...xs.map((p, i) => [p.mint, summarizeMint(xMints[i])]), ...others.map((p, i) => [p.mint, summarizeMint(oMints[i])])]);
const report = {
  readAt: new Date().toISOString(),
  platform: { standard: { name: plat.name, web: plat.web, feeRate: String(plat.feeRate), creatorFeeRate: String(plat.creatorFeeRate), restrictGlobalConfig: plat.restrictGlobalConfig, restrictCurveParam: plat.restrictCurveParam, curveRuleManager: plat.curveRuleManager },
    reward: { name: platR.name, feeRate: String(platR.feeRate), creatorFeeRate: String(platR.creatorFeeRate), restrictGlobalConfig: platR.restrictGlobalConfig, restrictCurveParam: platR.restrictCurveParam } },
  xstocks: rows.map((r) => {
    const o = r.pr ? check(r) : { symbol: r.p.symbol, pricing: null };
    o.chainMint = mintSummaries.get(r.p.mint);
    const prod = bySol.get(r.p.mint);
    o.official = prod ? { symbol: prod.symbol, name: prod.name } : null;
    o.builtin = XSTOCK_BUILTIN.find((b) => b.mint === r.p.mint)?.symbol ?? null;
    return o;
  }),
  others: others.map((p) => {
    const r = orows.find((x) => x.p === p);
    const o = r?.pr ? check(r) : { symbol: p.symbol, category: p.category, mint: p.mint, launchable: p.launchable, launchLabReady: p.launchLabReady, pricing: "not fetched" };
    o.chainMint = mintSummaries.get(p.mint);
    o.onXstocksList = bySol.has(p.mint);
    return o;
  }),
};
fs.writeFileSync(path.join(R, "check-quotes-report.json"), JSON.stringify(report, (k, v) => (typeof v === "bigint" ? v.toString() : v), 1));
console.log("ok", report.xstocks.length, report.others.length);
