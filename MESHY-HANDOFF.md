# Meshy: fix the cats' 3D models (handoff, 2026-09-26)

The owner wants every cat to look **exactly** like the real cat in its lore (colours, markings,
eyes, outfit, art style) and every resident to stand on **four legs**. The lore audit
(`data/research/exact-looks.json`) found 180 of the 202 garden models off. The owner has a
Meshy subscription (**3,000 credits**) and added `MESHY_API_KEY` to this cloud environment.

## What is ready
- `scripts/meshy.queue.json`: for every cat, `action` (retexture 89 / rebuild 107 / ok 6),
  `priority` (1 = wrong at a glance), `order` (cats about to be posted on X first, then famous
  adoptables, planned cats, Hall of Fame), the Meshy prompt, and the best reference picture.
- `scripts/meshy.mjs`: the runner (read its header). `node --test tests/meshy.test.mjs` passes.
- The rest of the pipeline is unchanged: `scripts/make-cat-models.py` packs a model recorded in
  `scripts/cat-models.jobs.json`; `scripts/capture-ingame.mjs` shoots its in-game picture.

## Budget (3,000 credits, keep a 100 reserve)
| Step | Cats | Credits |
|---|---|---|
| All retextures (p1 49, p2 29, p3 11) | 89 | ~890 |
| Rebuilds in queue order until the reserve | ~55 of 107 | ~2,000 |
| Left for later (~1,850 more credits) | ~52 rebuilds | - |

## Steps
1. Setup: `pip install pillow numpy`; `npm i --no-save gltfpack`; check the key:
   `node scripts/meshy.mjs balance`.
2. **Pilot (3 cats):** `node scripts/meshy.mjs run AMBERDROP TRIMCAT --only retexture` and one
   rebuild, e.g. `node scripts/meshy.mjs run SUCCOTASH`. Then
   `python3 scripts/make-cat-models.py --gltfpack node_modules/.bin/gltfpack AMBERDROP TRIMCAT SUCCOTASH`
   and `node scripts/capture-ingame.mjs AMBERDROP TRIMCAT SUCCOTASH`, and compare each
   `assets/ingame/<KEY>.jpg` with the cat's `exactLook` by eye (Read the image). Check the model
   still stands on four legs, faces the right way (`--yaw` if not) and is under budget.
   If a retexture from the prompt looks off, try `--image` (styles from the reference picture).
3. **Full run**, in batches of ~20: `node scripts/meshy.mjs run --limit 20`, then pack and shoot
   that batch right away (Meshy's result URLs expire), check the pictures, and fix or re-run bad
   ones (a failed or bad cat can be re-run by deleting its entry in `scripts/meshy.state.json`).
4. After each good batch: `npm test` (the promo media check on branches with promo work is
   known), commit (models, `index.json`, `PROVENANCE.md`, `cat-models.jobs.json`,
   `meshy.state.json`, the new in-game shots) and push to `main`. Never merge the promo work
   (`scripts/promo.mjs`, `.github/workflows/promo.yml`, `data/promo-*`) into main.
5. Stop at the reserve and report: cats fixed, credits used, cats left (the owner can top up).

## Rules
- Exact lore, four legs, no legal hedging (owner's rules, in `exact-looks.json` `ownerRules`).
- Portraits, lore pictures and kit logos still show the old looks for ~100 cats; they are a
  separate job (Meshy image-to-image, 3-12 credits each) once the models are done.
- Never paste or print the API key.

## Pilot findings (2026-09-26)
- Pilot: AMBERDROP, TRIMCAT (retextures), CROOKSHNK, KPURRY (rebuilds): all four now match their lore.
- Meshy models made with a fresh UV layout (every rebuild; a retexture whose source UVs were too
  small, `model_insufficient_uv`) have UVs cut per triangle. gltfpack cannot simplify those
  (plain `-si` stalls; `-sa` scrambles the texture into shards). So rebuilds are made at 10k faces
  (fits the 600 KB budget unsimplified) and their far copy is a Meshy remesh to 2k faces
  (`lo_url`, 5 credits). The runner does this itself; `node scripts/meshy.mjs remesh KEY
  [--faces N]` fixes a cat by hand. Real costs: retexture 10 (15 with a fresh UV layout),
  rebuild ~41.
- The packer now fits each copy to its budget by itself and updates only the packed cats' rows in
  `index.json` and `PROVENANCE.md` (the jobs file is out of date for older cats).
- Check each shot's facing: a big plume tail can fool the heading guess (CROOKSHNK needed `--yaw 180`).
