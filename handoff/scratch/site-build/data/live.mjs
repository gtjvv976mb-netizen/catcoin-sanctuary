import { buildCollection } from "/home/user/cat-sanctuary/scripts/build-collection.mjs";
import { createRpc } from "/home/user/cat-sanctuary/scripts/lib/rpc.mjs";
import { tempSite, readData } from "/home/user/cat-sanctuary/tests/helpers.mjs";
const root = tempSite({ wallets: { launchers: [
  { address: "8MwvKAAYCq258pUuT4ndQFjbwTyDZ8qHdGG6RzNdr43b", since: "2026-09-20", label: "GOOGLx launcher (live check)" },
  { address: "3DGnxRA1WzXVQcM26KTzAoT6VSTTMp8te3WxGdYiLsW6", since: "2026-09-24", label: "non-xStock launcher (live check)" },
] } });
const rpc = createRpc({ delayMs: 400 });
const t0 = Date.now();
const r = await buildCollection({ root, rpc, log: console.log });
console.log("calls", rpc.calls, "ms", Date.now() - t0, "read", r.read, "added", r.added.length, "refused", JSON.stringify(r.refused.map(x => [x.tx.slice(0,8), x.clause])), "unread", r.unread.length);
console.log(readData(root, "collection.json").slice(0, 600));
console.log(readData(root, "collection-state.json"));
// second run: idempotent
const r2 = await buildCollection({ root, rpc, log: console.log });
console.log("second run written", JSON.stringify(r2.written), "read", r2.read);
