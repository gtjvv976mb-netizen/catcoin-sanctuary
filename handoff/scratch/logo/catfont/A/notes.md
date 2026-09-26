# Catcoin Sanctuary: cat lettering, approach A (AI wordmark, composited)

## AI step (Higgsfield, model `gpt_image_2_5`, `background: transparent`, aspect 3:2)
Credits spent: 4.5 (5 x 0.5 at medium/1k, then 2 x 1.0 at medium/2k).

Round 1 (medium, 1k, text-only prompts): five cat-lettering variants, all spelled correctly (see gen/candidates.jpg):
| # | job id | motifs |
|---|--------|--------|
| r1_0 | be19c93b-501c-409d-a7c7-0c3a6f18db23 | ears on C, paw-print i dot, tail rising from y, tabby stripes |
| r1_1 | bff1944c-5e84-4b7e-9d51-137a324d7ef0 | cat-face o (ears, nose, whiskers), paw i dot, tail |
| r1_2 | 8b407d22-071c-43e3-a9fd-d56adf04295d | ears on C and S, paw i dot, tail |
| r1_3 | 3308932a-6364-4367-9f7b-0801d82fd95b | tabby-fur "Catcoin", ears on C, paw i dot, tail |
| r1_4 | b9a73b07-f91d-4254-8697-c149b5926670 | cat-head C (ears + whiskers), paw i dot, y descender = tabby tail |

Round 2 (medium, 2k, r1_4 passed as `image_references`):
| # | job id | change |
|---|--------|--------|
| r2_0 | 2495d194-68d7-4b05-b84c-fbf86da80417 | faithful 2k remake |
| **r2_1** | **d8825a43-2b38-45f7-bd5c-04db83f986dd** | 2k remake + soft tabby stripes in "Sanctuary" (chosen, = wordmark-src.png) |

Round-2 prompt for r2_1 (verbatim):
> Recreate this exact title-logo wordmark at high resolution on a fully transparent background, keeping the same layout, letter shapes and proportions. Exactly two words on two centered lines: "Catcoin" (top) and "Sanctuary" (bottom), spelled exactly C-a-t-c-o-i-n and S-a-n-c-t-u-a-r-y, every letter present and in order. Keep: chunky rounded bubbly letters; "Catcoin" warm cream with soft glossy highlights; thick dark plum outline and chunky dark plum 3D extrusion under every letter; the capital C is a cat head with two pointed cat ears (pink inside) on its top and three dark whisker strokes to its left; the dot of the i is a pink paw print with toe beans; the descender of the final y becomes a striped orange tabby cat tail curling to the left. Change only: the letters of "Sanctuary" are orange tabby-cat fur, warm amber-orange with soft darker-orange tabby stripes across each letter, like the cat's tail. The dark plum outline is fully closed and solid: the inside of the C's opening and all letter counters are solid dark plum, no transparent holes inside the lettering. Crisp clean edges. No other text, no mascot, no scenery, no frame, no sparkles.

(The round-1 r1_4 prompt was the same brief written from scratch: chunky rounded cartoon title lettering, cream "Catcoin" /
amber "Sanctuary", thick plum outline + 3D extrusion, and the cat details listed above. The script never re-calls the API.)

Spelling was checked letter by letter on the 2048x1360 original: C-a-t-c-o-i-n / S-a-n-c-t-u-a-r-y, no extra glyphs.
The cat motifs are the ears and whiskers that make the "C" a cat head, the paw-print dot on the "i", tabby-fur stripes in
"Sanctuary", and the "y" descender turning into a striped tabby tail. That is four motifs.

## Deterministic step: `python3 make.py`
Needs Pillow + numpy, ../../s1.png, ../../../kit/cmc-banner-b.png and kit/Figtree.ttf.
1. **clean**: alpha remap (drops the faint AI haze), speck removal (8-connected components), the 3 enclosed transparent
   pockets (22,120 px between the two lines and inside the y) filled with inpainted plum, defringe, then a tight crop ->
   `wordmark.png` (1931x1012 RGBA).
2. **avatar**: s1 scene zoomed 1.35x so the face (ears to chin) sits at y 62-384, clear of the lettering. The wordmark is
   auto-fitted at top y 360: the largest width whose every pixel stays inside r 472 (848x444 px). It gets a soft shadow
   (clipped to r 476) and the same amber rim ring as before.
3. **square**: s1 zoomed 1.5x, wordmark 890 px wide (86.9 %), 32 px from the bottom.
4. **banner**: the same lettering split into its two lines (`line-C.png`, `line-S.png`: each fill component goes to its
   line, plus that line's own outline/extrusion envelope, and the merged band between the lines gets a synthetic
   extrusion). They are staggered: "Catcoin" at top-left (36,40), "Sanctuary" from x 420 down to y 415. That keeps
   X's avatar zone (x<420, y>330, and the 130 px circle + ring) clear while letting the name span 36-1134 px. Tagline and
   url sit right-aligned in the gap right of "Catcoin". The scene is placed so CoinMarketCat waves in front of the cottage
   at x≈1170-1310.
5. **sheet.jpg**: contact sheet.
