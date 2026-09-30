# Catcoin Sanctuary

**https://catcoinsanctuary.com**

Catcoin Sanctuary is a sunny 3D garden full of cats, each paired with a stock that StonkFun lists as
a pair: the xStocks, the Backpack stocks and funds, and the pre-IPO PreStocks (the research covers
all 93 pairs; the cats arrive sheet by sheet). The whole page is
the 3D world. It has a sun, drifting clouds, flocks of birds, butterflies, a pond, flower beds and
a cottage with cat-ear gables, and the cats wander, play, eat, groom and nap in it. Click a cat,
or find it with **Find a cat**, and its card opens with:

- **who the cat is**: its own story, and the stock's real cat as the research found it (a
  company's own mascot, a post, a collaboration), or "None found";
- **its virality**: every view, like or share count with its source and date, or "Not measured".
  Each date says what it is: the day the figure was counted, the date the source gives for it,
  the day the source was published, or (when the source gives no date) the day it was read;
- **the X post or site that links it to the stock**, each with its date;
- **the token created for it**: "Not launched yet", or its mint, launch transaction and
  StonkFun page;
- **where to buy it**: GMGN.ai and FOMO, shown only once the cat has launched.

Every card ends with a disclaimer: the coin is not affiliated with the company or with StonkFun,
has no intrinsic value, and is not financial advice. A company's cat or mascot may be *described*
on a card, with its source. It is never used as a coin's picture or name (see "Held cats" below).
A planned cat's ticker is shown without a `$` and with a warning: any token under that name found
before launch is not this cat.

It is a static site: plain ES modules and CSS, no build step. three.js r169 is included in
`assets/vendor/three`. The page makes no requests to any other host. Everything it loads is in
this folder, and the data is prepared ahead of time. It is served by GitHub Pages.

## How cats arrive

A cat moves in as **planned** and becomes a **token** only when it is launched and the launch is
proven on chain.

1. **Planned.** Each launch sheet (a JSON list written for the owner) gives a cat's name, ticker,
   stock, story, look and portrait. `scripts/build-planned.mjs` merges the sheets with the
   research in `data/cats-info.json` (who the stock's real cat is, links, virality, all sourced
   and dated). It writes `data/planned.json` and copies each portrait to
   `assets/portraits/<TICKER>.jpg` at 512 × 512. A planned cat is in the garden with the label
   **Not launched yet**. It is not a token, and it has no buy links. A cat listed in
   `data/held.json` is left out (see "Held cats").
2. **Launched.** The owner launches the cat on StonkFun from a listed wallet (see below). It must
   use the cat's **ticker** and be priced in **the cat's stock pair**.
3. **Proven.** Every hour, the Collection workflow (`.github/workflows/collection.yml`) runs
   `scripts/build-collection.mjs`. It reads each listed wallet's new transactions on Solana and
   keeps only what it can prove is a StonkFun LaunchLab launch:
   - the fee payer is the wallet, and the transaction falls inside the wallet's dates;
   - the transaction is a StonkFun LaunchLab launch whose accounts all re-derive, with nothing in
     it that cannot be decoded;
   - it is priced in one of the 93 stock pairs;
   - the new mint's own metadata carries the same name and symbol.

   Before a launch is listed, the transaction must be the one asked for and every signature it
   carries must verify over its message, so the RPC provider cannot pass off someone else's
   launch as the owner's. A launch that passes is added to `data/collection.json`. The workflow
   commits that file, and the Pages workflow then publishes it.

   The automatic launcher's **pump.fun** launches are proved the same way
   (`scripts/lib/chain.mjs` `proveLaunchPump`): one direct `create_v2` priced in SOL, every account
   re-derived with `scripts/lib/pump.mjs`, the wallet as creator, every option off (mayhem,
   cashback, creator fee, holder rewards), no dev buy and nothing else but ComputeBudget; then the
   mint's metadata (with no update authority left: nobody can rename the coin) and its bonding
   curve are read back. Such an entry carries `"launchpad": "pump.fun"` and the pair SOL, or, for a
   launch priced in a coin `data/pump-quotes.json` lists (unverified, off unless the owner opts
   in; see "Launcher"), that coin as its pair: the page and the X bots read the same list, so they
   show such a coin only while it is listed. Its StonkFun launches are proved as the owner's are
   (no `launchpad` field, priced in their stock pair). An
   adoptable cat with a `launch` field in `data/adoptables.json` shows as **Launched by the
   sanctuary** only once `data/collection.json` holds a proved entry with that field's mint,
   transaction and launchpad that also carries the cat's own ticker (letter case aside) and coin
   name (letter case, accents and punctuation aside), and no other cat took that coin first. That one rule
   (`assets/ui/adoptables.js` `provedLaunch`) is what the page and the X announcer both use. Until
   then the cat shows "Launching…". Either way it has no Adopt button, a stranger's coin is never
   its adoption, and a coin a `launch` field names gets no card of its own. The announcer never
   lists a pump.fun coin that no adoptable claims, and both X posters hold any draft that names a
   Solana address (the one exception: the card link of an owner-launched StonkFun coin that no cat
   has, whose card is keyed by its mint).
4. **On the page.** A launch whose pair and ticker match a planned cat (letter case aside) takes
   that cat. The badge turns to **Launched**, a gold coin turns above the cat's head, and the
   card shows the mint, the launch and the GMGN and FOMO buy links. A launch that matches no
   planned cat still appears, as a token of its own.

Nothing is ever dropped. A cat that was proven stays proven.

## Listing a wallet

Only launches paid by a wallet listed in `data/wallets.json` count:

```json
{
  "launchers": [
    { "address": "3J57tqAJqRmSBn1ZYDu9JpMMyTfBHdcGGwECiPQeiji3", "since": "2026-09-25T00:00:00Z", "label": "Owner" }
  ]
}
```

- `address`: a Solana wallet (base58).
- `since`: the date the wallet counts from (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`). The first
  run reads the wallet's history back to this date.
- `label`: a short plain name.
- `until` (optional): the date the wallet stops counting, if it is retired. Retire a wallet this
  way rather than removing it: removing a wallet whose cats are already listed stops the
  builder.

Commit the change. The next hourly run (or a run started by hand from the Actions tab) reads the
new wallet. The owner's wallet `3J57tqAJ…eiji3` is listed from 2026-09-25.

**Launch from a fresh wallet used for nothing else.** A wallet's address is public, and anyone can
send it cheap transactions. The hourly check reads everything that names the wallet, so a flood
of them slows it down: each run reads for up to 15 minutes, and a wallet with more than 200,000
new transactions is not scanned that run (with a warning in the run's log), though nothing is
skipped. A flood can never list a foreign token: only a launch the wallet itself signed and paid
for counts.

## Listing a launch by hand (optional)

To have a launch proved at once, whatever else names the wallet, add its transaction signature to
`data/launches.json` and commit:

```json
{ "launches": [ { "tx": "<the launch's signature>", "note": "Patchpaw" } ] }
```

Every run proves each listed launch that is not in the collection yet, first and outside the
scan's limits, exactly as it proves a scanned one (it must still be paid by a listed wallet). The
scan finds launches on its own; this is for when it is slow.

## Launcher

The sanctuary launches trending cats itself: `.github/workflows/launch.yml` runs `scripts/launch.mjs`
(the rules are in `scripts/lib/launcher.mjs`) every 20 minutes, by hand, and at once whenever the
trend watch commits new candidates (`data/trending-cats.json`). It launches at most one cat a run,
**with no dev buy**: it never buys or sells anything, on any launchpad. The creator fees its pump.fun
coins earn go to the holders of $CATSANC (see "Holder rewards" below).

**Where (the owner's rule, `scripts/lib/venues.mjs` and `scripts/lib/venues-routing.mjs`):**

- by default on **pump.fun, priced in SOL**;
- a cat tied to a company whose stock is one of the 93 stock pairs on **StonkFun, priced in that
  stock** (Raydium LaunchLab on StonkFun's standard platform, `scripts/lib/launchlab.mjs`), but only
  when that pair has no sanctuary cat yet: one cat per pair, counting the planned cats, the proved
  launches, the adoptables and the launcher's own launches not in `data/adoptables.json` yet (today
  only tOpenAI and tKalshi are free, so most tied cats launch in SOL). The ties are in
  `data/cat-watch.json`: a figure's `"stock"`, or `accountLinks` (a big account's X handle to its
  stock) for the cat posts of that account;
- a cat tied to a coin (`"pumpQuote"`) on **pump.fun, priced in that coin**, only when
  `data/pump-quotes.json` lists the coin and the repository variable **`LAUNCH_PUMP_QUOTE`** is `on`
  (no such launch has been recorded yet, so this venue is unverified and off by default).

StonkFun's numbers come from its public pricing API, fetched right before each build (the raise
follows the stock's price), bounded, its SOL and stock prices anchored independently on DexScreener
(each within 15%), and checked against LaunchLab's config read over the RPC. A
StonkFun or coin-priced launch that fails at any step **before it is sent** (its pair taken
meanwhile, the pricing or its DexScreener anchor, the config, the opt-in, the build, the simulation, a cost over the
per-launch cap) goes out on pump.fun in SOL that run instead, and its ledger row says why
(`fallback`); nothing ever falls back after a send. Every venue serves the same metadata, and a cat
is only prepared when its coin and its X post would pass on pump.fun in SOL too.

**Who it launches on its own: only watch-list cats.** A post the trend watch named after a
`data/cat-watch.json` figure (`reading.nameFrom: "figure"`), or a cartoon or fiction cat that an X
trend named or a big account posted. Anything else (a real pet, even one named after a watch-list
figure, or a name the rules guessed) waits for you: add its post id to `data/launch-approvals.json` (`{ "approve": ["<post id>"] }`, the id in quotes, laid
out as you like; for someone's pet, ask its owner first). An approved post still meets every other rule. It never launches a
sensitive cat, one already in the sanctuary (a planned or adoptable cat's name or ticker), one in
its ledger, a post older than 48 hours or without a picture, or a cat whose coin text or X post
would break the site's content rules. Newest post first.

**How one launch goes** (each phase is committed before the next, and each is safe to run again
after a crash at any point):

1. *prepare* chooses the venue, writes the coin's metadata to `coins/<postId>.json` (pump.fun's
   shape, the same on every venue: name, symbol, the description, the post's picture hotlinked from
   pbs.twimg.com (the site's own picture for a hidden photo, below), the cat's card as website,
   @catcosanctuary as twitter) and a "prepared" row in the ledger, `data/sanctuary-launches.json` (its venue, and the
   cat priced in the venue's pair). The site is deployed so it serves that file.
2. *send* (the only step with the key) waits until `https://catcoinsanctuary.com/coins/<postId>.json`
   serves exactly the committed file, builds the launch on its venue (falling back to pump.fun in
   SOL as above), **simulates** it unsigned (it is signed only right before it is sent, so nothing
   signed ever reaches the RPC but the send itself) and sends it only if the
   simulation passes, the wallet loses at most `LAUNCH_MAX_SOL_PER_LAUNCH`, the last 24 hours stay
   within `LAUNCH_MAX_SOL_PER_DAY` and `LAUNCH_MAX_PER_DAY`, at least `LAUNCH_MIN_BALANCE_SOL`
   stays in the wallet (counted after the $CATSANC holders' SOL, which a launch never spends: see
   "Holder rewards"), and the wallet is still an active launcher. The row is written "sending"
   before the transaction goes out, then "launched" (its mint, its transaction, what it cost) or
   "failed". A send whose answer is unclear stays "sending" until its signature settles it, and a
   launch that landed but is not proved yet stays "sending" too (the run fails so a person looks):
   the launcher never forgets a coin that exists. It also stops preparing cats well before the
   Collection's cap of 500 (keeping room for every planned cat).
3. *record* moves the cat into the sanctuary: an adoptable in `data/adoptables.json` with its
   `launch` (its launchpad and pair the venue's; the card says "Launching on …" until the hourly
   Collection proves the mint, then "Launched by the sanctuary on …" with that launchpad's link),
   its transaction in `data/launches.json` (the announcer holds it by its own rule; the launcher
   never writes `data/announced.json`), a 3D model queued in `scripts/meshy.queue.json`, its real photo in
   `data/real-photos.json` (credited on its card, below), and its figure off the watch list. Then the Collection, Pages and
   Announce are started (Pages at once; the Collection and Announce keep their own hourly chains, so
   the proof and the post come within about an hour). Its one X post ("… launched by the sanctuary on PumpFun" or "on StonkFun",
   its lore line, the fan-tribute line when it fits, and its card link; never the mint or the author's @handle) goes out through
   `scripts/post-updates.mjs` once the Collection has proved it.

**Every sanctuary coin is a fan tribute, and says so.** Its description is its lore line, then
always, whole: "Unofficial fan tribute from the Catcoin Sanctuary. Not affiliated with or endorsed by
the character's owners." (for a real pet, a post the trend watch read as kind `real`: "…by the cat's
owners."). The description is kept to 500 characters (no venue limits it: it lives only in the
off-chain metadata); a longer lore line is shortened, never the tribute line. The lore meets every
content rule; the tribute line itself is the owner's fixed text, let through as a citation (the
rules' endorsement list cannot tell "not endorsed" from "endorsed"). The launch X post carries the
same line, under the lore line, when a version of the post fits 280 characters and every rule with
it: room is made as for any long post (the mint line, a hashtag, then the lore line go first), never
by dropping the card link. If no version could carry it, the post goes out as it would without it.

**Photos from X are shown with credit to their source.** Every launched cat, drawn or real, gets the
photo from its X post on its card, hotlinked from pbs.twimg.com (never copied here) and credited under
it: "📸 Photo: @handle on X", linked to the post (the Adopt panel credits a kit's photo the same way).
The same photo is the coin's picture, and the coin's description credits it too ("Photo: @handle on
X.", between the lore and the tribute line) when it fits the 500 characters and the content rules;
otherwise the description goes without it. The launch X post does not carry the credit: the launch
post never names the @handle of the post a cat was found in (a rule of the launcher's X post: no
mention of a stranger), and it links to the card, where the credit is.

**Hiding a photo (the owner):** a stranger's photo can show faces, children or a home. To hide one,
add its post's X status id (in quotes; any photo on the site, launched cat or not) to **`data/photo-hide.json`** (`{ "hide": ["<post id>"] }`).
The next Launch run (every 20 minutes) moves the cat's `data/real-photos.json` entry, whole, to `hidden` (the
card then shows its portrait), deploys the site, and a coin not sent yet takes the site's own picture
(`assets/og-image.jpg`, no photo credit) instead. **A coin's picture cannot change once it is
launched**, so hide a photo *before* the launch if the coin must not show it (for a real pet, you
see the post anyway when you approve its launch). Remove the id to show the photo again: it comes back
from `hidden` exactly as it was. The file is
read like `data/launch-approvals.json`: a typo hides nothing (the run warns), and it never stops the
launcher or the tests.

The coin's mint is derived from the wallet and the post (`deriveMintKeypair`), so one post can only
ever make one coin: a retry sends the same mint again. The mint is never written or printed before
its transaction is sent (a known, unused address can be blocked by anyone who funds it).

**Setting it up (the owner):**

1. Make a **new wallet used for nothing else**, for instance `solana-keygen new -o launcher.json`
   (or a fresh account in Phantom). Never the owner's wallet.
2. Fund it with about **0.1 SOL**. A launch costs about 0.006 SOL (rent and fees); the rest is the
   floor and the day's cap. The wallet can only lose what is in it. Once it holds creator fees
   claimed for the $CATSANC holders, those do not count towards the floor (a deposit of yours is
   never mistaken for them).
3. Add the repository secret **`LAUNCH_WALLET_KEY`**: the secret key as the Solana CLI writes it
   (the JSON array in `launcher.json`) or as Phantom exports it (base58). Keep
   **`SOLANA_RPC_URL`** set too (the public RPC throttles). Neither is ever printed.
4. Add the wallet's **address** to `data/wallets.json` and commit it before the first launch (the
   Collection proves only a listed wallet's launches; the send step refuses to run otherwise and
   prints this row with the address filled in):

   ```json
   { "address": "<the launcher's address>", "since": "2026-09-28", "label": "Auto launcher" }
   ```
   Keep the label "Auto launcher" (or "Auto launcher 2" and so on): before a post is launched with
   one key, every other wallet so labelled is searched for a launch of the same post, so changing
   `LAUNCH_WALLET_KEY` can never launch a post twice.
5. Repository variables (Settings → Secrets and variables → Actions → Variables):
   **`LAUNCH_ENABLED`** `dry` first (each run builds and simulates the next cat and logs it, sending
   and writing nothing), then `on`. Optional caps, each clamped: `LAUNCH_MAX_PER_DAY` (3, at most
   10), `LAUNCH_MAX_SOL_PER_LAUNCH` (0.03, at most 0.1), `LAUNCH_MAX_SOL_PER_DAY` (0.1, at most
   0.5), `LAUNCH_MIN_BALANCE_SOL` (0.02, at least 0.01), `LAUNCH_PRIORITY_MICROLAMPORTS` (100000).
   `LAUNCH_PUMP_QUOTE` `on` opts in to pump.fun launches priced in a listed coin (leave it unset
   unless you have listed a coin in `data/pump-quotes.json` after checking it on chain).
6. Optional, for a figure: `look`, `coat`, `owner` and `category` in its `data/cat-watch.json` entry
   make its card and its 3D model right from the start.

**Stopping it:** set `LAUNCH_ENABLED` to `off` (or delete it), or disable the Launch workflow. A
launch already sent is settled and recorded the next time it runs. To retire the wallet, give its
row in `data/wallets.json` an `until` date; never delete the row. Never delete a file in `coins/`:
a launched coin's uri points to it for good. A real photo that shows a person can be taken off a
card with `data/photo-hide.json` (above), or by hand by moving its row in `data/real-photos.json` to `none`. The 3D model is
made by the Models workflow (below) once it is switched on; by hand otherwise, as for every cat
(`node scripts/tripo.mjs make <TICKER>` or `node scripts/meshy.mjs run <TICKER>`, see `scripts/CAT-MODELS.md`
and `MESHY-HANDOFF.md`).

### 3D models for launched cats (the Models workflow)

`.github/workflows/models.yml` (`scripts/models.mjs`) gives each launched cat a 3D model of its own,
with the repository's own tools used as they are designed (`scripts/CAT-MODELS.md`). It runs daily,
by hand, and right after a launch is recorded (the Launch workflow's publish job starts it). Each run
makes at most one queued **rebuild** from `scripts/meshy.queue.json` (`MODELS_PER_RUN` 2 for two):
launched cats with no model first, never one whose photo `data/photo-hide.json` hides.

1. **The model**, by the tool `MODELS_GENERATOR` names. **Unset (the default), no API makes it and no API
   credit is spent:** the owner makes the model by hand through the Higgsfield connector (Tripo H3.1 on the
   owner's Higgsfield plan; `scripts/CAT-MODELS.md` section 1), and the workflow still packs, checks and
   commits nothing for that cat until the model is in `assets/models/cats/`. Or:
   - **Tripo** (`MODELS_GENERATOR` = `tripo`; `scripts/tripo.mjs make`, the official Tripo CLI): the queue entry's reference
     picture (the post's photo) redrawn standing on four legs (image-to-image), then image-to-model
     (`tripo-v3.1`, 12000 faces, textured), about 40 credits a cat, downloaded at once for the packer.
   - **Meshy** (`MODELS_GENERATOR` = `meshy`; `scripts/meshy.mjs run`): four-legged reference views from
     the same picture, multi-image-to-3D and a remesh far copy, about 41 credits a cat.
2. **Pack** (`scripts/make-cat-models.py` with gltfpack): normalized, textured, `<KEY>.glb` and
   `<KEY>-lo.glb` in `assets/models/cats/`, `index.json` and `PROVENANCE.md`.
3. **Checks**: the size budgets (600/150 KB, 800/300 KB for HD), a valid textured GLB the page can load
   without a decoder, the garden's own rig (`assets/world/catrig.js`) run on the model (four legs with
   their joints in order, skin weights that add up, 1 unit tall on the ground), and the model tests
   (`tests/catmodels`, `catrig`, `meshy`). A model that fails is **discarded** (its files, index row and
   job entry put back), the failure recorded in `scripts/models.state.json` and in its tool's record
   (`scripts/tripo.state.json` or `scripts/meshy.state.json`), and the cat keeps its portrait and the
   shared model. After 2 failed tries it is left for a person (delete its row in
   `scripts/models.state.json` to try again).
4. **Tripo** (`scripts/tripo.mjs rig`): the quadruped rig of the packed model (about 25 credits),
   recorded in `scripts/tripo.state.json`. Skipped, with a log line, when `TRIPO_API_KEY` is missing.
   The site rigs its cats itself, so Tripo's rigged GLB is not used on the page; a "not riggable"
   verdict is flagged in the log as a model to look at.
5. A **preview** PNG (`scripts/model-previews/<KEY>.png`, three views, rendered headless) and a line in
   the run's summary; then the commit, and Pages is deployed.

These run as separate jobs, so no job that installs a package holds a key it does not need or the push
token: the Pick job installs nothing and holds no secret; one make job runs, the chosen tool's: the
Tripo make job (its CLI from `tools/tripo-cli`: `npm ci --ignore-scripts`, every package locked by its
hash) holds only `TRIPO_API_KEY`, the Meshy job installs nothing and alone holds `MESHY_API_KEY`; the
Pack job (packages installed with `--ignore-scripts`) holds no secret; the Tripo rig job
(`tools/tripo-cli` and `tools/tripo-rig`, locked the same way) holds only `TRIPO_API_KEY`; the Commit job
installs nothing third-party, takes only the expected files from the others (each checked, the model
checks and tests run again there) and pushes with git hooks off. The make, Pack and rig jobs run the
commit the Pick job ran the model tests on. A try is counted before the tool is called, and the Commit
job always runs, so a run that fails, times out or is cancelled still records what the tool spent (the
cat is tried again, at most twice in all); a job that never got the state of the one before it uploads
none, so an older copy never hides a try.

**Setting it up (the owner):** add the repository secret **`TRIPO_API_KEY`** (and **`MESHY_API_KEY`** to
use Meshy) and the variable **`MODELS_ENABLED`** = `on` (anything else, or unset, runs nothing). Optional
variables: `MODELS_GENERATOR` = `tripo` or `meshy` to spend that API's credits (unset, the default, spends
none: the models are made by hand through Higgsfield; any other value makes nothing);
`MODELS_TRIPO_MAKE_RESERVE` (credits Tripo keeps when it makes a model, 0 by default: it spends what is
there); `MODELS_MESHY_RESERVE` and `MODELS_TRIPO_RESERVE` (credits Meshy and Tripo's rig keep, 100 by
default as in the scripts); `MODELS_PER_RUN` (1 or 2), `MODELS_BACKLOG` = `on` to also rebuild the queued
cats that have a model already (off by default: those were checked by eye before). Each key is only in
the steps that call its API (Tripo's: the make and the rig); no wallet key is anywhere near this workflow.

**A quick look at each new model is still wise:** the checks cannot tell which way a model faces (a
big tail can fool the packer's heading guess: `--yaw 180`, see `scripts/CAT-MODELS.md`) or whether it
looks like its cat. Open its preview, or run `node scripts/render-cat-clips.mjs OUT.png <KEY>` to see it
walk. Still by hand: a yaw fix, the in-game shot for X posts (`scripts/capture-ingame.mjs`), retextures,
and cats whose Meshy views wait for a person.

## Holder rewards

The creator fees the launcher's coins earn go to the holders of **$CATSANC**, the sanctuary's own
coin (its mint is `"contract"` in `data/socials.json`), in SOL. Older holders get more, and a new
holder always earns at least half the top rate. `.github/workflows/rewards.yml` runs
`scripts/rewards.mjs` every hour. The rules are in `scripts/lib/rewards.mjs` (which decides every
amount), the claim is in `scripts/lib/pump-fees.mjs` and the runs are in `scripts/lib/rewards-run.mjs`.

The site shows it under **About → Holder rewards** (`assets/ui/rewards.js`): the formula in three
lines, what was claimed and paid, when the next payout is due, the last payout's transactions on
Solscan, and a box to check any wallet (its tokens, age bonus, share of this period's points, and
what it is owed and was paid). It reads the files below, as of the site's last deploy (usually
within the hour: Pages redeploys after the hourly Collection run whenever main has moved). It says
plainly that none of this is financial advice: rewards can be small or nothing.

**What is paid.** Only SOL, and only what the launcher wallet (`HxhisqFB…HzQh`) actually claimed:
its pump.fun and PumpSwap creator fees, measured from each claim transaction (what the wallet
received, less that transaction's fee), times `REWARDS_HOLDER_SHARE_PCT` (100 by default; the share
is fixed when the claim is sent). StonkFun (Raydium LaunchLab) coins pay their creator no fee on
chain, and a pump.fun coin priced in another coin pays in that coin. Neither is claimed, because
turning it into SOL would need a swap, and the launcher never trades. The launcher's own SOL is
never in the pot.

**To whom.** Every wallet that holds at least 0.01% of the supply (100,000 $CATSANC,
`REWARDS_MIN_BALANCE_PPM`) in its own name. Never counted: the wallets in `data/wallets.json` (the
owner and the launcher), every owner off the ed25519 curve (a program address: pump.fun bonding
curves, AMM pools, lockers, vaults), the runtime's reserved addresses (the System Program's
"dead address" `1111…1111`, the sysvars, the builtin programs: SOL sent to one in a transaction is
always refused), the token and launch programs, the $CATSANC mint itself, frozen token accounts, and
the wallets the owner lists in `data/rewards-exclude.json`. At each close the accounts of the
wallets with points are read, and one that can never receive SOL (a program, an account a program
owns, an account holding data) gets no share; the period's file lists it under `refused`.

**The formula.** Every hour, at a random moment kept secret until the hour's window has closed (so
nobody can time a buy to the check), the Rewards workflow reads every $CATSANC token account.

```
points      = Σ over each hour: tokens held at this check and the one before × seconds (at most 2 h) × bonus
bonus       = 1 + age / (age + 14 days)     1× new, 1.33× at a week, 1.5× at two, 1.68× at a month, never 2×
every 7 days  50% of the holders' unallocated SOL is split by points, at most 10% of it to one wallet
              (what the cap holds back stays in the pot for later periods; nobody else gets it)
```

- A wallet's tokens are kept in lots, each with its own age. Tokens bought or received start a new
  lot at 1×. A sale takes the newest lot first, so the oldest tokens keep their age. (A wallet keeps
  at most 16 lots: past that, the two neighbours whose merge loses the least bonus are merged, at
  the younger age.)
- Age runs on a verified clock that moves only between two good checks, at most 2 hours at a time,
  so no age builds up while the workflow is off or the RPC is down. It starts at the first check
  (genesis, within the hour after `REWARDS_ENABLED` is first set): every holder then starts at 1×,
  so holding $CATSANC before that earns no age. The site says so; announce the start date in advance.
- Fair to newcomers: the bonus is bounded, so a new holder's tokens always earn more than half of
  what the oldest can. The cap keeps one big wallet from taking the pot: no wallet gets more than
  10% of a period's pot, however few wallets have points. What the cap holds back is never handed
  to the other wallets (that would pay a two-hour holding, or a wallet split in fifty, more than its
  points); it stays in the unallocated SOL and is released at later closes. Each close releases
  half of the unallocated SOL and keeps the rest for later periods, so someone who buys next week
  still shares in fees claimed this week.
- After each close every wallet is sent what it is owed, in plain SOL transfers, in transactions of
  at most 20 and of near-equal size (so the smallest payees never carry a transaction's fee almost
  alone). Each pays its share of that transaction's fee (a few hundred lamports; about 5,000 for a
  wallet paid alone). Amounts under
  `REWARDS_MIN_PAYOUT_SOL` (0.001) wait until they add up, and a wallet with no SOL account yet is
  paid once its reward covers the rent the account needs. A wallet whose own transfer fails in
  simulation is held for a day while the others are paid (the run fails so a person looks), and one
  whose payout expired waits until the wallet's history shows it never landed. Nothing is forfeited:
  a wallet that sold out, or that is excluded later, is still paid what it was owed. (A wallet with
  no SOL account whose reward never grows to cover that account's rent, about 0.0009 SOL with the
  fee, stays owed and is sent nothing until its account holds some SOL; an address that can never
  receive SOL is carried with its reason in each run's log.)

Everything is public: `data/rewards/ledger.json` (every claim and payout, with its transaction),
`data/rewards/state.json` (the rules in force, each wallet's lots, points and what it is owed) and
`data/rewards/periods/<k>.json` (each closed period's points and amounts).

**The safety rules:**

- **The pot is only claimed fees.** The holders' total is summed again from the landed claims on
  every run, and a hand-edited total is refused. A payout is signed only if what was paid, the
  payout fees, what is still in flight and this transaction together stay within that total. This
  is checked when the payout is planned, again right before it is signed, and again when it is
  recorded. The wallet must also still hold `LAUNCH_MIN_BALANCE_SOL` plus everything the holders
  are owed, so a payout never reaches into the launch reserve. The launcher, for its part, spends
  only its balance less the holders' SOL (`rewardsEarmark` in `scripts/lib/launcher.mjs`). Both
  rules are tested.
- **The key is only in the send step.** `LAUNCH_WALLET_KEY` is in the pay job's one send step and
  nowhere else; the hourly sample runs with no key. No job installs a dependency, the actions are
  pinned to commit SHAs, the workflow starts with `permissions: {}`, and the checkout keeps no
  credentials. The key and the RPC address are scrubbed from every line a run prints.
- **Simulate, then sign.** Every claim and payout is built, decoded again from its bytes and
  checked instruction by instruction. A claim may hold only pump.fun's and PumpSwap's creator-fee
  instructions, and opening and closing the wallet's own WSOL account. A payout may hold only
  SystemProgram transfers to the wallets owed, and the compute budget. It is simulated unsigned (a
  payout's simulation must succeed and take no more than the planned lamports from the wallet) and
  signed only after every check and cap has passed. Nothing here ever buys, sells or swaps.
- **The ledger.** A transaction's row is written "sending" to the ledger before it is sent, and
  committed by the step after (which runs even when the send fails or the run is cancelled), then
  settled by the next run (landed, paid, failed or expired). A record lost anyway is found on chain
  by the next run and recorded, never paid twice. "Expired" takes more than one answer: the
  finalized block height well past the blockhash's, and neither the status nor the transaction
  found when asked again; one that landed after all is recorded as what it did when the wallet's
  history shows it. The pay job shares the Launch workflow's concurrency group, so the two never
  spend from the wallet at the same time.
- **The wallet's history.** Each run counts the wallet's transactions since the ledger's cursor
  (a claim a stranger made, a record lost), oldest first, saving as it goes, for at most six
  minutes; anyone can flood the wallet's history with cheap transactions, so what is left is
  counted by the next runs, where the last stopped. Payouts wait until the count has caught up;
  claims do not. Never move the ledger's `cursor` by hand past transactions the count has not
  classified: a lost payout among them would be paid twice. The launcher holds back what every
  claim since the cursor brought in until it is counted (and waits if reading them takes too long).
- **Fail closed.** A missing `data/rewards/ledger.json` while `data/rewards/state.json` is there
  (or the other way round) stops the Rewards workflow, and the launcher waits while the ledger is
  missing and rewards are on or dry: restore the file from the repository's history.
- **Until $CATSANC has a valid mint** in `"contract"`, fees are still claimed and kept, and nothing
  is sampled or paid.

**Setting it up (the owner):**

1. Keep **`SOLANA_RPC_URL`** set: the hourly read of every token account (`getProgramAccounts`)
   needs a provider that serves it, and the public RPC may refuse it.
2. Set the repository variable **`REWARDS_ENABLED`** to `dry` first: real samples and periods are
   committed, and claims and payouts are built and simulated, but nothing is signed or sent. Then
   set it to `on`.
3. Optional repository variables, each clamped to its range:

   | Variable | Default | Range | What it sets |
   |---|---|---|---|
   | `REWARDS_ENABLED` | `off` | `off`, `dry`, `on` | Whether the workflow runs, and whether it sends. |
   | `REWARDS_HOLDER_SHARE_PCT` | 100 | 0–100 | The holders' share of each claim, fixed when the claim is sent. |
   | `REWARDS_EVERY_DAYS` | 7 | 1–30 | Days between payouts (one period). |
   | `REWARDS_RELEASE_PCT` | 50 | 10–100 | The share of the unallocated SOL each close releases. |
   | `REWARDS_WALLET_CAP_PCT` | 10 | 1–100 | The most one wallet gets of a period's pot; what it holds back stays in the pot (100: no cap). |
   | `REWARDS_MIN_BALANCE_PPM` | 100 | 10–10000 | The smallest holding that counts, in millionths of the supply (100 is 100,000 $CATSANC). |
   | `REWARDS_MIN_PAYOUT_SOL` | 0.001 | 0.0001–0.1 | The smallest payout; less waits for the next. |
   | `REWARDS_MIN_CLAIM_SOL` | 0.01 | 0.001–1 | Fees are claimed once at least this much waits. |
   | `REWARDS_MAX_TX_PER_RUN` | 10 | 1–50 | Payout transactions per run. |
   | `REWARDS_MAX_SOL_PER_RUN` | 2 | 0–20 | The most one run pays out, transfers and fees. |
   | `LAUNCH_PRIORITY_MICROLAMPORTS` | 100000 | 0–1000000 | The launcher's priority fee, used for claims and payouts too. |
   | `LAUNCH_MIN_BALANCE_SOL` | 0.02 | at least 0.01 | The launcher's floor: a payout leaves it, plus what the holders are owed. |

   The site's three lines quote the rules in force: each hourly sample records them in
   `data/rewards/state.json` ("rules"), and the site words its lines from them (7 days, half, 10%,
   100,000 $CATSANC, 0.001 SOL until a sample has recorded others). Changing a variable needs no
   code change; the site shows the new numbers after the next sample and deploy.
4. Changed the coin? Put the new mint in `"contract"`, then run the Rewards workflow by hand with
   `new_epoch` set to it. The period closes, everyone starts again at age 0, and what each wallet
   is owed is kept and paid. The run by hand waits behind the hour-long run in progress, and the
   next scheduled run can displace it (GitHub keeps one waiting run per group): check that it
   completed, and run it again if it shows as cancelled (until then every run warns about the
   changed contract and samples nothing).

**Excluding a wallet (the owner):** add it to `data/rewards-exclude.json` with a short reason (1 to
200 characters; the site's wallet box shows it) and commit:

```json
{ "note": "…", "exclude": [ { "address": "<the wallet>", "reason": "Team vesting wallet" } ] }
```

It stops earning at the next hourly check; what it was already owed is still paid. The wallets in
`data/wallets.json` and every program address are excluded already. A file that does not parse (a
bad address, an address listed twice, a missing reason) stops the samples until it is fixed:
nothing is counted against a list the workflow cannot read. Nothing else stops: the tests never
read this file, so a typo in it never holds up a deploy, a launch or the payouts.

**Stopping it:** set `REWARDS_ENABLED` to `off` (or delete it). Nothing more is claimed, sampled or
paid. What the holders are already owed stays theirs: the launcher keeps holding it back from
launches, together with whatever claims (a stranger's) landed since the ledger's cursor, reading the
wallet's history since that cursor on each launch; it is paid once the rewards are on again. For a
long pause, `dry` is better: it keeps counting (and so keeps that history short) and sends nothing.
Disabling the Rewards workflow alone does not stop it: the variable decides. A claim or payout
already sent is settled the next time the workflow runs.

## Unread transactions

The check reads transactions in version 0 (and legacy). A transaction that names a listed wallet
but comes in a newer version cannot be read yet: it is kept in `data/collection-state.json`
(`unread`), read again on every run, and every run's log carries a warning about it. It never
fails the run (anyone could send one, and a failed run publishes nothing). If the warning names
a launch of yours, open it on Solscan to confirm it, then either teach `scripts/lib/chain.mjs` the
new version (record the transaction as a fixture first) or launch again in the usual way.

## Fan-tribute cats and held cats

A cat whose look follows a company's cat (its `whyLook` says it follows, copies or "is the"
company's cat) is planned as a fan tribute: its description must carry, and its card shows,
"Fan tribute to <Company>'s cat. Not affiliated with or endorsed by <Company>." The planned-cats
builder stops on such a cat without that line (a sheet entry may also name it in `tribute`).
`data/held.json` can still hold a planned cat back from the garden (with its portrait); it is
empty now. To bring a held cat back, delete its row and run the planned-cats builder again.

## When a launch sheet or the research changes

Re-run the planned-cats builder with **every** sheet:

```sh
node scripts/build-planned.mjs path/to/launch-sheet.json path/to/launch-sheet-2.json
npm test
```

- It writes only what changed.
- It skips a sheet that does not exist yet, with a note.
- It refuses to drop a cat that `data/planned.json` already has unless you pass `--allow-drop`,
  so running it with a sheet missing cannot empty the garden.
- Resizing a portrait that is not already a 512 px JPEG needs `python3` with Pillow. A sheet's
  ready-made 512 px JPEG is copied as it is.

The research lives in `data/cats-info.json`. After editing it, run the builder again: a test
fails when `data/planned.json` is out of date with the research, and that test gates the deploy.
A research link or virality source may never be a trading, buy or token page (GMGN, FOMO,
pump.fun, DEX Screener, Birdeye, Jupiter, Raydium, a StonkFun or Solscan token page, …), every
virality figure needs a `dateType` (`measured`, `as_of`, `published` or `undated`), and a link the
research could not confirm is `linkType: "reported"`, never `official_*`.

The 3D world places however many cats there are. Nothing in the page needs changing when cats
are added.

## The famous cat coins and the meadows

`data/famous.json` lists Solana cat coins that already exist, made by others (one coin per line;
Solana only, by the owner's decision, and `validateFamous` refuses any other chain): each
with its chain, contract, pair, logo (`assets/coins/<id>.webp`), market figures and when they
were read, who the cat is and its lore (the research's profile, else the coin's own description,
else a plain line from its listing; such a card says "Lore not researched yet"), its X and
website, one buy link (its GMGN page), honest warnings, and a "not affiliated" line.
`assets/collection.js` (`validateFamous`) checks every row, in the page and in the tests; a coin
that fails is left out, and a missing file leaves the stock cats as they are. Trading and
liquidity warnings are worked out on the card from the latest figures (`marketWarnings`).

Where a coin lives (`tier`, set when it was placed, never moved by a refresh): the main garden for
coins of $1M and up and for company or project cats; meadow ring 1 ($100k to $1M) and ring 2
(below $100k) round the fence. The meadow cats are streamed (`assets/world/meadow.js`): only those
near the view are simulated at full rate, far ones rest, and the farthest are not drawn until the
camera comes near.

The **Famous coins** workflow (`.github/workflows/famous.yml`) runs `node scripts/refresh-famous.mjs`
daily: market cap, liquidity and 24 h volume from DexScreener's and CoinGecko's free endpoints,
committed only when the file changed and still validates.

A per-coin model goes in `assets/models/cats/` like a stock cat's; its key in `index.json` may be
the coin's id, contract (or `<chain>:<contract>`) or a symbol only one coin has
(`assets/ui/models.js`). Until then a coin uses the shared model, tinted from its look or logo.

## Running it locally

The page uses ES modules, so serve the folder over HTTP rather than opening the file:

```sh
python3 -m http.server 8000     # then open http://localhost:8000/
```

- `?debug` exposes `window.__world` for checks and screenshots.
- `?debug&noadapt` also turns off the automatic resolution drop on slow frames.
- `#cat=<TICKER>` opens a cat's card directly, for example `#cat=PEWTER`.

## Deploying, and DNS

Pushing to `main` deploys the site. `.github/workflows/pages.yml` runs the tests in a job that
can only read the repository (a failing test stops the deploy), then a separate job copies what a
visitor loads, from the commit the tests passed, into `_site` and publishes it to GitHub Pages. It
leaves out `scripts/`, `tests/`, `.github/`, the package files, Markdown notes, the builder's
state file, `data/held.json`, `data/launches.json` and the launcher's ledger and approvals (`coins/`,
the metadata of the coins the launcher launches, is published). It also deploys after an hourly Collection
run that committed something. The hourly Collection run is gated only by the builder's own tests
(`npm run test:builder`), so a content test can hold up a deploy but never the recording of a
launch.

One-time setup:

1. **Repository → Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Custom domain:** `catcoinsanctuary.com`. It is already in the `CNAME` file. Tick
   **Enforce HTTPS** once the certificate is issued.
3. **DNS at the domain's registrar:**

   | Host | Type | Value |
   |---|---|---|
   | `@` | A | `185.199.108.153` |
   | `@` | A | `185.199.109.153` |
   | `@` | A | `185.199.110.153` |
   | `@` | A | `185.199.111.153` |
   | `@` | AAAA | `2606:50c0:8000::153` |
   | `@` | AAAA | `2606:50c0:8001::153` |
   | `@` | AAAA | `2606:50c0:8002::153` |
   | `@` | AAAA | `2606:50c0:8003::153` |
   | `www` | CNAME | `<your-github-user>.github.io` |

   Remove any other A, AAAA or CNAME records for `@` and `www`, such as a registrar's parking
   page.
4. **Verify the domain** for your GitHub account or organisation (Settings → Pages → Verified
   domains). This stops anyone else from pointing a Pages site at it.
5. **Optional:** add a repository secret `SOLANA_RPC_URL` (an https RPC URL of your own) for the
   hourly check. Without it, the check uses the public mainnet RPC, slowly and gently.

The actions in both workflows are pinned to full commit SHAs.

## Tests

```sh
npm test                 # node --test, Node 22 or newer, no dependencies
npm run test:builder     # only what the hourly Collection run needs
```

Tests that read the shipped data use the real clock (`DATA_NOW` in `tests/helpers.mjs`), so a
launch or a research source dated after the day the data was built never trips them; tests on
recorded fixtures keep a fixed one.

| File | Covers |
|---|---|
| `chain.test.mjs` | Proving a launch against six real recorded StonkFun launches, and hostile variants: re-priced launches, a swapped pair mint, the wrong token program, another payer, other programs, lookup-table and co-signer tricks; every signature verifying over the rebuilt message. |
| `build.test.mjs` | The hourly builder: cursors, budgets (count and time), idempotent re-runs, never dropping a cat, failing safely, floods, listed launches, an RPC that answers with another transaction or unsigned relabels, version-1 transactions read again. |
| `collection.test.mjs` | The 93 stock pairs, the data rules, the wallet rules, and the GMGN, FOMO, Solscan and StonkFun link formats. |
| `planned.test.mjs` | The planned-cats builder, held cats, the "no company's cat as a picture" check, the research rules (no trading links, virality date types, reported links), and that the shipped `data/planned.json` is valid and matches the research. |
| `residents.test.mjs` | Merging planned cats with launched tokens. A cat gets buy links only once launched, and only for its own mint. |
| `page.test.mjs` | The page's scripts cannot write HTML from data, make no request to another host, and its security policy allows only its own origin. |
| `site.test.mjs` | See below. |
| `workflows.test.mjs` | Pinned actions, least-privilege permissions, and what each workflow runs. |
| `launcher.test.mjs` | The automatic launcher: who it launches (the policy and every exclusion), where (pump.fun in SOL, StonkFun in a free stock pair, pump.fun in a listed coin with the opt-in; one cat per pair), the fallback to SOL before a send and never after, the caps and the balance floor on a simulated balance, dry mode, the metadata it hosts and waits for, the ledger (never a mint before the send), every crash point (one post, one mint), recording the cat and its one X post, the key never in a log line, no dependency. |
| `launchlab.test.mjs` | A StonkFun launch built and signed offline: StonkFun's pricing (two real answers) and its bounds, all six recorded launches rebuilt byte for byte, and the sign-time checks. |
| `pump-quote.test.mjs` | A pump.fun launch priced in a listed coin, and the Collection's proof of one (also in `npm run test:builder`). |
| `venues-routing.test.mjs` | The owner's routing rule, the ties in `data/cat-watch.json` (valid, however they are laid out), one cat per stock pair, and that every row of `data/pump-quotes.json` is accepted. |
| `launch.test.mjs` | The Launch workflow: pinned actions, permissions per job, the wallet key in one step only, no npm, a commit after each phase, dispatches from jobs that run no repository code. |
| `rewards.test.mjs` | The $CATSANC holder-reward rules: the age bonus, the mint gate and the bracketed supply check, reading a sample, the reserved and program addresses that never earn, lots and points (lazy equal to eager), the period close and its cap (which hands nobody another wallet's share: a sniper or a split wallet gets only its points' share), owners that can never be paid, the payout plan (near-equal batches, held wallets), the ledger and its identity, expired rows found on chain, I1 and I2, the launcher's earmark, the site's lines for any rules in force, and every scenario of the spec re-run. |
| `pump-fees.test.mjs` | Claiming the launcher's creator fees: every instruction byte for byte, the checker refusing anything else, what waits to be claimed, and measuring a real mainnet claim. |
| `panels.test.mjs` | The About and Socials panels and `data/socials.json`, and About's Holder rewards section: its three lines (for the rules state.json records) and age bonus equal to the rules' own, a 15-day scenario run through the real rules and shown (the totals, the next payout, the last payout's Solscan links, the wallet box's tokens, age bonus, points share, owed and paid), files that do not read reported, never shown, and its stylesheet linked only when About opens. |
| `rewards-cli.test.mjs` | The Rewards workflow and `scripts/rewards.mjs` end to end against a fake Solana: the hidden sample (a burn between the reads, unpayable owners at a close, the rules recorded), claims measured into the pot, payouts written "sending" first and never past the pot or into the launcher's reserve, one failing recipient held while the others are paid, a flood of transactions counted over several runs, a lagging node never making a payout "expired" on one answer, dry mode counting and sending nothing, a missing file refused, every crash point (a lost record is found on chain, never paid twice), the key never in a log line. |
| `models.test.mjs` | The Models workflow (pinned actions, permissions per job, fail closed on `MODELS_ENABLED`, each API key in its one step, no wallet secret, the token only in the push) and `scripts/models.mjs` with fakes: which cats it makes, the credit reserves, the retries, the checks a model must pass, and discarding one that fails. |

`site.test.mjs` checks the site as a whole:

- Nothing the page loads comes from another host: the head, the CSS, the module graph and the
  models.
- Every file it names exists.
- The head carries the title, description, canonical address, a 1200 × 630 sharing picture and
  the icons.
- The first view stays within its weight budget.
- It renders every real cat's card and list row with a small stand-in DOM, from the data as
  shipped: a cat with no proven launch says **Not launched yet**, shows its ticker without a `$`
  and has nothing to buy; a launched one shows exactly the GMGN and FOMO links for its own mint.
- With a real recorded launch as a sample, only that cat's card shows GMGN and FOMO buy links for
  its own mint, and a buy link on any other host or path is dropped.
- About's Holder rewards section reads the shipped rewards files from this site (and Pages publishes
  them), links only to Solscan transaction pages and the ledger, and says it is not financial advice.

## Where things are

| Path | What |
|---|---|
| `index.html`, `assets/site.css` | The page: the world fills the window, with a light overlay on top. |
| `assets/ui/` | The overlay: the card (`card.js`), Find a cat (`finder.js`), About and Socials (`panels.js`) with About's Holder rewards section (`rewards.js`, `rewards.css`), the checks on every field (`data.js`) and the start-up (`main.js`). |
| `assets/world/` | The 3D world: sky, sun and clouds (`sky.js`), the garden (`garden.js`), birds and butterflies (`critters.js`), the cats' behaviour (`cats.js`, `nav.js`, `layout.js`), drawing the cats (`catviews.js`) and the scene, camera and picking (`world.js`). |
| `assets/residents.js`, `assets/collection.js` | Loading and checking the three data files, merging cats with tokens, buy and explorer links, and the stock pairs. |
| `assets/models/` | The cottage and the cats (glTF). See `PROVENANCE.md`. |
| `assets/portraits/` | One 512 px portrait per planned cat. |
| `assets/ingame/` | One 1600 x 900 in-game shot per cat, the second image on its X post (never loaded by the page). |
| `assets/og-image.jpg`, `favicon.ico`, `assets/icons/` | The sharing picture (a screenshot of the world) and the icons. |
| `data/planned.json` | Planned cats and the research for every stock pair (built). |
| `data/collection.json`, `data/collection-state.json` | Proven launches, and the builder's cursor (built hourly). |
| `data/wallets.json` | The wallets whose launches count. |
| `data/launches.json` | Launch signatures listed by hand (and by the launcher), proved first on every run (optional). |
| `data/sanctuary-launches.json`, `data/launch-approvals.json`, `coins/` | The launcher's ledger, the posts the owner approved, and each launched coin's metadata. |
| `data/rewards/`, `data/rewards-exclude.json` | The $CATSANC holder rewards (see "Holder rewards"): the sampling state, the ledger of claims and payouts, each period's split (written by the Rewards workflow, shown in About), and the wallets the owner excludes. |
| `data/held.json` | Planned cats held back until their picture is redrawn. |
| `data/cats-info.json` | The sourced research, one entry per stock. |
| `scripts/` | `build-planned.mjs`, `build-collection.mjs` and their helpers. |

## In-game shots for X posts

Every cat's announcement on X (`scripts/announce.mjs`) carries two pictures: its lore or real photo
(`assets/lore/<KEY>.webp`, else its portrait) first, and its in-game look, `assets/ingame/<KEY>.jpg`,
second (with a "🎮 + its in-game look" line when the post has room). If only one exists, that one is
posted; if an upload fails, the post goes out with whatever uploaded.

For a new cat, take its shot before it is queued:

```sh
node scripts/capture-ingame.mjs KEY…      # these cats (retakes them)
node scripts/capture-ingame.mjs           # every postable cat with no shot yet
```

It serves the site on a free local port, opens it in headless Chromium (Playwright) at `?q=high`,
flies the camera to each cat with the HUD hidden, waits for its full model and saves a 1600 x 900 JPG
(about 150 KB). Look at the shot before committing it. A cat in `data/release-queue.json` is not
released until its shot exists: the release readiness check wants a proof, a portrait, a launch kit
and the in-game shot.

## The rules the page keeps

- Every fact, figure and link on a card comes from a source that was opened, with its date.
  Where there is no figure, the card says "Not measured".
- A cat counts as launched only with a well-formed mint that the hourly check proved. Otherwise
  it is "Not launched yet".
- Buy links appear only for a launched cat, and only the exact GMGN and FOMO pages for its own
  mint. Research links are never trading pages.
- Only https links are shown. Portraits must be files on this site.
- About's Holder rewards section shows only what the committed rewards files say, each checked
  first (a file that does not read is reported, never guessed at). Its only outbound links are
  payout transactions on Solscan, and it says it is not financial advice.
- Catcoin Sanctuary is not affiliated with StonkFun, with the issuers of the tokenised stocks, or with
  any company whose stock a cat is paired with. Memecoins have no intrinsic value. Nothing here
  is financial advice.

## Research Team (runs on your laptop)

The cottage in the garden is **Research HQ**. Its "team" is Claude Code, run by you, on your
laptop, when you want it. Nothing runs on a server and nothing runs when the laptop is off.

1. Install Claude Code once: `npm install -g @anthropic-ai/claude-code` (Node 22+), then run
   `claude` and sign in with your Claude account.
2. Open the repo: `cd cat-sanctuary && claude`.
3. Type **`/scout`** (optionally a focus: `/scout TV and film cats max 5`). It searches the web and
   X for cats with real lore (companies, celebrities, TV/film, crypto projects, viral cats) that are
   not in `data/adoptables.json` or `data/planned.json`, verifies each with an X post (read through
   api.fxtwitter.com) and a reliable web source, checks DexScreener/Jupiter for existing coins
   (skips a cat whose coin is over $50k), proposes a name, ticker (checked free on Jupiter and
   StonkFun), look, category and pair, and writes them to `data/research/inbox.json`, plus a run
   entry in `data/research/log.json`. It is read-only on the web: it never signs or sends a
   transaction and never posts to X. The instructions are in `.claude/commands/scout.md`.
4. Review: `npm run scout:status` for a summary, `npm run scout:review` to read the candidates,
   `npm run scout:review -- --approve <id>` to add one (it goes into `data/adoptables.json` and is
   held from X in `data/announced.json`; its research row is kept in
   `data/research/adoptables-source.json`), or `-- --reject <id> --why "…"`.
5. Commit and push as usual; the house on the site reads `data/research/log.json`. For ~6 hours
   after a scan its lights are on, the rooftop antenna turns and a bubble says "Scanning the net…
   N new leads"; after that it says "Research team resting — last scan …". Clicking the house
   opens a small panel (last scan, cats found this week, latest leads, how the research works).

**How often:** once or twice a week is plenty; each run adds up to ~10 leads.
**What it costs:** nothing extra. It uses your own Claude plan's usage (a run is a few dozen web
searches and fetches, so it counts like a longer Claude Code session). No API keys or servers.
## Adopt a cat (a hand-off)

Every planned or adoptable cat that has not launched has an **Adopt this cat** button on its card. It opens the Adopt panel (`assets/ui/adopt.js`), which hands the visitor everything needed to launch the cat's coin **themselves**:

- the LAUNCH KIT words, each with a copy button: token name (at most 32 characters), ticker (at most 10), description (the cat's lore, its proof link and "Not affiliated with <owner>. A memecoin with no intrinsic value; not financial advice."), website (the cat's card, `https://catcoinsanctuary.com/#cat=<TICKER>`) and X (the proof post, or blank);
- the logo: the real photo from the cat's X proof post when it has one, hotlinked from `pbs.twimg.com` with its credit and a note to ask the owner's permission (never copied to this site), and our Sanctuary portrait as a free-to-use 1024 x 1024 PNG download (the only logo when the post has no photo);
- an optional 1500 x 500 banner ("Include banner", on by default), Sanctuary-style or plain;
- a **Launch on StonkFun** button (with the quote token to pick and its mint, after StonkFun's terms: 18+, restricted regions) and a **Launch on pump.fun** button (SOL pair). Both open the launchpad's own create page in a new tab.

The visitor decides the final details on the launchpad and is the coin's creator. This site (the page) never signs or sends anything, holds no keys and takes no fee; the sanctuary's own launches are the Launch workflow's (see "Launcher"), with its own wallet. Neither launchpad reads its form from the address (checked 2026-09-26: pump.fun/create reads only `?mayhem=true`; StonkFun's /launch reads no query and has no description field), so the flow is copy-and-open.

The kit pictures are built by `python3 scripts/build-kits.py [--offline] [TICKER ...]` into `assets/kits/<TICKER>/` (`token.png`, `banner.png`, `banner-plain.png`) and listed in `assets/kits/kits.json` with each token logo's `tokenSha256` and the proof photo's URL and credit. Run it again after portraits or lore pictures change (`--offline` keeps the photo URLs already found and calls nothing).

**Finding an adoption later (not built yet).** A launch made from a kit is an ordinary launch by the visitor's wallet, so the hourly Collection job (or a later check) can find it by matching new StonkFun and pump.fun launches on the kit's exact name and ticker, and confirm it by the token image's hash (`tokenSha256` in `assets/kits/kits.json`; a visitor who used the real photo or edited the image will not match on the hash, so name and ticker plus the quote token are the main key). Until that check exists, an adopted cat still shows "Not launched yet".

