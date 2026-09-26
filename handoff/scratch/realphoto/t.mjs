import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
console.log("start");
const b = await chromium.launch();
console.log("ok", b.version());
await b.close();
