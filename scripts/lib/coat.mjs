/**
 * A PLANNED CAT'S COAT, FOR THE GARDEN'S 3D MODEL: { base, second, pattern, eyes }, in the words
 * assets/collection.js COAT_COLOURS and COAT_PATTERNS allow (the renderer and the page both read
 * them). It is a drawing hint, not a fact about anything: it comes from the launch sheet's own
 * `coat` when there is one, and otherwise from the words of the sheet's `look` (the text the
 * portrait was drawn from), read the same way every time.
 */
import { COAT_COLOURS, COAT_PATTERNS } from "../../assets/collection.js";

/* Words a look uses for a colour, mapped to the coat's colour words. */
const SYNONYMS = Object.freeze({
  black: "black", white: "white", snow: "white", snowy: "white", cream: "cream", ivory: "cream", ginger: "ginger", orange: "ginger",
  marmalade: "ginger", red: "red", grey: "grey", gray: "grey", dove: "grey", slate: "grey", silver: "silver", pewter: "silver",
  blue: "blue", brown: "brown", chocolate: "chocolate", lilac: "lilac", fawn: "fawn", cinnamon: "cinnamon", golden: "golden",
  honey: "golden", tan: "tan", tawny: "caramel", sandy: "tan", smoke: "smoke", smoky: "smoke", smokey: "smoke", taupe: "smoke",
  seal: "seal", caramel: "caramel", amber: "amber", copper: "copper", gold: "gold", green: "green", yellow: "yellow", hazel: "hazel",
});
const EYE_WORDS = Object.freeze({ ...SYNONYMS, odd: "odd", orange: "orange" });

/* Sentences or clauses that say what the cat does NOT have. */
const NEGATION = /\b(no|not|without|nothing|never)\b[^.;:!?]*/gi;

function colourWords(text, table = SYNONYMS) {
  const out = [];
  for (const m of text.toLowerCase().matchAll(/[a-z]+/g)) {
    const w = table[m[0]];
    if (w && COAT_COLOURS.includes(w)) out.push(w);
  }
  return out;
}

/** The first two sentences that describe the coat (they name the coat, fur, a colour or a pattern). */
function coatText(look) {
  const sentences = look.replace(NEGATION, " ").split(/(?<=[.!?])\s+/);
  const about = sentences.filter((s) => /\b(coat|fur|tabby|calico|tortoiseshell|tortie|tuxedo|colou?rpoint|cat|kitten|body|stripes?|patch(es)?)\b/i.test(s));
  return (about.length ? about : sentences).slice(0, 2).join(" ");
}

/** The pattern a look describes. */
export function patternFrom(text) {
  const s = text.toLowerCase();
  if (/calico/.test(s)) return "calico";
  if (/tortoiseshell|tortie|blue-cream|mottled/.test(s)) return "tortie";
  if (/tuxedo/.test(s)) return "tuxedo";
  if (/colou?rpoint|siamese|himalayan|\bpoints?\b|face mask/.test(s)) return "point";
  if (/rosette|spotted|\bspots\b|leopard/.test(s)) return "spotted";
  if (/tabby|stripe|striped|mackerel|ringed/.test(s)) return "tabby";
  if (/\b[a-z]+-and-white\b|white (chest|bib|belly|chin|muzzle|paws|socks)|bicolou?r/.test(s)) return "bicolour";
  return "solid";
}

/** The eye colour a look names, or "". */
export function eyesFrom(look) {
  const s = look.toLowerCase().replace(NEGATION, " ");
  if (/\bodd eyes\b|one blue, one green|one green, one blue/.test(s)) return "odd";
  const m = s.match(/((?:[a-z]+[- ]){0,3})eyes\b/);
  if (!m) return "";
  const words = colourWords(m[1], EYE_WORDS);
  return words.length ? words.at(-1) : "";
}

/**
 * The coat a look describes. The base is the first colour the coat sentences name (white for a
 * calico, whose patches the renderer lays over white); the second is the other colour a
 * patterned coat shows (the patches, the points, the tuxedo's white), or "" for the renderer's
 * own darker shade of the base.
 */
export function coatFromLook(look) {
  const text = coatText(String(look ?? ""));
  const pattern = patternFrom(text);
  // Colours named for the eyes (and anything in brackets after them) are not coat colours.
  const coatColours = colourWords(text.replace(/\b[a-z-]*\s*eyes\b(\s*\([^)]*\))?/gi, " "));
  const eyes = eyesFrom(String(look ?? ""));
  let base = coatColours[0] ?? "cream";
  let second = coatColours.find((c) => c !== base) ?? "";
  if (pattern === "calico") { second = coatColours.find((c) => c !== "white") ?? "ginger"; base = "white"; }
  if (pattern === "tuxedo") { base = coatColours.find((c) => c !== "white") ?? "black"; second = "white"; }
  if (pattern === "bicolour") second = base !== "white" && coatColours.includes("white") ? "white" : second || (base === "white" ? "black" : "white");
  if (pattern === "solid" || pattern === "tabby" || pattern === "spotted") {
    // A plain or striped coat with a white chest or muzzle keeps that white; otherwise the
    // renderer draws the stripes or spots in a darker shade of the base.
    second = second === "white" || second === "cream" || (pattern === "spotted" && second === "black") ? second : "";
  }
  return { base, second, pattern, eyes };
}

/** A sheet's own coat, read into the coat's words (each field: the last word it knows), or null if it has none. */
export function coatFromSheet(coat) {
  if (!coat || typeof coat !== "object") return null;
  const last = (v, table) => { const w = colourWords(String(v ?? ""), table); return w.length ? w.at(-1) : ""; };
  const base = last(coat.base, SYNONYMS);
  if (!base) return null;
  const p = String(coat.pattern ?? "").toLowerCase();
  const pattern = COAT_PATTERNS.includes(p) ? p : patternFrom(p);
  return { base, second: last(coat.second, SYNONYMS), pattern, eyes: /odd/i.test(String(coat.eyes ?? "")) ? "odd" : last(coat.eyes, EYE_WORDS) };
}
