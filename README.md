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

## Unread transactions

The check reads transactions in version 0 (and legacy). A transaction that names a listed wallet
but comes in a newer version cannot be read yet: it is kept in `data/collection-state.json`
(`unread`), read again on every run, and every run's log carries a warning about it. It never
fails the run (anyone could send one, and a failed run publishes nothing). If the warning names
a launch of yours, open it on Solscan to confirm it, then either teach `scripts/lib/chain.mjs` the
new version (record the transaction as a fixture first) or launch again in the usual way.

## Held cats

A company's own cat is never a coin's picture. `data/held.json` lists planned cats whose launch-
sheet picture follows a particular cat that a company owns or published; they stay out of the
garden (and their portraits out of the site) until the picture is redrawn. The builder also stops
on any other cat whose `whyLook` says its picture follows, copies or "is the" company's cat. To
bring one back: redraw its launch-sheet picture, rewrite its `whyLook`, delete its row in
`data/held.json`, and run the planned-cats builder again. Launch a held cat only after that: its
sheet picture is the coin's picture.

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
state file, `data/held.json` and `data/launches.json`. It also deploys after an hourly Collection
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

## Where things are

| Path | What |
|---|---|
| `index.html`, `assets/site.css` | The page: the world fills the window, with a light overlay on top. |
| `assets/ui/` | The overlay: the card (`card.js`), Find a cat (`finder.js`), the checks on every field (`data.js`) and the start-up (`main.js`). |
| `assets/world/` | The 3D world: sky, sun and clouds (`sky.js`), the garden (`garden.js`), birds and butterflies (`critters.js`), the cats' behaviour (`cats.js`, `nav.js`, `layout.js`), drawing the cats (`catviews.js`) and the scene, camera and picking (`world.js`). |
| `assets/residents.js`, `assets/collection.js` | Loading and checking the three data files, merging cats with tokens, buy and explorer links, and the stock pairs. |
| `assets/models/` | The cottage and the cats (glTF). See `PROVENANCE.md`. |
| `assets/portraits/` | One 512 px portrait per planned cat. |
| `assets/og-image.jpg`, `favicon.ico`, `assets/icons/` | The sharing picture (a screenshot of the world) and the icons. |
| `data/planned.json` | Planned cats and the research for every stock pair (built). |
| `data/collection.json`, `data/collection-state.json` | Proven launches, and the builder's cursor (built hourly). |
| `data/wallets.json` | The wallets whose launches count. |
| `data/launches.json` | Launch signatures listed by hand, proved first on every run (optional). |
| `data/held.json` | Planned cats held back until their picture is redrawn. |
| `data/cats-info.json` | The sourced research, one entry per stock. |
| `scripts/` | `build-planned.mjs`, `build-collection.mjs` and their helpers. |

## The rules the page keeps

- Every fact, figure and link on a card comes from a source that was opened, with its date.
  Where there is no figure, the card says "Not measured".
- A cat counts as launched only with a well-formed mint that the hourly check proved. Otherwise
  it is "Not launched yet".
- Buy links appear only for a launched cat, and only the exact GMGN and FOMO pages for its own
  mint. Research links are never trading pages.
- Only https links are shown. Portraits must be files on this site.
- Catcoin Sanctuary is not affiliated with StonkFun, with the issuers of the tokenised stocks, or with
  any company whose stock a cat is paired with. Memecoins have no intrinsic value. Nothing here
  is financial advice.
