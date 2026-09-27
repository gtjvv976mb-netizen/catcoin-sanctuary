/**
 * The trend watch's X-only reading of a trending cat post (no Anthropic key needed): the cat's name from
 * the way people write about their cat ("my cat Biscuit", "meet Mochi", "Biscuit the cat", "#MochiTheCat",
 * "Mochi is …"), real / cartoon / fiction from the words around it, and sensitive on any word of illness,
 * death, loss, children or politics. It answers in the same shape as Claude's reading, marked
 * readBy: "rules"; with no name found the post is not about one cat. Stricter than Claude on purpose:
 * a missed cat is cheap, a wrong one is not.
 */

// Capitalised words that start a sentence or describe a cat, never a cat's name.
const NOT_NAMES = new Set(`a an the my our your his her their this that these those it its i we you he she they
me him us them what when why how who where which there here then now today tonight yesterday tomorrow
look see watch meet say just so and but or if because every all some any no not one two first last
cat cats kitten kitty kittens kitties pet pets baby babe boy girl buddy bro sir mister miss lady king queen prince princess
big little tiny small fat chonky chonk cute sweet good bad sad happy angry grumpy evil funny silly smart dumb crazy wild
black white orange ginger grey gray brown tabby calico tuxedo siamese persian maine coon sphynx bengal ragdoll british
street house office shop bodega barn farm space jungle sea city night day morning evening
mom mum dad mama papa grandma grandpa owner human hooman
breaking update new old live video photo pic clip thread post reply
monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december`.split(/\s+/));

const NAME = "([A-Z][a-z]{1,15}(?:[A-Z][a-z]{1,15})?)";
const PATTERNS = [
  ["my cat", new RegExp(`\\b(?:[Mm]y|[Oo]ur)\\s+(?:cat|kitten|kitty|boy|girl|baby)\\s*,?\\s+${NAME}\\b`)],
  ["meet", new RegExp(`\\b(?:[Mm]eet|[Tt]his is|[Ii]ntroducing|[Ss]ay (?:hi|hello) to)\\s+${NAME}\\b`)],
  ["the cat", new RegExp(`\\b${NAME},?\\s+(?:the\\s+)?(?:cat|kitten|kitty)\\b`)],
  ["hashtag", /#([A-Z][a-z]{2,15})(?:The)?(?:Cat|Kitten)\b/],
  ["opening", new RegExp(`^${NAME}\\s+(?:is|has|was|just|learned|decided|refuses|always|really|finally|keeps|loves|hates|thinks|wants)\\b`)],
];

const SENSITIVE = /\b(?:rip|r\.i\.p|pass(?:ed|ing) away|died|dies|dying|death|dead|kill\w*|cancer|tumou?r|sick|ill|illness|vet|surgery|hospital\w*|injur\w*|hurt|wound\w*|abus\w*|cruel\w*|torture\w*|abandon\w*|missing|lost|stolen|rescue\w*|euthan\w*|funeral|grie\w*|mourn\w*|memorial|rainbow bridge|goodbye|farewell|child|children|kid|kids|toddler|son|daughter|school|trump|biden|harris|election|vote|war|gaza|ukraine|russia|israel|palestin\w*|police|shoot\w*|fire|flood|earthquake|hurricane)\b/i;
const CARTOON = /\b(?:anime|manga|cartoon|animated|animation|comic|webtoon|sticker|mascot|drawing|drew|fanart|illustration|chibi|pixel art)\b/i;
const FICTION = /\b(?:movie|film|show|series|episode|season|book|novel|game|trailer|character|netflix|disney|pixar|ghibli|studio)\b/i;

/** The cat's name in a post and which pattern found it, or null. */
export function catNameIn(text) {
  const t = String(text || "");
  for (const [how, re] of PATTERNS) {
    const m = t.match(re);
    if (m && !NOT_NAMES.has(m[1].toLowerCase())) return { name: m[1], how };
  }
  return null;
}

/** A ticker from a name: its letters and digits in capitals, at most 10. */
export const tickerFor = (name) => {
  const t = String(name || "").normalize("NFKD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
  return t.length >= 2 ? t : null;
};

/** One line of lore from the post itself: its first sentence, without links, mentions or hashtags. */
export function loreFrom(text, name) {
  let t = String(text || "").replace(/https?:\/\/\S+|www\.\S+/g, " ").replace(/[@#][\w]+/g, " ");
  if (name) t = t.replace(new RegExp(`\\b(?:my|our)\\s+(?:cat|kitten|kitty|boy|girl|baby)\\s*,?\\s+(?=${name}\\b)`, "i"), "");
  t = t.replace(/\s+/g, " ").trim();
  const first = t.split(/(?<=[.!?])\s+|\n/)[0]?.trim() || "";
  if ((first.match(/[\p{L}\p{N}]+/gu) || []).length < 4) return null; // too little to say anything about the cat
  const line = first.length > 200 ? `${first.slice(0, 197).replace(/\s+\S*$/, "")}…` : first;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** The X-only reading of a qualified post ({ text, author }), in the shape of Claude's reading. */
export function readPostByRules(post) {
  const text = String(post?.text || "");
  const found = catNameIn(text);
  const sensitive = SENSITIVE.test(text);
  const kind = !found ? "none" : CARTOON.test(text) ? "cartoon" : FICTION.test(text) ? "fiction" : "real";
  const ticker = found ? tickerFor(found.name) : null;
  return {
    aboutOneCat: !!found,
    catName: found?.name ?? null,
    kind,
    coinName: found?.name ?? null,
    ticker,
    lore: found ? loreFrom(text, found.name) : null,
    sensitive,
    why: !found ? "no cat's name found in the post" : `name from "${found.how}"${sensitive ? "; a sensitive word in the post" : ""}`,
    readBy: "rules",
  };
}
