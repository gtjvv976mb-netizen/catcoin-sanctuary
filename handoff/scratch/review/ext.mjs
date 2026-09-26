import { createRpc } from "/home/user/Cat-Intelligence-Agency/src/lib/rpc.mjs";
import { parseMintExtensions, assertTradeableExtensions } from "/home/user/Cat-Intelligence-Agency/vendor/executor/token2022.mjs";
const rpc = createRpc({ url: "https://api.mainnet-beta.solana.com" });
const mints = process.argv.slice(2);
const r = await rpc.getMultipleAccounts(mints);
r.accounts.forEach((a, i) => {
  if (!a) return console.log(mints[i], "missing");
  let ext; try { ext = parseMintExtensions(Buffer.from(a.data[0], "base64")); } catch (e) { ext = e.message; }
  let ok; try { assertTradeableExtensions(ext, mints[i]); ok = "tradeable"; } catch (e) { ok = e.message; }
  console.log(mints[i], a.owner.slice(0, 6), JSON.stringify(Array.isArray(ext) ? ext.map((x) => x.name ?? x.type ?? x) : Object.keys(ext ?? {})), ok);
});
