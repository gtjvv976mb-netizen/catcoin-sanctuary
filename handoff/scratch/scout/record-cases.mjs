/* The named cases beside the scan: CATWIF and CATCOIN quoted the agent's way; the four coins that
   had no route at maxAccounts 24, asked once more with no maxAccounts (to say why); the unverified
   Token-2022 cluster from Jupiter's search; and the named mints read on chain. Nothing signed. */
import fs from "node:fs";
import path from "node:path";
const REPO = "/home/user/Cat-Intelligence-Agency";
const OUT = path.dirname(new URL(import.meta.url).pathname);
const { createJupiterClient } = await import(`${REPO}/src/lib/jupiter-swap.mjs`);
const { createRpc } = await import(`${REPO}/src/lib/rpc.mjs`);
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const jupFetch = async (url, init = {}) => {
  const at = new Date().toISOString();
  const res = await fetch(url, init);
  const text = await res.text();
  log.push({ at, method: init.method ?? "GET", url, status: res.status, body: (() => { try { return JSON.parse(text); } catch { return text; } })() });
  return { ok: res.ok, status: res.status, headers: res.headers, text: async () => text };
};
const jupiter = createJupiterClient({ fetchImpl: jupFetch });
const agentWay = async (inputMint, outputMint, amountRaw) => { try { return await jupiter.quote({ inputMint, outputMint, amountRaw, slippageBps: 100, solHop: true, priority: "entry" }); } catch (e) { return { error: e.code, message: e.message }; } };
const out = { quotes: [], unbounded: [] };
const CASES = { CATWIF: "5pYB12kEhfhSFXJjZ7JtyqDpt6uUqhsF6iu6Ee9spump", CATCOIN: "9i3NFMa9pqR3suCUhyX3nQE1dy6i5wXafDtppUxYpump" };
for (const [symbol, mint] of Object.entries(CASES)) {
  const buy = await agentWay(USDC, mint, 25_000_000n);
  const sell = buy.outAmount ? await agentWay(mint, USDC, BigInt(buy.outAmount)) : null;
  out.quotes.push({ symbol, mint, buy, sell });
  console.log(symbol, buy.priceImpactPct ?? buy.error, buy.routePlan?.map((h) => `${h.swapInfo.label}:${h.swapInfo.inputMint.slice(0, 4)}>${h.swapInfo.outputMint.slice(0, 4)}`).join(" "), sell?.outAmount);
}
/* The four with no route within 24 accounts: the same hop ask with maxAccounts left out. */
const NOROUTE = { RKC: "7HgfXftRBBqsYtAEYcqjGLQrNJLL6Tww9ek4rE3Apump", SOLCAT: null, drooling: null, NYAN: null };
const scan = JSON.parse(fs.readFileSync(path.join(OUT, "scan-unpinned.json"), "utf8"));
for (const x of scan.report.refused.filter((x) => x.clause === "scout_no_route")) NOROUTE[x.symbol] = x.mint;
for (const [symbol, mint] of Object.entries(NOROUTE)) {
  await sleep(2_200);
  const url = `https://api.jup.ag/swap/v1/quote?${new URLSearchParams({ inputMint: USDC, outputMint: mint, amount: "25000000", slippageBps: "100", swapMode: "ExactIn", onlyDirectRoutes: "false", restrictIntermediateTokens: "true", instructionVersion: "V2" })}`;
  await jupFetch(url);
  const last = log.at(-1);
  out.unbounded.push({ symbol, mint, url, status: last.status, body: last.body });
  console.log(symbol, last.status, last.body?.priceImpactPct, last.body?.routePlan?.map((h) => `${h.swapInfo.label}:${h.swapInfo.inputMint.slice(0, 4)}>${h.swapInfo.outputMint.slice(0, 4)}`).join(" ") ?? last.body?.errorCode);
}
/* The unverified Token-2022 cluster (Neko, OGCAT, $SMEOW), from Jupiter's search, as the plan names it. */
await sleep(1_200);
const clusterUrl = "https://lite-api.jup.ag/tokens/v2/search?query=AgavbLZybMxhDsjR2i3d48vCnzThpGZfZ9osFdkQ8eGz,GCXVUyF78tCko4JS3d4wXpjHoNNMW22mTcEXnL4hpump,FE9LVt68GdduUHiXXrPqHZ91ehKMpZGTa3Kb3bdNpump";
const cres = await fetch(clusterUrl);
out.cluster = { url: clusterUrl, at: new Date().toISOString(), status: cres.status, body: await cres.json() };
console.log("cluster", out.cluster.status, out.cluster.body.map((t) => `${t.symbol} v=${t.isVerified} liq=${Math.round(t.liquidity)} mcap=${Math.round(t.mcap)} holders=${t.holderCount} ${t.tokenProgram.slice(0, 6)}`).join(" | "));
/* The named mints, on chain. */
const MINTS = { POPCAT: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", VIBE: "DFVeSFxNohR5CVuReaXSz6rGuJ62LsKhxFpWsDbbjups", CATWIF: CASES.CATWIF,
  ZCAT: "HcRLc9VDgjLeK154xDawfb1dmVJ98DoSqcwTHGqiDeJR", INBRED: "EjzzyCSiLqjFDprpZj8e1zjXmcTG5HPGFRSEoWcJWHh9", CASHCAT: "CashcatZMRn4Jv8sPQZUSsbTLi2PcPe1ssqbHcnaJqSS" };
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com", fetchImpl: (u, i) => fetch(u, i), timeoutMs: 30_000 });
const readAt = new Date().toISOString();
const read = await rpc.getMultipleAccounts(Object.values(MINTS), { commitment: "confirmed" });
out.mints = { readAt, rpc: "https://api.mainnet-beta.solana.com", method: "getMultipleAccounts (base64, confirmed)", slot: read.slot,
  accounts: Object.fromEntries(Object.entries(MINTS).map(([symbol, mint], i) => [mint, { symbol, ...(read.accounts[i] ? { owner: read.accounts[i].owner, lamports: read.accounts[i].lamports, data: read.accounts[i].data } : { missing: true }) }])) };
console.log("mints slot", read.slot, Object.values(out.mints.accounts).map((a) => `${a.symbol}:${a.owner?.slice(0, 6)}`).join(" "));
out.log = log;
fs.writeFileSync(path.join(OUT, "cases.json"), JSON.stringify(out, null, 1));
