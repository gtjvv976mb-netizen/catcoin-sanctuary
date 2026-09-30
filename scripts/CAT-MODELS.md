# Per-cat 3D models: the pipeline

Every cat can have its own model, made from its own picture, instead of the shared tinted base
models. The page loads `assets/models/cats/index.json` after the first picture is up and
fetches each listed cat's far copy, then its full model, nearest and in-view cats first.
A cat not in the index keeps the old tinted model, so the pipeline can run in batches.

## 1. Higgsfield (through the Higgsfield tools)

1. **Balance first** (`balance`). Costs: gpt_image_2_5 about 0.25 credits, tripo_h3_1_image_to_3d
   9 credits (12000 faces, texture on, PBR off). If credits run out, stop; cats without a model
   stay on the tinted base models.
2. **A standing reference** (gpt_image_2_5, the cat's picture job as `image_references`). The rig
   needs every cat standing on all four legs. Prompt used for the 24 planned cats:
   > The exact same {coat description} as in the reference image: same faceted low-poly art style,
   > same colours, markings, face and eyes[ and the same outfit]. Shown alone, full body, standing
   > naturally on all four legs like a real cat: a real quadruped stance with a horizontal back,
   > all four paws flat on the ground, legs straight and clearly separated with a clear gap under
   > the belly, head up looking ahead, tail held out behind and gently raised. Realistic cat
   > proportions, never upright or human-like. Seen from the side at a slight 3/4 angle with the
   > head to the right. Plain flat light grey background, no props, no ground, no text.
   Outfits stay (hat, cap, headband, tunic). Held props (a wand, a bow) are left out, since a
   walking cat can't hold them. Check the image before 3D: four separate legs, a gap under
   the belly.
3. **Image to 3D**: `generate_3d` with `tripo_h3_1_image_to_3d`, the standing image's job id as
   `image_references`, `face_limit: 12000, texture: true, pbr: false`.
4. Record it in `scripts/cat-models.jobs.json`: `image_job` (picture), `clean_job` (standing
   reference), `model_job`, `url` (the .glb result URL), `status: "done"`.

Higgsfield's rigging (Meshy) and its 678 animation clips are for humanoids only, so they are not
used. The cats are rigged in the browser instead (see 3).

## 2. Local: normalize, shrink, pack

    npm i gltfpack           # or any gltfpack 0.24 on PATH
    python3 scripts/make-cat-models.py --gltfpack node_modules/.bin/gltfpack [TICKER ...]

This downloads each raw GLB (cached in `scripts/.cat-models-cache/`, ignored by git) and turns
the model so its head points at +X. The body's long axis comes from the principal axis of its
footprint, and the head end is the end with more of the model up high. It then sets y up,
1 unit tall, feet on y = 0, centred. The colour texture becomes a 1024 px JPEG (512 px for the
far copy), and the PBR extras go. gltfpack packs it with `-kn -km -tr`, and `-si 0.25` for
`<TICKER>-lo.glb`. Finally it rewrites `index.json` and the table in
`assets/models/PROVENANCE.md`. Budgets are 600 KB full and 150 KB far; the 24 cats come to about
230-340 KB and 70-115 KB. `--yaw DEG` turns a single model if the automatic heading is ever wrong.

## Automatic: the Models workflow

`.github/workflows/models.yml` makes the model, packs it, runs the checks (budgets, a valid GLB, the
garden's rig on the model, tests/catmodels, catrig and meshy), Tripo's rig and a preview for the cats the
sanctuary launches (`scripts/models.mjs`; README "Launcher"). A model that fails the checks is discarded.
The facing and the look still want a person's eye (section 3).

The repository variable `MODELS_GENERATOR` picks the tool that makes the model:

- **unset** (the default), `off` or `higgsfield`: no API makes a model and no API credit is spent; the
  owner makes it by hand through Higgsfield (section 1).
- **`tripo`**: `scripts/tripo.mjs make KEY` with the official Tripo CLI
  (`tripo-cli` 0.5.1, key `TRIPO_API_KEY`; the workflow installs it from `tools/tripo-cli` with
  `npm ci --ignore-scripts`, every package, the CLI's own dependencies too, at the version and hash its
  `package-lock.json` names), in two tasks, about 40 credits:
  1. `tripo generate image-to-image <picture> --model banana2 --prompt "<TRIPO_REPOSE> <referencePrompt> <TRIPO_STANDING>" -p aspect_ratio=4:3`
     (about 10 credits): the queue entry's picture (`styleImage`: the post's photo URL as it is, or a
     PNG/JPEG/WebP in the repository, uploaded by the CLI) redrawn standing on all four legs, with the Meshy
     reference's pose words said shorter (`tripoPrompt` in `scripts/tripo.mjs`). Tripo takes at most 1024
     characters for a picture's prompt, so the pose words stay whole and a long `referencePrompt` is cut at
     a sentence, clause or word to fit. An entry with no picture (`"generate"`) gets
     `tripo generate text-to-image "<referencePrompt> <TRIPO_STANDING>" --model seedream_v4`
     (about 5 credits). A photo's own pose would stay otherwise, and a sitting cat fails the rig check.
  2. `tripo generate image-to-model <reference task> --model tripo-v3.1 -p face_limit=12000 -p texture=true -p pbr=false`
     (30 credits). The model is always named: with a face budget of 20000 or less and no `--model`, the CLI
     picks P1 (50 credits). Never `compress=geometry` (the packer cannot read meshopt) or `quad` (FBX only).

  The balance is read first; the run stops, with no try used, when the cost would take it under
  `MODELS_TRIPO_MAKE_RESERVE` (0 by default: Tripo itself refuses an empty balance). Each task id is saved
  in `scripts/tripo.state.json` (`<MODELKEY>.make`) as soon as it is known. Each CLI call is killed at its
  own bound, so one cat takes at most 75 minutes, and the workflow starts a cat only while that still fits
  in its make step. The GLB is downloaded at once
  (Tripo's result URLs expire) to `scripts/.cat-models-cache/<MODELKEY>.raw.glb`, with the stamp
  `<MODELKEY>.raw.job` (the model task), where `make-cat-models.py` reads it (the workflow carries it to the
  Pack job under `raw/` in the artifact, since the upload leaves out hidden folders; Pack never downloads
  Tripo's link, and the packer downloads only an `https://` link); the job entry carries
  `model: "tripo v3.1-20260211 image-to-model"`, `faces: 12000`, and no `lo_url`: Tripo's UV atlas
  simplifies cleanly into the far copy (`-si 0.25`), as the Tripo models of section 1 did.
- **`meshy`**: `scripts/meshy.mjs run KEY` (reference views, multi-image-to-3D, a remesh far copy; about
  41 credits; `MODELS_MESHY_RESERVE`, 100 by default).

Any other value makes nothing. By hand: `node scripts/tripo.mjs balance`, then
`node scripts/tripo.mjs make <TICKER> [--reserve N]` and the packer as in section 2.

## 3. Check by eye

    node scripts/render-cat-thumbs.mjs OUT --pictures DIR   # picture | 3/4 view | side (head right) | far copy
    node scripts/render-cat-clips.mjs OUT.png TICKER [PHASE] # the rigged cat in every clip

Regenerate the standing image (and then the 3D) once if the model's colours, outfit or legs are
wrong.

## Runtime (assets/world/catrig.js, catviews.js)

- `findRig` finds the paws, belly and back lines, head and tail from the model's points.
  `buildSkeleton` builds the same bone names for every cat: root, pelvis, spine, chest, neck,
  head, tail1-4, and thigh/shin/foot plus arm/forearm/paw on each side. `skinWeights` weights
  each vertex by region (leg, tail, head, body) with inverse distance to the bones.
- `makeClips` generates the clips procedurally: a clip for every action in catmotion.js (walk, trot,
  run, stalk, stand, sit, loaf, sleep, groom, pounce, the posture changes, ...), pivot and the
  pull-ups. Gaits keep real cats' footfalls: walk and stalk are a lateral sequence (left hind, left
  fore, right hind, right fore, a quarter cycle apart; the shoulders' roll and swing follow the
  forelegs), trot moves diagonal pairs, and run is a rotary gallop with the back rounding and
  stretching. The head is held level and steady over the gait; the pounce gathers from the
  wiggle's crouch, stretches out in the air and lands. tests/catrig.test.mjs checks the footfalls.
- catviews.js (animateOwn) sets each clip's weight and time from cat.motion: per-clip fades, one
  gait phase stepped by the distance walked (`cyclesPerUnit`, so paws don't slide) and blended
  between gaits, idle loops at each cat's own phase; then procedural layers: the head turns to
  what the cat looks at, the back bends into turns, the tail is a damped spring, ear-flick twitches.
- Behaviour (cats.js): walking, the head looks along the way ahead, so it leads a turn; chasing or
  stalking, it stays on the prey.
- LOD: the nearest 10 cats within 16 units get the full model; the rest use the far copy on the
  same skeleton, and their animation updates at up to 20 Hz.
- `?still`: no motion. Each cat holds a sit, loaf or sleep pose.

## HD pipeline (Hunyuan3D v3, multi-view), from 2026-09-26

For every new cat: (1) the standing 3/4 reference as in section 1; (2) four gpt_image_2_5 views made from that
reference ("orthographic turnaround view of the exact same animal…"): front, left (head pointing to the left edge),
back, right; (3) `generate_3d` with `hunyuan3d_v3_image_to_3d` and the four view job ids in the order
front, left, back, right, default face count (~500k faces; 15 credits, a custom `face_count` costs 19). About
16.25 credits per cat. The job entry carries `hd: true, si: 0.04, si_lo: 0.01, tex: 2048, q: 78, tex_lo: 256`,
which make-cat-models.py uses to simplify to ~20k faces with a 2K texture (budget 800 KB) and a far copy
(budget 300 KB; gltfpack stops at ~6k triangles on Hunyuan's fragmented UV atlas, so most land at 140-200 KB).
index.json marks these cats `hd: true`. What is left is in `scripts/cat-models.queue.json`.

### 2026-09-26 (second run): realistic adoptables, lore pictures, queue

- Adoptable cats: a realistic portrait made from the real cat's proof photo (cropped to the cat), a standing
  reference made from that portrait, four views, Hunyuan3D v3. Characters the image model refuses by name
  (Meowth, Sylvester) went through nano_banana_pro. Job entries carry `source: "adoptable ..."`.
- Queue cats: the queue's old `ref_job`s belong to another Higgsfield account and cannot be used; each cat's
  standing reference was remade from its site portrait (stock cats) or coin logo (famous coins).
- Famous coins are keyed in index.json by their data/famous.json `id` (e.g. `cate-meme`), which
  `modelIdFor` resolves.
- Far copies gltfpack cannot bring under budget get `sa_lo: true` (aggressive simplification, `-sa`).
- `--yaw 180` was needed for BENBUTTON, CHOUPETCAT and CROOKSHNK (long fluffy tails fooled the heading test).

### 2026-09-26 (third run): Hall of Fame, xStock redo, next adoptables

- Hall of Fame: RKC (`red-kitten-crew`) and LEVERCAT (`leveraged-cat`) got HD models from their coin logos. SOMETHING, SC and
  MASK stay in the queue but are no longer in data/famous.json, so nothing on the page would use them.
- The 24 xStock cats' Tripo models were redone with the HD method: standing reference from the realistic site portrait,
  four views, Hunyuan3D v3. The old Tripo job is kept as `prev_model_job`.
- Adoptable cats 26-90: realistic portrait from the proof photo (or the source page's image when the X post had none,
  or the research look alone when neither showed the cat), standing reference, four views, Hunyuan3D v3. Two-cat entries
  (Sushi & Tuna, Cole & Marmalade) and Kuroneko's mother-and-kitten logo are modelled as one cat; Octocat stands on four
  legs with tentacles for a tail.
- Most HD cats now pack at `si 0.03, q 70`; the few still over the 800 KB budget were redone at a lower `si`/`q`.

Run result: 60 of 65 new adoptables have HD models. SNOWBALCAT, PUSSBOOCAT, TRIMCAT, TUBBSCAT and SGTTIBBS
failed twice on Hunyuan and have no model yet. 21 of 24 xStock cats were redone as HD. PATCHPAW, SOCKFOOT and
COUCHCAP failed twice and keep their Tripo models. MAYORSTUB and SEACAT meshes did not simplify well: MAYORSTUB
uses si 0.02 with a 1024 texture, and SEACAT's model was generated a second time and uses si 0.015 with a
1024 texture. SNOWBELCAT needed yaw 180.

### 2026-09-30: Tripo H3.1 multi-view, detailed (the method from now on)

Hunyuan3D failed often when many jobs ran at once, and its fur and markings came out soft. Every cat is now made
with `generate_3d` and `tripo_h3_1_multiview_to_3d`, with the four view job ids in the order front, left, back,
right, and `texture: true, pbr: false, texture_quality: "detailed", geometry_quality: "detailed",
texture_alignment: "original_image"` (about 21 credits). Fur strands, whiskers, collars and markings now come
through in the texture. The steps before it are the same: a realistic portrait from the proof photo
(gpt_image_2_5, high), a standing 3/4 reference (high), and four orthographic views (high from this run on).

Job entries carry `hd: true, si: 0.02, si_lo: 0.003, tex: 1024, tex_lo: 256, q: 88`: about 50k triangles and a 1K
texture at high JPEG quality, 800-1000 KB full and 120-260 KB far (the HD budget is 1.3 MB full, 300 KB far). A 2K
texture doesn't fit with that much geometry, and the packer's fallback for an over-budget model drops straight to a
256 px texture, so check `tex` in the entry after packing. A far copy still over 300 KB gets `sa_lo: true` with
`si_lo` 0.004-0.01 (this scrambles the far copy's texture a little, which does not show at far-copy distances). The Hunyuan models were redone this way; the
old model job is kept as `prev_model_job`. SNOWBALCAT, PUSSBOOCAT, TRIMCAT, TUBBSCAT and SGTTIBBS, listed above as
failed, have had models since the third run.
### 2026-09-30: 24 models made by hand through Higgsfield

- A standing reference (gpt_image_2_5, from the lore picture, or from the lore text alone where the picture is the
  wrong cat), then tripo_h3_1_image_to_3d (12000 faces, texture on, PBR off), packed by section 2. The replaced model's
  job is kept as `prev_model_job`; `scripts/meshy.state.json` marks each cat done (no Meshy credit) so the Models
  workflow doesn't rebuild it. Big cats are drawn as adults.
- `--yaw 180` for MITTENSCAT and OSCARRI (plume tails). CORSAGE's far copy (a cat made of carnations) needs `sa_lo`.
- New MODEL_LIMITS: AMRCAT (its mound hides the head when curled: it dozes in its loaf), CAMTHECAT, MILKWEED,
  hosico-cat, ket-3; the old models' limits for SUNSTRETCH and hello-kitty-sol no longer apply. AMRCAT's, MITTENSCAT's and
  OSCARRI's Cowork leg labels (`.legs.json`) belonged to the old meshes and were dropped; tests/catrig-models.test.mjs
  takes CASENAP for its joined-forelegs sample, since AMRCAT's new forelegs are apart.
- GIMBALPAW's new model (bubble helmet and a loose scarf) was held back: the scarf tears into sheets in every pose,
  walking included, so it keeps its previous model.
