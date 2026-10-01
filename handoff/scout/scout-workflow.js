export const meta = {
  name: 'scout-new-cats',
  description: 'Sweep X and the web for new famous/trending cats, verify each with X + web proof, adversarially check, return inbox-ready records',
  phases: [
    { title: 'Sweep', detail: '10 finders, each a different angle' },
    { title: 'Verify', detail: 'build a full, sourced record per candidate' },
    { title: 'Skeptic', detail: 'two lenses try to refute each record' },
    { title: 'Critic', detail: 'what trending cats did the sweep miss?' },
  ],
}

const EXISTING = args.existingPath
const NOW = args.now, TODAY = args.today

const RULES = `You are part of the Catcoin Sanctuary research team. Hard rules:
- READ-ONLY on the web: search and fetch only. Never post, like, reply or DM anywhere; never fill forms, never connect wallets, never sign anything.
- Never invent anything: every fact must come from a page you fetched in this task.
- Do not write or edit any file. Do not commit.
- Fan tributes only: cats with public fame (their own account, official account, press coverage). Skip anything involving a tragic death, harm, minors or politics.
- Web tools (WebSearch, WebFetch) may be deferred: load them with ToolSearch ("select:WebSearch,WebFetch") before use.
- To read an X post, fetch https://api.fxtwitter.com/<handle>/status/<id> (JSON: tweet.text, tweet.author.screen_name, tweet.created_at, tweet.media.photos[0].url).
- Already in the sanctuary (skip these; match name AND owner, case-insensitively): read the JSON file ${EXISTING} (its "names" list). Also skip Garfield and Morgana.`

const CAT = ['company', 'celebrity', 'tv-movie', 'crypto', 'viral']

const ANGLES = [
  { key: 'viral-now', prompt: 'Cats going viral on X in the last 3-4 weeks (September 2026): trending cat videos, news cats, meme cats of the month. Search X-related news, "viral cat" September 2026, trending topics lists, cat meme roundups.' },
  { key: 'sports-live', prompt: 'Cats in sports and live TV: cats that ran onto pitches/courts/fields, team or stadium cats, cats at press conferences or live broadcasts, racing/cricket/baseball/football club cats (2024-2026), with an official team/league/broadcaster X post.' },
  { key: 'workplaces', prompt: 'Working cats with official X accounts: bookshop, library, museum, hotel, pub, brewery, distillery, ferry, embassy, parliament-adjacent (non-political) office, shop and station cats worldwide.' },
  { key: 'east-asia', prompt: 'Famous cats in Japan, Korea, Taiwan, Hong Kong and China with an X presence: station-master cats, temple and shrine cats, shop cats, café cats, idol cats of Japanese X, Korean viral cats.' },
  { key: 'europe-world', prompt: 'Famous cats in Europe, Turkey, the Middle East, Latin America, Africa and Oceania with an X presence: Istanbul cats, museum cats (Hermitage etc.), Brazilian/Mexican/Argentinian viral cats, Australian/NZ famous cats.' },
  { key: 'celebrity', prompt: 'Cats of celebrities, musicians, actors, athletes, streamers and YouTubers, shown and named on the celebrity\'s own X account (2023-2026), well covered by press.' },
  { key: 'screen', prompt: 'Cat characters from films, TV series and anime, especially 2025-2026 releases and currently airing shows, with an official X account post showing the cat.' },
  { key: 'games', prompt: 'Cat characters and mascots in video games (2023-2026 releases and popular classics) with an official game/studio X post showing the cat.' },
  { key: 'crypto', prompt: 'Cats that are a crypto project\'s documented mascot or a well-known crypto founder\'s/personality\'s pet, shown on X. (Skip any cat whose existing coin has a market cap over $50,000.)' },
  { key: 'internet-classics', prompt: 'Long-running internet-famous cats and meme-template cats with their own X account or a big official post (Instagram/TikTok stars, meme cats like reaction-image cats), not yet in the sanctuary.' },
]

const FIND = {
  type: 'object', required: ['candidates'],
  properties: { candidates: { type: 'array', items: { type: 'object', required: ['catName', 'owner', 'category', 'why', 'xPostUrls'],
    properties: {
      catName: { type: 'string' }, owner: { type: 'string' }, category: { type: 'string', enum: CAT },
      why: { type: 'string', description: 'one line: why famous now, with the source' },
      xPostUrls: { type: 'array', items: { type: 'string' }, description: 'x.com/<handle>/status/<id> URLs you checked show or name the cat' },
      webUrls: { type: 'array', items: { type: 'string' } },
      trendingNow: { type: 'boolean' },
    } } } },
}

const RECORD = {
  type: 'object', required: ['ok', 'reason'],
  properties: {
    ok: { type: 'boolean', description: 'true only if fully verified and fits every rule' },
    reason: { type: 'string' },
    record: { type: 'object', required: ['id', 'catName', 'owner', 'category', 'story', 'look', 'proof', 'existingCoin', 'suggestedName', 'suggestedTicker', 'pairSuggestion', 'sensitivity', 'confidence'],
      properties: {
        id: { type: 'string', description: 'lowercase-kebab id' }, catName: { type: 'string' }, owner: { type: 'string' },
        category: { type: 'string', enum: CAT },
        story: { type: 'string', description: '40-900 chars, only facts from the fetched sources' },
        look: { type: 'string', description: 'precise coat/eyes/ears/build/accessories from the photos' },
        proof: { type: 'object', required: ['x', 'web'], properties: {
          x: { type: 'array', items: { type: 'object', required: ['url', 'handle', 'date', 'text', 'verifiedVia'], properties: {
            url: { type: 'string' }, handle: { type: 'string' }, date: { type: 'string' }, text: { type: 'string', description: 'the post text EXACTLY as api.fxtwitter.com returns it' },
            photo: { type: ['string', 'null'] }, verifiedVia: { type: 'string' } } } },
          web: { type: 'array', items: { type: 'object', required: ['title', 'url'], properties: { title: { type: 'string' }, url: { type: 'string' } } } } } },
        existingCoin: { type: ['object', 'null'], properties: { symbol: { type: 'string' }, contract: { type: 'string' }, mcap: { type: 'number' } } },
        suggestedName: { type: 'string' }, suggestedTicker: { type: 'string', description: 'A-Z0-9, 3-10 chars' },
        pairSuggestion: { type: 'string' }, sensitivity: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      } },
  },
}

const VERDICT = {
  type: 'object', required: ['refuted', 'problems'],
  properties: { refuted: { type: 'boolean' }, problems: { type: 'array', items: { type: 'string' } } },
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
const keyOf = (c) => norm(c.catName)

const verifyPrompt = (c) => `${RULES}

Verify this candidate cat and, if it holds up, build its full inbox record.
Candidate: ${JSON.stringify(c)}

Steps:
1. Check it is not already in ${EXISTING} (name AND owner). If it is, ok=false.
2. For at least one X status URL: fetch https://api.fxtwitter.com/<handle>/status/<id>. The post must show or name the cat. Record handle (with @), date (created_at as YYYY-MM-DD), text EXACTLY as returned (character for character), photo = media.photos[0].url if any else null, verifiedVia: "api.fxtwitter.com ${TODAY}". Prefer the cat's own/official account. If no X post verifies, you may search for another; otherwise ok=false.
3. At least one reliable web source (official site, Wikipedia, reputable news). Never a trading/token page (GMGN, pump.fun, DexScreener, Birdeye...). Fetch it; the story must use only facts from the fetched X post(s) and web page(s).
4. Existing coins: fetch https://api.dexscreener.com/latest/dex/search?q=<cat name> and https://lite-api.jup.ag/tokens/v2/search?query=<cat name>. If a coin clearly for this cat has market cap > $50,000: ok=false (say so). If one exists at <= $50,000, set existingCoin {symbol, contract, mcap}; else null.
5. suggestedName (the cat's name, plus owner if it helps) and suggestedTicker (A-Z/0-9, 3-10 chars): must not be in the "tickers" list of ${EXISTING} and must not be taken on Jupiter (search the ticker). pairSuggestion: "STONK" unless the owner is a public company listed on StonkFun.
6. look: precise description from the photos. sensitivity: anything to handle with care (died - with date and source; illness; controversy), else "". confidence: high (official account + solid source), medium, or low. id: lowercase-kebab.
7. ok=true only if everything above holds and it respects the hard rules; confidence "low" means ok=false.`

const evidencePrompt = (r) => `${RULES}

You are a skeptic. Try hard to REFUTE this research record on EVIDENCE. Default to refuted=true if you cannot confirm.
Record: ${JSON.stringify(r)}
Check: (a) fetch each proof.x url via api.fxtwitter.com: the handle, date and text must match EXACTLY and the post must show or name this cat; (b) fetch at least one proof.web url: it must support the story's facts (every fact in the story must be in a fetched source); (c) the web source is reliable (not a trading/token page); (d) DexScreener/Jupiter: no coin for this cat with market cap over $50,000.
List every problem. refuted=true if any fact is unsupported, the X text does not match, or a coin is over $50k.`

const fitPrompt = (r) => `${RULES}

You are a skeptic. Try hard to REFUTE this research record on FIT. Default to refuted=true if unsure.
Record: ${JSON.stringify({ id: r.id, catName: r.catName, owner: r.owner, category: r.category, story: r.story, sensitivity: r.sensitivity, suggestedTicker: r.suggestedTicker, existingCoin: r.existingCoin })}
Check: (a) is this cat (same cat, even under another name or owner spelling) already in ${EXISTING}? (b) does it involve a tragic death, harm, minors or politics (a politician's cat is politics only if the story is about the politics)? (c) is it a private person's pet with no public fame? (d) is suggestedTicker (A-Z0-9, 3-10 chars) free: not in the file's "tickers" list and not taken on Jupiter (https://lite-api.jup.ag/tokens/v2/search?query=<ticker>)? (e) is the category right?
refuted=true for (a), (b), (c) or a taken ticker. List every problem.`

// ── Sweep: every angle in parallel; each finder is blind to the others ──
phase('Sweep')
const found = await parallel(ANGLES.map((a) => () => agent(`${RULES}

Find NEW famous cats for the sanctuary from this angle: ${a.prompt}
Aim for 6-10 strong candidates. For each, you must have checked at least one X status URL (via api.fxtwitter.com) that shows or names the cat. Prefer cats trending now and cats with an official or their own account. Return only cats NOT already in ${EXISTING}.`, { label: `find:${a.key}`, phase: 'Sweep', schema: FIND })))

const seen = new Map()
for (const r of found.filter(Boolean)) for (const c of r.candidates || []) {
  const k = keyOf(c)
  if (!k || seen.has(k)) continue
  seen.set(k, c)
}
log(`${seen.size} distinct candidates from ${found.filter(Boolean).length} finders`)

const checkAll = (cands) => pipeline(cands,
  (c) => agent(verifyPrompt(c), { label: `verify:${c.catName}`, phase: 'Verify', schema: RECORD }),
  async (v, c) => {
    if (!v || !v.ok || !v.record) return { cat: c.catName, ok: false, reason: v ? v.reason : 'verifier failed' }
    const [e, f] = await parallel([
      () => agent(evidencePrompt(v.record), { label: `evidence:${c.catName}`, phase: 'Skeptic', schema: VERDICT }),
      () => agent(fitPrompt(v.record), { label: `fit:${c.catName}`, phase: 'Skeptic', schema: VERDICT }),
    ])
    const problems = [...(e ? e.problems : ['evidence skeptic failed']), ...(f ? f.problems : ['fit skeptic failed'])]
    const ok = e && f && !e.refuted && !f.refuted
    return { cat: c.catName, ok, reason: ok ? 'verified' : problems.join('; '), record: v.record, problems }
  })

let results = await checkAll([...seen.values()])

// ── Completeness critic: what did the sweep miss? one more round on its picks ──
phase('Critic')
const kept = results.filter((r) => r && r.ok).map((r) => r.record.catName)
const critic = await agent(`${RULES}

A sweep for famous and trending cats (angles: ${ANGLES.map((a) => a.key).join(', ')}) found these candidates: ${[...seen.values()].map((c) => c.catName).join(', ')}.
What notable cats did it miss? Think about cats trending on X right now (late September 2026), big news cats of 2025-2026, and famous cats from angles not listed. Return up to 10 candidates NOT in that list and NOT in ${EXISTING}, each with an X status URL you checked via api.fxtwitter.com.`, { label: 'critic', phase: 'Critic', schema: FIND })
const extra = (critic ? critic.candidates : []).filter((c) => { const k = keyOf(c); if (!k || seen.has(k)) return false; seen.set(k, c); return true })
log(`critic added ${extra.length} candidates`)
if (extra.length) results = results.concat(await checkAll(extra))

const ok = results.filter((r) => r && r.ok)
// one ticker per cat: drop a later record whose ticker repeats (reported)
const tick = new Set(), final = [], dup = []
for (const r of ok) { const t = r.record.suggestedTicker; if (tick.has(t)) dup.push(r.cat); else { tick.add(t); final.push(r.record) } }
if (dup.length) log(`ticker clash, dropped: ${dup.join(', ')}`)
return {
  searched: seen.size,
  verified: final,
  rejected: results.filter((r) => r && !r.ok).map((r) => ({ cat: r.cat, reason: r.reason })),
  tickerClashes: dup,
}