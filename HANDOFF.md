# Catcoin Sanctuary: handoff (2026-09-26, ~14:50 UTC)

This branch (`handoff/2026-09-26`) holds everything that was NOT yet on `main`. **`main` is the live site** (catcoinsanctuary.com, GitHub Pages) and is the source of truth for the product. Start from `main`, and use this branch only for the pieces listed below.

## What is live on main
- **3D garden** (three.js), HD cat models (`assets/models/cats`, 197+), Research HQ house, and the "Who's that cat?" easel and teaser (`data/next-cat.json`).
- **Cat cards:**
  - A real X photo at the top, hotlinked from pbs.twimg.com and never stored (`data/real-photos.json`).
  - "🎮 In-game look" shown below it.
  - "🐾 Adopt this cat" opens the Adopt panel with launch kits (`assets/kits/`) and buttons for StonkFun, GetStonked (https://getstonked.xyz/launch) and pump.fun.
- **Top bar:** Find a cat, Adopt a Cat, Hall of Fame, About, Socials.
- **Black-screen fix:** a GPU-memory budget, context-loss recovery, and a quality tier (`?q=low|medium|high`).
- **X announcer** (`scripts/announce.mjs`, `.github/workflows/announce.yml`):
  - Posts the initial roster one cat per run, with 2 images: the lore photo and `assets/ingame/<KEY>.jpg`.
  - When the backlog is empty, it switches to the hourly release queue (`data/release-queue.json`). A cat is posted on X first and only then shown on the site. The "🆕 New cat just moved in!" card highlights it.
  - Secrets: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET, set in the repo's Actions secrets.

## IMPORTANT: the posting pacer
GitHub's `*/20` cron almost never fires on this repo. Every post so far came from a manual `workflow_dispatch`. The old session kept posting going by dispatching `announce.yml` every 20 minutes, and **that stops when the old session stops**. Options:
1. The new session re-creates the pacer: dispatch `announce.yml` on main every 20 minutes (a Claude Code `send_later` loop or a Routine).
2. **Recommended:** a free external cron (cron-job.org) that POSTs to `https://api.github.com/repos/gtjvv976mb-netizen/catcoin-sanctuary/actions/workflows/announce.yml/dispatches` with body `{"ref":"main"}`, using a fine-grained PAT with Actions: write on this repo. The owner creates the token and never pastes it into a chat.

**State on 2026-09-26:** about 28 initial-roster cats are left (see `data/announced.json`, status `backlog`). 146 cats are `held`, awaiting the owner's approval into `data/release-queue.json`. The queue is empty.

## What is on this branch (not on main)
### 1. Project promo posts (work in progress)
- **Files:** `scripts/promo.mjs`, `.github/workflows/promo.yml`, `data/promo-{posts,config,state}.json` (24 posts), `tests/promo.test.mjs`, `assets/promo/` (13 stills, `clip-orbit.mp4`, `media.json`).
- **Supporting edits:** in `scripts/lib/x-api.mjs` (uploadVideo, postTime), `tests/workflows.test.mjs`, and `pages.yml` (keeps promo media out of Pages).
- **Config:** everyMinutes 120. The owner asked for every 5 minutes and was advised that this risks suspension; 120 is the default.
- **Left to do:**
  - 3 more clips (cats, research, adopt). The scripts are in `handoff/scratch/pc/` (`node clips.mjs NAME`, then `bash enc.sh NAME 7.0`, with the site served on port 8768). Until then, `npm test` fails only the promo media check.
  - Then run `npm run test:builder`, do a dryRun, and show the owner 3 sample posts before merging to main.
- **Review before merging:** some stills show hotlinked X photos inside cards, and the Hall of Fame list shows market caps. Decide whether that's OK for promo media.

### 2. `handoff/source-tree-scripts/`
The asset pipeline from the old working tree (`/home/user/cat-sanctuary/scripts`), which was never a git repo:
- `make-cat-models.py` (Hunyuan GLB → full and far copies, budgets 800 KB and 300 KB, with the `drop_small`, `-sv` and `lo_url` options)
- `cat-models.jobs.json` (every Higgsfield job id)
- `CAT-MODELS.md`
- `build-kits.py`
- the portrait and lore generators

Also `handoff/source-tree-claude/` holds the `/scout` command.

### 3. `handoff/scratch/`
Text working files (json, md, py, mjs, sh) from the old scratchpad: the launch sheets, adoptables research, retry job ids (`r3/`), the release and teaser notes, the real-photo mismatch list (`realphoto/mismatch.md`) and the cohort notes. Large image dumps were left out.

### 4. `handoff/logo/`
The brand logo, avatar and banner PNGs and `make.py`.

## Open questions for the owner
1. Redo the 4 cats whose pictures don't match their real photos: GENKITTY, PALICO, CWIF, SERPOUNCE (about 25–40 Higgsfield credits).
2. Label cartoon or game art as "📸 Official image" instead of "Real photo" (Pusheen, Meowth, etc.)?
3. Search X more deeply for real photos of the 89 cats that have none.
4. Which of the 146 held cats to approve into the hourly release queue.
5. Promo cadence (the default is 120 minutes).

## Rules the owner set (keep them)
- **Content:** real, verified lore only (an X post plus a web source). No price talk or promises. At most one cashtag per post. Hyped, emoji-rich, easy-to-read copy.
- **Photos:** real photos are hotlinked and credited, never hosted. No real people's faces.
- **Brand:**
  - Name: Catcoin Sanctuary, ticker $CATSANC, tagline "Where all catcoins live".
  - Links: X @catcosanctuary; Telegram https://t.me/+x58u0_NhAAZlMTZl.
- **Safety:** never ask for private keys or seed phrases. Research is read-only, with no transactions.
- **Higgsfield:** about 1,777 credits left at handoff. Never use media_upload_widget.
