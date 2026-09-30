# The photoreal garden's models (assets/models/world/)

The garden's trees, the cottage and its props, as the medium and high tiers show them once the first
view is up (assets/world/photoreal.js; the low tier keeps the procedural ones). None of these files is
part of the first view: the page fetches index.json and the models by path afterwards.

Each was generated in the owner's Higgsfield account with **Tripo H3.1 image to 3D** (tripo_h3_1),
from a reference picture generated there first (a photo-style image of the one object on a plain
background). The raw models (about 2 million triangles, 4k PBR textures, 60-75 MB each) are not in
the repository; scripts/make-world-models.py packs them:

- the colour texture only, as a 1024 px JPEG (512 px for the bench, lamp, cat tree and cat bed, and
  for every tree's far copy); the metal/roughness and normal maps are dropped, metallic 0, roughness 0.85;
- normalized: y up, front towards +Z (Tripo puts it at +X), standing on y = 0, centred on x/z (a
  tree on the foot of its trunk), at a sensible size in metres;
- simplified and quantized with gltfpack 1.3 (`-km -si <ratio> -sp -sa`; the cottage and the cat bed without `-sa`,
  which smears textures across UV seams and shows on the timbers and the plush). KHR_mesh_quantization and
  KHR_texture_transform only: no Draco, no meshopt, no KTX2, since the page's GLTFLoader has no
  decoders and its policy allows none;
- index.json: each model's size (`w`, `h`, `d`), its bounding box and top point (the cottage's
  chimney), and `lo` where there is a far copy.

| File | Triangles | Size | 3D job | Reference picture job |
|---|---|---|---|---|
| oak.glb, oak-lo.glb | 14.0k, 2.2k | 412 KB, 90 KB | c7a82e65-aa03-4040-83d6-4e85e4ce679f | 2c4f081d-e492-423c-87ea-ec522589ad29 |
| birch.glb, birch-lo.glb | 11.9k, 2.3k | 379 KB, 87 KB | fbc0c5c6-b0ef-4d52-b9ae-064221a24f5c | 0b8ab82c-798e-4365-a2ae-9d8772278d58 |
| cherry.glb, cherry-lo.glb | 11.8k, 2.0k | 493 KB, 114 KB | 89f272c0-520d-4a58-9c27-5bb989fe1b2d | 6c814651-431b-484b-b0dc-6ec6871ee65d |
| pine.glb, pine-lo.glb | 9.9k, 2.3k | 349 KB, 84 KB | 26819f6f-d117-4862-aaca-6015c4cd8f1c | 2aa186d0-d830-421e-8d84-342d7e9e733e |
| apple.glb, apple-lo.glb | 11.8k, 2.2k | 378 KB, 96 KB | 4c50d6be-7560-4dba-bd3e-4a63506315bf | c1fb2d4a-5370-4feb-ae80-a8d3a7f92d47 |
| cottage.glb (the sanctuary's own cottage in HD: orange tiles, cat-ear gable, cat's-eye window, porch) | 27.2k | 829 KB | daaae9b8-5056-40fe-83ad-deb4cc22eb5f (multi-view) | 130af30f, 7a38fc0a, a4cd81fb, 1abd49f9 |
| fountain.glb (two basins, a gold cat on top) | 8.0k | 409 KB | 7bba50ea-b296-4a65-a424-e5e68b13db38 | d7e4bff3-a4de-4bd7-aadb-bad26e8228ae |
| bench.glb | 4.8k | 135 KB | 2a218113-f883-4360-981e-318f1204ae4b | 1b0bd8f5-55c5-4fc8-9ae1-aeacbdb9aa71 |
| lamp.glb (garden lamp post) | 1.8k | 87 KB | 78506c7f-385a-47a9-87e5-a823d0861602 | 6b8fb9b9-d487-4fd6-919a-e958ef0983ec |
| cattower.glb | 6.0k | 166 KB | c4f2299d-39e9-4c26-8ab5-4d392e692667 | d6bf9095-bb70-4182-9ce8-23acbaa41ed4 |
| bed.glb (cat bed; a stray dark patch in its texture painted over) | 5.7k | 143 KB | a1ba16ab-20e6-4c72-8636-06113994274a | 72d3c571-9952-4c49-aacd-ed0d51362f30 |

The cottage's seams keep gltfpack from going below about 26k triangles without `-sa`, so it is over
the 600 KB each model aims for.

2026-09-30, second round (a second Higgsfield account): the trees were made again from reference
pictures of full, dense canopies (the first ones came out as bare branches with a few leaf patches),
and the cottage is now the sanctuary's own cottage (assets/models/sanctuary.glb, the one the low tier
shows) in HD: its four sides were rendered, each redrawn in high detail with gpt_image_2_5 keeping
its design, and the four views made into one model with Tripo H3.1 multi-view (texture and geometry
"detailed"). The first round's timber-framed cottage was dropped for it.

The ground's photo textures (assets/world/tex/: grass, earth, gravel, stone and bark, each 1024 px
and a 512 px copy) are tiling images generated in the same account: grass
85c8fd5a-2484-4fa1-bc7f-926542a8e7db, earth 49049a15-8a19-438b-bb47-7d8e735f0c09, gravel
256887b9-e1e0-45b3-bba2-9261115b90bd, stone 055f1f6a-837c-4e23-abbf-1b8b034fea92, bark
44387a8e-6522-4884-8888-395dfcdc394e.

To pack again: `python3 scripts/make-world-models.py [NAME ...] --raw DIR --gltfpack PATH`, with the
raw GLBs in DIR as <name>.glb.
