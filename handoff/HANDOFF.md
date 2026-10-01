# Handoff: where the last session stopped (2026-10-01, second session)

Branch: `claude/vigilant-davinci-utlztf` (this branch carries everything from `claude/practical-cray-ln7m3z`,
the branch of draft PR gtjvv976mb-netizen/catcoin-sanctuary#27, plus main and the garden fix below).
PR #27 ("Launcher: launch the sanctuary's own cats on pump.fun after their X post") still points at the old
branch and is NOT merged. Start the next session on this branch and read this file first.

## 1. Done and live on main
- **X bot fixed** (PR #26, merged): queued cats with no lore picture post with their portrait.
  Announce releases one cat an hour again (Gatekeeper 18:09, Zelda 19:21, ...). 80 left in the queue.
- **Ad finished** ("Look Closer: The Newcomer", 38 s, all Higgsfield, ~673 credits):
  - 16:9 master: https://d2ol7oe51mr4n9.cloudfront.net/user_3JZSMzfLba5srJNn6vNI9xpZHJd/9db564ba-a491-4b15-b107-d1c81647de09.mp4
  - 9:16 cut:   https://d2ol7oe51mr4n9.cloudfront.net/user_3JZSMzfLba5srJNn6vNI9xpZHJd/d5f292f5-86ea-4d20-9b67-baa0541687e9.mp4
  - Plan, clip list, assembly scripts, frame sheets: `handoff/ad/`. Higgsfield project folder 7118936e.
  - Open notes: no music bed (only native ambience + 4 synthesised sfx), voice preset "Imogen" unheard,
    shot 6 has a lamp post drifting across. Keyframes (193 MB) were NOT saved (too large; regenerable from the plan).

## 2. In progress: PR #27 (the launcher launches the sanctuary's own cats)
Owner's decisions (from the chat, binding):
- Launch each cat on **pump.fun in SOL right after its X post**, so the launch wallet collects the
  **creator fees** (the wallet is `creator` in create_v2; the Rewards workflow claims them).
- **Keep the dead cats: launch them as tributes** ("In loving memory of <name>.").

What the branch does (see the PR body and `scripts/lib/launcher.mjs` header, "AND THE SANCTUARY'S OWN CATS"):
policy `"sanctuary"`, `sanctuaryRow`/`selectSanctuary`, live pump.fun adoption check before signing
(`kitLaunchedSince`, reads back to `data/trending.json fresh.coveredUntil` which build-trending now keeps),
give-way to trending cats, last daily slot kept for trending, memorial = data only (20 dead cats flagged
memorial in data/adoptables.json + build-adoptables MEMORIAL; traits rebuilt), announce.yml dispatches
launch.yml after a release, build-trending ledger-aware.

Reviews: first review (12 confirmed) and second review (12 confirmed) are ALL fixed in commit ae585d6
(findings: `handoff/review/`). Known limit, documented: StonkFun/GetStonked adoptions are tracked by nothing.

**Done in the second session (this branch):**
1. The one failing test is fixed in the garden code (`assets/world/cats.js`), not the test:
   - `tests/cats.test.mjs` "garden cats with characters move like cats" failed on "creeping CAT56: walk shown at
     under 0.15 units/s for 0.33 s". CAT56 is a synthetic lively cat, not a memorial; the traits rebuild only
     reshuffled the garden so that it brushed the corner of vegetable bed veg-3 while wandering. Root cause: the
     keep-out pushed it straight back along its own step (corner catch), the stall check replanned, and the planner
     ignored the bed it stood beside and handed it the same straight route, so it shoved at the bed every 0.1 s with
     its walk shown on the spot. Fix: a route replanned after a prop held the cat fast (`route.stale === "prop"`)
     first steps out to the planner's clearance (the existing "out" step for a cat standing in a prop's clearance),
     so it is routed round.
   - That fix reshuffled the chaotic garden and exposed a second, pre-existing wedge: a visitor chose its cheek-rub
     spot right beside a sleeping third cat, could neither turn nor step off afterwards, and stood 0.12 into its
     friend for 31 s (CAT69/CAT237). Fix: the nuzzle spot must be clear of every other cat's body whichever way the
     visitor faces there (`crowdingBut`, as `besideSpot` already requires); otherwise no visit.
   - `node --test tests/cats.test.mjs`: 25 of 25 pass. Full `npm test` (after `npm ci`), with the launcher fixes below too: 1245 tests, 1244 pass, 0 fail, 1 skipped.
2. Dependencies: this container had no node_modules; `npm ci` is needed before `npm test` or two files
   (trendwatch, venues-routing) fail on a missing `@anthropic-ai/sdk`. That is an environment matter, not code.
3. The optional third review of the money path (one agent, read-only) found 4 things; all fixed, with tests
   (tests/launcher.test.mjs, tests/trending.test.mjs):
   - The trend watch's coverage mark could jump past launches nobody read (a mark older than a day, or a gap "let go"),
     and the launcher's live check only read back to the mark: a visitor's adoption in that window was in no file, so a
     second coin could have been launched for an adopted cat. Now every unread window is in `fresh.gaps`
     (build-trending), and the live check reads back over the windows since the cat's X post (`unreadWindows`); past
     the list's reach the row waits (`adoption_unchecked`) until the owner, having looked on pump.fun, approves the
     cat's post id in `data/launch-approvals.json`. A window before the post changes nothing.
   - Later the same day: pump.fun's newest-coins list ends about 1,000 coins back (an empty page at offset ~1050,
     ~20 minutes at its busiest), so both the trend watch's mark and the live check stalled for hours. Now the trend
     watch lets a mark go as a gap once the list runs out past `LIST_DEPTH` (900) coins. Past the list's end, the live
     check asks pump.fun's own search (`/coins/search-unrestricted`, newest first, the site's search box) for the kit's
     ticker. It believes the search only after the search has found one of the walk's oldest coins by its ticker,
     which shows the search is up, filters, and is current. Tested live 2026-10-01: a coin 8 s old was already there,
     and ROLFCAT's real mint was found.
   - A sanctuary row tried again (it gave way, or a send failed) could take the day's last launch. The retry (prepare
     step 2) and the send now keep the reserved-slot rule too.
   - At the send, a cat that could not be prepared as it was any more (portrait gone, row refused, no lore line that
     passes) was sent anyway and then record refused to write it. Now it fails for good (`ineligible`), like one taken.
   - The wallet's balance was read minutes before the simulation (the live check in between). It is read after it.

**Done after the merge of PR #28 (third session, this branch):**
- First sanctuary launch worked end to end: Ponta (PONTAKUN) on pump.fun at 06:24 UTC 2026-10-01, mint
  8MPC8bNZwD8a7wNJk6KbmJ2dvk3g9FS4hM4WS8wxJg8Y, 0.0055 SOL, recorded on its card, no warnings.
- **Mint addresses end in "pump"** (owner's ask): `LAUNCH_MINT_SUFFIX` ("pump" by default, blank included, since an unset repository variable reaches the workflow as ""; "none" for none. Blehmilly, 2026-10-01, launched without it before this was fixed) and
  `LAUNCH_MINT_GRIND_MINUTES` (12). The send scans derivation nonces (solana-tx.mjs grindMintNonce, every core,
  about 10k derivations a second a core, 11.3 million on average for four characters: roughly 5 minutes on a
  4-core runner, resumable across runs: the row keeps `mintGrind.next`, then `mintNonce`). Deterministic (the
  smallest nonce), so the lost-commit recovery still finds the mint. Launched rows without a nonce keep the old
  derivation.
- **Creator fees paid out at $100** (owner's ask): `REWARDS_CLOSE_USD` (100; 0 for never). Each hourly sample
  values the unallocated holders' pot (E − A) at SOL's DexScreener price; at $100 or more the period closes early
  and ALL of the pot is released (the 7-day close still releases REWARDS_RELEASE_PCT, 50%). "Longer holders get
  more, newer holders treated fairly" was already the rule: points = tokens × hours × an age bonus from 1× to 2×
  (1.5× at two weeks), so a newcomer earns at least half the top rate. The site's rules text says so.
- Not done: the scout intake (needs network egress to api.fxtwitter.com, api.dexscreener.com, lite-api.jup.ag,
  stonkfun.com, en.wikipedia.org and news sites; 71 deduplicated candidates are batched in the session's scratchpad
  only, redo from handoff/scout/scout-results.json), and the HD remodels (credits shared with the scout cats).

**Remaining before merge (historical, PR #28 merged 2026-10-01 06:05 UTC):**
1. PR #27's head branch is `claude/practical-cray-ln7m3z`, which this session could not push to. This branch
   (`claude/vigilant-davinci-utlztf`, the same history plus the fixes) is up as its own PR against main, ready for
   review: the owner merges that one and closes #27. Then watch the first Launch run (logs: prepare picks the newest
   posted cat; send waits until build-trending has written `fresh.coveredUntil`, i.e. one Trending run after merge).
2. Known, pre-existing, not fixed: cats "Waiting its turn" for 5-80 s happen 50-80 times per 2-minute garden run
   (hemmed in by resting cats); they only fail the test when the waiter is more than 0.12 into another's body.
   A general fix to the hemmed-in logic (`stepOut`/`turnBlocked`, cats.js) is a separate job.

Owner actions (repo Settings -> Actions variables; Claude cannot set them):
- `LAUNCH_ENABLED` is `on`. Raise `LAUNCH_MAX_PER_DAY` (default 3, max 10) and `LAUNCH_MAX_SOL_PER_DAY`
  (default 0.1, max 0.5) if more launches a day are wanted; sanctuary cats get all slots but the last.

## 3. Not started / pending
- **Scout (task #4)**: workflow `handoff/scout/scout-workflow.js` ran 105 agents, 103 finished; raw results
  in `handoff/scout/scout-results.json` (candidates with X posts and sources). Next: dedupe against
  data/adoptables.json + data/planned.json + data/research/inbox.json, verify, add the good ones to the
  research inbox / pipeline (portraits, kits, models, queue) as done for the previous 45 cats.
- **HD models for the ~151 older (non-HD) cat models**: ~30 credits each the full way (~4,500 total).
  Higgsfield balance was ~347 after the ad, so only ~10 cats unless the owner tops up. Owner said to start
  this after the scout. Recipe: see scripts/cat-models.jobs.json entries with `hd: true` (gpt_image_2_5
  reference, tripo_h3_1_image_to_3d 12000 faces, packed by make-cat-models.py, fit.json, in-game shots).

## 4. Housekeeping
- Scheduled check-ins in the old session fire into the old session only; nothing to cancel.
- Task list at handoff: #4 scout (in progress), #7 launcher PR (in progress); all others done.
