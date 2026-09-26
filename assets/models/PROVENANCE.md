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

## Per-cat models (assets/models/cats/)

Each cat's own model, made from its own picture by scripts/make-cat-models.py (see scripts/CAT-MODELS.md).
Normalized: y up, facing +X, 1 unit tall, feet on y = 0; texture 1024 px JPEG; gltfpack 0.24 -kn -km -tr.
<TICKER>-lo.glb is the far copy (gltfpack -si 0.25, 512 px texture).

| Cat | Picture job | Clean image job | 3D job | Model | Full | Far |
|---|---|---|---|---|---|---|
| PATCHPAW | 6dc202df-47c4-426b-99c1-40f6dfe915e0 | 155eb386-ccfa-45b1-9153-329929408fe2 | 40724ed0-b4b6-49e1-9784-34398e20882e | tripo_h3_1_image_to_3d, 12000 faces | 322 KB | 112 KB |
| WHISK100 | 5c75f0aa-dcb6-4641-aa4d-f14bef38bb9f | 736ecb30-955e-4e81-9955-64a8582fd9e2 | b9b7bfb3-969e-4243-bd64-760bff75d346 | tripo_h3_1_image_to_3d, 12000 faces | 257 KB | 87 KB |
| INGOTLOAF | 39421f6e-3df3-48c8-8f97-3a1af2442c13 | e3f54c2e-783d-41db-b31b-5645a8e22a12 | df7ee079-2274-4782-8453-fb8a4429b883 | tripo_h3_1_image_to_3d, 12000 faces | 233 KB | 77 KB |
| SNOWCURL | 7dc12802-ae82-4c29-a1f1-ad88e8bd7dbf | 206d3c7f-bfe5-4561-b744-bc5f7d4f2312 | 90cd79b0-7437-4ca3-8a11-86dadb8e34b6 | tripo_h3_1_image_to_3d, 12000 faces | 223 KB | 72 KB |
| SOCKFOOT | 7238ed56-6b09-4fa5-b544-5bc1958b09a1 | c227931b-5d5a-4c9f-b696-6d2243eba811 | 91390165-a186-45c3-bb02-a4d384abebc9 | tripo_h3_1_image_to_3d, 12000 faces | 262 KB | 88 KB |
| ROSETTE | db36e71b-7354-494a-8387-39a865fd3080 | b33b7dcb-4f21-4b8e-a344-db5602eba99a | 5fa2ae5f-3eb3-4489-9701-3b35feee799b | tripo_h3_1_image_to_3d, 12000 faces | 339 KB | 116 KB |
| JELLIECAT | fd831572-17ef-4a93-954b-1750f4da7807 | 41c39825-f4c0-4634-a0a1-4d0532afcdea | 87b95ee3-514b-4266-9eb8-baf53c85b3bb | tripo_h3_1_image_to_3d, 12000 faces | 256 KB | 87 KB |
| MOMOTHECAT | 7c94bc69-4ab0-4d38-9949-4b0569170132 | f9a74bdb-5d8c-45c0-9324-87951a2d40d1 | 047b97f4-565a-40b1-ab96-ccdd49ca8f2c | tripo_h3_1_image_to_3d, 12000 faces | 240 KB | 81 KB |
| LEOTHELION | 8031a36c-0012-4b2f-a3ad-c062d08ed69a | c68f8efa-b7fe-41c6-9398-3240ad8e28fa | feaffd5b-9ae5-463a-b900-9f2f58101aac | tripo_h3_1_image_to_3d, 12000 faces | 272 KB | 91 KB |
| COUCHCAP | c38d8c5e-d93c-4fbd-984b-19bd944ac1ef | 69cbc884-dfd6-427f-956d-f3cd74fe9346 | aae549f4-db6e-40c7-9d61-c1ce13012df0 | tripo_h3_1_image_to_3d, 12000 faces | 309 KB | 104 KB |
| MIGGLES | 9ea321cd-3074-4e34-b115-5f9b70884c90 | 35d34aad-1ace-4b37-a02f-bfb946f267b4 | 7f717969-b6e5-46d5-8268-fa2c36dc1575 | tripo_h3_1_image_to_3d, 12000 faces | 242 KB | 78 KB |
| PEWTER | bf35b288-f673-4645-a450-9d085c900154 | aa5bd8fc-ae61-4700-a7eb-0a039e75b058 | ebc84ede-6aa8-4050-98e0-e2592fca3ae7 | tripo_h3_1_image_to_3d, 12000 faces | 293 KB | 100 KB |
| TRINKETCAT | 2cff5eee-3522-450e-b4e6-02041bb0c4f6 | 1a566b0d-f68c-4e2a-9171-8fca5fc3e6e6 | af0bf37b-bb76-48fd-837f-a8fef4a4f20b | tripo_h3_1_image_to_3d, 12000 faces | 295 KB | 97 KB |
| TUPPENCE | 7bd9b225-9d13-4462-a9c9-9f23091f82e1 | 06b4cd7e-d2eb-4c83-969a-b7824f3751e0 | 575d9717-9d79-4967-b6f6-b0be4afedf82 | tripo_h3_1_image_to_3d, 12000 faces | 244 KB | 81 KB |
| WARMSPOT | 41380148-ea4b-4853-bd90-ab6b886b8eeb | 22360428-fa91-417b-875f-cb2212398c83 | a2aaf4ef-728f-4e7c-9966-17c77e0c55dd | tripo_h3_1_image_to_3d, 12000 faces | 238 KB | 82 KB |
| SKEINKIT | 38e5f17c-c00a-43ab-8778-a5857461c2e5 | 9154cc0b-519e-42df-ab51-a5036b9c2eda | d107494f-769c-4718-b28f-2b6d79c31a0b | tripo_h3_1_image_to_3d, 12000 faces | 231 KB | 76 KB |
| SAVEPAWS | 3ca4900e-e25e-412c-96de-030c0dbeba0c | 88bc132d-01d5-4070-a007-52dcd67d4fc0 | 838c9f7d-461c-4fe5-b084-300ed1edac0c | tripo_h3_1_image_to_3d, 12000 faces | 301 KB | 103 KB |
| EVERLOOP | 059815cc-8a55-4f7c-bad1-07766da5cdc1 | 55a6905c-9aa7-42f2-a50d-054f95c2a8d0 | 04aa8db3-ca0c-46bd-a94b-cd1bcdb5c490 | tripo_h3_1_image_to_3d, 12000 faces | 280 KB | 95 KB |
| MILKWEED | 1b99733e-c644-4bd2-bab0-ccc71de5c56c | be39e1d7-4803-4208-8fec-766d28ccddeb | 32d4f65e-5ae8-480d-abe2-4407e2e0567e | tripo_h3_1_image_to_3d, 12000 faces | 235 KB | 75 KB |
| CAMTHECAT | b40b16b0-7dfa-4573-ad00-edd1f28ed777 | ce1327c6-8261-48f6-994d-92b228fb92e9 | 00163700-4701-440f-92e5-3ebd21966f35 | tripo_h3_1_image_to_3d, 12000 faces | 254 KB | 86 KB |
| OLIVIACAT | a5934974-191e-43e2-8a3f-4e74fb06fd05 | 5498a925-90e8-452d-a8a5-c0b0330723d5 | a9831bb0-a6bb-4bf3-afe1-f68e6bfa2a26 | tripo_h3_1_image_to_3d, 12000 faces | 271 KB | 91 KB |
| UPDATECAT | 0061cfa8-eb81-45fa-9e32-1fe7d2808cc7 | dcfcfddd-e526-46af-b8c1-94b92c53ef3a | f9e57a51-ca33-4c81-af46-5c6484d877b5 | tripo_h3_1_image_to_3d, 12000 faces | 275 KB | 92 KB |
| TRILLBY | 97a34f6d-4ed7-4bfa-9d65-31e0825b94f8 | e4878c8f-df17-411b-a77a-f63d412a3217 | 8c23fd81-17b5-4f86-ba48-71939d04c63c | tripo_h3_1_image_to_3d, 12000 faces | 263 KB | 90 KB |
| LATCHKEY | d1caa958-0ec2-45cf-924e-261123dcabfc | 862995bc-a02e-4a9d-9ac4-2f7b1435505b | ea4a2c14-04af-4d64-b16d-5fe2652adf6d | tripo_h3_1_image_to_3d, 12000 faces | 248 KB | 83 KB |
| MEMOPAW | 802a7f1e-7935-4fb4-818b-ae216628c300 | 88de237c-4bde-4e34-b833-c3b57c72f133 | af81be0b-b70e-4299-bffa-78f7e12c2fde | tripo_h3_1_image_to_3d, 12000 faces | 259 KB | 87 KB |
| GIMBALPAW | fc2c2bc9-4ea0-4bfe-9249-836d07c362d2 | f9028e05-ccc9-4d10-abfb-d717f93593dd | ac3f3ec6-33b0-4a70-8a47-71032dd2c6b6 | tripo_h3_1_image_to_3d, 12000 faces | 252 KB | 87 KB |
| CHIK | 998b11b6-0522-40b1-83ef-8063d2863424 | 3d37f24c-cd3f-456c-97af-08d31102688b | 9336ec1b-350c-4706-b13c-bac015a38728 | tripo_h3_1_image_to_3d, 12000 faces | 295 KB | 103 KB |
| KEEPSAKE | 200fd29f-c084-46fe-9563-0183ea88b102 | f56596dd-cfcb-487f-ae27-aef3f64ef25e | cbe509a9-deca-4be1-96ef-bc05394a4992 | tripo_h3_1_image_to_3d, 12000 faces | 250 KB | 82 KB |
| PINROW | 25b72af9-663d-4fac-ad0c-0d8253476f71 | 076f1ecd-8695-4b0f-bdea-271d90b48895 | 16fac88a-4437-402b-b1b6-4746aab65cfb | tripo_h3_1_image_to_3d, 12000 faces | 231 KB | 76 KB |
| COOPERCAT | 7432d69c-414a-4d14-9f2b-de42d0740680 | 7643b69b-390e-48ae-868d-df81547441ec | 9486ca06-1778-42f5-9b8e-d6daec777627 | tripo_h3_1_image_to_3d, 12000 faces | 268 KB | 93 KB |
| SAFFWHISK | abd2d714-9375-4ae4-952e-452fbad56ad1 | 0d357a91-312c-496d-b114-155e3072d168 | e01ffa86-4138-4a8d-93ad-0b2df648495d | tripo_h3_1_image_to_3d, 12000 faces | 337 KB | 119 KB |
| NOTEPAW | e5a7d1aa-3295-411f-91c8-d198858ed82e | 40a74dad-5201-48fa-91d7-97904c84294a | b94556e0-5590-47b1-9213-79589de953c0 | tripo_h3_1_image_to_3d, 12000 faces | 301 KB | 102 KB |
| APOTHECAT | 9120e5d9-fa40-4606-a947-98fd553faab5 | b8a15ab5-2797-4db8-8bda-a1a9faedcaf6 | 14e84a21-3f71-441a-bd04-317c61971d6e | tripo_h3_1_image_to_3d, 12000 faces | 252 KB | 83 KB |
| COBBLEPAW | 2871b897-958c-4363-b7a8-d99581108e75 | 04fc0e9e-06a2-4375-87e6-a1969122e4f2 | f6db8548-1512-445e-8d7b-52c8c1a92739 | tripo_h3_1_image_to_3d, 12000 faces | 275 KB | 93 KB |
| SCUFFPAW | 859d9e31-5ed9-4253-ae2b-aa1e187340ef | dd759b87-43d8-4cec-af0a-bbc0d275fbc1 | 4cb9218a-9055-46bd-96b1-1e20927b0dbb | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 761 KB | 156 KB |
| KERNELPAW | 9db38511-b5d8-48bc-91ac-afe63e4f0d2d | 4efdac07-1464-4f29-9429-5932eb197026 | d0d1b7db-c1dc-4f41-802f-d3c8cfa9d62b | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 715 KB | 283 KB |
| TREADPAW | 81d52a1c-e8da-47c8-bf5c-2d35f81c94a3 | 2359fb5b-d499-4882-956e-185f18abb150 | f90f3925-5a68-42d9-99f9-ff0844cfd489 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 505 KB | 163 KB |
| COWARDLION | c6e3659c-8f85-475f-8f94-3355971598c9 | dcffd2a3-2f7b-4d13-bc5a-15ec04808e76 | f7bac78b-8f2f-45b6-bb41-561b8e7e7c5e | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 724 KB | 198 KB |
| GLINTPAW | 01d2a042-9d44-4d93-b097-59bed06f7a48 | 10b28cf2-605c-4393-8559-df69bcbe78fa | 0a6f4739-a4ef-46b7-b6ff-6e02a9353a8e | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 594 KB | 180 KB |
| HUBBUB | d5d45b7f-3a0d-4777-ba3b-7b62dc77c5e4 | 653d5843-6166-4a63-bf33-eaf3df22c267 | c327dddd-0f24-4f68-8525-a8307687a837 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 738 KB | 152 KB |
| BOXWOOD | 34a652db-5a86-41fb-9460-0205f839e9b8 | d424e085-c7db-4c84-9af5-c96a3f13c28e | 3f408056-44ca-44ef-a152-abc8fd9475f1 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 767 KB | 139 KB |
| LIDNAP | ac29889f-2cf7-42c5-965f-32768d4ff5c3 | 604c3c13-a675-46e5-9026-e510bcae07ea | 1339f3d8-b23d-4688-a378-218f8a20ded0 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 714 KB | 186 KB |
| PAWPOST | e6b6ecec-5e25-47bb-a552-97e2c03c1990 | 85e99ab3-0e3e-45b7-b92e-4b91ba6df14b | a937e2e9-799b-473b-bb2f-697b7edfedca | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 738 KB | 157 KB |
| TALLYSPOT | 7113994c-f922-4fd2-a627-818e8fbece32 | dbb38ccb-0250-4cfd-a103-2c0aaf641689 | 11d34bc1-06d7-47cf-a355-95b6d960b8bb | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 731 KB | 173 KB |
| VELVETPAW | dec34ae9-82d3-47ad-9bc9-72985532ef2c | 922eec4b-dc9b-478b-ac9a-2131a40608e6 | 8f59772e-0a2c-4ae6-8002-ba32cf34f705 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 733 KB | 192 KB |
