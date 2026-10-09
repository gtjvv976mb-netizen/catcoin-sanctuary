# Handoff: where things stand (2026-10-09)

Read this first when you pick the project up, from any Claude account. Everything is on `main` of
`gtjvv976mb-netizen/catcoin-sanctuary`: no work is left on a branch or only on a laptop. How the site and the bots work
is in `README.md`; how a cat's 3D model is made is in `scripts/CAT-MODELS.md`. This file covers what is live, what is
waiting, and the owner's rules. The previous handoff is `handoff/HANDOFF-2026-10-01.md` (history only).

## 1. Picking it up from another account

- **The bots don't depend on any Claude account.** They are GitHub Actions in this repository, with its own secrets and
  variables (Settings → Secrets and variables → Actions), and they keep running whoever is signed in to Claude:
  - Announce: X posts, chained every 20 minutes.
  - Launch: coins on pump.fun.
  - Collection: proves coins on Solana, hourly.
  - Pages: deploys the site on every push to `main`.
  - Rewards, Trending, Trend watch, Famous, Models.
  
  Secret names: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `LAUNCH_WALLET_KEY`,
  `SOLANA_RPC_URL`, `ANTHROPIC_API_KEY`, `TRIPO_API_KEY` and `MESHY_API_KEY`. Never print or commit their values.
- **What the new account needs:**
  - **GitHub:** connect a GitHub account that can push to this repository (at https://claude.ai/connect-github), with
    the Claude GitHub App installed on the repository from that same page. If the other Claude account uses a
    different GitHub user, first add that user as a collaborator (repository Settings → Collaborators).
  - **The Higgsfield connector,** with credits, for portraits and 3D models: see section 3. The art made so far is
    already committed, so nothing on the old Higgsfield account is needed to keep going.
- **Not on GitHub, on purpose:**
  - `node_modules/`: run `npm ci` to get it back.
  - `scripts/.cat-models-cache/`: about 1.8 GB of raw model downloads. It is a cache; the packed models are
    committed in `assets/models/cats/`.
- **Checks:** `npm test` (Node 22) runs the whole suite: 1292 tests, all passing on 2026-10-09. The Pages workflow runs
  the same suite before every deploy, so a red test stops the site from updating.

## 2. Live state (2026-10-09, about 15:30 UTC)

- **Site:** https://catcoinsanctuary.com, about 320 residents (one row each in `data/traits.json`).
- **X (@catcosanctuary):** Announce posts at most one item every 60 minutes (`minGapMinutes` in `data/updates.json`).
  - **Order:** the sanctuary's own launch posts first, then adoptions, then queued updates.
  - **What a launch post waits for:**
    - its coin proved in `data/collection.json` (the hourly Collection run);
    - its fee route recorded (`feeRoute` in its `data/sanctuary-launches.json` row), when its fees go to an X
      account through UsePaid.
  - **Ledgers:** `data/updates.json` (`launchesPosted`, `lastPostedAt`) records what went out.
  - **Latest launch posts:** OREOCHAN at 10:35 and SHACHIHIME at 15:06. TORAHIKO's post is next, once the
    Collection proves its coin.
- **Launcher:**
  - **Settings:** `LAUNCH_ENABLED` is `on`, and `LAUNCH_MAX_PER_DAY` is 40. The SOL caps are the defaults: 0.03 a
    launch, 0.1 a day, and 0.02 left in the wallet.
  - **Today:** CALLIE, OREOCHAN, SHACHIHIME and TORAHIKO launched on 2026-10-09. FUKURA is prepared and goes next.
  - **The wallet:** a launch costs about 0.0057 SOL, plus the fee-route transaction. Watch the launch wallet's
    balance; its address is in `data/wallets.json`, labelled "Auto launcher". When it is low, routes and launches
    wait (a `::warning` in the Launch log).
- **Every new coin:**
  - its **website** is its UsePaid page, `https://usepaid.app/token/<mint>`;
  - its **twitter** link is the X post its cat's story came from;
  - its **creator fees** go to that post's account through UsePaid: a route transaction sent right after the launch,
    `routeFees` in `scripts/lib/launcher.mjs`;
  - accounts that are never paid (government, brands, media) are in `data/fee-exclusions.json`.
- **New-cat posts (the release queue):** all 186 cats in `data/release-queue.json` are posted, so the queue is empty
  until the cats in section 3 get their art.

## 3. Waiting on Higgsfield credits (0.38 credits left on 2026-10-09)

The announcer holds a cat off X until it has a proof, a portrait, a launch kit and an in-game shot. A queued cat also
needs its teaser silhouette (the teaser test fails otherwise). So each cat goes: art first, then the teaser, then the
release queue.

**Batch 4** (approved 2026-10-06). Done: portrait, kit, traits and real photo. Still needed: the HD model, the in-game
shot and the teaser, and then put the cat back in `data/release-queue.json` (it was taken out on purpose):
SANJURO, KURONOSUKE, TENCHAN, SCHNITZCAT, LEEUCAT, BACONTAMA, HADJICAT, NIBLO, LIESL and LURKLARRY.

**Batch 5** (approved 2026-10-08). Done: research, site data, real photos (except DROPNEKO, which has none), teaser
hints and trait corrections. Still needed: portrait, kit, HD model, in-game shot and teaser, and then queue the cat:
GOOTENGU, BOSSMETO, NELSONPUB, NACHOFLAY, WXBETTY, MUKUSAMA, FUZZCAT, GEUMDONG, DROPNEKO, SHIROAN, OAGECAT and ANKOCAT.
Before anything launches for DROPNEKO, check she is alive: the newest coverage found is from 2017.

How to make the art, step by step:
1. **Portrait and model:** follow `scripts/CAT-MODELS.md`, "2026-10-03: the squared stance", which is the current
   method. For each cat:
   - a realistic portrait from the proof photo, cropped to the cat, no people: `gpt_image_2_5`, high, 1:1;
   - a squared standing 3/4 reference: 4:3;
   - four squared orthographic views, in the order front, left, back, right;
   - `generate_3d` with `tripo_h3_1_multiview_to_3d` and detailed settings, about 21 credits.
   
   Crops go up with `media_upload` (a presigned PUT), then `media_confirm`. Pack the model into
   `assets/models/cats/<TICKER>.glb` and `-lo.glb`, and check it stands on four legs (`tests/catlegs.test.mjs`).
2. **Kit:** run `python3 scripts/build-kits.py TICKER…`.
3. **In-game shot:** run `node scripts/capture-ingame.mjs TICKER…`, then look at the shot before committing it.
4. **Teaser:** run `node scripts/build-teasers.mjs`.
5. **Release:** add `{ "key": "<TICKER>", "approved": true, "added": "<date>" }` to `data/release-queue.json`.

## 4. The owner's standing rules (binding)

- **Never put a usepaid.app link in an X post.** X refuses the domain ("The Tweet contains an invalid URL").
  - A launch post names the account instead: "💸 Fees go to the creator, @handle via UsePaid".
  - The UsePaid page goes in the coin's website field only.
  - A post that X refuses for a link is held at once (status `held`, rule `x_link` in `data/updates.json`), not
    retried.
- **Real cats only.** `LAUNCH_CHARACTERS` stays off; a drawn or fictional cat never launches.
- **Research (the scout):**
  - It is read-only on the web and never invents anything; every story has a proof link.
  - It takes no private people's pets, no minors, nothing harmful and no politics.
  - It writes only `data/research/inbox.json` and `data/research/log.json`.
  - The owner approves each cat ("all" has meant all of a round).
  - There are 8 old pending candidates from 2026-09-30: characters or sensitive cases, left for the owner.
- **Dead cats launch as tributes** ("In loving memory of <name>."). Their keys go in `MEMORIAL` in
  `scripts/build-adoptables.mjs`.
- **Trait corrections** go in `TRAIT_OVERRIDES` (`assets/world/traits.js`), each with a note saying which line of the
  story was misread. Rebuild with `node scripts/build-traits.mjs`.
- **Size budgets** live in the tests, and each raise has a dated note:
  - `tests/site.test.mjs`: the page's own scripts are at most 1170 KB. They measured 1166.4 KB on 2026-10-08, so the
    next batch's trait notes will need trimming or a raise.
  - `tests/traits.test.mjs`: `data/traits.json` is at most 190 KB, enough for about 35 more residents.
- **How changes land:** work on a branch, open a PR and merge it. The owner has had Claude merge each PR. Run
  `npm test` before pushing.

## 5. What changed lately (newest first)

- **2026-10-09, PR #66.** A coin's fee route is now recorded in the run that sends it, and launch posts no longer wait
  hours.
  - **The bug:** the route was read back at "finalized" right after it was only "confirmed", so it was missed. It
    was then retried only when the next coin launched.
  - **The fix:** it is now read at "confirmed", and `prepare` reports pending work while a route is due, so the next
    Launch run routes it even with no cat to launch.
- **2026-10-08, PRs #64 and #65.** Research round 5 (12 cats), all approved as batch 5.
- **2026-10-08, PR #63.** KIKI's launch post was retried once its card was on the site.
- **2026-10-08, PR #62.** A garden cat stuck twice in the same spot now acts where it stands. This was blocking Pages
  (`tests/cats.test.mjs`).
- **2026-10-08, PR #61.** Posting had stopped because X refused usepaid.app links. The link left the posts, the 13
  stuck launch posts were retried, and a post X refuses for a link is now held at once.
- **2026-10-07, PRs #59 and #60.** Each coin's website is its UsePaid page, and its twitter link is its lore X post.
- **PR #58.** A flaky mint-grinder test was fixed.
- **PR #57.** Batch 4 shipped with portraits only (models wait on credits).

## 6. Known limits and open ideas (none started)

- **Launches are sparse.** GitHub runs Launch's 20-minute schedule only every few hours, so coins launch, and launch
  posts follow, only a few times a day. Announce gets around this by chaining itself (its `next` job). Launch could do
  the same, but that means more launches and more SOL (still within the caps), so ask the owner first. You can always
  start a run by hand from the Actions tab.
- **Garden.** The reviewers of PR #62 suggested tightening the pinned-cat rule in `assets/world/cats.js`. It is
  optional.
- **A testing hazard.** Never symlink `data/` into a scratch copy of the repo to run tests there.
  `tests/launcher.test.mjs` `site()` copies `data/` with `fs.cpSync`, which copies a symlink as a symlink, so the
  fixtures then overwrite the live data files. This happened once on 2026-10-09 (local only, restored). Copy the files,
  or use `git worktree` instead.

## 7. Quick health check ("is it posting?")

1. **Announce:** the Actions tab should show a run every 20 minutes, each green.
2. **Last post:** check `data/updates.json` `lastPostedAt`. More than about an hour old only matters if something is
   waiting, so look at the next three steps.
3. **Unposted coins:** compare `data/sanctuary-launches.json` rows with `"status": "launched"` against
   `launchesPosted`. A launched coin with no post is waiting for its `feeRoute` (a Launch run records it) or for its
   proof in `data/collection.json` (the hourly Collection run).
4. **Release queue:** check `data/release-queue.json` for cats not yet `released`. Each needs its art (section 3).
5. **Errors:** a failed or `held` row in `data/updates.json` carries the error. The Announce log names it with
   `::error::`.
