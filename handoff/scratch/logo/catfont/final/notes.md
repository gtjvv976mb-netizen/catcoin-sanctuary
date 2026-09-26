# Catcoin Sanctuary: cat lettering, FINAL (approach A plus the judges' fixes)

`python3 make.py` rebuilds everything in this folder. It needs Pillow and numpy and makes no API calls. Two runs in a
row give byte-identical files (sha256 checked for all 13 outputs).

## Files
| file | what |
|---|---|
| `avatar.png` 1024 (+ `avatar-400.png`) | X profile picture / pump.fun image. Max text radius **471.3** (limit 476, the y-tail tip sets it). Max shadow radius (alpha > 8) is 468.3 |
| `square.png` 1024 (+ `square-400.png`) | name 890 px wide, **86.9 %** of the width, no circle rule |
| `banner.png` 1500x500 | X header: title ink y 40-415, tagline block y 127-192, nothing in x<420 / y>330 |
| `wordmark.png` 1931x1012 | cleaned RGBA master, byte-identical to A's |
| `wordmark@2x.png` 3862x2024 | print master. 2x Lanczos with a light unsharp mask on colour, then the alpha edge re-tightened (slope 1.8 about 0.5) so edges stay crisp |
| `lockup-transparent.png` 2053x1131 | stacked lockup with its soft drop shadow, transparent |
| `lockup-wide-transparent.png` 3066x1113 | the banner's staggered two-line lockup, transparent |
| `line-C.png`, `line-S.png` | the two lines split out of the master (banner input) |
| `sheet.jpg` | contact sheet: avatar circle @400/96/48 on #000 and #fff, square @400/64, banner @750, and banner @600x200 with the 130 px avatar at x 20-150, y 110-240 |
| `gen/s1-foreground.png` | the AI-edited s1 scene used for the avatar's foreground |

## The wordmark (unchanged from A)
The wordmark is one Higgsfield `gpt_image_2_5` generation: job **d8825a43-2b38-45f7-bd5c-04db83f986dd** (r2_1), saved
as `wordmark-src.png`. Round 1 used a text-only brief, and r1_4 (b9a73b07-f91d-4254-8697-c149b5926670) was the image
reference for round 2. The prompts and the other candidates are in `../A/notes.md` and `../A/gen/`.
Spelling: C-a-t-c-o-i-n / S-a-n-c-t-u-a-r-y, with every letter present, in order, and no extra glyphs.
There are four cat motifs: a cat-head **C** (ears and whiskers), a **paw-print i-dot**, tabby stripes in "Sanctuary",
and the **y** descender curling into a striped tail. As the judges asked, the pixels are identical in every piece.
No fill texture or counter decoration was added.

## What changed from A, and why
**Avatar: the empty grass band (y 805-985)**
- One AI edit of s1 (job **5afb3cbd-a2f3-4ba9-9430-76e69b039174**, `gpt_image_2_5`, 1:1, medium, 1k, image reference
  3655ebef-d9d9-4eee-bd46-0c7e22a7a3fa = `logo/s1.png`, 0.5 credits). It added three stepping stones leading to the sign,
  plus flower clumps in the lawn. Above y 760 the edit matches s1 (mean |diff| 3-6/255, best offset 0,0). make.py keeps
  s1 above row 735 and blends the edit in over 30 rows, so there is no seam and the mascot and house are untouched.
- A plum darkening deepens downward (y 740 to 900) and toward the rim, and a soft plum contact shadow sits under
  "Sanctuary" (ellipse centred at y 780, 820x80, blur 22, 45 %). With these, the foreground below the sign measures
  luminance p50 **0.205** and p99 **0.349**, under the 0.35 cap.
- The lettering did not move, because the tail tip at r 471 rules out shifting the name.

**Square: the peeking feet.** CoinMarketCat's pale feet under the extrusion (x 430-700, y 900-945) are gone. The stone
path to the right of them in s1 (x 612-835) is mirrored over them (s1 box 388-612 x 684-742, 6 px feather) before the
zoom. That also removes the orange tail tip at x≈410.

**Banner**
- *Separation from the dark sky.* Four changes:
  - The wash colour is ~15 % lighter: (52,32,68)→(30,22,39), was (44,27,58)→(26,19,33).
  - A warm mauve (#8A5A86) radial lift sits behind the title (centre 560,165; 26 %).
  - A soft cream (#FFE9C7) glow sits behind both lines (grow 3, blur 12, 22 %).
  - A thin warm rim (#FFD496, 2.5 px, 38 %) runs just outside the plum outline.
  
  All of it is masked to exactly 0 inside x<420 / y>330 (measured max there: **0.0**) and inside r 172.5 of X's avatar
  centre (nearest glow pixel: **178.5**).
- *Tagline.* It is set at 33 px, with the URL at 24 px (was 34/25), right-aligned at x 1138 so it stays clear of the
  cottage. The gap from "Catcoin" (letters and paw dot) over the block's rows is **65 px** (was 39).
- *Mascot.* The wide scene is scaled 1.25x and placed at x 320, y-offset 176. CoinMarketCat is now **186 px** wide
  (x 1194-1380, ears y 237, feet y 489), **59.8 px** clear of the title ink (bounding-box distance). The white and grey
  side cats now start at x 1504, fully off-frame, so no cat is cut by the edge. The cottage fills the right edge, and its
  roof top is cropped.
- *Duplicated lantern.* The mirrored left strip is now 320 px of pure meadow, so the lantern repeat at x≈75 is gone.
- All of A's checks still pass. Title ink is 200.8 px from the avatar centre (limit 172.5), and the title and tagline
  lie within y 40-420.

**Not done (optional small-size polish):** thicker whiskers and +10 % stripe contrast in the 400 px and ≤64 px renders.
- At 64 px the whiskers are 0.9 px wide, and at the left of the C they sit on the dark porch. A "slight" thickening would
  not survive, and a thick one would change the wordmark.
- The other two judges asked to keep the wordmark exactly as it is and identical in every piece.
- The ears, paw i-dot and tail read at 48-96 px (see sheet.jpg), so the cat theme holds at small sizes without it.

## Credits
This step used 0.5 (balance 190.75 → 190.25). A's wordmark generations used 4.5, so the whole A→final path totals 5.0.
