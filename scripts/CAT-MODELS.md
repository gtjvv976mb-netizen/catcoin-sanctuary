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
