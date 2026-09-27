/* Each cat's character (assets/world/traits.js, data/traits.json from scripts/build-traits.mjs):
   every resident has one, in range and explained; the hand overrides apply; the cats whose ways
   are well known come out as they are (a loaf cat sleepy, a yarn kitten playful, a scowling
   Persian grumpy); memorial and disabled cats are marked gentle; the words that fooled the first
   rules (yellow, Talkeetna, Hello Kitty, "sleepy eyes", "as a kitten") no longer do; and the
   motion style keeps to its ranges: kittens small and bouncy, seniors slow and low, chunky cats
   waddling, shy cats creeping with the tail down, proud ones strutting with it up. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA_NOW } from "./helpers.mjs";
import { loadResidents } from "../assets/residents.js";
import { NEUTRAL_TRAITS, SIGNATURES } from "../assets/world/catmotion.js";
import { parseTraits, traitsOf, deriveTraits, normalizeTraits, styleOf, STYLE_DEFAULTS, TRAIT_OVERRIDES, TRAIT_KEYS } from "../assets/world/traits.js";
import { buildTraits, formatTraits, table, TABLE_CATS } from "../scripts/build-traits.mjs";

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const FILE = JSON.parse(read("data/traits.json"));
const TABLE = FILE.cats;
const BASE = new URL(`file://${ROOT}/`);
const localFetch = (skip = []) => async (url) => {
  const p = new URL(url).pathname;
  if (skip.some((s) => p.endsWith(s))) return new Response("", { status: 404 });
  try { return new Response(fs.readFileSync(p), { status: 200 }); } catch { return new Response("", { status: 404 }); }
};
const quiet = async (f) => { const w = console.warn; console.warn = () => {}; try { return await f(); } finally { console.warn = w; } };
const residents = (skip) => quiet(() => loadResidents({ fetchImpl: localFetch(skip), base: BASE, nowMs: DATA_NOW }));
const RANGES = { tempo: [0.8, 1.3], stride: [0.85, 1.15], lift: [0.7, 1.3], bob: [0.6, 1.6], sway: [0, 1], crouch: [0, 0.35], tail: [-0.4, 1], head: [-0.3, 0.3], sitTall: [0, 1], loafTuck: [0, 1], scale: [0.7, 1.6] };
const ADOPT = JSON.parse(read("data/adoptables.json")).cats;

test("every resident has a character in data/traits.json, in range, with the words behind each value", async () => {
  const list = await residents();
  assert.equal(list.length, 247);
  assert.equal(Object.keys(TABLE).length, list.length, "one row per resident, no strays");
  for (const r of list) {
    const t = TABLE[r.id];
    assert.ok(t, `${r.id} has traits`);
    assert.deepEqual(r.traits, t, `${r.id}: residents.js attaches its row`);
    for (const k of TRAIT_KEYS) {
      assert.ok(Number.isFinite(t[k]) && t[k] >= 0 && t[k] <= 1, `${r.id}.${k} = ${t[k]}`);
      if (t[k] !== 0.5) assert.ok(typeof t.why[k] === "string" && t.why[k].length > 2, `${r.id}.${k} = ${t[k]} says why`);
    }
    assert.ok(["kitten", "adult", "senior"].includes(t.age), `${r.id}.age`);
    assert.ok(["slim", "normal", "chunky"].includes(t.build), `${r.id}.build`);
    assert.ok(["normal", "short"].includes(t.legs), `${r.id}.legs`);
    assert.ok(["small", "medium", "large", "bigcat"].includes(t.size), `${r.id}.size`);
    for (const k of ["age", "build", "legs", "size"]) if (t[k] !== NEUTRAL_TRAITS[k]) assert.ok(t.why[k], `${r.id}.${k} says why`);
    if (t.size === "bigcat") assert.ok(t.scale >= 1.1 && t.scale <= 1.6, `${r.id} big cat scale ${t.scale}`);
    else assert.equal(t.scale, undefined, `${r.id}: only big cats carry a scale`);
    assert.ok(Array.isArray(t.flags) && t.flags.every((f) => ["blind", "tailless", "memorial", "gentle"].includes(f)), `${r.id}.flags`);
    assert.ok(t.signature === null || Object.hasOwn(SIGNATURES, t.signature), `${r.id}.signature ${t.signature}`);
    if (t.signature) assert.ok(t.why.signature, `${r.id}.signature says why`);
    assert.deepEqual(traitsOf(r), normalizeTraits(t), `${r.id}: traitsOf reads its row`);
  }
  assert.ok(read("data/traits.json").length < 150 * 1024, "data/traits.json stays small");
  assert.ok(!/https?:/.test(read("data/traits.json")), "no links in the file");
});

test("data/traits.json is what scripts/build-traits.mjs builds from today's words (re-run it after adding a cat)", async () => {
  assert.equal(formatTraits(await buildTraits(ROOT)), read("data/traits.json"));
});

test("the hand overrides name real residents and win over the rules", async () => {
  const list = await residents();
  const byKey = new Map(list.flatMap((r) => [[r.id, r], [r.ticker, r]]));
  for (const [key, o] of Object.entries(TRAIT_OVERRIDES)) {
    const r = byKey.get(key);
    assert.ok(r, `override ${key} names a resident`);
    assert.ok(typeof o.note === "string" && o.note.length > 8, `override ${key} says why`);
    const t = TABLE[r.id];
    for (const [k, v] of Object.entries(o)) {
      if (k === "note") continue;
      if (k === "flags") for (const f of v) assert.ok(t.flags.includes(f), `${key} flag ${f}`);
      else assert.deepEqual(t[k], v, `${key}.${k}`);
      if (k !== "flags") assert.equal(t.why[k], "hand", `${key}.${k} is marked as a hand value`);
    }
    assert.equal(t.why.hand, o.note);
  }
  // The cats whose words carry no temperament all have one.
  for (const id of ["SNOWCURL", "TRINKETCAT", "COOPERCAT", "NOTEPAW", "RUBYCAT", "MARUBOX", "GLICAT", "NEKOBUS", "OCTOMONA", "COPYCC", "KURONEKCAT", "NERMALCAT", "SCRATCHC", "KITTENPLZ", "MARUOCAT", "QCGENESIS", "MOONRESCUE", "CATE", "MANEKI"])
    assert.ok(TRAIT_OVERRIDES[id] || TRAIT_OVERRIDES[byKey.get(id)?.id], `${id} has a hand-read character`);
  // An overridden age still brings what age brings: Kuroneko is drawn with a kitten but is the mother.
  assert.equal(TABLE.KURONEKCAT.age, "adult");
  assert.notEqual(TABLE.KURONEKCAT.size, "small");
});

test("cats whose ways are well known come out as themselves", () => {
  const T = TABLE;
  const hi = (id, k, v = 0.7) => assert.ok(T[id][k] >= v, `${id}.${k} = ${T[id][k]} (want >= ${v})`);
  const lo = (id, k, v = 0.3) => assert.ok(T[id][k] <= v, `${id}.${k} = ${T[id][k]} (want <= ${v})`);
  hi("INGOTLOAF", "sleepy"); lo("INGOTLOAF", "energy", 0.4); assert.equal(T.INGOTLOAF.signature, "loaf");
  assert.equal(T.SKEINKIT.age, "kitten"); hi("SKEINKIT", "playful", 0.85); assert.equal(T.SKEINKIT.size, "small");
  hi("MEREDITCAT", "proud", 0.8); lo("MEREDITCAT", "social");
  hi("CROOKSHNK", "grumpy"); hi("CROOKSHNK", "hunter");
  lo("CZELDA", "bold", 0.25); hi("CZELDA", "curious", 0.85);
  assert.equal(T.maneki.signature, "beckon"); hi("maneki", "social");
  assert.equal(T.michi.signature, "hindStand");
  assert.equal(T.MARUBOX.signature, "boxSit");
  assert.equal(T.HUBBUB.signature, "spin"); assert.ok(T.HUBBUB.flags.includes("blind") && T.HUBBUB.legs === "short");
  assert.equal(T.LILBUBCAT.signature, "blep"); assert.equal(T.LILBUBCAT.legs, "short");
  assert.equal(T.GANYHOUSE.age, "senior"); assert.ok(T.GANYHOUSE.flags.includes("blind"));
  assert.equal(T.LARRY10.age, "senior");
  assert.equal(T.EVERLOOP.signature, "ringCurl"); hi("EVERLOOP", "sleepy");
  assert.equal(T.TOMBILICAT.signature, "drapeLean");
  assert.equal(T["gta6cat"].signature, "wash");
  assert.equal(T.popcat.signature, "popMouth"); hi("popcat", "vocal", 0.8);
  hi("TRILLBY", "vocal", 0.85); hi("TRILLBY", "social", 0.85);
  hi("TUBBSCAT", "foodie", 0.9); assert.equal(T.TUBBSCAT.build, "chunky"); lo("TUBBSCAT", "energy", 0.2);
  hi("COLMEOW2", "grumpy", 0.85); hi("JELLIECAT", "grumpy", 0.8);
  lo("COWARDLION", "bold", 0.2); lo("COWARDLION", "grumpy", 0.2);
  assert.equal(T.NERMALCAT.age, "kitten"); hi("NERMALCAT", "proud", 0.8);
  assert.equal(T.PICKLECCAT.signature, "lapClaim"); hi("PICKLECCAT", "social", 0.85);
  assert.equal(T["hosico-cat"].build, "chunky"); lo("hosico-cat", "bold");
  for (const id of ["LEOTHELION", "GRREAT", "TALLYSPOT", "SORRELPAW", "ROSETTE", "VELVETPAW", "SANDSTEP", "STUBTAIL"]) assert.equal(T[id].size, "bigcat", `${id} is a big cat`);
  for (const id of ["TREADPAW", "MITTENSCAT", "NALACATCAT", "CHIK", "SERPOUNCE"]) assert.notEqual(T[id].size, "bigcat", `${id} (panther-like, lynx tips, a leopard word) is a house cat`);
  hi("TALLYSPOT", "energy", 0.75); hi("SORRELPAW", "hunter", 0.85);
  assert.equal(T.MAYORSTUB.flags.includes("tailless"), true);
  assert.equal(T.KYURUGACAT.legs, "normal", "a Munchkin 'with long legs despite being a munchkin'");
  for (const id of ["PAYAKE", "IDPHOTO", "UNIUNI"]) assert.equal(T[id].legs, "short", `${id} has short legs`);
});

test("memorial and disabled cats, and cats with serious real lore, are gentle (no slapstick)", () => {
  const memorial = ADOPT.filter((c) => c.memorial === true || /in loving memory/i.test(c.sensitivity || "")).map((c) => c.ticker);
  assert.ok(memorial.length >= 8);
  for (const id of memorial) assert.ok(TABLE[id].flags.includes("memorial") && TABLE[id].flags.includes("gentle"), `${id} is memorial and gentle`);
  for (const id of ["HUBBUB", "GANYHOUSE", "LILBUBCAT", "OSCARRI", "FAITHCAT", "SEACAT", "SINSMILE"]) assert.ok(TABLE[id].flags.includes("gentle"), `${id} is gentle`);
  for (const [id, t] of Object.entries(TABLE)) if (t.flags.includes("memorial")) assert.ok(memorial.includes(id), `${id} is memorial only if the data says so`);
  assert.ok(normalizeTraits({ flags: ["memorial"] }).flags.includes("gentle"), "memorial always implies gentle");
});

test("the words that fooled the first rules no longer do", () => {
  const p = (x) => parseTraits(x);
  assert.equal(p({ story: "A yellow cat with yellow eyes sits by the gate." }).vocal, 0.5, "yellow is not yell");
  assert.equal(p({ story: "Stubbs was the honorary mayor of Talkeetna, Alaska." }).vocal, 0.5, "Talkeetna is not talk");
  assert.equal(p({ story: "Hello Kitty, the white cartoon cat with a red bow." }).social, 0.5, "Hello Kitty is a name");
  const fcbr = p({ story: "Fat Cat Bat Rat, the tubby hat-wearing character from an ad." });
  assert.ok(fcbr.hunter <= 0.5 && !/rat|bat/.test(fcbr.why.hunter || ""), "Fat Cat Bat Rat is a name, not prey");
  assert.equal(p({ story: "BeeJay was a 26-pound, 2-year-old cat at the refuge." }).age, "adult", "N-year-old is not old");
  assert.equal(p({ look: "A silver tabby with bold black stripes and bold swirls." }).bold, 0.5, "bold stripes are not bravery");
  const pepe = p({ story: "A charcoal kitty with Pepe's sleepy green eyes and a huge red grin." });
  assert.equal(pepe.sleepy, 0.5, "sleepy eyes are an eye shape");
  assert.equal(p({ look: "It sits in a neat cat-loaf pose on the steps." }).proud, 0.5, "a loaf pose is not posing");
  const hosico = p({ story: "His family brought him home as a shy little kitten after losing their old Siamese." });
  assert.equal(hosico.bold, 0.5, "shy as a kitten is past");
  assert.equal(hosico.age, "adult", "as a kitten is past");
  const pop = p({ caption: "Oatmeal mid-'pop', the round 'O' mouth that looped around the world." });
  assert.ok(pop.vocal > 0.5, "a quoted 'O' mouth is read");
  assert.equal(pop.signature, "popMouth");
  assert.equal(p({ story: "It is not a shy cat, and never hides." }).bold, 0.5, "a negated word does not count");
  assert.equal(p({ story: "Miette is a rescue cat, adopted after a shelter vet nursed the kitten back to health." }).age, "adult", "a kitten in its history is not a kitten now");
  assert.equal(p({ look: "A golden-cream cat. Eyes are blue-grey as a kitten and yellow-green as an adult." }).age, "adult");
  assert.equal(p({ look: "A white Scottish Fold kitten, photoreal and fluffy." }).age, "kitten");
  assert.deepEqual(p({ story: "A grumpy tabby glares at pigeons." }), p({ story: "A grumpy tabby glares at pigeons." }), "the same words give the same traits");
});

test("traitsOf: its table row, else what residents.js attached, else read from its card; always whole and safe", async () => {
  const r = { id: "NEWCAT", ticker: "NEWCAT", kind: "adoptable", story: "A shy little tabby who hides under the shed and naps all afternoon.", look: "A small, slim brown tabby.", memorial: true };
  const t = traitsOf(r);
  assert.ok(t.bold < 0.4 && t.sleepy > 0.6, "read from its story");
  assert.equal(t.build, "slim"); assert.equal(t.size, "small");
  assert.deepEqual(t.flags, ["memorial", "gentle"]);
  assert.equal(t.why, undefined, "no why at run time");
  assert.deepEqual(traitsOf({ ...r, traits: { energy: 0.9 } }).energy, 0.9, "r.traits wins over reading");
  assert.equal(traitsOf(r, { NEWCAT: { energy: 0.1 } }).energy, 0.1, "the table wins over r.traits");
  assert.equal(traitsOf({ id: "x", ticker: "NEWCAT" }, { NEWCAT: { energy: 0.2 } }).energy, 0.2, "a ticker finds the row too");
  const junk = normalizeTraits({ energy: 7, sleepy: -3, playful: "a lot", age: "ancient", build: 3, flags: ["blind", "wings"], signature: "moonwalk", size: "bigcat", scale: 9 });
  assert.equal(junk.energy, 1); assert.equal(junk.sleepy, 0); assert.equal(junk.playful, 0.5);
  assert.equal(junk.age, "adult"); assert.equal(junk.build, "normal"); assert.deepEqual(junk.flags, ["blind"]);
  assert.equal(junk.signature, null); assert.equal(junk.scale, 1.6);
  const plain = traitsOf({ id: "EMPTY" });
  for (const k of TRAIT_KEYS) assert.equal(plain[k], 0.5, `a cat with no words is ordinary: ${k}`);
  assert.deepEqual(deriveTraits({ id: "MARUBOX", ticker: "MARUBOX" }).signature, "boxSit", "overrides apply at run time too");
  // Without data/traits.json the page still loads every cat, with no rows attached.
  const bare = await residents(["data/traits.json"]);
  assert.equal(bare.length, 247);
  assert.ok(bare.every((x) => x.traits === undefined));
  assert.equal(traitsOf(bare.find((x) => x.id === "INGOTLOAF")).signature, "loaf", "and each is read from its words instead");
});

test("styleOf: an ordinary cat moves as today; every cat's style keeps to its ranges and to its character", (t) => {
  assert.deepEqual(styleOf(NEUTRAL_TRAITS), { ...STYLE_DEFAULTS });
  assert.deepEqual(styleOf({}), { ...STYLE_DEFAULTS });
  for (const [id, tr] of Object.entries(TABLE)) {
    const s = styleOf(tr);
    assert.deepEqual(Object.keys(s).sort(), Object.keys(RANGES).sort());
    for (const [k, [lo, hi]] of Object.entries(RANGES)) assert.ok(s[k] >= lo && s[k] <= hi, `${id} ${k} ${s[k]} not in ${lo}..${hi}`);
    if (tr.age === "kitten") {
      assert.ok(s.scale <= 0.8 && s.bob >= 1.2 && s.lift >= 1.05 && s.tail >= 0.15 && s.tempo < 1, `${id}: a kitten is small, bouncy, quick, tail up: ${JSON.stringify(s)}`);
      if (tr.build !== "chunky") assert.ok(s.tempo <= 0.92, `${id} kitten tempo ${s.tempo}`);
    }
    if (tr.age === "senior") assert.ok(s.tempo >= 1.1 && s.head < 0 && s.lift < 0.95 && s.stride < 1, `${id}: a senior is slow and low: ${JSON.stringify(s)}`);
    if (tr.build === "chunky") assert.ok(s.sway >= 0.3 && (tr.age === "kitten" || (s.lift < 0.95 && s.tempo >= 1)), `${id}: a chunky cat waddles: ${JSON.stringify(s)}`);
    if (tr.bold <= 0.25) assert.ok(s.crouch >= 0.12 && s.tail <= -0.15, `${id}: a shy cat creeps, tail low: ${JSON.stringify(s)}`);
    if (tr.proud >= 0.8 && tr.bold >= 0.5 && tr.grumpy <= 0.6 && tr.age !== "senior") assert.ok(s.tail >= 0.25 && s.sitTall > 0.55 && s.head > 0, `${id}: a proud cat struts, tail up, sits tall: ${JSON.stringify(s)}`);
    if (tr.size === "bigcat") assert.ok(s.scale >= 1.1 && s.tempo >= 1 && s.bob < 1, `${id}: a big cat is larger, slower, smoother: ${JSON.stringify(s)}`);
    if (tr.flags.includes("tailless")) assert.equal(s.tail, 0, `${id} has no tail to carry`);
    if (tr.sleepy >= 0.75 && tr.energy <= 0.4 && tr.size !== "bigcat") assert.ok(s.loafTuck >= 0.7, `${id}: a sleepy cat tucks its paws in: ${s.loafTuck}`);
  }
  // A kitten, a senior, a heavy cat and a big cat, side by side with an ordinary cat.
  const S = (id) => styleOf(TABLE[id]);
  assert.ok(S("SKEINKIT").tempo < S("JOCKCAT").tempo && S("JOCKCAT").tempo < S("GANYHOUSE").tempo);
  assert.ok(S("TUBBSCAT").sway > S("JOCKCAT").sway && S("TUBBSCAT").lift < S("JOCKCAT").lift);
  assert.ok(S("LEOTHELION").scale > 1.4 && S("SKEINKIT").scale < 0.8);
  assert.ok(S("CZELDA").tail < 0 && S("GRREAT").tail > 0.5);
  // The owner's table: some cats of every kind, their character in words and how they move.
  const lines = table(FILE).split("\n");
  assert.equal(lines.length, TABLE_CATS.length + 1);
  assert.ok(TABLE_CATS.length >= 20);
  for (const line of lines) t.diagnostic(line);
});
