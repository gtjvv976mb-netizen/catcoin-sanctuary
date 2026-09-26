# Catcoin Sanctuary: cat lettering, approach C (one integrated AI logo)

Deliverables in this folder: `square.png` (+`square-400.png`), `avatar.png` (+`avatar-400.png`), `banner.png`,
`sheet.jpg`. `python3 make.py` rebuilds all of them from the saved generations in `gen/`. It needs only Pillow and numpy
and never calls the API.

The lettering is the same in every file. It uses fat, soft bubble letters with a thick dark-plum outline and 3D extrusion.
"Catcoin" is glossy cream and "Sanctuary" is orange tabby. There are four cat motifs:
1. The capital **C** has two pointed cat ears with pink insides.
2. The dot of the **i** is a pink **paw print** with toe beans.
3. The holes of the **a**'s and the **o** are pink **toe beans**.
4. "Sanctuary" has **tabby-fur stripes**.

CoinMarketCat (orange tabby, purple hoodie) peeks over the name with one paw resting on "Catcoin" and the other waving.
His face is never covered.

## Credits: 8.0 (balance 198.75 -> 190.75)

| round | job id | settings | cost | result |
|---|---|---|---|---|
| r1_0 | 8d03a71a-448e-4978-9627-707e7fb9fd2c | 1:1, medium, 1k, ref 3655ebef (= logo/s1.png) | 0.5 | ears on C, paw i-dot, y becomes a tail. Spelled right |
| r1_1 | 66386039-9a16-4990-93df-844b4a7f8a04 | same | 0.5 | cat-face o, paw i-dot, tabby stripes. Spelled right |
| r1_2 | 8b11337a-97f8-447d-a6b0-fbcaf807c048 | same | 0.5 | **rejected: reads "Catcon"** (the i stem is missing, only a floating paw) |
| **r1_3** | **c1fc5108-51df-4d48-8d79-8d9b5f541dcd** | same | 0.5 | ears on C, paw i-dot, toe-bean counters, tabby stripes, mascot hugging the name. **Chosen style** |
| r2_square | 1edf5bc2-783b-48d5-8e2f-55b854b2650e | 1:1, medium, 2k, ref r1_3 | 1.0 | 2k remake with the name at 86 % width, becomes `square.png` |
| r2_avatar | 892917e9-d97f-422c-baff-7b7cd42ef313 | 1:1, medium, 2k, ref r1_3 | 1.0 | compact lockup. The text still reached r 547, so make.py re-composes it |
| r2_wordmark | 6c7d32c9-ad1e-411d-a07f-e0c78ae94b40 | 3:2, medium, 2k, transparent, ref r1_3 | 1.0 | same lettering with no scene, two separate lines, used for the banner |
| r3 outpaint | 330c0bab-3ca5-48c5-9bc0-95bfc48aeb16 | outpaint r2_avatar to 2432x2432 | 2.0 | **wasted**: it came back as 2048x2048 and unchanged, so it is not used |
| r4_banner_scene | 84003567-ee97-4a86-9167-e2211c2df06c | 21:9, medium, 2k, ref 1f815edc (= kit/cmc-banner-b.png) | 1.0 | wide dusk scene with the mascot at the far right and the left two thirds empty |

Spelling was checked letter by letter on zoomed crops of every file that is used: C-a-t-c-o-i-n and S-a-n-c-t-u-a-r-y,
with no extra glyphs. The only generation that failed was r1_2.

### Prompts (verbatim)

**r1_3** (the other r1 prompts are the same brief with different motif lists):
> Square game-title logo artwork in the same warm flat-shaded low-poly 3D style as the reference image. THE HERO IS THE NAME: huge chunky cartoon title lettering reading exactly two words on two centered lines, top line "Catcoin" and bottom line "Sanctuary", spelled exactly C-a-t-c-o-i-n and S-a-n-c-t-u-a-r-y, every letter present and in order, no other words or letters anywhere. The lettering fills the lower 55% of the image and spans about 88% of the image width: fat, soft, rounded letters like plush cat toys; "Catcoin" warm cream with a glossy highlight, "Sanctuary" orange tabby with soft darker tabby stripes; both with a very thick dark plum outline, a chunky dark plum 3D extrusion underneath and a soft drop shadow, very strong contrast, instantly readable. Cat-themed lettering, tasteful, exactly three details: (1) the capital C of "Catcoin" is shaped like a cat head seen from the side, with two pointed cat ears with pink insides on top; (2) the dot of the i is a pink paw print with toe beans; (3) the inner holes (counters) of the letters o and a are small pink toe-bean shapes. Above and behind the lettering, EXACTLY the orange tabby cat from the reference in his bright purple hoodie, big happy open-mouth grin, both front paws resting on top of the letters of "Catcoin" as if hugging the name, one paw waving: his whole head fully visible above the letters, face never covered, smaller than the lettering. Background: the cozy cottage with cat-ear gables and glowing amber windows at warm sunset, slightly soft and darker around the lettering so the letters pop. No other text, no logos, no watermark, no border, no frame.

The motif lists in the other r1 prompts were:
- **r1_0**: ears on C, paw i-dot, y descender curling into a striped tail.
- **r1_1**: cat-face o, paw i-dot, tabby-fur "Sanctuary".
- **r1_2**: ears on C and S, paw i-dot, whiskers left of C, y tail.

**r2_square**:
> Recreate the reference image at high resolution: the same square game-title logo, same warm flat-shaded low-poly 3D style, same cottage background at sunset, same orange tabby cat in the bright purple hoodie with his big open-mouth grin, one paw waving and one paw resting on top of the letters, face fully visible. Keep the title lettering identical: exactly two words on two centered lines, "Catcoin" (top) and "Sanctuary" (bottom), spelled exactly C-a-t-c-o-i-n and S-a-n-c-t-u-a-r-y, every letter present and in order; fat soft rounded bubble letters; "Catcoin" warm cream with a glossy highlight, two pointed cat ears with pink insides on top of the capital C, a pink toe-bean shape in the hole of the a and of the o, and the dot of the i is a pink paw print with toe beans; "Sanctuary" orange tabby with soft darker tabby stripes and a pink toe-bean shape in the hole of each a; very thick dark plum outline and chunky dark plum 3D extrusion with soft shadow. Only change: the lettering block is slightly smaller so it spans about 86% of the image width with equal margins on the left and right, still centered in the lower half with a little grass visible below it. No other text, no logos, no watermark, no border.

**r2_avatar**:
> A round profile-picture version of the reference logo, same warm flat-shaded low-poly 3D style, same cottage background at sunset filling the whole square edge to edge (do not draw any circle, ring or border). The image will be cropped to a circle by the website, so ALL of the lettering must sit well inside a centered circle whose diameter is 84% of the image width: nothing of the lettering near the corners or the edges. Compact centered title lockup: "Catcoin" on the upper line and "Sanctuary" on the lower line in slightly smaller letters, so both lines are about the same width; the whole lettering block is about 74% of the image width, centered horizontally, starting just above the vertical center and ending at about 80% of the image height. Spelled exactly C-a-t-c-o-i-n and S-a-n-c-t-u-a-r-y, every letter present and in order, no other text. Keep the exact lettering style of the reference: fat soft rounded bubble letters; "Catcoin" warm cream with a glossy highlight, two pointed cat ears with pink insides on top of the capital C, pink toe-bean shapes in the holes of the a and the o, the dot of the i is a pink paw print; "Sanctuary" orange tabby with soft darker tabby stripes and pink toe-bean shapes in the holes of the a's; very thick dark plum outline and chunky dark plum 3D extrusion. Above the lettering, the same orange tabby cat in the bright purple hoodie peeks up from behind the name with a big happy open-mouth grin, one paw waving and one paw resting on top of the letters; his whole head fully visible, centered in the upper part, face never covered. No logos, no watermark.

**r2_wordmark** (`background: transparent`):
> Extract only the title lettering from the reference image and redraw it at high resolution on a fully transparent background, with identical letter shapes, colours and cat details. Exactly two words on two centered lines: "Catcoin" (top) and "Sanctuary" (bottom), spelled exactly C-a-t-c-o-i-n and S-a-n-c-t-u-a-r-y, every letter present and in order. The two lines are SEPARATE pieces with a clear transparent gap between them (they do not touch), each line with its own complete outline and extrusion. Lettering: fat soft rounded bubble letters; "Catcoin" warm cream with a glossy highlight, two pointed cat ears with pink insides on top of the capital C, pink toe-bean shapes in the holes of the a and the o, the dot of the i is a pink paw print with toe beans; "Sanctuary" orange tabby with soft darker tabby stripes and pink toe-bean shapes in the holes of both a's; very thick dark plum outline and chunky dark plum 3D extrusion under every letter, the outline fully closed and solid (no transparent holes inside the lettering). Crisp clean edges. No cat, no paws on the letters, no scenery, no shadow on the background, no other text, no frame.

**r4_banner_scene**:
> Wide panoramic banner scene in exactly the same warm flat-shaded low-poly 3D style, dusk palette, cottage and character as the reference image. Recompose it for a website header: the cozy cat sanctuary cottage (cat-ear gables, glowing round cat's-eye attic window, warm amber windows, lanterns, cat tree) sits at the far right, its left edge at about 68% of the image width. EXACTLY the same orange tabby cat in the bright purple hoodie stands on the stone path in front of the cottage, centered at about 84% of the image width, facing the viewer with a big happy open-mouth grin and one front paw raised in a wave, fully visible from ears to feet, its height about 55% of the image height, its feet at about 85% of the image height. The left two thirds of the image are calm and open: a deep purple-to-amber dusk sky with a few soft clouds over a low, dark, softly lit meadow with distant low hills and a wooden fence far away, horizon at about 62% of the image height, no objects, no cats and no lanterns there (empty space reserved for a big title). Warm, cozy, inviting. No text, no letters, no logos, no watermark, no border.

## Deterministic steps (make.py)

**Text measurement.** The AI lettering's plum outline and extrusion (hue 285-12 deg, saturation > 0.28, value < 0.5) is
the only plum in these scenes. The text mask is built in four steps:
1. Take that colour mask and apply a 2 px closing.
2. Keep only the region grown from a seed inside the name. This leaves out the roof and the hoodie.
3. Fill every enclosed pocket, which adds the letter fills.
4. Check the result against an overlay. The overlay is `work/av_mask_overlay.png`, with the r 476 circle drawn in red.

**square.png**: r2_square scaled 2048 -> 1024. The text bounding box is (80, 487)-(961, 920), so **the name spans 86.0 % of
the width**. There is no circle rule.

**avatar.png**:
1. Start from r2_avatar at 2k. The whole logo is zoomed out by **0.905** about the top centre (512, 0). This moves the name up
   toward the centre while the mascot's face stays clear. The zoom is the largest one that keeps the text radius at or below 466.
2. The freed bands are filled:
   - The bottom band is mirror-tiled grass taken from under the name.
   - The two side bands are mirrored bushes. make.py asserts that these strips contain no lettering.
3. A gentle vignette is applied from r 440. A plum line at r 490-493 and an amber rim at r 493-514 hold the edge on X in dark
   and light mode.
4. Outside the circle there is a soft, darker blur of the same scene. It is only seen where the image is shown square, for
   example on pump.fun.

**Measured.** Every text pixel is within **r 465.2** (transformed mask, limit 476). Re-segmenting the final 1024 avatar
gives **r 463.6**. The text box is (130, 423)-(897, 836).

**banner.png**:
1. r4_banner_scene is scaled to 1725 px wide and cropped at (0, 180, 1500, 680). The mascot waves at x ≈ 1180-1370.
2. The wordmark is cleaned: the alpha haze under 16 is dropped, then the two line components are kept by seeded growth.
   It is scaled by 0.344, premultiplied.
3. The lines are staggered:
   - "Catcoin" ink sits at (36, 40)-(663, 250).
   - "Sanctuary" ink sits at (420, 238)-(1112, 420).
4. The tagline is set in Figtree 700 35 px, cream: "Every cat here is a token.". The url line is set in Figtree 650 23 px,
   amber: "catcoinsanctuary.com  ·  $CATSANC". Together they sit at (694, 116)-(1094, 186), right of "Catcoin", with a soft
   dusk glow behind them.

**Banner checks:**
- All text is inside y 40-420.
- No text is in x < 420, y > 330.
- The nearest text is 198.5 px from the centre of X's avatar, which with its ring has r 172.5.

**sheet.jpg**: the avatar circle at 400/96/48 on #000 and #fff, the square at 400/64, the banner at 750, and the banner at
600x200 with the 130 px avatar circle at x 20-150, y 110-240.

## Notes / deviations
- The avatar is re-composed from the integrated generation, not regenerated. The prompt asked for a circle-safe layout, but
  the model still put the text at r 547, and the outpaint attempt did nothing. The re-composition keeps the integrated art,
  including the paws on the letters. The trade-offs are that the name is 9.5 % smaller than in r2_avatar, and there are
  mirrored grass and bush bands near the rim.
- The banner scene is a new generation, referenced on cmc-banner-b, because cmc-banner-b puts the mascot in the middle. That
  would have forced a much smaller name.
- `work/` holds scratch crops, masks and previews. It is not part of the deliverables.
