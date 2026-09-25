# World assets (generated 2026-09-25 with Higgsfield)

All models were generated in the owner's Higgsfield account, then shrunk locally:
textures resized with PIL (JPEG), meshes quantized with gltfpack 0.24 (`-kn -km -tr`,
KHR_mesh_quantization + KHR_texture_transform; three.js GLTFLoader reads both with no decoder).

| File | Source image job | 3D job | Model |
|---|---|---|---|
| sanctuary.glb (bright cream/coral cottage, cat-ear gable, cat's-eye window, porch cat tree) | 570d22ce-bf01-414c-bcf0-0dab4b56fe49 (gpt_image_2_5) | 3a66f6fe-ba98-4e4c-bec3-58b80cb1563a | tripo_h3_1, 5000 faces, texture 2048 -> 1024 JPEG, ORM/normal maps dropped, metallic 0 / roughness 0.85; door faces +x in model space (world.js turns it -90 deg) |
| sanctuary-old.glb (previous dark timber cottage, unused) | 81a64983-3976-42f4-b2d3-fdf80921bead (gpt_image_2_5) | 61087add-04d4-4d74-a7e0-4593552ed7a7 | hunyuan3d_v3 LowPoly, texture 4096 -> 1024 |
| cat-sit.glb | c0dc6227-9a1e-4375-9933-5cb61d2a5aec | b1f8f4f7-d91a-4aa1-a4f8-64e4b28b4a3a | tripo_h3_1, 3000 faces, texture 2048 -> 512 |
| cat-walk.glb | da0a3575-a115-44ce-9476-4b79afd50854 | b2c45447-146f-4291-abb4-82075c2185c3 | tripo_h3_1 |
| cat-loaf.glb | bd9c5917-492b-43cd-9030-1f30fb0eff73 | 3ffaf187-904a-4f61-8ea3-56960b0051de | tripo_h3_1 |
| cat-stretch.glb | df54da22-ef23-402d-9fa5-097bf13d4813 | af109ba3-1a67-4d95-b3e6-6850fb298cb0 | tripo_h3_1 |
| cat-sleep.glb | 975cc52a-f57f-4388-b3e0-4ee0fdde0404 | 3ba61f08-76eb-4b1b-b196-e8e31ab33bb7 | tripo_h3_1 |
| agency-fallback/coinmarketcat-plain-*.glb | ee777c1e, 459625f4, 7f3ee19f, 92beec1b, 89ea57bc | a8fdc642, e0b5b0a2, deb98b3f, 61fb7ba5, 83453e1c | tripo_h3_1 (orange tabby, no outfit) |
| agency-fallback/<cat>-plain-sit.glb | director ff2914b6, popcat 8f58107b, crying-cat 6aee7a71, grumpy-cat 909173dd, cashcat fab8041f | 5b1b8db2, 1ee8830e, c6ede134, 6ccc1884, d175a1e3 | tripo_h3_1 (coat only, no outfit) |

Approved looks for the agency cats WITH outfits and signature expressions (images only, 3D pending credits):
coinmarketcat 26060f08 (purple hoodie, grin, wave), popcat ae732d5d (pop "O", black suit+tie), crying-cat ddf0fa8b (tears, suit),
grumpy-cat 6cb9bb56 (frown, suit), director ceb7440c (black shades, earpiece, suit), cashcat 597c5ed8 (gold shades, gold chain, suit).
All base models face +X in model space (the sit/walk previews show the head toward +X); y is up; each is unit-sized and centred.
