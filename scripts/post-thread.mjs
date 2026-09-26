/* Posts data/intro-thread.json once, as a thread from the sanctuary's X account, and records the ids.
   With "replyToLatestOwn", the first post replies to the account's most recent post (to finish a thread).
   Ids are saved after every post, so a refusal part-way never makes it post the same text twice. */
import fs from "node:fs";
import { credsFromEnv, createPost, whoAmI, getLatestOwnPostId } from "./lib/x-api.mjs";

const file = new URL("../data/intro-thread.json", import.meta.url);
const t = JSON.parse(fs.readFileSync(file, "utf8"));
const creds = credsFromEnv(process.env);
if (t.ids || !creds) { console.log(t.ids ? "Intro thread already posted." : "No X secrets; intro thread not posted."); process.exit(0); }
const save = () => fs.writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
let prev = null;
if (t.replyToLatestOwn) prev = await getLatestOwnPostId((await whoAmI(creds)).data.id, creds);
t.partial = t.partial || [];
for (const text of t.posts.slice(t.partial.length)) {
  if ((text.match(/\$[A-Za-z]{2,}/g) || []).length > 1) throw new Error("X allows one cashtag per post");
  const id = await createPost({ text, replyTo: t.partial.at(-1) ?? prev }, creds);
  t.partial.push(id); save();
}
t.ids = t.partial; delete t.partial; save();
console.log(`Intro thread posted: ${t.ids.join(", ")}`);
