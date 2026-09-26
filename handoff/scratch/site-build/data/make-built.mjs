import fs from "node:fs";
import { buildCollection } from "/home/user/cat-sanctuary/scripts/build-collection.mjs";
import { createRpc } from "/home/user/cat-sanctuary/scripts/lib/rpc.mjs";
import { fakeRpc, tempSite, history, readData, GME_LAUNCHER, GOOGL_LAUNCHER } from "/home/user/cat-sanctuary/tests/helpers.mjs";
const root = tempSite({ wallets: { launchers: [{ address: GOOGL_LAUNCHER, since: "2026-09-01", label: "GOOGLx launcher" }, { address: GME_LAUNCHER, since: "2026-09-01", label: "GMEx launcher" }] } });
const fake = fakeRpc({ histories: { [GOOGL_LAUNCHER]: history(GOOGL_LAUNCHER), [GME_LAUNCHER]: history(GME_LAUNCHER) } });
await buildCollection({ root, rpc: createRpc({ url: "https://x.test", fetchImpl: fake.fetchImpl, delayMs: 0 }) });
fs.writeFileSync("built-collection.json", readData(root, "collection.json"));
