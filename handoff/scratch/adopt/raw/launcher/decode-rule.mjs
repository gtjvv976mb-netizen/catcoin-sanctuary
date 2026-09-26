import { decodeCurveRule, decodePlatformConfig, decodeGlobalConfig } from "/home/user/Cat-Intelligence-Agency/bots/cashcat/stonkfun.mjs";
import fs from "node:fs";
const a = JSON.parse(fs.readFileSync("/home/user/Cat-Intelligence-Agency/fixtures/bots/stonkfun/accounts.json","utf8")).accounts;
const by = (re) => a.find((x) => re.test(x.label));
const rule = decodeCurveRule(Buffer.from(by(/curve rule/).dataBase64, "base64"));
const j = (o) => JSON.stringify(o, (k, v) => typeof v === "bigint" ? v.toString() : v, 1);
console.log("RULE", j(rule));
console.log("PLATFORM std", j(decodePlatformConfig(Buffer.from(by(/standard platform/).dataBase64, "base64"))));
console.log("GLOBALCONFIG SPYx", j(decodeGlobalConfig(Buffer.from(by(/GlobalConfig/).dataBase64, "base64"))));
