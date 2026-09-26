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
- `makeClips` generates the clips procedurally: walk, trot, run, stalk, stand, sniff, greet,
  sit, look, pant, groom, knead, loaf, sleep, eat, stretch, crouch, wiggle, pounce and scratch.
  An AnimationMixer per cat crossfades between them (0.3 s). Gait clips are timed by the
  distance walked (`cyclesPerUnit`), so paws don't slide.
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
