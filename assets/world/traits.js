/* WHO EACH CAT IS: its character, read from the words the repo already has about it (its story,
   lore, lore caption and look sheet), so the sim and the clips can make a lazy loaf cat lazy and a
   yarn kitten bounce. No three.js here (it runs under plain Node too).

   The page reads data/traits.json (built by scripts/build-traits.mjs from these same rules, plus
   the research look sheets, and checked in so the owner can review every value with the quote
   behind it); a cat missing from it is read from its card at run time with parseTraits.

   traits (every number 0..1, 0.5 = an ordinary adult cat; see NEUTRAL_TRAITS in catmotion.js):
     energy, sleepy, playful, bold (shy 0 .. bold 1), social (aloof 0 .. affectionate 1), grumpy,
     proud, grace (clumsy 0 .. graceful 1), curious, hunter, vocal, foodie,
     age: "kitten" | "adult" | "senior", build: "slim" | "normal" | "chunky", legs: "normal" | "short",
     size: "small" | "medium" | "large" | "bigcat", species (a big cat's, or a wild hybrid's: a key
     of SPECIES) and scale (how much bigger it is drawn: its species' size, speciesScale),
     flags: ["blind", "tailless", "memorial", "gentle"] (gentle: memorial or disabled cats, or
     serious real lore: no slapstick, no clumsy moves), signature: a key of SIGNATURES
     (catmotion.js) or null.

   styleOf(traits) turns them into how the cat moves and holds itself (see STYLE_DEFAULTS). */

import { ACTIONS, NEUTRAL_TRAITS, SIGNATURES } from "./catmotion.js";

export const TRAIT_KEYS = ["energy", "sleepy", "playful", "bold", "social", "grumpy", "proud", "grace", "curious", "hunter", "vocal", "foodie"];
const ENUMS = { age: ["kitten", "adult", "senior"], build: ["slim", "normal", "chunky"], legs: ["normal", "short"], size: ["small", "medium", "large", "bigcat"] };
const FLAGS = ["blind", "tailless", "memorial", "gentle"];

/** The most and the least a cat is ever drawn and simulated at, × an ordinary adult's size: the one
    limit traits, styles, the sims (cats.js sizeOf, meadow.js) and the herd (catviews.js) all share. */
export const MAX_SCALE = 3, MIN_SCALE = 0.5;

/* BIG CATS, DRAWN BY SPECIES. The owner (2026-09): "if its a lion, normally lions are bigger than cats
   so make them bigger and same logic with other feline beasts", "make the tigers, lions proportionately
   bigger, not the same size as the normal cats", "AS REALISTICALLY AS POSSIBLE".
   Each species' adult shoulder height (m), against a house cat's 0.25 m, gives how many times bigger
   it really is (a lion 4.8×). The garden draws SIZE_POWER of that ratio (its 0.6th power: a lion
   2.56×, a tiger 2.3×, a cheetah 2.0×, a bobcat 1.42×): the real ratio would put a lion's head over
   the cottage's ridge and its body across three garden paths, and three judges picked this set (C)
   from renders of the true ratio (A), its 0.75th power (B) and this. It keeps the species' order and
   their ratios to one another in proportion. A cartoon or fantasy big cat (a cereal-box tiger, an
   armoured lion, an ice tiger) is drawn at its species' size. `domestic`: a wild-cat hybrid bred as a
   house cat (an F1 Savannah), bigger than a house cat but not a big cat (no big-cat ways). */
export const HOUSE_CAT_SHOULDER = 0.25;
export const SIZE_POWER = 0.6;
export const SPECIES = {
  liger: { shoulder: 1.25 }, lion: { shoulder: 1.2 }, lioness: { shoulder: 1.0 }, tiger: { shoulder: 1.0 },
  cheetah: { shoulder: 0.8 }, jaguar: { shoulder: 0.7 }, cougar: { shoulder: 0.7 }, leopard: { shoulder: 0.65 },
  "eurasian lynx": { shoulder: 0.65 }, "snow leopard": { shoulder: 0.6 }, serval: { shoulder: 0.55 }, "canada lynx": { shoulder: 0.55 },
  "clouded leopard": { shoulder: 0.5 }, bobcat: { shoulder: 0.45 }, caracal: { shoulder: 0.45 }, ocelot: { shoulder: 0.45 },
  savannah: { shoulder: 0.39, domestic: true },
};
/** How many times a house cat's size a species really is (shoulder height over 0.25 m). */
export const speciesRatio = (sp) => (SPECIES[sp] ? SPECIES[sp].shoulder / HOUSE_CAT_SHOULDER : 1);
/** How much bigger than an ordinary adult a cat of this species is drawn (and simulated): its real
    ratio to the SIZE_POWER, to two places. 1 for a species not in the table. */
export const speciesScale = (sp) => (SPECIES[sp] ? Math.round(Math.min(MAX_SCALE, speciesRatio(sp) ** SIZE_POWER) * 100) / 100 : 1);
/** Which species a look's big-cat word names (the words just round it, so "mountain lion" is a cougar
    and "snow leopard" not a leopard): the first rule that matches, or null. A black panther is a
    melanistic leopard unless the look says jaguar; "Lynx rufus" beside "bobcat" is a bobcat. */
const SPECIES_RULES = [
  [/\b(liger|tigon)\b/, "liger"], [/\b(mountain lion|cougar|puma)\b/, "cougar"], [/\bsnow leopard\b/, "snow leopard"],
  [/\bclouded leopard\b/, "clouded leopard"], [/\blioness\b/, "lioness"], [/\blion\b/, "lion"], [/\btiger\b/, "tiger"],
  [/\bcheetah\b/, "cheetah"], [/\bjaguar\b/, "jaguar"], [/\b(leopard|panther)\b/, "leopard"], [/\bbobcat\b/, "bobcat"],
  [/\bcanada lynx\b/, "canada lynx"], [/\blynx\b/, "eurasian lynx"], [/\bserval\b/, "serval"], [/\bcaracal\b/, "caracal"], [/\bocelot\b/, "ocelot"],
];
export function speciesIn(text, at = 0) {
  const near = String(text || "").toLowerCase().slice(Math.max(0, at - 12), at + 24);
  for (const [re, sp] of SPECIES_RULES) if (re.test(near)) return sp;
  return null;
}

/** Words that name something else and would read as character: other cats and people, titles,
    merchandise. Taken out of the text before the rules run. */
const NOISE = /fat cat bat rat|hello kitty|laser cat|(?:minnie|mickey) mouse|(?:ai )?cat chaser(?: cat)?|cat toy|capsule toys|pet mode|roaring kitty|in loving memory|sweet home|stephen king|queen song|first cat to \$1b|as (?:a |an |\d{4} )?(?:shy |little |tiny )*kittens?|timid, fight-shy chaa|alfred[^.]*gentle|the angelic dog hopes for snacks|big cat rescue|smells of milk|milk[- ]c(?:arton|hug)|swift bought back|the independent|\(independent\)|monster hunter|solo leveling hunter|guardian mech|meow(?:, co-founder| \(@weremeow\)| signs off)|plush toys|\(spin\)|zoom court hearing|happy meal|deadpan posts|colonel meow|the guardian(?! cat)/g;

/** [trait, change, where, rule]; where: c = what it does (story, lore, caption), l = its look, a =
    either. Each rule counts once. A match right after "no", "not", "never" or "without" does not. */
const RULES = [
  ["energy", .25, "c", /\b(energetic|hyper|lively(?! chat)|restless|zoom\w*|sprints?|sprinting|dash(?:es|ing)|bounc\w+|athletic|acrobat\w*|skateboard\w*|tricks|runs and jumps|unbelievable speed|punched the air|leaps? after)\b/],
  ["energy", .12, "c", /\b(trots?|trotting|patrols?|patrolling|walks the (?:wall|garden|town)|chases?|chasing|leaps?|leaping|pads (?:through|round|between)|prowl\w*|adventures?|exploring|explores|treks?)\b/],
  ["energy", -.25, "c", /\b(lazy|laid-back|lounges?|lounging|sits (?:so )?still|all afternoon|waddles?|plops? down|deadpan|over-it|never (?:once )?moved|sleeps through the day)\b/],
  ["energy", -.12, "c", /\b(naps?|napping|dozes?|dozing|sleeps?|sleeping|asleep|loaf(?:s|ing)?|bask(?:s|ing)?|sunbath\w*|calm|unbothered|relax\w*|serene)\b/],
  // Breed priors (Salonen et al. 2019, Sci Rep): British Shorthair, Ragdoll, Birman least active and,
  // with Persians and Exotics, least fearful; Bengal, Cornish Rex, Korat most active; Russian
  // Blues shyest. Siamese are famously talkative.
  ["energy", -.1, "l", /\b(british shorthair|ragdoll|birman|persian|exotic shorthair)\b/],
  ["energy", .1, "l", /\b(bengal(?!(?:-type)? tiger)|cornish rex|korat)\b/],
  ["bold", .08, "l", /\b(british shorthair|ragdoll|birman|persian|exotic shorthair)\b/],
  ["bold", -.15, "l", /\brussian blue\b/],
  ["vocal", .15, "l", /\bsiamese\b/],
  ["sleepy", .25, "c", /\b(naps?|napping|dozes?|dozing|sleeps?|sleeping|asleep|curl(?:s|ed)? (?:up|into)|loaf(?:s|ing|ed)?|snuggl\w*|all afternoon|sleepy(?![^.;]{0,20}\b(?:eyes?|eyed|stare|gaze|look|wink|expression)\b))\b/],
  ["sleepy", .15, "c", /\b(bask\w*|sunbath\w*|blankets?|cushion|hammock|basket|lounges?|lounging|warm (?:stones|steps|bricks|air grate|grate|dish)|patch of sun)\b/],
  ["sleepy", -.15, "c", /\b(restless|energetic|hyper|zoom\w*|sprints?|never sleeps)\b/],
  ["playful", .3, "c", /\b(playful|plays?|playing|playtime|pounc\w*|zoom\w*|yarn|laser[- ]pointer|red dot|string|toys?|tricks|skateboard\w*|capricious|mischie\w*|cheeky|silly|goofy|up to something|bats (?:the|at)|drinking straw|demand play|at a feather|feather (?:toy|on a string))\b/],
  ["playful", .15, "c", /\b(chases?|chasing|rolls? in|rolling in|tangled|acorns?|falling leaves|dragonfl\w+|moths|rainbow dots|seed fluff|wriggle|flops over)\b/],
  ["playful", -.2, "c", /\b(unimpressed|over-it|deadpan|sits (?:so )?still|dignified|finicky|sad and depressed|won't warm)\b/],
  ["bold", .25, "c", /\b(brave|fearless|no fear|fierce\w*|confident|swashbuckl\w*|guards?|guarding|guardian|bodyguard|stares? down|roar\w*|survived?|survivor|medal|highest perch|chief|mayor|stationmaster|pest controller|on duty|moved for anyone|jumped on stage|crawled through a window|kept killing|scratched out)\b/],
  ["bold", .12, "c", /\b(smug|too cool|coolest|cocky|sassy)\b/],
  ["bold", -.3, "c", /\b(shy|timid|nervous|scared|frightened|cowardly|fearful|hid|hides|hiding|spook\w*|startled|under the sofa|wouldn't even look up)\b/],
  ["bold", -.12, "c", /\b(peeks?|peeking|peers? over|sad teal|very sad)\b/],
  ["bold", -.15, "l", /\b(startled|worried|timid|wary|nervous|fearful)\b/],
  ["social", .3, "c", /\b(friendly|affection\w*|cuddl\w*|snuggl\w*|clingy|clung|greets?|greeting|say hi|hello|loyal|companions?|claiming a lap|laps?|curled up with|gentle company|chirps back|joins? every|joining every|follows every|sweetest|sweet(?! (?:morning|love|air))|loving|loved his friends|being petted|sits with me|crazy about|good girl|meet-up|ambassacat|raising morale|best friend|sidekick|rescue duo)\b/],
  ["social", .15, "c", /\b(shoulders?|family|friends?|side by side|duo|brother and sister|visitors?|waits by the garden gate|meets the|receiving guests|his people|kind)\b/],
  ["social", -.3, "c", /\b(aloof|independent|haughty|solitary|unimpressed|over-it|jealous|won't warm to strangers|scoffs|moved for anyone|wasn't reciprocated)\b/],
  ["social", -.15, "l", /\b(aloof|haughty)\b/],
  ["grumpy", .35, "c", /\b(grump\w*|scowl\w*|frown\w*|glar(?:e|es|ing)|pout\w*|angry|hiss\w*|annoyed|irritable|moody|violent|sinister|scheming|devious|plotting|sarcastic|finicky|over-it|bared fangs|swat|scratches his owner|scratched out|scoffs|won't like it|fearsome)\b/],
  ["grumpy", .15, "c", /\b(unimpressed|deadpan|smug|judg\w*|seen it all|stares? down|jealous)\b/],
  ["grumpy", .2, "l", /\b(grump\w*|scowl\w*|frown\w*|glar(?:e|ing)|unimpressed|stern(?! brows)|sinister|sardonic|deadpan|world-weary)\b/],
  ["grumpy", -.15, "c", /\b(sweetest|sweet(?! (?:morning|love|air))|kind|gentle|blissful|happy|cheerful|optimistic|wholesome|loving|calm|unbothered|laid-back|cool blue|groov\w*|friendly|polite\w*)\b/],
  ["grumpy", -.12, "l", /\b(happy|content(?:ed)?|sweet smile|smiling|blissful|cheerful)\b/],
  ["proud", .3, "a", /\b(proud\w*|pride|regal|(?<!ark )royal(?![- ]blue)|queen|king|princess|empress|duchess|lady at all times|lord cat|sass\w*|diva|pampered|fashion|dignif\w*|posing|poses? (?:by|for|at)|posed|(?:striking|strikes|holding) (?:a|the) (?:[\w,'-]+ ){0,2}poses?|red carpet|center of the world|heirs?|maids|sits? (?:up )?(?:tall|straight)|stands up tall|upright pose|first cat|smug|too cool|coolest|cocky|haughty|spoilt|me me me|runs the store|best seat|ladylike)\b/],
  ["proud", .15, "a", /\b(just-washed|velvet cushion|silk cushion|stationmaster|mayor|chief|confident|smirk|cool blue cat)\b/],
  ["proud", -.15, "a", /\b(scruffy|unkempt|messy)\b/],
  ["grace", .3, "c", /\b(graceful|lithe|agile|nimble|silent\w*|without bending a leaf|never bends a leaf|never gets tangled|so carefully|without tipping|none ever tips|slips (?:between|through)|threads through|hang in the air|acrobat\w*|creeps? low|walks the wall|top of the garden wall|climbs (?:the|up|trees?)|climbing (?:in|up|trees?)|dancer)\b/],
  ["grace", .1, "l", /\b(sleek|lithe|athletic|agile|graceful|dancer-like)\b/],
  ["grace", -.3, "c", /\b(clumsy|cannot open the door|derp\w*|stomps?|waddl\w+|knocking things over|butter on his head|tangled)\b/],
  ["curious", .3, "c", /\b(curious|explor\w*|sniff\w*|investigat\w*|tilts? (?:its|his|her) head|head tilted|peeks?|peeking|peers?|checks every|counts|count them|losing count|wonder|every flower bed|watching every|to hear every|intuitive|reading up|looking up at|gazing up|caught staring|guessing|never forgets a face|copies the|is mysterious|photographer|read replies)\b/],
  ["curious", .1, "c", /\b(watch(?:es|ing)?|gazes?|gazing|looks? (?:about|around|up))\b/],
  ["curious", .1, "l", /\b(curious|wonder)\b/],
  ["hunter", .35, "c", /\b(hunt(?:s|ing|er)?|mouser|pest controller|killing rats|rats|mice|stalk\w*|prowl\w*|creeps? (?:up|low)|tweety|smurfs|scabbers|house flies)\b/],
  ["hunter", .2, "c", /\b(mouse|pigeons|sparrows|birds|flycatchers|goldfish(?! bowl)|moths(?! land)|dragonfl\w+|catfish|reaching for|pounc\w*)\b/],
  ["hunter", .15, "c", /\b(patrols?|patrolling|checks every gate)\b/],
  ["foodie", .35, "c", /\b(food bowl|empties|cookies?|donuts?|doughnuts?|treats?|snack\w*|crumbs?|tea table|breakfast|milk|baguette|groceries|fishing|sanma fish|loves to eat|always hungry|hungry|loves chicken|begs|raids the food|pizza|ramen|eats well|cheetle|cheetos|frosted flakes|meat)\b/],
  ["foodie", -.25, "c", /\b(finicky|fussy|picky|only eat when)\b/],
  ["vocal", .4, "c", /\b(chirp\w*|meow(?:s|ed|ing)?|mid-meow|talks|talking|talkative|roar\w*|sings?|singing|town calling|points and calls|yell(?:s|ed|ing)?|scream\w*|chatter\w*|bleh+|repeats|breathless cat voice|shouted capitals|one-liners?|wisecrack\w*|misspelled voice|chatty|loud|me me me|gasps|meowed a lot|same meow)\b|'o' mouth|mid-'(?:pop|roar)'|gr-r-reat/],
  ["vocal", .15, "c", /\b(purrs?|purring|hum)\b/],
  ["vocal", -.15, "c", /\b(quiet|never meows|mute)\b/],
];

/** Signature moves, most telling first; read from the lore caption, then the story, then the look
    sheet's "signature"/"often" sentences. */
const SIGNATURE_RULES = [
  ["beckon", /\b(beckon\w*|waving good fortune|waves? good fortune|one paw raised|raised paw|punched the air|lifts? one paw|lifting one paw)\b/],
  ["hindStand", /\b(on (?:its|his|her) hind legs|stands? (?:up )?(?:tall|upright)|standing upright|walks? upright|stands upright)\b/],
  ["boxSit", /\b(box|boxes|cardboard|carrying case|carrier|basket|paper bag|inside a bag)\b/],
  ["spin", /\b(spins?(?!-off)|spinning)\b/],
  ["blep", /\b(tongue[- ]out|blep|bleh+|protruding tongue|tongue tip pokes)\b/],
  ["popMouth", /'o' mouth|mid-'(?:pop|roar)'|\bmid-meow\b|\broars?\b|\bmouth (?:wide |hangs )?open\b|gr-r-reat/],
  ["headTilt", /\b(head tilted|tilts? (?:its|his|her) head|tilting (?:its|his|her) head|head-tilt)\b/],
  ["drapeLean", /\b(leaning (?:on|against)|lounging against|one paw draped|draped|one paw dangling|lies long and flat|stretched out|along (?:a|the) (?:low |old oak )?(?:branch|beam))\b/],
  ["lapClaim", /\b(claiming a lap|every lap|onto (?:his|her) lap|on (?:his|her) lap|clung to|clingy|riding on (?:dad's|his|her) back|on (?:his|her) shoulder|busker's shoulder)\b/],
  ["ringCurl", /\b(curl(?:s|ed)? (?:up|into)|perfect ring)\b/],
  ["loaf", /\b(loaf(?:s|ing|ed)?|cat-loaf|tucks? in (?:her|his|its) paws)\b/],
  ["wash", /\b(washing (?:himself|herself|itself)|washes|have a wash|grooms?|grooming|just-washed)\b/],
  ["slowBlink", /\b(sleepy wink|slow blink|half-closed eyes|sleepy, knowing|knowing look|loving stare|eyes closed|closed-eye|blissful)\b/],
  ["stareDown", /\b(stares? down|staring down|glar(?:es|ing)|fearsome glare|unblinking stare|piercing stare|caught staring|staring|stare)\b/],
  ["sphinxWatch", /\b(keep(?:s|ing)? watch|keeping an eye|keeps one eye open|watches the pond|watch(?:es|ing)? over|guards?|guarding|stands guard|on duty|at (?:his|her) post|on the doorstep|bodyguard|guardian|at the ticket gate)\b/],
];

/** The ones a look sheet may name ("often with her tongue out"), not places or props. */
const LOOK_SIGNATURES = ["blep", "popMouth", "headTilt", "loaf", "wash", "slowBlink", "stareDown"];

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const r2 = (v) => Math.round(v * 100) / 100 + 0; // + 0: never -0
const lower = (s) => String(s || "").toLowerCase();
const negated = (text, i) => /\b(?:no|not|never|without)\b[^.;,]{0,14}$/.test(text.slice(Math.max(0, i - 24), i));

/** The first match of `re` in `text` that no "not" comes just before: { at, text } or null. */
function find(text, re) {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) if (!negated(text, m.index)) return { at: m.index, text: m[0] };
  return null;
}

/** A few words either side of a match, inside its sentence: the quote behind a value. */
function quote(text, m) {
  const end = m.at + m.text.length;
  let before = text.slice(Math.max(0, m.at - 26), m.at), after = text.slice(end, end + 22);
  const cutB = before.split(/[.;!?\n~](?:\s|$)/), cutA = after.split(/[.;!?\n~](?:\s|$)/);
  before = cutB.length > 1 || m.at <= 26 ? cutB.pop() : before.replace(/^\S*\s?/, "");
  after = cutA.length > 1 || end + 22 >= text.length ? cutA[0] : after.replace(/\s?\S*$/, "");
  return (before + m.text + after).replace(/\s+/g, " ").trim();
}

const KITTEN = /(?<!\b(?:her|his|small black|carries a|carrying (?:her|a)) )\bkittens?\b(?![- ](?:sized|fuzz|panda|irises|eyes))/;
const ADULT = /\b(adult|full-grown|grown-up|older)\b/;
const SENIOR = /\b(senior(?! pest)|elderly|geriatric|16 or so|greying muzzle|old tom|older domestic)\b/;
const CHUNKY = /\b(chubby(?![^.;]{0,14}\b(?:cheek|face))|chonk\w*|fat|tubby|plump(?!,? (?:round[- ])?fac)|portly|obese|rotund|stout|stocky|heavy-set|heavyset|heavy-bodied|heavy body|heavy build|heavy,? (?:stocky|long-haired|round)|heavy cat|cobby|round-bellied|ball-round|blob-shaped|bean-shaped|gumdrop-shaped|egg-shaped|loaf-(?:shaped|like) (?:body|build)|broad-chested|burly|jowly|barrel-bodied|big boi|26-pound|round(?:,| and)? (?:(?!head|face|eyes?)[a-z-]+,? ){0,3}(?:cat|kitten|body|belly|tom|tabby|tortoiseshell|calico|bodyguard)(?![-\w]))\b/;
const SLIM = /\b(slim(?! (?:[a-z]+ )?(?:collar|tail|line))|slender|(?<!medium[- ])lean(?!,? medium)|lithe|wiry(?![^.;]{0,24}\b(?:hairs?|coat|fur)\b)|lanky|skinny|svelte|rangy|leggy|long-legged|long legs|very thin|underfed|dancer-like)\b/;
const SHORT_LEGS = /\b(munchkin|minuet|short-legged|short legs|stubby (?:black )?(?:legs|limbs|arms and legs|nub feet)|dwarfism)\b/;
const LONG_LEGS = /\b(long legs|long-legged)\b/;
const BIG = /\b(lion|lioness|tiger|liger|tigon|cheetah|panther|jaguar|leopard|bobcat|lynx|cougar|puma|serval|caracal|ocelot)\b(?![- ](?:print|stripes?|striped|like|points?|tips?|tufts?|tufted|make-up|hybrid))/;
const LARGE = /\b(maine coon|norwegian forest|savannah|serval-hybrid|big boi|26-pound|(?:very large|fairly large|huge|giant|big|large)(?:,| and)? (?:(?!head|eyes?|ears?|nose|paws?|feet|ruff|tail|patch|chest|belly|fist)[a-z-]+,? ){0,3}(?:cat|tom|tomcat|male|female|body|calico|tabby|persian|shorthair|adult)(?![-\w]| (?:saddle|patch|mark|stripe|spot|silhouette)))\b/;
const SMALL = /(?<!carries a )\b(?:small|little|tiny|petite)(?:,| and)? (?:(?!head|eyes?|ears?|nose|paws?|feet|body|patch|spots?)[a-z-]+,? ){0,3}(?:cat|kitten|calico|tabby|tortoiseshell|shorthair|house cat|female|male|tom|adult)(?![-\w]| (?:saddle|patch|mark|stripe|spot|silhouette))/;
const TAILLESS = /\b(tailless|manx|bobbed tail|bobtailed|stub tail|no tail(?! rings?))\b/;
const DISABLED = /\b(blind|dwarfism|deformit\w*|missing (?:front )?toes|three-legged|paralys\w*|deaf)\b/;

/** Reads a cat's character from its words: { story, caption, look, lore, who } (any may be empty).
    Returns the traits with `why`: the quote or reason behind every value that is not ordinary. */
export function parseTraits({ story = "", caption = "", look = "", lore = "", who = "" } = {}, fixed = {}) {
  const cap = lower(caption).replace(NOISE, " ~ ");
  const tale = [story, lore, who].map(lower).join(" \n ").replace(NOISE, " ~ ");
  const C = `${cap} \n ${tale}`, L = lower(look).replace(NOISE, " ~ "), A = `${C} \n ${L}`;
  const t = {}, why = {};
  for (const k of TRAIT_KEYS) t[k] = 0.5;
  const add = (k, d, reason) => { t[k] += d; (why[k] ||= []).push(reason); };
  for (const [k, d, where, re] of RULES) {
    const src = where === "c" ? C : where === "l" ? L : A;
    const m = find(src, re);
    if (m) add(k, d, `"${quote(src, m)}"`);
  }
  // Age: as the cat is drawn now (its look), else its caption, else the story's first sentence.
  let age = "adult";
  const first = lower(story || lore).replace(NOISE, " ~ ").split(/(?<=[.!?])\s/)[0];
  const k = find(L, KITTEN), ad = find(L, ADULT);
  const isKit = /^[^,.]{1,40}, (?:a|an|the) [^,.]{0,50}\bkittens?\b|\b(?:is|are) (?:a |an |the )?[^.]{0,50}\bkittens?\b/;
  const kit = k && (!ad || k.at < ad.at) ? [L, k] : ad ? null : find(cap, KITTEN) ? [cap, find(cap, KITTEN)] : find(first, isKit) ? [first, find(first, isKit)] : null;
  if (kit) { age = "kitten"; why.age = `"${quote(...kit)}"`; }
  const sen = find(L, SENIOR) ? [L, find(L, SENIOR)] : find(C, SENIOR) ? [C, find(C, SENIOR)] : null;
  if (sen) { age = "senior"; why.age = `"${quote(...sen)}"`; }
  if (fixed.age) { age = fixed.age; why.age = "hand"; }
  // Size: a big cat when its look is one (not a house cat with a tiger print), of the species its
  // look names (SPECIES: drawn at its species' size), else from its looks.
  const lead = L.slice(0, 200);
  const big = find(lead, BIG) && !/\b(house ?cat|domestic)\b/.test(lead) ? find(lead, BIG) : null;
  const species = fixed.species || (big ? speciesIn(lead, big.at) : null);
  const wild = !!species && !SPECIES[species].domestic;
  const size = fixed.size || (wild ? "bigcat" : age === "kitten" ? "small" : find(L, LARGE) || find(tale, LARGE) ? "large" : find(L, SMALL) || find(tale, SMALL) ? "small" : "medium");
  if (fixed.size) why.size = "hand";
  else if (size === "bigcat") why.size = `"${quote(lead, big)}"`;
  else if (size !== "medium") { const src = find(L, size === "large" ? LARGE : SMALL) ? L : tale, m = find(src, size === "large" ? LARGE : SMALL); why.size = m ? `"${quote(src, m)}"` : age; }
  if (species) {
    why.species = fixed.species ? "hand" : `"${quote(lead, big)}"`;
    why.scale = `a ${species}: ${SPECIES[species].shoulder} m at the shoulder, ${r2(speciesRatio(species))}x a house cat's ${HOUSE_CAT_SHOULDER} m; drawn at ${r2(speciesRatio(species))}^${SIZE_POWER} = ${speciesScale(species)}x`;
  }
  // Build: from the look first (its first mention), then the story. Big cats are never "chunky".
  let build = "normal";
  const bm = (src) => { const c = find(src, CHUNKY), s = find(src, SLIM); return c && (!s || c.at <= s.at) ? ["chunky", c] : s ? ["slim", s] : null; };
  const b = bm(L) ? [L, bm(L)] : bm(tale) ? [tale, bm(tale)] : null;
  if (b && !(size === "bigcat" && b[1][0] === "chunky")) { build = b[1][0]; why.build = `"${quote(b[0], b[1][1])}"`; }
  if (fixed.build) { build = fixed.build; why.build = "hand"; }
  let legs = "normal";
  const sl = find(A, SHORT_LEGS);
  if (sl && !find(L, LONG_LEGS)) { legs = "short"; why.legs = `"${quote(A, sl)}"`; }
  if (fixed.legs) { legs = fixed.legs; why.legs = "hand"; }
  const flags = [];
  const bl = find(A, /\bblind\b/), tl = find(L, TAILLESS), dis = find(A, DISABLED);
  if (bl) { flags.push("blind"); why.blind = `"${quote(A, bl)}"`; }
  if (tl) { flags.push("tailless"); why.tailless = `"${quote(L, tl)}"`; }
  if (dis) { flags.push("gentle"); why.gentle = `"${quote(A, dis)}"`; }
  // What its age, build and size do to its character.
  const couple = (cond, tag, ch) => { if (cond) for (const [key, d] of Object.entries(ch)) add(key, d, tag); };
  couple(age === "kitten", "kitten", { energy: .15, playful: .2, curious: .1, grace: -.1 });
  couple(age === "senior", "senior", { energy: -.2, playful: -.2, sleepy: .15, grace: -.1, hunter: -.1 });
  couple(build === "chunky", "chunky", { energy: -.1, grace: -.12, foodie: .12, hunter: -.08 });
  couple(build === "slim", "slim", { grace: .1, energy: .05 });
  couple(legs === "short", "short legs", { grace: -.08 });
  couple(size === "bigcat", "big cat", { hunter: .15, bold: .15, grace: .05 });
  couple(flags.includes("blind"), "blind", { grace: -.1, energy: -.1, curious: .1 });
  // Its signature move: the caption first, then the story, then what its look sheet says it often does.
  const sigLook = L.split(/(?<=[.;])\s/).filter((s) => /\b(signature|often|usually)\b/.test(s)).join(" ");
  let signature = null;
  for (const [i, src] of [cap, tale, sigLook].entries()) {
    for (const [name, re] of SIGNATURE_RULES) {
      if (i === 2 && !LOOK_SIGNATURES.includes(name)) continue;
      const m = find(src, re);
      if (m) { signature = name; why.signature = `"${quote(src, m)}"`; break; }
    }
    if (signature) break;
  }
  for (const key of TRAIT_KEYS) t[key] = r2(clamp(t[key], 0.05, 0.95));
  const out = { ...t, age, build, legs, size, flags: FLAGS.filter((f) => flags.includes(f)), signature };
  if (species) { out.species = species; out.scale = speciesScale(species); }
  else if (size === "bigcat") out.scale = 1.45;
  for (const key of Object.keys(why)) if (Array.isArray(why[key])) { if (t[key] === 0.5) delete why[key]; else why[key] = why[key].slice(0, 3).join("; "); }
  out.why = why;
  return out;
}

/** Hand-read characters: the cats whose words say little about them, and famous characters whose
    ways are well known. Partial traits; `note` says why. Applied over parseTraits by traitsOf and
    the build. */
export const TRAIT_OVERRIDES = {
  // Cats whose words carry no temperament.
  SNOWCURL: { energy: .4, social: .6, proud: .55, grace: .6, signature: "wash", note: "Tesla's Balloon Cat: a calm poser, one paw lifted to her face" },
  TRINKETCAT: { curious: .75, playful: .6, hunter: .6, social: .35, note: "a secretive magpie who hoards pebbles" },
  COOPERCAT: { curious: .65, proud: .6, grace: .6, note: "a tidy worker sorting petals" },
  NOTEPAW: { energy: .6, grace: .7, social: .6, bold: .55, note: "a careful courier who never drops a note" },
  RUBYCAT: { energy: .45, social: .6, curious: .55, note: "a relaxed stroller" },
  MARUBOX: { playful: .8, curious: .8, bold: .65, energy: .6, signature: "boxSit", note: "Maru: dives into every box, however small" },
  GLICAT: { social: .75, bold: .7, sleepy: .6, energy: .4, proud: .6, signature: "loaf", note: "Gli of Hagia Sophia: calm with every visitor, loafing on her ledge" },
  NEKOBUS: { energy: .85, playful: .7, social: .7, grace: .7, curious: .6, size: "large", note: "the Catbus: big, fast and grinning" },
  OCTOMONA: { curious: .75, social: .6, playful: .55, note: "GitHub's Mona, watching the code" },
  COPYCC: { curious: .7, playful: .65, note: "CC the clone was said to be curious and playful, unlike her reserved donor" },
  KURONEKCAT: { age: "adult", social: .7, grace: .7, bold: .55, grumpy: .3, note: "Yamato's mother cat, carrying her kitten with care" },
  NERMALCAT: { proud: .85, playful: .75, social: .75, energy: .75, vocal: .6, bold: .6, signature: "headTilt", note: "Garfield's Nermal: vain, perky 'world's cutest kitten'" },
  SCRATCHC: { energy: .7, playful: .75, social: .75, curious: .6, note: "Scratch Cat: the cheerful sprite kids make dance" },
  KITTENPLZ: { playful: .75, social: .75, curious: .65, note: "Keanu, the kitten everyone wanted back" },
  MARUOCAT: { sleepy: .6, social: .6, energy: .4, signature: "boxSit", note: "HIKAKIN's round-faced Fold with his cardboard castle" },
  QCGENESIS: { size: "medium", proud: .75, bold: .65, curious: .6, grace: .6, signature: "sphinxWatch", note: "the one-of-one 'origin of all cats'" },
  MOONRESCUE: { curious: .65, playful: .6, social: .6, note: "MoonCats: rescued pixel cats, poses chosen by their people" },
  "cate-meme": { sleepy: .65, bold: .35, social: .6, signature: "slowBlink", note: "a tiny rescued kitten, eyes closed, chin up" },
  maneki: { social: .8, bold: .6, energy: .35, sleepy: .55, grumpy: .1, signature: "beckon", note: "the beckoning lucky cat, blissful smile" },
  // Famous characters.
  "cat-in-a-dogs-world": { bold: .75, proud: .7, grumpy: .6, social: .35, signature: "stareDown", note: "MEW: a scowling, unimpressed stare down Dog City" },
  "catwifhat-2": { energy: .4, grumpy: .25, bold: .65, note: "calm and completely unbothered" },
  "pepecat-2": { energy: .6, curious: .65, playful: .65, note: "'moody, loud' and always off on an adventure" },
  "hello-kitty-sol": { social: .8, playful: .6, foodie: .6, grumpy: .1, note: "Kitty White, a kind girl who loves baking cookies" },
  michi: { curious: .8, playful: .7, signature: "hindStand", note: "michi, up on its hind legs by the window" },
  "vibing-cat-coin": { playful: .85, energy: .75, curious: .7, sleepy: .5, social: .6, foodie: .6, hunter: .6, signature: null, note: "mid-pounce at a feather, then off exploring" },
  "catcoin-6": { foodie: .7, curious: .75, social: .65, note: "head tilted, waiting for a treat" },
  "raydium-cat": { energy: .8, bold: .7, note: "bounces on its toes, fist in the air" },
  "ket-3": { grumpy: .75, bold: .8, energy: .3, signature: "stareDown", note: "KET: no plan, no fear, half-closed eyes that have seen it all" },
  gta6cat: { proud: .75, bold: .8, energy: .25, social: .3, grumpy: .45, note: "Gato owns the store and has never moved for anyone" },
  "hosico-cat": { bold: .25, playful: .75, vocal: .65, social: .65, note: "hides from the doorbell, adores his straw, chatters at his people" },
  MEREDITCAT: { proud: .85, social: .2, energy: .35, grumpy: .45, signature: "stareDown", note: "Meredith: aloof, upright, 'sassy'" },
  BENBUTTON: { social: .85, energy: .3, sleepy: .65, bold: .6, note: "a floppy, unflappable Ragdoll" },
  LARRY10: { age: "senior", hunter: .6, bold: .7, proud: .7, social: .35, grumpy: .55, energy: .3, sleepy: .65, signature: "sphinxWatch", note: "Larry, about 19, Chief Mouser: watches from the doorstep, spars with rivals" },
  CHOUPETCAT: { proud: .9, energy: .3, sleepy: .6, grace: .7, signature: "drapeLean", note: "Choupette, lounging, the most pampered cat in Paris" },
  STREETBOB: { social: .8, bold: .7, note: "Bob rode a busker's shoulder through London" },
  MEOWTHR: { vocal: .85, bold: .6, grumpy: .5, proud: .6, note: "Meowth talks, schemes and walks upright" },
  LILBUBCAT: { energy: .3, social: .75, sleepy: .6, grace: .4, note: "Lil BUB: a gentle, slow magical space cat" },
  PUSHEENX: { build: "chunky", foodie: .9, sleepy: .65, energy: .3, social: .65, signature: "loaf", note: "Pusheen: a chubby loaf who loves cookies" },
  TOMBILICAT: { energy: .2, sleepy: .7, social: .6, bold: .6, note: "Tombili, the kerb-leaning street cat of Kadıköy" },
  STEPANCAT: { energy: .25, playful: .2, grumpy: .55, proud: .7, signature: "stareDown", note: "Stepan: deadpan, unimpressed poses" },
  BUTTERED: { grace: .15, social: .7, playful: .6, note: "Jorts: sweet, not bright, cannot open the door" },
  TAMAEKI: { proud: .7, social: .75, bold: .6, energy: .35, note: "Tama, stationmaster, greeting passengers at the gate" },
  NOSTROMCAT: { grumpy: .55, bold: .55, curious: .6, hunter: .6, note: "Jonesy: wary, hisses at what he does not trust" },
  FLERKENCAT: { bold: .75, grumpy: .5, hunter: .7, signature: "slowBlink", note: "Goose: looks entirely innocent, is not" },
  CROOKSHNK: { grumpy: .75, hunter: .85, bold: .75, curious: .7, social: .45, signature: "stareDown", note: "Crookshanks: a scowling, clever prowler who saw through Scabbers" },
  MARIEAC: { proud: .85, social: .65, vocal: .6, grace: .7, signature: "wash", note: "Marie: 'a lady at all times', sings her scales" },
  CHESHIRCAT: { curious: .7, playful: .7, bold: .7, grace: .8, signature: "drapeLean", note: "the Cheshire Cat, lounging on his branch" },
  SUCCOTASH: { hunter: .9, energy: .7, grace: .25, vocal: .7, foodie: .7, signature: "hindStand", note: "Sylvester: forever reaching for Tweety, forever missing" },
  BIGGLESCAT: { proud: .8, energy: .3, grumpy: .5, sleepy: .55, signature: "lapClaim", note: "Mr. Bigglesworth, smug on Dr. Evil's lap" },
  NALACATCAT: { proud: .85, social: .7, note: "Nala, posing for her millions of followers" },
  LUNAMOOCAT: { curious: .6, proud: .65, bold: .65, grace: .7, vocal: .6, note: "Luna: a wise, talking guardian" },
  PICKLECCAT: { social: .9, bold: .6, playful: .6, note: "Pickle kept climbing onto his lap until they kept her" },
  SABERHACAT: { vocal: .85, grumpy: .6, proud: .75, energy: .35, social: .45, signature: "stareDown", note: "Salem: sarcastic one-liners from the kitchen counter" },
  MAYORSTUB: { proud: .75, social: .75, energy: .35, sleepy: .6, note: "Mayor Stubbs, greeting tourists at his post" },
  FDCW: { curious: .7, vocal: .7, proud: .6, note: "Chester, the Siamese physicist" },
  DIPLOMOG: { hunter: .75, bold: .75, energy: .6, grumpy: .5, signature: "sphinxWatch", note: "Palmerston, a working mouser who stood up to Larry" },
  COLMEOW2: { grumpy: .9, proud: .75, bold: .7, energy: .3, social: .3, signature: "stareDown", note: "Colonel Meow and his famous scowl" },
  CHEETLE: { proud: .8, bold: .75, energy: .7, grace: .7, foodie: .75, grumpy: .2, note: "Chester Cheetah: too cool, dusty with Cheetle" },
  TALKTOM: { vocal: .95, playful: .7, social: .7, energy: .6, note: "Talking Tom repeats everything you say" },
  MRSNORRCAT: { hunter: .7, curious: .75, bold: .6, social: .3, grumpy: .6, grace: .7, signature: "stareDown", note: "Mrs Norris, Filch's watchful snitch" },
  CHURCHCCAT: { grumpy: .7, social: .2, energy: .4, hunter: .7, signature: "stareDown", note: "Church came back, and not quite the same" },
  THACKERY: { bold: .75, curious: .6, social: .65, grace: .7, vocal: .6, note: "Binx, loyal and watchful for 300 years" },
  FIGAROCAT: { playful: .8, proud: .55, social: .6, curious: .65, note: "Figaro: a lively, pouting kitten" },
  GUMBALLW: { energy: .8, playful: .85, curious: .7, grace: .3, social: .75, vocal: .7, note: "Gumball: a hyper 12-year-old cartoon cat" },
  FELIX1919: { playful: .8, energy: .7, curious: .65, bold: .65, note: "Felix and his bag of tricks" },
  ARTEMISCAT: { curious: .75, social: .7, grace: .65, signature: "headTilt", note: "Artemis, looking up at the stars" },
  SPRIGATO: { playful: .85, social: .75, vocal: .6, energy: .7, note: "'capricious, attention-seeking'" },
  STRAYB12: { curious: .9, energy: .7, grace: .8, playful: .6, bold: .6, note: "the Stray: climbs everything, explores everywhere" },
  GENKITTY: { proud: .75, grumpy: .35, note: "Genesis, CryptoKitty #1, smug" },
  SUSHITUNA: { age: "adult", size: "large", species: "savannah", energy: .8, bold: .7, playful: .7, curious: .75, hunter: .7, social: .55, vocal: .6, note: "Savannah siblings: tall, busy, chirpy hunters (F1 Savannahs, serval hybrids, about 0.39 m at the shoulder)" },
  TREMAINE: { grumpy: .85, proud: .7, social: .2, foodie: .7, energy: .3, hunter: .7, signature: "sphinxWatch", note: "Lucifer, plotting on his velvet cushion" },
  PUSSBOOCAT: { bold: .9, proud: .8, grace: .85, energy: .7, playful: .6, social: .6, signature: "headTilt", note: "Puss in Boots: swashbuckler with the big pleading eyes" },
  DIDGACAT: { energy: .85, playful: .8, grace: .8, bold: .75, social: .6, note: "Didga: record-breaking trick cat" },
  GRREAT: { social: .85, energy: .75, bold: .8, proud: .7, vocal: .75, foodie: .75, grumpy: .05, note: "Tony the Tiger: 'They're Gr-r-reat!'" },
  MUSTACHCAT: { proud: .7, energy: .4, social: .55, note: "Hamilton, the dignified hipster" },
  JOCKCAT: { social: .6, proud: .55, note: "Jock of Chartwell, a comfortable country-house cat" },
  FELIXHUD: { hunter: .8, bold: .7, social: .75, note: "Felix, Senior Pest Controller, greeting commuters" },
  NITAMACAT: { proud: .65, social: .75, bold: .55, note: "Nitama, stationmaster after Tama" },
  BLAZECAT: { proud: .8, bold: .8, grace: .85, energy: .7, social: .35, grumpy: .45, note: "Blaze, the fire princess: poised and reserved" },
  CHOCOCACAT: { curious: .85, social: .6, energy: .45, signature: "headTilt", note: "Chococat: intuitive, always reading up" },
  UNSINKSAM: { bold: .75, grace: .6, note: "Sam, who survived three sinkings" },
  OSCARRI: { social: .85, energy: .3, sleepy: .7, playful: .2, flags: ["gentle"], signature: "ringCurl", note: "Oscar kept gentle company with the dying: serious lore, no slapstick" },
  COLEMARM: { social: .75, playful: .65, curious: .6, note: "Cole and Marmalade, the rescue duo" },
  TREASMOG: { hunter: .7, bold: .6, proud: .6, signature: "sphinxWatch", note: "Gladstone, Chief Mouser at his desk" },
  MISTO: { grace: .9, playful: .7, energy: .7, proud: .7, bold: .65, signature: "spin", note: "Mr. Mistoffelees, the conjuring cat who spins" },
  SASSYHB: { proud: .8, grumpy: .6, vocal: .7, social: .45, energy: .5, signature: "wash", note: "Sassy: prissy, sharp-tongued Himalayan" },
  BIGFROGGY: { energy: .25, sleepy: .6, grumpy: .1, social: .75, foodie: .6, hunter: .55, grace: .25, bold: .6, size: "large", note: "Big the Cat: huge, laid-back, fishing with Froggy" },
  CAITSITH: { vocal: .8, playful: .65, social: .6, note: "Cait Sith, the wisecracking fortune-teller" },
  SEACAT: { hunter: .9, bold: .8, social: .75, flags: ["gentle"], note: "Simon of HMS Amethyst, wounded in war: serious lore, no slapstick" },
  SERPOUNCE: { playful: .75, proud: .7, social: .6, note: "Ser Pounce, the king's kitten, on his royal cushion" },
  AZRAELCAT: { hunter: .9, grumpy: .75, energy: .4, playful: .2, social: .2, bold: .6, foodie: .7, signature: "stareDown", note: "Azrael: 'the world's most over-it cat', forever hunting Smurfs" },
  GROOVYPETE: { grumpy: .05, social: .75, playful: .6, proud: .6, bold: .6, vocal: .6, signature: "slowBlink", note: "Pete the Cat: cool, groovy, never upset" },
  CHISWEET: { playful: .8, curious: .8, bold: .35, social: .75, vocal: .6, grace: .35, signature: "headTilt", note: "Chi: a lost, curious little kitten" },
  PALICO: { hunter: .75, bold: .75, social: .75, energy: .7, vocal: .6, signature: "hindStand", note: "a Palico: a loyal, upright hunting companion" },
  ATCHOUMCAT: { grumpy: .45, bold: .6, social: .55, energy: .4, note: "Atchoum: 'hairy not scary', an intense stare" },
  SNOWBELCAT: { grumpy: .65, proud: .7, social: .35, hunter: .6, energy: .35, signature: "stareDown", note: "Snowbell, a jealous Persian eyeing the mouse" },
  FINICKY: { foodie: .25, proud: .75, grumpy: .5, energy: .4, signature: "slowBlink", note: "Morris, famously finicky and suave" },
  NYANKOSEN: { foodie: .85, sleepy: .7, energy: .3, grumpy: .55, bold: .8, vocal: .65, note: "Nyanko-sensei: a lazy, greedy, grumbling bodyguard" },
  EMPTANG: { proud: .75, energy: .35, sleepy: .6, note: "Empress Tang, a Persian of Martha Stewart's farm" },
  FAITHCAT: { social: .7, bold: .7, flags: ["gentle"], note: "Faith saved her kitten from the Blitz: serious lore, no slapstick" },
  TRIMCAT: { bold: .75, social: .8, curious: .75, playful: .7, grace: .75, energy: .6, note: "Trim, Flinders' affectionate, clever ship's cat" },
  TUBBSCAT: { foodie: .95, energy: .15, sleepy: .75, grace: .15, social: .4, signature: "loaf", note: "Tubbs, who empties the food bowl" },
  SGTTIBBS: { bold: .85, curious: .7, energy: .65, social: .7, note: "Sergeant Tibbs: brave rescuer of the puppies" },
  LEOTHELION: { sleepy: .65, energy: .35, signature: "sphinxWatch", note: "Leo on the sundial, following the sun" },
  JELLIECAT: { grumpy: .85, signature: "stareDown", note: "Jellie and her famous grumpy face" },
  MOMOTHECAT: { curious: .65, playful: .6, grace: .65, grumpy: .45, signature: "beckon", note: "Momo, waving her wand" },
  COUCHCAP: { curious: .6, sleepy: .6, energy: .35, note: "the Make-A-Video Cat, watching TV from the sofa" },
  TUPPENCE: { social: .7, proud: .55, note: "Fat Cat Bat Rat, waiting politely for four o'clock tea" },
  SKEINKIT: { playful: .95, grace: .25, note: "Skein, forever tangled in the yarn" },
  CAMTHECAT: { bold: .75, note: "Cam, guarding the pond like a moat" },
  TRILLBY: { vocal: .9, social: .9, note: "Trillby chirps back and follows every chat" },
  PAWPOST: { social: .35, note: "a stern guard" },
  COWARDLION: { grumpy: .1, bold: .15, social: .6, vocal: .55, proud: .45, note: "the Cowardly Lion: timid and tearful, not cross" },
  SAFFWHISK: { bold: .85, note: "the tiger that stares down the sprinkler" },
  TARTANPAW: { proud: .8, grumpy: .6, bold: .7, note: "Business Cat: needs that TPS report" },
  KIOSKPAW: { social: .8, playful: .65, signature: "beckon", note: "Kiosk bats the bell for each visitor" },
  TOMRUTGERS: { energy: .15, grumpy: .5, note: "Tom Rutgers: jowly and still" },
  ICICLEPAW: { energy: .15, grace: .75, grumpy: .3, vocal: .45, note: "sits so still that moths land by him" },
  PARLORPUFF: { proud: .75, energy: .2, note: "so still visitors take her for a painting" },
  SQUINTPAW: { grumpy: .8, foodie: .8, note: "the Free Groceries Cat, frowning over his milk and baguette" },
  JITTERPAW: { grumpy: .65, energy: .7, bold: .6, note: "a scruffy, fanged coffee cat" },
  PAPRIKA: { flags: ["gentle"], note: "Walter, a fallen serviceman's cat: serious lore, no slapstick" },
  HUBBUB: { social: .7, curious: .7, note: "Ethel: blind, short-legged, follows every lively chat by ear" },
  GANYHOUSE: { age: "senior", energy: .3, bold: .5, social: .6, sleepy: .7, note: "Gany: a blind senior; 'wholesome memes only', his owner asks" },
  CZELDA: { bold: .2, curious: .9, note: "Zelda: 'Easily startled. Often caught staring.'" },
  PONTAKUN: { age: "senior", grumpy: .8, social: .2, bold: .6, playful: .35, note: "Ponta, 14: won't warm to strangers, lands a swat, still runs and jumps" },
  TSUSAN: { bold: .7, grumpy: .45, playful: .65, social: .6, note: "Tsushima: an ex-stray who flops over to demand play" },
  SINSMILE: { grumpy: .55, playful: .6, flags: ["gentle"], note: "Monkey: 'devious/scheming', skeletal deformities, so no clumsy slapstick" },
  COSMICGREG: { vocal: .7, proud: .65, social: .75, bold: .5, note: "Gregory: sad eyes gone, now 'a sassy, talkative friend'" },
  FISHTOPH: { social: .65, bold: .35, energy: .35, note: "Fishtopher: once 'very sad', now at home with cat friends" },
  MIETTE: { vocal: .75, playful: .7, foodie: .7, note: "Miette: talks like a British orphan, loves crumbs and her three games" },
  NEKOSAMA: { grumpy: .8, proud: .7, foodie: .75, signature: "stareDown", note: "Neko-sama, 'Lord Cat', glares and raids the food" },
  LEFTFANG: { vocal: .85, social: .75, bold: .7, note: "Ollie: 'ME ME ME ... TELL ME I'M A GOOD GIRL!'" },
  PEEPEECAT: { social: .75, energy: .4, note: "Peepee, 'a litle creacher' who loved being petted" },
  MAYORJINX: { bold: .7, curious: .6, note: "Jinx, one-day mayor of Hell, Michigan" },
  KOTECHAN: { playful: .75, social: .6, energy: .55, note: "Kotetsu: a mischievous cat raised from 3 days old" },
  BLEHMILLY: { playful: .75, curious: .65, note: "Milly: 'i can act rather silly at times'" },
  DELILAHCAT: { social: .75, sleepy: .65, playful: .55, proud: .6, note: "Freddie Mercury's favourite, who cuddled up to sleep beside him" },
  PRINCEKIT: { hunter: .5, vocal: .5, social: .6, bold: .5, proud: .55, note: "a Siberian kitten new to No 10 (the mouser in his story is Larry)" },
  CHIKUWACAT: { energy: .55, playful: .7, sleepy: .7, note: "Chikuwa sleeps all day, then sprints round the house every night" },
  BROWANTSIN: { signature: "stareDown", note: "Bro stands still in the rain, staring at the camera" },
  tsuki: { proud: .7, note: "Diana, a wise young guardian keeping watch" },
  MRBCHONK: { social: .7, bold: .35, note: "Mr. B: 'a big cat with a big heart', who hid behind the studio couch" },
  HEIZOU: { social: .8, grumpy: .4, curious: .7, note: "Heizou walks the night listening for crying children" },
  YOSHINEKO: { bold: .65, note: "Shigoto Neko: points and calls 'Yoshi!' at anything" },
  CAPOOBUG: { playful: .7, grumpy: .55, note: "Capoo: 'both violent and cute', always hungry for meat" },
  HOICHAN: { foodie: .6, note: "Hoi-chan: clingy, comes down sleepy-eyed at breakfast" },
  PAYAKE: { foodie: .7, note: "Donguri: a lively, fuzzy Munchkin" },
  SUGARSOOT: { foodie: .6, note: "the Krispy Kreme doughnut cat, sniffing the sweet air" },
  OLIVIACAT: { grumpy: .55, note: "Olivia: a napping Fold with a slightly grumpy face" },
  SILKSTRIPE: { social: .15, note: "Schrödinger: aloof ('the feeling wasn't reciprocated')" },
  ROLFCAT: { social: .85, curious: .6, note: "Rolf, campus 'Ambassacat' for student wellbeing" },
};

/** Every override's `flags` add to the parsed ones; its numbers and signature replace them (its
    age, build, legs and size go to parseTraits, so what they imply is worked out as usual). */
function applyOverride(t, o) {
  if (!o) return t;
  const out = { ...t, why: { ...t.why } };
  for (const [k, v] of Object.entries(o)) {
    if (k === "note" || k === "species" || has(ENUMS, k)) continue; // age, build, legs, size, species: read by parseTraits
    if (k === "flags") { out.flags = FLAGS.filter((f) => t.flags.includes(f) || v.includes(f)); for (const f of v) out.why[f] = "hand"; continue; }
    out[k] = v;
    out.why[k] = "hand";
  }
  out.why.hand = o.note;
  return out;
}

/** The words a resident card carries (a stock cat, an adoptable cat or a famous coin; see
    residents.js), plus any the build adds ({ caption, exactLook }). */
export function textsOf(r, extra = {}) {
  const famous = r?.kind === "famous";
  return {
    story: famous ? "" : r?.story || r?.description || "",
    lore: famous && typeof r.lore === "string" ? r.lore : "",
    who: famous ? [r.who, r.viral?.summary].filter(Boolean).join(" ") : "",
    caption: extra.caption ?? (famous ? r.lorePic?.caption : r?.lore?.caption) ?? "",
    look: [famous ? "" : r?.look || "", extra.exactLook || ""].join(" "),
  };
}

/** What a resident's own 3D model cannot show without its skin tearing (measured over every clip by the
    herd survey behind tests/catrig-herd.test.mjs): the actions (catmotion.js ACTIONS) the sims never give
    it and the view never shows for it (catviews shows the posture's plain pose, or standing, instead).
    Keyed by id; `why` says what the model is. Everything a model can do it still does: three keep to
    standing and walking, Pusheen to its loaf; the rest skip only a wash, a scratch or a wave that their
    shape can't bring off (a move toned down that far would read as a half gesture, or as nothing). */
const STANDING_ONLY = ["sit", "look", "pant", "groom", "legLick", "earScratch", "knead", "beckon", "chatter", "yawn", "loaf", "dab", "flop", "roll", "sleep", "hop", "pounce", "sitDown", "standUp", "lieDown", "getUp", "sitToLie", "lieToSit", "curlUp", "wake", "hindStand", "scratch", "headBunt", "crouch", "wiggle", "stretch", "stalk"];
export const MODEL_LIMITS = {
  NEKOBUS: { avoid: STANDING_ONLY, why: "the Catbus: a bus on twelve legs; it stands, walks and runs, and does nothing a bus cannot" },
  ATCHOUMCAT: { avoid: STANDING_ONLY, why: "floor-length fur stands in for the hind legs in the model: only standing and walking hold together" },
  JITTERPAW: { avoid: STANDING_ONLY, why: "fur modelled as loose spiky shards, which come apart in any fold" },
  PUSHEENX: { avoid: ["groom", "legLick", "earScratch", "beckon", "hindStand", "scratch", "stretch", "dab", "flop", "roll", "hop", "pounce", "sleep", "curlUp", "wake", "crouch", "wiggle"], why: "Pusheen: stub legs on a loaf of a body; no paw reaches the face, and it neither rolls over nor curls up (it dozes in its loaf)" },
  // (the final survey round: its full copy's tail root, modelled lying along the ground from the hip, twists
  // into a sheet when a hind leg comes up to the ear or is lifted to lick, even at 0.3 of the move)
  MILLRACE: { avoid: ["earScratch", "legLick"], why: "its tail lies along the ground from the hip: a hind leg raised to the ear or to lick twists the tail's root" },
  // (fixer round 3, from renders of every model's wash, leg lick and ear scratch and the reach they measure
  // (mouth to paw or leg, hind paw to ear) against what their skin lets them do (fit.json): a move that
  // can't read on the model is left out, rather than shown as a half gesture or a cat sitting still)
  GUMBALLW: { avoid: ["groom", "legLick", "earScratch"], why: "a cartoon cat with a head as big as its body: no paw or leg comes near its mouth or ear" },
  CHOCOCACAT: { avoid: ["groom", "legLick", "earScratch"], why: "a chibi: a head as big as its body on stub legs; no paw or leg comes near its mouth or ear" },
  NYANKOSEN: { avoid: ["groom", "legLick", "earScratch"], why: "a round ball of a cat on stub legs: no paw or leg comes near its mouth or ear" },
  BIGFROGGY: { avoid: ["groom", "legLick", "earScratch"], why: "a round cartoon body: no paw or leg comes near its mouth or ear" },
  TUBBSCAT: { avoid: ["legLick", "earScratch"], why: "a very round cat: a hind leg lifted as far as its skin lets it stays down by its belly" },
  MEDIACAT: { avoid: ["earScratch"], why: "its hand-made model's hind leg lifted as far as it goes stays down by its shoulder, well short of the ear" },
  WAYBILL: { avoid: ["legLick"], why: "its skin lets a hind leg come up only a third of the way: the lick would be a nod at its knee" },
  OCTOMONA: { avoid: ["legLick"], why: "tentacles for hind legs, which sink into the lawn when one is lifted" },
  TOMBILICAT: { avoid: ["earScratch"], why: "round and short-legged: its hind paw can't get near its ear" },
  NERMALCAT: { avoid: ["earScratch"], why: "a cartoon head as big as its body: its hind paw can't get near its ear" },
  LILBUBCAT: { avoid: ["earScratch"], why: "short legs on a round body: its hind paw can't get near its ear" },
  CHISWEET: { avoid: ["earScratch"], why: "a big kitten head on a small body: its hind paw can't get near its ear" },
  COLMEOW2: { avoid: ["earScratch"], why: "a deep, round body: its hind paw can't get near its ear" },
  MUSTACHCAT: { avoid: ["earScratch"], why: "a deep, round body: its hind paw can't get near its ear" },
  "catcoin-6": { avoid: ["earScratch"], why: "a big head on a round body: its hind paw can't get near its ear" },
  sillynubcat: { avoid: ["earScratch"], why: "long fur over a round body: its hind paw can't get near its ear" },
  CROOKSHNK: { avoid: ["earScratch"], why: "a squashed, deep-furred body: its hind paw can't get near its ear" },
  maneki: { avoid: ["earScratch"], why: "the lucky-cat figure: a round body with a big head; its hind paw can't get near its ear" },
  CAITSITH: { avoid: ["earScratch"], why: "a deep body under its cloak: its hind paw can't get near its ear" },
  EMPTANG: { avoid: ["earScratch"], why: "a round, deep-furred body: its hind paw can't get near its ear" },
  SKEINKIT: { avoid: ["earScratch"], why: "its skin lets a hind leg come up only a third of the way: the paw would scratch its shoulder" },
  TARTANPAW: { avoid: ["earScratch"], why: "its skin lets a hind leg come up only a third of the way: the paw would scratch its shoulder" },
  tsuki: { avoid: ["scratch"], why: "its skin lets it rear only half way up to a trunk: the scratch would read as a lunge" },
  SNOWBELCAT: { avoid: ["scratch"], why: "its skin lets it rear only half way up to a trunk: the scratch would read as a lunge" },
  "vibing-cat-coin": { avoid: ["beckon"], why: "its skin lets a forepaw come up only a third of the way: the beckon would be a twitch" },
  // (fixer round 4: with the head's skin on the head at last (the head joint at the back of the skull), a head
  // tipped, bowed or rolled over shows, and these models' skin can't take it even at 0.3 of the move, or at what it can take the move falls short)
  LACQUER: { avoid: ["earScratch"], why: "a big kitten head: tipped down to the scratching paw, its face pinches" },
  AMRCAT: { avoid: ["legLick"], why: "a cartoon head as big as its body: bowed to a raised hind leg it buries the leg and folds at the nape" },
  "hello-kitty-sol": { avoid: ["roll"], why: "rolled onto its back and wriggling, its head rubbed round on the lawn squeezes flat" },
  SUNSTRETCH: { avoid: ["earScratch"], why: "a tiger cub's big round head: tipped down to the scratching paw, it squeezes at the nape" },
  CHOUPETCAT: { avoid: ["earScratch"], why: "a deep ruff under a head tipped to the paw: its skin lets the hind paw come only part way up, a paw short of the ear" },
  PEWTER: { avoid: ["earScratch", "roll"], why: "its cape and feathered hat: a hind leg lifted to the ear catches the cape, and rolled onto its back the hat's feather goes into the lawn" },
};
const avoidOf = (r) => { const m = MODEL_LIMITS[r?.id] ?? MODEL_LIMITS[r?.ticker]; return m ? m.avoid.slice() : null; };

/** A resident's traits read from its words, with its memorial mark and any hand override (and `why`). */
export function deriveTraits(r, extra = {}) {
  const o = TRAIT_OVERRIDES[r?.id] ?? TRAIT_OVERRIDES[r?.ticker];
  const fixed = {};
  for (const k of [...Object.keys(ENUMS), "species"]) if (o?.[k]) fixed[k] = o[k];
  const t = parseTraits(textsOf(r, extra), fixed);
  if (r?.memorial === true || /in loving memory/i.test(r?.sensitivity || "")) {
    t.flags = FLAGS.filter((f) => t.flags.includes(f) || f === "memorial" || f === "gentle");
    t.why.memorial = "in loving memory";
  }
  const a = avoidOf(r);
  if (a) { t.avoid = a; t.why.avoid = (MODEL_LIMITS[r?.id] ?? MODEL_LIMITS[r?.ticker]).why; }
  return applyOverride(t, o);
}

/** Any traits-like object made whole and safe: numbers clamped to 0..1 (0.5 when missing), words
    from their lists, known flags, a known signature; `why` and unknown fields dropped. */
export function normalizeTraits(x) {
  const src = x && typeof x === "object" ? x : {};
  const out = {};
  for (const k of TRAIT_KEYS) out[k] = Number.isFinite(src[k]) ? clamp(src[k]) : NEUTRAL_TRAITS[k];
  for (const [k, list] of Object.entries(ENUMS)) out[k] = list.includes(src[k]) ? src[k] : NEUTRAL_TRAITS[k];
  out.flags = FLAGS.filter((f) => Array.isArray(src.flags) && src.flags.includes(f));
  if (out.flags.includes("memorial") && !out.flags.includes("gentle")) out.flags.push("gentle");
  out.signature = has(SIGNATURES, src.signature) ? src.signature : null;
  // (a species drawn at its species' size, from the table: SPECIES; any other big cat as given)
  if (has(SPECIES, src.species)) { out.species = src.species; out.scale = speciesScale(src.species); }
  else if (out.size === "bigcat") out.scale = Number.isFinite(src.scale) ? clamp(src.scale, 1, MAX_SCALE) : 1.45;
  // (what its model can't show, catmotion ACTIONS names, kept only when there is any: see MODEL_LIMITS)
  if (Array.isArray(src.avoid) && src.avoid.length) out.avoid = src.avoid.filter((a, i) => typeof a === "string" && has(ACTIONS, a) && src.avoid.indexOf(a) === i);
  return out;
}

/** A resident's traits: its row in data/traits.json (`table`, keyed by id, or by ticker), else what
    residents.js attached (r.traits), else read from its card now. */
/** A resident's full traits: its row of data/traits.json (or its own `traits`, or what its words say), made
    whole, with what its own model cannot show (MODEL_LIMITS) whichever way the traits came. */
export function traitsOf(r, table) {
  const row = table?.[r?.id] ?? table?.[r?.ticker] ?? r?.traits;
  const t = normalizeTraits(row && typeof row === "object" ? row : deriveTraits(r));
  const a = avoidOf(r);
  if (a) t.avoid = [...new Set([...(t.avoid || []), ...a])];
  return t;
}

/** How an ordinary adult moves (styleOf(NEUTRAL_TRAITS) gives exactly this; clips use these values
    for anything a style leaves out). */
export const STYLE_DEFAULTS = Object.freeze({ tempo: 1, stride: 1, lift: 1, bob: 1, sway: 0, crouch: 0, tail: 0, head: 0, sitTall: 0.5, loafTuck: 0.5, scale: 1 });

/** How a cat of these traits moves and holds itself:
    tempo 0.8..1.3 (× transition and idle durations: kittens ~0.85, seniors and heavy cats ~1.2),
    stride 0.85..1.15 (× walk stride), lift 0.7..1.3 (× paw lift), bob 0.6..1.6 (× body bob),
    sway 0..1 (hip roll, the chunky waddle), crouch 0..0.35 (body lowered on the move: shy, hunter),
    tail -0.4..1 (carriage: tucked .. relaxed 0 .. straight up), head -0.3..0.3 (carriage),
    sitTall 0..1 (slumped .. regal), loafTuck 0..1 (sphinx forelegs out .. fully tucked),
    scale 0.7..MAX_SCALE (drawn size: kittens ~0.75, big cats and wild hybrids by species: SPECIES). */
export function styleOf(traits) {
  const t = normalizeTraits(traits);
  const c = (k) => t[k] - 0.5;
  const kit = t.age === "kitten", old = t.age === "senior", fat = t.build === "chunky", slim = t.build === "slim";
  const short = t.legs === "short", big = t.size === "bigcat", blind = t.flags.includes("blind");
  const shy = Math.max(0, -c("bold")), sig = t.signature;
  const tempo = 1 - 0.2 * c("energy") + 0.08 * c("sleepy") - (kit ? 0.12 : 0) + (old ? 0.2 : 0) + (fat ? (kit ? 0.05 : 0.15) : 0) + (big ? 0.1 : 0) + (blind ? 0.1 : 0);
  const stride = 1 + 0.12 * c("grace") + 0.08 * c("energy") + 0.1 * Math.max(0, c("proud")) - 0.12 * shy
    + (slim ? 0.05 : 0) - (fat ? 0.05 : 0) - (short ? 0.06 : 0) - (kit ? 0.06 : 0) - (old ? 0.12 : 0) + (big ? 0.04 : 0) - (blind ? 0.06 : 0);
  const lift = 1 + 0.2 * c("energy") + 0.15 * c("grace") + 0.15 * Math.max(0, c("proud"))
    + (kit ? 0.18 : 0) - (old ? 0.18 : 0) - (fat ? (kit ? 0.05 : 0.15) : 0) - (short ? 0.1 : 0) - (blind ? 0.05 : 0); // a chubby kitten still bounces
  const bob = 1 + 0.4 * c("playful") + 0.3 * c("energy") - 0.5 * c("grace") - 0.2 * shy
    + (kit ? 0.3 : 0) - (old ? 0.2 : 0) + (fat ? 0.1 : 0) - (big ? 0.15 : 0) + (short ? 0.1 : 0);
  const sway = (fat ? 0.35 + 0.8 * Math.max(0, c("foodie")) - 0.3 * c("grace") : 0) + (short ? 0.2 : 0) + (big ? 0.25 : 0) + (old ? 0.1 : 0) + 0.15 * Math.max(0, c("proud"));
  const crouch = 0.5 * shy + 0.2 * Math.max(0, c("hunter")) + (blind ? 0.1 : 0) + (old ? 0.04 : 0) - 0.1 * Math.max(0, c("proud"));
  // Only fear tucks the tail: a grumpy or sleepy cat carries it low, not under.
  const carriage = 1.6 * c("proud") + 0.8 * c("social") + 0.3 * c("energy") - 0.4 * c("grumpy") - 0.2 * c("sleepy")
    + (kit ? 0.35 : 0) + (slim ? 0.08 : 0) - (old ? 0.1 : 0) - (big ? 0.15 : 0) - (blind ? 0.1 : 0);
  const tail = t.flags.includes("tailless") ? 0 : Math.max(-0.15, carriage) - 1.3 * shy;
  const head = 0.5 * c("proud") + 0.2 * c("bold") + 0.1 * c("curious") - 0.1 * c("hunter") - 0.1 * c("sleepy")
    + (kit ? 0.05 : 0) - (old ? 0.12 : 0) - (big ? 0.12 : 0) - (blind ? 0.15 : 0);
  // (A cat famous for a seated pose, the beckoning maneki-neko or a box-sitter, sits up for it,
  // however round it is.)
  const sitSig = ["beckon", "boxSit", "slowBlink", "stareDown", "headTilt", "popMouth", "blep"].includes(sig);
  const sitTall = Math.max(sitSig ? 0.6 : 0, 0.5 + 0.8 * c("proud") + 0.2 * c("bold") + 0.1 * c("curious") - 0.3 * c("sleepy") - (fat ? 0.15 : 0) - (old ? 0.1 : 0));
  const loafTuck = 0.5 + 0.8 * c("sleepy") - 0.4 * c("energy") - 0.3 * c("hunter") - 0.2 * c("bold") + (fat ? 0.1 : 0) - (big ? 0.3 : 0)
    + (sig === "loaf" ? 0.2 : 0) - (sig === "sphinxWatch" ? 0.25 : 0);
  const scale = Number.isFinite(t.scale) ? t.scale : kit ? 0.75 : t.size === "small" ? 0.88 : t.size === "large" ? 1.12 : 1;
  const s = (v, lo, hi) => r2(clamp(v, lo, hi));
  return {
    tempo: s(tempo, 0.8, 1.3), stride: s(stride, 0.85, 1.15), lift: s(lift, 0.7, 1.3), bob: s(bob, 0.6, 1.6),
    sway: s(sway, 0, 1), crouch: s(crouch, 0, 0.35), tail: s(tail, -0.4, 1), head: s(head, -0.3, 0.3),
    sitTall: s(sitTall, 0, 1), loafTuck: s(loafTuck, 0, 1), scale: s(scale, 0.7, MAX_SCALE),
  };
}
