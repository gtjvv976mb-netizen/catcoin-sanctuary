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
- simplified and quantized with gltfpack 1.3 (`-km -si <ratio> -sp -sa`; the cottage without `-sa`,
  which smears textures across UV seams and shows on its timbers). KHR_mesh_quantization and
  KHR_texture_transform only: no Draco, no meshopt, no KTX2, since the page's GLTFLoader has no
  decoders and its policy allows none;
- index.json: each model's size (`w`, `h`, `d`), its bounding box and top point (the cottage's
  chimney), and `lo` where there is a far copy.

| File | Triangles | Size | 3D job | Reference picture job |
|---|---|---|---|---|
| oak.glb, oak-lo.glb | 13.8k, 2.3k | 415 KB, 100 KB | cebeaabe-6251-4a88-88ee-91099e6875de | c6181dbd-7e88-40c5-aa26-53ad70323a9e |
| birch.glb, birch-lo.glb | 11.9k, 2.4k | 361 KB, 94 KB | ff2e64cc-f7b6-43d7-907d-a5f2c918a3c4 | bbfee002-4ef6-4af9-8270-2f03a2b2c27e |
| cherry.glb, cherry-lo.glb | 11.8k, 2.2k | 441 KB, 119 KB | a9835964-dd70-4798-8915-55f8318727c0 | 32f5e6e2-753e-40aa-97e4-11969d171e6f |
| pine.glb, pine-lo.glb | 9.9k, 2.4k | 396 KB, 110 KB | 0f1ee288-dcb3-4ecc-9cb3-ee4b6185bbcc | 7745531f-94cb-4ac5-86e7-4ce5b1c47bcb |
| apple.glb, apple-lo.glb | 11.4k, 2.3k | 387 KB, 102 KB | 70b23533-47dd-47eb-a868-a8316a198469 | 7d4c5c6e-6eda-4e56-8739-8f3361770802 |
| cottage.glb (timber-framed, cat's-eye window) | 26.4k | 779 KB | 1c552a2a-31d6-4af3-a145-468b7ad322e5 | 171adf18-3664-4ea8-a093-3928d6088e65 |
| fountain.glb (two basins, a gold cat on top) | 8.0k | 409 KB | 7bba50ea-b296-4a65-a424-e5e68b13db38 | d7e4bff3-a4de-4bd7-aadb-bad26e8228ae |
| bench.glb | 4.8k | 135 KB | 2a218113-f883-4360-981e-318f1204ae4b | 1b0bd8f5-55c5-4fc8-9ae1-aeacbdb9aa71 |
| lamp.glb (garden lamp post) | 1.8k | 87 KB | 78506c7f-385a-47a9-87e5-a823d0861602 | 6b8fb9b9-d487-4fd6-919a-e958ef0983ec |
| cattower.glb | 6.0k | 166 KB | c4f2299d-39e9-4c26-8ab5-4d392e692667 | d6bf9095-bb70-4182-9ce8-23acbaa41ed4 |
| bed.glb (cat bed) | 2.4k | 81 KB | a1ba16ab-20e6-4c72-8636-06113994274a | 72d3c571-9952-4c49-aacd-ed0d51362f30 |

The cottage's seams keep gltfpack from going below about 26k triangles without `-sa`, so it is over
the 600 KB each model aims for.

The ground's photo textures (assets/world/tex/: grass, earth, gravel, stone and bark, each 1024 px
and a 512 px copy) are tiling images generated in the same account: grass
85c8fd5a-2484-4fa1-bc7f-926542a8e7db, earth 49049a15-8a19-438b-bb47-7d8e735f0c09, gravel
256887b9-e1e0-45b3-bba2-9261115b90bd, stone 055f1f6a-837c-4e23-abbf-1b8b034fea92, bark
44387a8e-6522-4884-8888-395dfcdc394e.

To pack again: `python3 scripts/make-world-models.py [NAME ...] --raw DIR --gltfpack PATH`, with the
raw GLBs in DIR as <name>.glb.
