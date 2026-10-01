# Handoff: where the last session stopped (2026-10-01 ~02:00 UTC)

Branch: `claude/practical-cray-ln7m3z`. Open draft PR: **gtjvv976mb-netizen/catcoin-sanctuary#27**
("Launcher: launch the sanctuary's own cats on pump.fun after their X post"). Not merged.
Start the next session on this branch and read this file first.

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

**Remaining before merge:**
1. `npm test` on the branch (after merging main, commit 20ecfda): 1241/1242. One failure, deterministic,
   passes on main: `tests/cats.test.mjs` "garden cats with characters move like cats" ->
   "creeping CAT56: walk shown at under 0.15 units/s for 0.33 s". Cause: the traits rebuild (20 cats now
   memorial -> "gentle") changes the garden simulation. Find which cat CAT56 is, fix the gait/creep
   threshold or the gentle-cat movement (do NOT weaken or skip the test). Then rerun `npm test`.
2. Optionally run one more short review of commit ae585d6 (money path).
3. Mark PR #27 ready, merge. Then watch the first Launch run (logs: prepare picks the newest posted cat;
   send waits until build-trending has written `fresh.coveredUntil`, i.e. one Trending run after merge).

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
