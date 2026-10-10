# Handoff: where things stand (2026-10-09)

Read this first when you pick the project up, from any Claude account. Everything is on `main` of
`gtjvv976mb-netizen/catcoin-sanctuary`. The older remote branches are superseded: `hd-work`, `handoff/2026-09-26`,
`claude/meshy-models` and `claude/gifted-ritchie-qnt9jb`.

- How a cat's 3D model is made is in `scripts/CAT-MODELS.md`.
- How the site and bots work is in `README.md`, but README is out of date on the money path (section 6). Where they
  disagree, this file and `terms.html` are right.
- The previous handoff is `handoff/HANDOFF-2026-10-01.md` (history only).

## 1. Picking it up from another account

- **The bots don't depend on any Claude account.** They are GitHub Actions in this repository, with its own secrets and
  variables (Settings → Secrets and variables → Actions):
  - **Announce:** X posts, chained every 20 minutes.
  - **Launch:** coins on pump.fun.
  - **Collection:** proves coins on Solana, hourly.
  - **Pages:** deploys the site on every push to `main`.
  - **Trending, Trend watch and Famous coins.**
  - **Rewards and Models** run but do nothing yet (section 2).
  
  Secret names: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `LAUNCH_WALLET_KEY`,
  `SOLANA_RPC_URL`, `ANTHROPIC_API_KEY`, `TRIPO_API_KEY` and `MESHY_API_KEY`. Never print or commit their values.
- **What the new account needs:**
  - **GitHub:** connect a GitHub account that can push to this repository (at https://claude.ai/connect-github), with
    the Claude GitHub App installed on the repository from that same page. If the other Claude account uses a
    different GitHub user, first add that user as a collaborator (repository Settings → Collaborators).
  - **The Higgsfield connector,** with credits, for portraits and 3D models (section 3). The art made so far is
    committed, so nothing on the old Higgsfield account is needed.
- **A fresh machine:**
  - `npm ci` installs only what `package-lock.json` lists.
  - The art steps also need **Pillow and numpy** for Python, **gltfpack** (`npm i gltfpack` after `npm ci`, which
    would remove it), and **Playwright with Chromium** for `capture-ingame.mjs` and `build-teasers.mjs`.
  - `scripts/.cat-models-cache/` (about 1.8 GB of raw model downloads) is git-ignored. It is a cache; the packed
    models are in `assets/models/cats/`.
- **Checks:**
  - `npm test` (Node 22) runs the whole suite. The Pages workflow runs it before every deploy, so a red test stops the
    site from updating.
  - Tests remove their temp folders since 2026-10-09; before that, each run left hundreds in `/tmp`.

### How to stop things

| What | How |
|---|---|
| Launches and SOL spending | Repository variable `LAUNCH_ENABLED` to anything but `on`/`dry` |
| X posting | `"dryRun": true` in `data/announce-config.json`, or disable the Announce workflow |
| Rewards payouts | `REWARDS_ENABLED`. Disabling the Rewards workflow alone does not stop it: see `rewards.yml` |

`ANNOUNCE_CHAIN` set to `off` only stops Announce from chaining itself; its schedule still posts.

## 2. Live state (2026-10-09, about 16:50 UTC)

- **Site:** https://catcoinsanctuary.com, about 320 residents (one row each in `data/traits.json`).
- **X (@catcosanctuary), two posters in the Announce run:**
  - **`scripts/announce.mjs`** releases one queued cat every 60 minutes (`releaseEveryMinutes` in
    `data/announce-config.json`), with a proof reply.
  - **`scripts/post-updates.mjs`** posts one item every 60 minutes (`minGapMinutes` in `data/updates.json`), at least
    15 minutes after the announcer. Its order:
    1. updates marked `first: true`;
    2. the sanctuary's own launch posts, with tickers in `launchesFirst` ahead of the rest;
    3. adoptions;
    4. queued updates.
- **What a launch post waits for:**
  - its coin proved in `data/collection.json` (the hourly Collection run);
  - its fee route recorded (`feeRoute` in its `data/sanctuary-launches.json` row), when its fees go to an X account
    through UsePaid.
- **Recent launch posts:** OREOCHAN at 10:35, SHACHIHIME at 15:06 and TORAHIKO at 16:22. FUKURA, proved and routed,
  is next.
- **The launcher:**
  - **Settings:** `LAUNCH_ENABLED` is `on`, and `LAUNCH_MAX_PER_DAY` is 40. The SOL caps are the defaults: 0.03 a
    launch, 0.1 a day, and 0.02 left in the wallet.
  - **Today:** five coins launched on 2026-10-09: CALLIE, OREOCHAN, SHACHIHIME, TORAHIKO and FUKURA. None is in
    flight.
  - **The wallet:** a launch costs about 0.0057 SOL, plus the fee-route transaction. Watch the launch wallet's
    balance; its address is in `data/wallets.json`, labelled "Auto launcher". When it is low, routes and launches
    wait (a `::warning` in the Launch log).
- **What gets launched.** Most launches are the sanctuary's own cats: 44 of 54 so far, launched from their X post.
  Trending cats also launch with no approval while `LAUNCH_OPEN` is on (the default):
  - a real pet in a viral or rising X post;
  - any cat a big account names.
  
  That path has launched 7 coins: 5 named by a big account and 2 from viral posts. Every other trending cat waits
  for the owner to list its post in `data/launch-approvals.json` (3 so far). See `launch.yml`'s header.
- **A coin with a fee account** (`feesTo`: the X account its cat's story came from, unless excluded):
  - its **website** is its UsePaid page, `https://usepaid.app/token/<mint>`;
  - its **twitter** link is that X post;
  - its **creator fees** go to that account through UsePaid: a route transaction right after the launch, `routeFees`
    in `scripts/lib/launcher.mjs`.
  
  A coin without one has its sanctuary card as its website and is a pump.fun holder-rewards coin. That happens when
  the account is in `data/fee-exclusions.json`, its handle contains "gov", or `LAUNCH_FEES_TO` is `holders`.
- **Rewards and Models do nothing yet.**
  - **Rewards:** `REWARDS_ENABLED` is not on, so $CATSANC holders have been paid nothing (`data/rewards/state.json`
    has no period).
  - **Models:** the workflow makes nothing while `MODELS_GENERATOR` is unset; models are made by hand through
    Higgsfield.
- **New-cat posts:** all 186 cats in `data/release-queue.json` are posted (`status: "released"`), so the queue is
  empty until the cats in section 3 get their art.

## 3. Waiting on Higgsfield credits (0.38 credits left on 2026-10-09)

The announcer holds a cat off X until its adoptable row has a portrait, plus a launch kit and an in-game shot. A
queued cat also needs its teaser silhouette (the teaser test fails otherwise).

A whole cat costs about 27 credits (the recent entries in `scripts/cat-models.jobs.json`). The 26 cats below come to
roughly 700 credits.

**Batch 4** (approved 2026-10-06). Done: portrait, kit and traits. Each also has a real photo except NIBLO, which has
neither a photo nor a reason recorded. Still needed: the HD model, the in-game shot and the teaser, and then queue the
cat (it was taken out on purpose): SANJURO, KURONOSUKE, TENCHAN, SCHNITZCAT, LEEUCAT, BACONTAMA, HADJICAT, NIBLO, LIESL
and LURKLARRY.

**Batch 5** (approved 2026-10-08). Done: site data, real photos (except DROPNEKO: the posts that name her show other
cats), teaser hints and trait corrections. Still needed: portrait, kit, HD model, in-game shot and teaser, then queue
the cat: GOOTENGU, BOSSMETO, NELSONPUB, NACHOFLAY, WXBETTY, MUKUSAMA, FUZZCAT, GEUMDONG, DROPNEKO, SHIROAN, OAGECAT and
ANKOCAT. Before anything launches for DROPNEKO, check she is alive: the newest coverage found is from 2017.

**Four launched cats with no art at all:** BOOKCAT, KIKI, BARCAT and CALLIE. They are trending cats that the launcher
launched, with no portrait, model or in-game shot. They are in `scripts/meshy.queue.json`. Make them from their
launch posts' photos, as `scripts/CAT-MODELS.md` "2026-10-06 (evening)" did for Scroll, King, Milkbelly and Le Chonk.

How to make the art, per cat:
1. **Portrait** (batch 5 and the four launched cats). Follow `scripts/CAT-MODELS.md`, "2026-10-03: the squared
   stance", which is the current method:
   - A realistic portrait from the proof photo, cropped to the cat, no people: `gpt_image_2_5`, high, 1:1.
   - Save it as `assets/portraits/<TICKER>.jpg`.
   - Rebuild with `node scripts/build-adoptables.mjs data/research/adoptables-source.json`. The adoptable row's
     `portrait` field is what the site and the announcer read; the file alone is not enough.
2. **Model:**
   - A squared standing 3/4 reference (4:3).
   - Four squared orthographic views, in the order front, left, back, right.
   - `generate_3d` with `tripo_h3_1_multiview_to_3d` and detailed settings. Crops go up with `media_upload` (a
     presigned PUT), then `media_confirm`.
   - Add a job entry in `scripts/cat-models.jobs.json` like FUKURA's: `url`, status `done`, `hd: true`, `si 0.02`,
     `si_lo 0.003`, `tex 1024`, `tex_lo 256`, `q 88`, and `stance: "square"`. Without `stance`,
     `tests/catlegs.test.mjs` does not check its leg count.
   - Pack with `python3 scripts/make-cat-models.py --gltfpack node_modules/.bin/gltfpack TICKER…` into
     `assets/models/cats/<TICKER>.glb` and `-lo.glb`.
3. **Kit:** run `python3 scripts/build-kits.py TICKER…`.
4. **In-game shot:** run `node scripts/capture-ingame.mjs TICKER…`, then look at the shot before committing it.
5. **Teaser:** run `node scripts/build-teasers.mjs TICKER…`. Name the tickers: with no argument it only draws cats
   already queued.
6. **Release:** add `{ "key": "<TICKER>", "approved": true, "added": "<date>", "shown": true }` to
   `data/release-queue.json`. `shown: true` is needed because these cats are already on the site; without it the site
   hides the cat until its X post goes out.

## 4. Decision for the owner: fees paid to public bodies and companies

The owner's rule (the note in `data/fee-exclusions.json`, 2026-10-02) is that government and public bodies, companies
and brands, and news and media are never paid. The list matches exact handles only, and some got through.

**Already routed.** These routes are permanent and cannot be undone:
- @VPDHorses: CHEDDARVPD, Vancouver Police Department Mounted Unit.
- @TroyMI_Police: PAWFFICER, Troy Police Department.
- @CommonsSpeaker: ATTLEECAT, the Speaker of the House of Commons.
- @bijutsu1: KENCHAN, Onomichi City Museum of Art.
- @MistralAI: LECHONKCAT.
- @castleandkey: RICKKEY, a distillery.
- @qnote_inc: FUTABACAT, a company.
- @TheStourbridge: STOURCAT, a railway station account.

**The waiting cats would pay these accounts** when they launch, unless the accounts are added to the list first:
- @GLFOP: FUZZCAT, a police lodge. Its owner is the Fort Smith Police Department.
- @hisyo_takahashi: SANJURO, the Takahashi City tourism office.
- @AQuietPlace: SCHNITZCAT, a Paramount film.
- @movie_n_NEW: GEUMDONG, a film distributor.
- @KlockworxInfo: DROPNEKO, a film distributor.
- @nekojiimovie: BACONTAMA, a film's official account.
- @YumejiArtMuseum: KURONOSUKE.
- Businesses: @sirakababbq (GOOTENGU), @NLstaff (BOSSMETO) and @TappingAdmiral (NELSONPUB).

**The owner's answer (2026-10-10):** "just route the fees to the x creator page, regardless". Nothing is added to
`data/fee-exclusions.json`: these coins pay the account their story came from, public body, company or not
(HORATIOCAT's fees went to @CentreCoLibrary that day). The accounts already on the list stay on it until the owner
says otherwise. The owner also chose @elonmusk, through UsePaid, for SILKSTRIPE's fees.

## 5. The owner's standing rules (binding)

- **Never put a usepaid.app link in an X post.** X refuses the domain ("The Tweet contains an invalid URL").
  - A launch post names the account instead: "💸 Fees go to the creator, @handle via UsePaid".
  - The UsePaid page goes in the coin's website field only.
  - A post that X refuses for a link is held at once (status `held`, rule `x_link`), not retried. To post it again
    after fixing the cause, delete its row in `launchesPosted`/`adoptionsPosted` in `data/updates.json`, or set an
    update's `status` back to `queued`. PRs #61 and #63 did this.
- **Real cats only.** `LAUNCH_CHARACTERS` stays off; a drawn or fictional cat never launches.
  - **The one exception (2026-10-10):** the owner asked for Schrödinger's Cat (ticker CAT1935), the cat of the 1935
    thought experiment, for the quantum meta on pump.fun. It launches from the sanctuary's own X post (so it is a
    holder-rewards coin and nobody is paid), approved with `"character": true` in `data/launch-approvals.json`. That
    flag works for one post only and never for the sanctuary's own cats; nothing else changed.
- **Research** follows the scout's hard rules in `.claude/commands/scout.md`:
  - it is read-only on the web and invents nothing;
  - it writes only `data/research/inbox.json` and `log.json`;
  - it takes no cats of private people;
  - it is careful with cats that have died, and skips anything involving harm, minors or tragedy.
  
  The owner approves cats with `npm run scout:review` ("all" has meant all of a round). There are 8 pending
  candidates from 2026-09-30, characters or sensitive cases, left for the owner.
- **Dead cats launch as tributes** ("In loving memory of <name>."). `MEMORIAL` in `scripts/build-adoptables.mjs`
  holds research ids, not tickers: DROPNEKO is `drop`, HADJICAT is `hadji-keith-hernandez`.
- **Trait corrections** go in `TRAIT_OVERRIDES` (`assets/world/traits.js`), each with a note saying which line of the
  story was misread. Rebuild with `node scripts/build-traits.mjs`.
- **Size budgets** live in the tests, and each raise has a dated note:
  - `tests/site.test.mjs`: the page's own scripts are at most 1170 KB. They measured 1166.4 KB on 2026-10-08, so the
    next batch's trait notes will need trimming or a raise.
  - `tests/traits.test.mjs`: `data/traits.json` is at most 190 KB, enough for about 35 more residents.
- **How changes land:** work on a branch, open a PR and merge it. The owner has had Claude merge each PR. The bots
  commit to `main` all the time, so merge `main` in and run `npm test` before pushing.

## 6. What changed lately (newest first)

- **2026-10-09, PR #67 and this follow-up.** This handoff and `CLAUDE.md`. The temp-folder cleanup for tests, from
  the branch `claude/nifty-albattani-o9hq1b`, is merged.
- **2026-10-09, PR #66.** A coin's fee route is now recorded in the run that sends it.
  - **The bug:** the route was read back at "finalized" right after it was only "confirmed", so it was missed. It
    was then retried only when the next coin launched, so launch posts waited hours.
  - **The fix:** it is now read at "confirmed", and `prepare` reports pending work while a route is due.
- **2026-10-08, PRs #64 and #65.** Research round 5 (12 cats), all approved as batch 5.
- **2026-10-08, PR #63.** KIKI's launch post was retried once its card was on the site.
- **2026-10-08, PR #62.** A garden cat stuck twice in the same spot now acts where it stands. This was blocking Pages.
- **2026-10-08, PR #61.** Posting had stopped because X refused usepaid.app links. The link left the posts, the 13
  stuck posts were retried, and a refused link is now held at once.
- **2026-10-07, PRs #59 and #60.** A coin's website is its UsePaid page, and its twitter link is its lore X post.
- **PR #58** fixed a flaky mint-grinder test. **PR #57** shipped batch 4 with portraits only.
- **README is stale on fees.** It says creator fees go to $CATSANC holders and gives an old `LAUNCH_MAX_PER_DAY`
  clamp, and it never mentions UsePaid. Updating it is open work.

## 7. Known limits and open ideas (none started)

- **Launches are sparse.** GitHub runs Launch's 20-minute schedule only every few hours. Announce gets around this by
  chaining itself (its `next` job). Launch could do the same, but that means more launches and more SOL (still within
  the caps), so ask the owner first. A run can always be started by hand from the Actions tab.
- **Posting failures can look green.** `post-updates.mjs` catches every posting error, so an Announce run stays green
  even while X refuses every post. That is how the 2026-10-06 to 10-08 outage went unnoticed for a while. Use the
  health check below, not the run colour.
- **Garden.** The reviewers of PR #62 suggested tightening the pinned-cat rule in `assets/world/cats.js`. It is
  optional.
- **A testing hazard.** Never symlink `data/` into a scratch copy of the repo to run tests there.
  - `tests/launcher.test.mjs` `site()` copies `data/` with `fs.cpSync`, which copies a symlink as a symlink.
  - The fixtures then overwrite the live data files and delete `data/rewards/`.
  - This happened once on 2026-10-09 (local only, restored with `git checkout -- data`).

## 8. Quick health check ("is it posting?")

1. **Last post:** check `data/updates.json` `lastPostedAt`. More than about an hour old only matters if something is
   waiting, so look at the next three steps.
2. **Unposted coins:** list `data/sanctuary-launches.json` rows with `"status": "launched"` whose `launchesPosted` row
   is missing or not `"posted"`. A row can exist and be `posting`, `failed` or `held`. For each one:
   - **No `feeRoute`:** a Launch run records it, so start one from the Actions tab.
   - **Mint not in `data/collection.json`:** the hourly Collection run proves it.
   - **`failed` or `held`:** read its `error` or `violations`.
3. **New cats:** check `data/release-queue.json` for entries whose `status` is not `"released"`. Each needs its art
   (section 3).
4. **The Announce log:** look for `::warning::` and `::error::` lines. Only an X link refusal logs `::error::`; other
   failed or held posts log `::warning::`.
