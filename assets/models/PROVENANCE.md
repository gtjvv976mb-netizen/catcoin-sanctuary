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
| MEREDITCAT | d51c48dc-ddac-4e4d-94e2-c1cef1b6e4a9 | b2b373e0-fd56-44d6-b090-f3ac6e1ddc62 | 01a0df4c-6012-7713-bf6a-2e884c615c92 | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 678 KB | 290 KB |
| BENBUTTON | 49704d15-9ca3-41e3-a438-5344c5d7877e | 0ced5b45-5ed6-4edc-aea5-053d93610da6 | 9bc9c337-e531-46d2-81e4-05c99f8a606e | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 748 KB | 79 KB |
| LARRY10 | f8c97a8e-4bc4-45aa-ab4f-bb31f70537fe | 487f2e65-c6b2-45d4-b729-0d2a942110e8 | 01a0df48-632b-736b-9c0e-e328bea4338c | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 647 KB | 285 KB |
| CHOUPETCAT | 1b72da60-9658-4271-ae5c-776bae6ec82f | ba089992-4eb4-4fda-af4a-1bcd4353a252 | 01a0df3b-b50f-753c-bb8c-68d95771614f | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 581 KB | 220 KB |
| MARUBOX | 2c55bfc7-ef20-437b-922c-d54803223088 | b5204ae4-037c-4ad4-8045-d6785396b083 | 01a0df4a-4d65-7778-a5c5-2c4d6148a093 | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 664 KB | 211 KB |
| STREETBOB | 2da18771-a185-4164-94d5-99f68a7f6b7a | ffcf023f-d57c-411a-9c1a-e31b38fe5c78 | d81a6a92-dad3-4034-b42b-029ecc8ac7d2 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 728 KB | 149 KB |
| LILBUBCAT | 6f1ed3af-51a1-4dd0-a88f-1fb2c5e28624 | 36d72917-5df1-49a9-b1ec-984d6e4b4d2d | badc7aaf-d2ff-4342-a154-ee87099f0eed | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 740 KB | 122 KB |
| PUSHEENX | 036a3ef0-9a08-47ce-8e95-bc76f0bb2f3a | e344c945-eb82-45df-a998-ca6255179478 | 01a0df35-8324-7255-8d6d-332952ea2a9a | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 571 KB | 212 KB |
| KPURRY | 01a0df1e-3166-750e-a5cb-df263a8a99c3 | 01a0df1e-3166-750e-a5cb-df263a8a99c3 | 01a0df24-e016-7754-9c2e-119c84fdb7d4 (far: 01a0df25-f641-70a1-af3a-aa0b461a283c) | meshy-7.1 multi-image-to-3d + meshy remesh, 10000 faces | 546 KB | 143 KB |
| MEOWTHR | f9071547-4cef-4ff3-ae47-764e8366a750 | 6758c6a9-5910-468c-8d5b-6dcfd97680b2 | bc35ae0f-f81b-4a99-8072-b09e96353c07 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 650 KB | 122 KB |
| DELILAHCAT | ee6793a2-ac08-4543-b711-d4b82a37c001 | c67c3d07-3ad9-4b69-9b6d-346af4f77ae1 | 01a0df2d-88ac-7354-b764-9edf28c7fd25 | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 613 KB | 209 KB |
| LALEO | 57a5a0d8-7129-41a3-9dab-ba15588d3099 | 12c39ed1-4751-4cc5-8018-642b9a7c5eb6 | 01a0df30-70d2-73a9-82a0-23875f933cdb | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 624 KB | 211 KB |
| WILLOWCAT | 7c65dc5f-8615-4ed3-a877-bce958db9324 | 5e57f423-6e58-4b17-97dd-93883e2ea01b | 01a0df39-cdd3-75fb-adb3-314fc3fb18d6 | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 654 KB | 222 KB |
| GLICAT | 8de15cef-03f9-4138-b2bb-6ef71ca08b90 | 3be0216b-1a66-48b6-91af-621c1f5fca1d | 01a0df2e-fc78-73d0-9f4f-fff6f01dbcf3 | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 646 KB | 290 KB |
| TOMBILICAT | c377b011-8861-4c2a-8a34-5a5e1d4af2f1 | 943ae787-1cc5-4edd-bb11-31660a84b0a8 | b26970e2-c546-4191-a13d-e800a4aa102b | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 652 KB | 126 KB |
| STEPANCAT | 673f4ecb-2a56-4ac8-9c99-221e0196ed48 | f7b83b88-1836-4864-acf7-242c2734201c | 01a0df37-e3c6-755c-90e4-714913075380 | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 650 KB | 218 KB |
| BUTTERED | e9bd46d7-ce77-4b72-ac91-680bd05e1fd9 | e7de5c09-6e9b-46c4-98ac-6fb9506670f6 | 71ec4840-e264-410f-a26a-fbdd4ac664ea | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 636 KB | 121 KB |
| TAMAEKI | be182de4-87e6-4f2c-9b28-491c3c4fb6c4 | 907cbde5-3e17-41a0-8f1e-67d926320e97 | c6264764-cd87-4e64-af9c-7a2c60f04387 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 730 KB | 129 KB |
| NOSTROMCAT | 14ea54ba-74a5-4202-8bd6-66f9ffb0e9f2 | 8adecb58-17c0-4bd9-be4c-5b1d89a00e21 | f852c4b1-4536-4094-9963-6181bd580091 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 670 KB | 117 KB |
| FLERKENCAT | 53d41911-c6f1-4877-bd49-de455d9cf823 | 7ed5c802-455a-460b-8599-7aa1ed29fbdb | cab92bdf-6ac1-4c8d-aaec-d8f3c4c567af | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 675 KB | 129 KB |
| CROOKSHNK | 01a0df18-cf2e-74c8-bef7-738efc225f4d | 01a0df18-cf2e-74c8-bef7-738efc225f4d | 01a0df28-89e6-70ee-89cd-4010a9495d37 (far: 01a0df29-a07f-76a1-8819-b09adc5464e5) | meshy-7.1 multi-image-to-3d + meshy retexture from its side view + meshy remesh, 10000 faces | 531 KB | 134 KB |
| MARIEAC | 33531a97-7146-4602-85c7-ce062b357121 | 5ac1af5d-e16a-4217-bf0c-b11cc8c6e94a | 01a0df32-d1d4-708e-997f-186620433d69 | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 618 KB | 245 KB |
| CHESHIRCAT | 3c91c060-7bed-46b4-9bd5-560c3b28986f | 5ca4f0a6-f556-4124-beb9-ea674f3898e9 | 714a7998-3b4f-4ea4-8949-8119e0e0f825 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 709 KB | 125 KB |
| SUCCOTASH | e3c21006-bc30-4476-95f5-911f8e2b1192 | 92411efb-dabb-428a-b689-6194e50c23c2 | 404b0eb2-3014-4df0-8bb7-cdd520ed028f | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 515 KB | 115 KB |
| NEKOBUS | 96069275-5102-404d-a343-207f83ab9edc | 96a86792-2cbe-4712-bc5d-623cefb40c61 | ab34be86-18cc-413e-b271-c294fb29ea65 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 649 KB | 249 KB |
| PRISMPAW | 8593bcc0-988b-44b8-9be6-4861295ac28a | c937d629-9c51-4834-944b-964229195506 | 9968d020-a265-4f95-b589-3b092c8d9864 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 738 KB | 146 KB |
| TARTANPAW | ca631046-0de9-4835-892e-79fa35c1ad92 | 785f2687-2b6d-400b-9111-1d927ca71c64 | fad9107e-7947-438b-bce4-f6b8317f44a6 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 570 KB | 249 KB |
| BURLYPAW | f58a999a-a602-4f54-8345-57acf8889f89 | 91d383a1-e8e2-403a-8f37-2e1019f4f706 | 777cdb4e-4ff5-4dba-bd8e-d0bf2193520b | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 670 KB | 143 KB |
| SUNSTRETCH | de230cea-9f92-40a4-bb1a-d88ac0ca5185 | faed2448-8c2e-4b08-9b6e-a44a1e7967e8 | ecb57406-e670-49b3-8625-4c789bdddaa8 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 716 KB | 148 KB |
| AMRCAT | b47106a1-7a42-43e9-976a-4de4ea315c01 | 30fb92d5-1030-473e-ab57-88d15e950845 | 5523e4a6-b44a-4b78-8e05-a3c008cf2ad7 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 701 KB | 132 KB |
| PEPPERCAT | a81587e5-651e-479f-998f-a53c2506f052 | a4337dfd-c4fa-4305-b5b3-e80a196d4a11 | 5113431e-1211-4d12-a7fb-2074da7a7fad | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 596 KB | 235 KB |
| KIOSKPAW | ae874b63-f7bb-4db7-a0b8-11f2593d1f8f | dba5baf5-805b-491d-b6a0-5723e0e8e65c | 4f078f51-aa68-4bdc-a520-980336bbf003 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 697 KB | 171 KB |
| SANDSTEP | 50f48c51-282b-4920-b21f-8bf6d917b7f0 | 9591736b-8bcf-442a-954b-03a4f5d5e73d | 7dad27d3-b3da-4513-9c51-f513daec7b9f | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 667 KB | 177 KB |
| WAYBILL | 883dfb7b-c218-4733-b75f-80f56027c2eb | fa445e8f-3887-4288-a0ed-ef336bc9d8c3 | 96d88c83-8477-4a65-b183-3c778d2f22ba | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 709 KB | 194 KB |
| WHIRRPAW | 02e55294-028b-4f9c-8b51-247eba1f680c | 8bae05d5-b7ac-4388-a845-409be6d6196b | 5080685d-c137-4366-8ded-b3e4c0c7b0ae | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 608 KB | 191 KB |
| WINDSOCK | 6ccb0891-24bc-4536-9cff-a95b3a901281 | 9719f0d5-7ff3-4b0a-9834-bd1768e5a6eb | 9f975d8a-bf22-4f13-9102-7bbcdb8fdf1a | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 736 KB | 152 KB |
| VIGNETPAW | 63ad12f6-f0f2-4f00-b7a1-6b074266bb6d | bb33594e-fa97-4b21-9671-3cf6f8182d8c | f561f144-9e3a-447c-bdf3-72b3b24f6123 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 664 KB | 166 KB |
| CANDLEWICK | ed88159c-0f8c-4c40-80ff-e7f52ce07cf5 | 2fdab00c-6573-4661-a3c3-d63db1c1c870 | 6c1fe6d0-7043-417e-b11c-37a825a21585 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 772 KB | 163 KB |
| TOMRUTGERS | 646837df-0e17-46aa-8856-133d5fe837cb | d6efdfe5-dd21-4138-aba5-892b9f43c02f | 7d0b11bb-a24e-414d-b608-d313bba77b9e | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 623 KB | 121 KB |
| LACQUER | c26aa725-6b9f-4a37-8402-8d1c895d827e | ddfd98ee-76ed-47f8-8776-cec41174804b | 1837621c-033d-4a06-8654-547475dffc9e | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 517 KB | 206 KB |
| RUBYCAT | d2c969b6-aaf8-4683-b7c5-9b17ae5871df | 18f7011d-772e-4563-a9ae-a43c32706617 | 1462815e-ff73-47cc-a414-e1730a073e4a | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 717 KB | 263 KB |
| SORRELPAW | 745705e3-1665-494e-a0bc-c97f3d67fc9c | ade7df7e-4141-44df-b262-0fd1d9386f31 | 6c9f6feb-b050-48b3-8039-42c7d8f0bef0 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 681 KB | 156 KB |
| SUGARSOOT | 7d423f80-f29c-4edd-859f-35fa4b68f809 | 59560c2b-6690-4d96-b564-eb63fe77c194 | 21ea735a-bac6-4d7e-9c13-426e38220d8c | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 695 KB | 195 KB |
| GRIDDLE | f9151e9b-6e70-4b49-97a4-97fe8a737bce | b4c4f8cc-3c52-4283-b467-41159b857fac | d87eadf2-afb8-4858-8a1d-c473b6994436 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 636 KB | 191 KB |
| ROOKIEPAW | 008e1a1f-01f8-45b3-9168-c2ecf2b925a9 | ed191574-ba61-4f8c-916b-d58db0bf445a | 09c40e61-24fd-4be1-86fb-a4fa524325e6 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 694 KB | 174 KB |
| CORSAGE | 4b33df45-5581-4419-85dc-242c7cd85e93 | c009f38b-fbda-40d5-89cc-1e19b8698028 | f487b9ad-c575-4c2a-abcf-e4375a839f08 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 669 KB | 224 KB |
| RAFTERPAW | 15202185-b82e-4c16-944e-0e75a9e31cec | b56518c0-4d09-44f2-96a2-97362fda178a | 3d2780a3-0152-4c66-a796-7b3578473e93 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 718 KB | 176 KB |
| UMBERPAW | 1ee2ccca-18a3-482c-b483-e394a2545615 | c5cef2d7-1985-4b19-b7a9-0e9e94b3373d | 1344fbb9-0632-40c7-82d0-f046b3f4250a | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 604 KB | 189 KB |
| PUMICE | 9164a17e-9977-4348-ace3-a582cd339d37 | 0d87c687-96f5-41e5-a8aa-4fea33b8b7b8 | 554895da-86fa-4af4-a30d-91f19813774d | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 664 KB | 166 KB |
| JITTERPAW | 5ea33fff-438d-46fb-ad4c-ef14c4a0b5a3 | 5c1fbd9e-e3f1-447b-80ce-2848ae4bfe58 | 81c382a9-fd9c-4dc3-bad1-5b6f88b35a86 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 674 KB | 81 KB |
| STUBTAIL | 71bf763d-87d0-42a9-a38b-863a04fe0ad4 | 7bb9f6cd-4fb7-4399-9fa8-332544d91514 | 457d63e4-41e1-4a54-beb5-7bb84dfcfef8 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 726 KB | 194 KB |
| CASENAP | d6778401-7005-40bc-ba5c-35a16857af5a | 1a6e6e76-cf4a-49ae-9233-f89d182efb3b | a8f412bb-b1f3-42ec-86f1-da2e5823dd78 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 675 KB | 171 KB |
| PAPRIKA | a5d7d132-bdf3-4e24-b5f2-e28f92185435 | 1caa6deb-e8d8-461e-ba8b-3640932bf258 | d8026a08-b6fb-48c8-86db-a2f4f8019c02 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 737 KB | 179 KB |
| SNUGPAW | 600846d9-db7a-4cbd-96f4-4841387fef96 | 01cbf0d2-7d9c-4454-b99e-645279238d91 | b143071b-ad2d-4fdc-9449-a28d1dcb25da | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 600 KB | 179 KB |
| MITTENSCAT | a572c1ea-304b-44a6-bfda-6565ed67bfe0 | 2cccbd6c-4f37-48ff-857c-a28379377d08 | 99cde48b-9162-4cb5-b8a5-89a16068125c | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 755 KB | 82 KB |
| AMBERDROP | 5d536c15-569d-48ff-97dc-4a16dc202a4a | e784a470-d63e-4920-98d9-64030f9ae210 | 01a0df0f-bd87-736a-8383-fbb68a52a73e | meshy retexture (hunyuan3d_v3_image_to_3d (multiview front,left,back,right)), ? faces | 639 KB | 225 KB |
| DROWSEPAW | 5d179d12-bdbd-4b38-8c6d-ca77495e6aff | d2880b0b-96ef-4abb-b536-9a2417b63a3f | 8121dc91-96f8-4c5d-9111-b7971cbf33b7 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 774 KB | 253 KB |
| CURFEWPAW | 785b0bcd-d1ed-4d8e-b539-a972576addde | ce44649c-34c2-4e80-be10-678c7fee8aed | aad640e6-bdf7-4830-9d61-fc15c12f73be | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 683 KB | 171 KB |
| LICHENPAW | 50468c7b-9d25-469b-b73f-f011f49bab6c | 4ef421fd-9e86-42b1-8bab-12fea9e86279 | 9d953cfe-490d-4f01-872b-6865dce4bd46 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 627 KB | 175 KB |
| RUSTLEPAW | ddffc02f-300e-4c0d-80b4-ff61dc63e190 | 4d70480b-a817-4982-974d-acdcf54bea7a | 987213e3-91b5-40f9-ac7e-5d780d03e8e1 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 648 KB | 222 KB |
| ICICLEPAW | 92b099e7-fee9-4a0b-83b4-442894375dc1 | 21a867aa-8a0c-4648-97b5-8c770da27041 | 32f9e716-54af-4e12-8c3f-65683e8da9fb | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 718 KB | 232 KB |
| RIMESTRIPE | de3d9a69-0e05-42b7-bae6-ea5f5d548ce0 | 3df4f30b-97b9-4276-b285-d235eea9a446 | 5bdcd027-9403-454c-9294-65eae5adc59a | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 773 KB | 178 KB |
| CABLETAIL | 462e9356-d55d-4c2c-abf7-e3733a116d05 | 0e15d2e8-f78d-4810-9b21-206d44ab9a84 | cd81c522-2994-4131-bb27-1a8adcf52ef4 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 648 KB | 174 KB |
| MILLRACE | c0ebd947-9ae4-4bfc-bcac-ea77506d0374 | c0d9df61-1b9a-49cb-a69d-21ed9bb225d0 | 91ce073e-dfc7-496c-b5b1-362a1cefba39 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 772 KB | 172 KB |
| PARLORPUFF | 6f7107d1-434e-4399-b914-ac02bbc27b3d | 0404d332-ca71-4a5b-9070-4e1c03c4e9be | ad408cca-2bdd-4f2a-886c-b1924d7ef56c | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 753 KB | 79 KB |
| SQUINTPAW | 0bff4973-bfc3-4069-9c1a-f551b5ccf47d | e30f814e-d690-4418-9ad5-2ab9c92b5a56 | 3eda6799-b532-4436-8ecb-643b77e37af3 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 640 KB | 176 KB |
| COTTAPAW | 6cae6a8e-8473-4a13-a10e-be19a828e97d | c4c8effd-211d-4313-a82e-f05fbe72c490 | 1dce9f29-d003-4874-ae25-f479be096ba3 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 612 KB | 182 KB |
| HOVERPAW | 6a2cc088-3f3b-4379-b52e-8e9c6225ebd8 | f87bc0f0-71c7-4b09-8802-c7296ae07e99 | a5db0e98-5c7c-44b2-9714-16a3ee5653d2 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 636 KB | 196 KB |
| HUNCHPAW | 6aae254b-0d97-4ef3-afda-ea26e1c2e18a | 1cebe000-53c4-4378-8eb4-0061e08f1540 | 5cf8b5c1-67d7-48ec-8727-d0db4427fb78 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 672 KB | 142 KB |
| SILKSTRIPE | 862481a3-c3d9-4a27-acf6-dc2b3f476fc7 | 16e45363-be5c-4761-a960-bc58ddeb19ec | e7f57e9f-9358-4300-b663-9322737910c6 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 673 KB | 148 KB |
| KNITPAW | 8386d67d-bbc2-4da8-80b7-88d039a81964 | 390dde20-2b18-4d77-80de-8b770ee6137f | 3a6e5dfc-a2fa-4a04-aed1-c95ac452dde8 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 694 KB | 151 KB |
| cate-meme | ac49f491-6382-4ebc-870c-e0699d99910e | 9adb6305-d216-4b3b-b955-6b5d436e7a50 | 5443d9b3-5bda-44cd-bacd-eed18438ee35 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 751 KB | 275 KB |
| anonymous-cat | 0240d536-3841-4a7b-b0f2-17b9144639b4 | 9953a607-d63a-48a1-a154-cd4ac73ea8a2 | 1ff9fe1b-e7da-4c35-b8af-81a7a0333655 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 744 KB | 143 KB |
| popcat | 774c96e7-a13c-4c24-8d83-8ed1f8a5d65d | e93d7046-176d-4d97-a307-9a9d8acd5912 | 2a63f5aa-3470-40d5-a666-7f720074f060 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 780 KB | 180 KB |
| cat-in-a-dogs-world | e64c0595-cbf1-4847-995d-e19b5b377d83 | 4038a814-e125-4c3d-9ea4-55bb5e46041a | 90f18b55-33e4-4d0e-91af-3ad7987992a1 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 651 KB | 133 KB |
| catwifhat-2 | 7c0e4a84-ad50-47fa-bb8c-ead7f44c92e6 | 5917e56d-1d72-4007-8216-04d21d98874b | 260ea671-dd3a-4ef6-941d-501ae01e331c | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 728 KB | 124 KB |
| pepecat-2 | eb0ee238-4cf4-44d9-b51d-86824da6b825 | c5c6e3d9-3f7a-4d09-a285-a45d94a39633 | 3da610b5-6f44-499d-9b51-d97c3bcd408a | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 422 KB | 44 KB |
| wen-4 | fe49e93a-00e8-47d3-8fa7-88ce2f500b8a | 1401de02-bc73-451a-b334-a02c536504bc | ed28afd4-1754-4c3c-b46e-423de00aabb2 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 732 KB | 137 KB |
| tsuki | 59eea9a9-a278-4295-b2c4-23662a621e3f | 3eb24131-3bc4-4a01-90ab-6a6350a19957 | 89a6732c-14ec-4376-b489-423ce64195ad | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 623 KB | 152 KB |
| hello-kitty-sol | 457f2876-9f35-491f-99c7-9fd614431d31 | fdbefb7b-fdf4-4f75-b438-422735dbaf08 | 1ac5e2c0-89a5-4f9a-8947-7e5cf1fabd7c | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 714 KB | 185 KB |
| sillynubcat | a3df8bed-8bb0-421c-8790-95f11ff1556d | ebbb7c34-3146-43d4-9f53-ed5fa06fb0b5 | ff918e3b-2686-43ea-8129-9efb69993a3c | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 602 KB | 224 KB |
| michi | b505333a-245b-45b7-a2fc-46550d36628c | 05d3e005-73f0-4d84-ae6b-7e901fb9187c | f150633d-fbde-4cef-97ff-c3d076722cbc | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 744 KB | 120 KB |
| vibing-cat-coin | fe9c1ad4-976e-4098-875c-d253535675ad | 7cda7214-d9b4-49a4-b6c0-76196913592e | 708e2668-cdc6-43f2-89c1-70a2c9ac0c15 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 748 KB | 119 KB |
| catcoin-6 | 8952f7b5-6314-4618-8307-8f3bc97d8075 | 92324f4f-a534-4670-87c7-055590ad6871 | 45d18b27-2417-4d67-81d2-b31d6e8f9e09 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 693 KB | 131 KB |
| raydium-cat | c51b09f1-fdce-4bd4-951e-5967c02fe04e | 753f46bf-5189-4d92-841e-dd75d49a7a36 | 69560d59-6c42-41ec-b8a0-97e85a8cb22c | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 689 KB | 179 KB |
| ket-3 | b5d31be1-46c5-44c2-9622-59844577921b | ea170135-fb65-46d8-88a9-26846a412a9c | b299bba9-b5b2-4d7c-abef-c1f63a4d8254 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 518 KB | 124 KB |
| maneki | 742dbcac-6773-431a-aaca-5fdd76076fb8 | a8ca7343-6e06-42c7-a61d-47a7595b4484 | 9d9fc0e4-cb2b-4af2-8839-1bf11e9c1982 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 701 KB | 127 KB |
| gta6cat | 1e5feb48-0d6f-40d9-a5a6-611218b30325 | 79ab9ea1-270d-4b45-b8b7-b7239a8d6373 | b450d126-af65-4848-be95-c8d9124358f2 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 691 KB | 127 KB |
| stonk-cats | 889a1bd9-a1af-4752-9299-e9a0a5ccc46b | 57a42c60-4980-4489-8f76-2b00cb94bd11 | 701d99c8-9556-48ab-ad18-bd669e098d3a | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 765 KB | 218 KB |
| hosico-cat | 4f60979d-08b5-4001-9fff-b6d89144fc49 | d2252f06-2f22-4a98-8154-3af135681723 | 96dc1b2f-0367-4d82-8bee-0bd1255fd395 | hunyuan3d_v3_image_to_3d (multiview front,left,back,right), ~500k raw, packed ~20k faces | 409 KB | 63 KB |
| TRIMCAT | - | - | 01a0df11-99c2-76cf-9360-d554bf008249 (far: 01a0df27-8317-77b2-ad3b-6ca6c5c698b1) | meshy retexture (site model), ? faces | 481 KB | 112 KB |
| COLMEOW2 | - | - | 01a0df3d-cc05-73b9-aa41-98f8abfe54f6 (far: 01a0df3e-e23a-751b-836a-2fae6d7e65a0) | meshy retexture (site model), ? faces | 549 KB | 83 KB |
| DIDGACAT | - | - | 01a0df40-23e1-7193-b319-7e7e7452dbcc (far: 01a0df42-0012-7121-adee-f3bb165ebde8) | meshy retexture (site model), ? faces | 561 KB | 146 KB |
| DIPLOMOG | - | - | 01a0df43-19b8-751a-bdd2-49a74cee72be (far: 01a0df44-3043-766e-8c50-4512948890a3) | meshy retexture (site model), ? faces | 469 KB | 127 KB |
| FELIXHUD | - | - | 01a0df45-495a-739c-bad0-cefab33f2b97 (far: 01a0df47-7539-720c-b1a1-e6ca01ce38ce) | meshy retexture (site model), ? faces | 467 KB | 134 KB |
| MRSNORRCAT | - | - | 01a0df50-013d-7351-b4a0-d2bb4cc97156 (far: 01a0df52-f1ea-7251-be87-ac27f4612d7f) | meshy retexture (site model), ? faces | 565 KB | 146 KB |
| NALACATCAT | - | - | 01a0df54-3355-709a-b716-50c7963e4733 (far: 01a0df56-8668-7478-b7f2-c072af85b91d) | meshy retexture (site model), ? faces | 526 KB | 139 KB |
| PICKLECCAT | - | - | 01a0df57-9f92-70c5-b0d7-070867479514 (far: 01a0df5a-90be-7752-b8dc-d75500657ca1) | meshy retexture (site model), ? faces | 585 KB | 146 KB |
| SABERHACAT | - | - | 01a0df5b-ab1e-7795-b6be-586dffb5b105 (far: 01a0df5f-133d-73e4-80f1-63f144bfefeb) | meshy retexture (site model), ? faces | 346 KB | 93 KB |
| SEACAT | - | - | 01a0df60-2c34-75c8-bfa2-572f4f858192 (far: 01a0df61-921d-763c-a9ee-d4222a6b803e) | meshy retexture (site model), ? faces | 586 KB | 102 KB |
