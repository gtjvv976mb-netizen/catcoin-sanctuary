import fs from "node:fs"; import zlib from "node:zlib"; import crypto from "node:crypto";
import { rpc } from "./rpc.mjs";
const r = await rpc("getAccountInfo", ["E6wT2uNeoWUvDrwdch1R8ETsyewR1ZM4WAwsa5hLJK5Z", { encoding: "base64", commitment: "confirmed" }]);
const b = Buffer.from(r.value.data[0], "base64");
const len = b.readUInt32LE(40); const json = zlib.inflateSync(b.subarray(44, 44 + len));
fs.writeFileSync(process.argv[2], json);
console.log("slot", r.context.slot, "bytes", json.length, "sha256", crypto.createHash("sha256").update(json).digest("hex"));
