/* Posts data/intro-thread.json once, as a thread from the sanctuary's X account, and records the ids.
   Needs the same four X secrets as the announcer; without them, or once posted, it does nothing. */
import fs from "node:fs";
import { credsFromEnv, createPost } from "./lib/x-api.mjs";

const file = new URL("../data/intro-thread.json", import.meta.url);
const t = JSON.parse(fs.readFileSync(file, "utf8"));
const creds = credsFromEnv(process.env);
if (t.ids || !creds) { console.log(t.ids ? "Intro thread already posted." : "No X secrets; intro thread not posted."); process.exit(0); }
const ids = [];
for (const text of t.posts) {
  if ([...text].length > 280) throw new Error(`intro post too long: ${text.slice(0, 40)}`);
  ids.push(await createPost({ text, replyTo: ids.at(-1) ?? null }, creds));
}
t.ids = ids;
fs.writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
console.log(`Intro thread posted: ${ids.join(", ")}`);
