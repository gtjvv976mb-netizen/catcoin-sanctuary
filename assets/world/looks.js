/* What a cat drawn from the shared models should look like, from its research: the markings
   and accessories its look sheet (data/planned.json `look`) or its Hall of Fame profile describes.
   catviews.js paints the markings in the coat shader and draws the accessories as small low-poly
   meshes on the head and neck; a cat with its own HD model (assets/models/cats/) doesn't use this.

   No three.js here (it runs under plain Node too). Colours are "#rrggbb" or colour words, read
   by catviews.js colorOf.

   lookOf(resident) → {
     base:     the coat colour when the look contradicts the sheet ("solid black"), or null
     pattern:  a pattern word overriding the sheet's (e.g. "classic", "ticked", "van", "patch"), or null
     second:   the markings' colour when the sheet leaves it empty (stripes, spots, points), or null
     eyes:     the eye colour when the sheet leaves it empty, or null
     white:    { chest, paws, muzzle, belly, blaze } white markings (booleans)
     tail:     "white" (white tip) | "dark" (dark tip or tuft) | "bob" (bobbed) | "ringed" | null
     mane:     a mane colour (lions), or null
     stripe:   how strong tabby stripes are, 0..1 (faint 0.45, bold 1)
     scale:    how big the cat is drawn (big cats > 1)
     garment:  { kind: "jacket", color } | null   (a tinted torso)
     wears:    [{ type, color }]   type: beanie, cap, tweed, hood (Robin Hood cap), witch, crown,
               headband, bow, collar, bell, tag, tie, scarf, sunglasses, bag, crescent
   } */

/** The Hall of Fame cats' looks, from their profiles (data/famous.json `who`), read by hand. */
export const HALL_LOOKS = {
  "cate-meme": { pattern: "tabby", stripe: 0.6, white: { muzzle: true, chest: true } },
  "anonymous-cat": { wears: [{ type: "bag", color: "#b8894f" }, { type: "collar", color: "#2a2426" }, { type: "tag", color: "#c9cbd0" }] },
  popcat: { pattern: "tabby", stripe: 0.5, white: { muzzle: true, chest: true, belly: true, paws: true } },
  "cat-in-a-dogs-world": { pattern: "solid", white: {} },
  "catwifhat-2": { white: { muzzle: true, chest: true }, wears: [{ type: "beanie", color: "#f29a8e" }] },
  "pepecat-2": { pattern: "solid" },
  "wen-4": { pattern: "bicolor" },
  tsuki: { pattern: "solid", wears: [{ type: "crescent", color: "#f5c542" }] },
  "hello-kitty-sol": { wears: [{ type: "bow", color: "#e0283a" }] },
  sillynubcat: { pattern: "solid" },
  michi: { pattern: "van", tail: "dark" },
  "vibing-cat-coin": { wears: [{ type: "sunglasses", color: "#f47aa8" }] },
  "catcoin-6": { stripe: 0.5, white: { muzzle: true } },
  "raydium-cat": { wears: [{ type: "scarf", color: "#3b78d8" }, { type: "cap", color: "#1f2a4a" }] },
  "ket-3": { pattern: "patch" },
  maneki: { pattern: "solid", wears: [{ type: "collar", color: "#e0283a" }, { type: "bell", color: "#f5c542" }] },
  gta6cat: { pattern: "mackerel" },
  "stonk-cats": { garment: { kind: "jacket", color: "#1f2a52" }, wears: [{ type: "sunglasses", color: "#e0268a" }] },
  "hosico-cat": { pattern: "ticked" },
  "red-kitten-crew": { pattern: "mackerel", wears: [{ type: "headband", color: "#d8262e" }] },
  "leveraged-cat": { white: { chest: true, muzzle: true, paws: true, belly: true } },
};

/** Big cats: how much bigger they are drawn, and what they have that a house cat doesn't. */
const BIG = [
  [/\b(mountain lion|cougar|puma)\b/, { scale: 1.35, tail: "dark", belly: true }],
  [/\blion\b(?!ess)/, { scale: 1.55, mane: true, tail: "dark", belly: true }],
  [/\blioness\b/, { scale: 1.45, tail: "dark", belly: true }],
  [/\btiger\b/, { scale: 1.5, stripe: 1, belly: true }],
  [/\bcheetah\b/, { scale: 1.35, belly: true }],
  [/\b(panther|jaguar|leopard)\b/, { scale: 1.4 }],
  [/\bbobcat|lynx\b/, { scale: 1.15, tail: "bob" }],
];

const COLOR_WORD = "(?:[a-z]+[- ])?(?:jet-?black|black|white|cream|ginger|orange|red|rust|grey|gray|silver|blue|slate(?:-blue)?|brown|chocolate|seal|lilac|fawn|cinnamon|golden|gold|tan|smoke|caramel|amber|green|yellow|copper|hazel|charcoal|taupe|pink|purple|violet|teal|aqua|navy|magenta|salmon|rust-orange|honey(?:-gold)?|lemon-yellow|lime-green|leaf-green|sky-blue|ice-blue|olive(?:-gold)?|brass-gold|green-gold|dark(?:-grey| brown| rust-brown)?|darker(?:[- ][a-z]+)?|rust-red)";

/** The sentences of a look that describe what the cat wears (not the "wears nothing" ones). */
function wearSentences(text) {
  return text.split(/(?<=[.!?])\s+/).filter((s) => /\bwear/i.test(s) && !/wears? (nothing|no\b)|no collar or clothing/i.test(s));
}

/** Reads a look sheet's words. */
export function parseLook(text) {
  const t = String(text || "").toLowerCase();
  const out = { pattern: null, base: null, second: null, eyes: null, white: {}, tail: null, mane: null, stripe: 0.9, scale: 1, garment: null, wears: [] };
  if (!t) return out;
  // Tabby kinds.
  if (/mackerel|vertical bars|grill bars|pinstripe/.test(t)) out.pattern = "mackerel";
  else if (/classic tabby|marbled?|swirl|bullseye/.test(t)) out.pattern = "classic";
  else if (/ticked/.test(t)) out.pattern = "ticked";
  else if (/speckle|fleck|dappled/.test(t)) out.pattern = "spotted";
  if (/faint|low-contrast|softly/.test(t) && /stripe|tabby/.test(t)) out.stripe = 0.45;
  if (/bold|thick black stripes/.test(t)) out.stripe = 1;
  // Van-style: white with a coloured cap and tail.
  if (/\bcap of fur|grey ears and cap/.test(t)) out.pattern = "van";
  // A solid black or white cat whose sheet colour says otherwise: the look wins.
  const solid = t.match(/\bsolid (?:jet-)?(black|white)\b/);
  if (solid) out.base = solid[1];
  // The markings' colour.
  const m = t.match(new RegExp(`(${COLOR_WORD}) (?:mackerel )?(?:stripes|spots|patches|bars|points?|pinstripes|speckles|rings)`));
  if (m) out.second = m[1].replace(/^(darker|dark)[- ]?/, "") || null;
  if (/thick black stripes|black mackerel stripes|black stripes/.test(t)) out.second = "black";
  if (/black-ringed tail/.test(t)) out.tail = "ringed";
  // Eyes.
  const e = t.match(new RegExp(`(${COLOR_WORD}|green-gold|olive to green-gold|pale gold|light gold|warm gold|copper|gold|golden)(?: to [a-z-]+)? eyes`));
  if (e) out.eyes = e[1].split(/[\s-]/).pop();
  if (/one glowing green eye/.test(t)) out.eyes = "green";
  // White markings: what follows each "white" (up to the end of its clause).
  for (const m of t.matchAll(/(?<![a-z-])(?:white|cream|pale) (?=([a-z ,-]{0,48}))/g)) {
    if (/\bno\s*$/.test(t.slice(Math.max(0, m.index - 4), m.index))) continue;
    const after = m[1].split(/[.;:]| with | wears? /)[0];
    if (/^(?:shorthair|coat|kitten|cat|house|body|fur)\b/.test(after)) continue;
    if (/\b(chest|bib|ruff)\b/.test(after)) out.white.chest = true;
    if (/\b(paws?|socks|toes|legs|mittens)\b/.test(after)) out.white.paws = true;
    if (/\b(muzzle|chin|cheeks?)\b/.test(after)) out.white.muzzle = true;
    if (/\b(belly|underside)\b/.test(after)) out.white.belly = true;
    if (/\b(blaze|stripe (?:running )?up the nose|nose stripe)\b/.test(after)) out.white.blaze = true;
  }
  if (/one front paw is all white|four white/.test(t)) out.white.paws = true;
  if (/stripe (?:running )?up the nose|muzzle blaze/.test(t)) out.white.blaze = true;
  if (/white tip|white-tipped/.test(t)) out.tail = "white";
  if (/dark tail tip|black tail tip|dark-tipped tail/.test(t)) out.tail = "dark";
  // Big cats.
  for (const [re, b] of BIG) if (re.test(t)) {
    out.scale = b.scale;
    if (b.mane) {
      const mm = t.match(new RegExp(`(${COLOR_WORD}) mane`));
      out.mane = mm ? mm[1] : "#6b4226";
    }
    if (b.tail && !out.tail) out.tail = b.tail;
    if (b.stripe) out.stripe = b.stripe;
    if (b.belly) out.white.belly = true;
    break;
  }
  if (/no mane/.test(t)) out.mane = null;
  // What it wears.
  for (const s of wearSentences(t)) {
    const colorIn = (re) => { const c = s.match(new RegExp(`(${COLOR_WORD})(?: [a-z]+)? ${re}`)); return c ? c[1] : null; };
    if (/witch/.test(s)) out.wears.push({ type: "witch", color: colorIn("(?:witch|pointed)") || "purple" });
    if (/beanie|knit hat|woolly hat/.test(s)) out.wears.push({ type: "beanie", color: colorIn("(?:knit )?(?:beanie|hat)") || "red" });
    if (/tweed/.test(s)) out.wears.push({ type: "tweed", color: colorIn("tweed") || "brown" });
    else if (/robin hood|feathered cap/.test(s)) out.wears.push({ type: "hood", color: colorIn("cap") || "green" });
    else if (/\bcap\b/.test(s)) out.wears.push({ type: "cap", color: colorIn("cap") || "navy" });
    if (/crown|tiara/.test(s)) out.wears.push({ type: "crown", color: "gold" });
    if (/headband/.test(s)) out.wears.push({ type: "headband", color: colorIn("(?:cloth )?headband") || "red" });
    if (/\bbow\b/.test(s)) out.wears.push({ type: "bow", color: colorIn("bow") || "red" });
    if (/collar(?!ed)/.test(s)) out.wears.push({ type: "collar", color: colorIn("(?:patterned )?collar") || "red" });
    if (/\bbell\b/.test(s)) out.wears.push({ type: "bell", color: "gold" });
    if (/\btag\b|small ring/.test(s)) out.wears.push({ type: "tag", color: "silver" });
    if (/necktie|\btie\b/.test(s)) out.wears.push({ type: "tie", color: colorIn("(?:plaid )?necktie") || "yellow" });
    if (/scarf|bandana/.test(s)) out.wears.push({ type: "scarf", color: colorIn("(?:scarf|bandana)") || "blue" });
    if (/sunglasses|shades|goggles/.test(s)) out.wears.push({ type: "sunglasses", color: colorIn("(?:shield )?sunglasses") || "black" });
    if (/hoodie|jacket|sweater|jumper|shirt/.test(s)) out.garment = { kind: "jacket", color: colorIn("(?:collared |zip |track |knit )?(?:hoodie|jacket|sweater|jumper|shirt)") || "blue" };
  }
  return out;
}

/** A cat's look: its sheet read (a stock cat) or its Hall of Fame profile, merged over the defaults. */
export function lookOf(r) {
  const base = parseLook(r?.kind === "famous" ? "" : r?.look);
  const hall = r?.kind === "famous" ? HALL_LOOKS[r.id] : null;
  if (!hall) return base;
  return { ...base, ...hall, white: { ...base.white, ...(hall.white || {}) }, wears: hall.wears || base.wears };
}
