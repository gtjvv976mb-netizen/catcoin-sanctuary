"""Assemble adopt/kits-inventory.json (machine-readable per-cat adoption kit inventory + production plan) and the
generated Markdown tables (adopt/raw/kits/tables.md, adopt/raw/kits/sample.md) that research-kits.md embeds.
Inputs (all produced by the scripts next to this one, re-runnable in order):
  inventory.py -> raw/kits/base-inventory.json   text.mjs -> raw/kits/text-checks.json   banner.py -> raw/kits/proto/proto-results.json
Run: python3 inventory.py && node text.mjs && python3 banner.py SOCKFOOT PORCHLIGHT SAVEPAWS HALFSMILE MOATCAT && python3 assemble.py"""
import json, os, datetime
from urllib.parse import quote

SP = '/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad'
A = f'{SP}/adopt'
base = json.load(open(f'{A}/raw/kits/base-inventory.json'))
text = {r['stock']: r for r in json.load(open(f'{A}/raw/kits/text-checks.json'))['rows']}
proto = {r['ticker']: r for r in json.load(open(f'{A}/raw/kits/proto/proto-results.json'))}
pairs_live = {p['mint']: p for p in json.load(open(f'{A}/raw/api/pairs-ready.json'))['data']['pairs']}
SITE = 'https://catcoinsanctuary.com'
KIT_OUT = f'{A}/kits'            # proposed output folder for produced kit files (nothing is written there by this script)
enc = lambda s: quote(s, safe="-_.!~*'()")   # = encodeURIComponent

SAMPLE = ['SOCKFOOT', 'KERNELPAW', 'COTTAPAW']
COLLISIONS = {
              'CARTONPAW': 'Close to RBLX pick "Tartan the Yellow-Tie Cat" ($TARTANPAW): ticker edit distance 2 (-ARTONPAW). Different names; low risk, flag only.',
              'TARTANPAW': 'Close to COST "Carton the Cardboard-Tan Cat" ($CARTONPAW): ticker edit distance 2. Different names; low risk, flag only.','SAVEPAWS': 'Near-duplicate of TTWO "Savepoint the Silver Cat" ($SAVEPAW): ticker edit distance 1, same name root. Sheet 1 note says rename the TTWO coin, not this one.',
              'SAVEPAW': 'Near-duplicate of GMEx "Save Point the Tabby" ($SAVEPAWS): rename this TTWO pick before its kit is published (launch-sheet.md note on SAVEPAWS says the same).'}

rows = []
for r in base['rows']:
    d = r['draft']; t = text.get(r['stock'], {}); tk = d.get('ticker')
    drafted = bool(tk)
    has_img = bool(r.get('image'))
    missing = []
    if not drafted:
        missing += ['final name/ticker/description pick (sheet 2 has candidates only)']
    if not has_img:
        missing += ['1024x1024 token image (+512 JPEG)']
    missing += ['banner 1500x500 (X header; also usable on the cat page)', 'avatar 400x400 (resize of the token image)']
    if not drafted:
        missing += ['X post text (template ready; needs name/ticker)', 'X bio (template ready; needs name/ticker)']
    missing += [f'live cat page at the kit website URL (today only {SITE}/#cat=<TICKER> exists)' if r['siteHasCat'] else 'the cat itself on the site (not in planned.json cats yet) and its page at the kit website URL']
    if tk in COLLISIONS:
        missing.insert(0, 'resolve name/ticker collision: ' + COLLISIONS[tk])
    kit = {
        'n': r['n'], 'id': tk, 'category': r['category'], 'stock': r['stock'], 'stonkfunSymbol': r['stonkfunSymbol'],
        'stonkfunPairName': r['stonkfunPairName'], 'company': r['company'],
        'quote': {'mint': r['quoteMint'], 'tokenProgram': r['quoteTokenProgram'], 'decimals': r['quoteDecimals'],
                  'launchable': r['launchable'], 'launchLabReady': r['launchLabReady'], 'symbolAmbiguous': r['symbolAmbiguous'],
                  'checked': r['pairCheckedAt'], 'alsoListedMint': r['alsoListedMint']},
        'status': {'final': 'ready-text-and-image', 'picked-no-image': 'text-ready-no-image', 'candidates-only': 'not-picked'}[d['status']],
        'draft': {k: d.get(k) for k in ['sheet', 'name', 'nameLen', 'nameBytes', 'nameOk', 'ticker', 'tickerLen', 'tickerOk', 'description',
                                        'descriptionLen', 'story', 'storyLen', 'disclosure', 'issuersNamed', 'look', 'coat']},
        'candidates': d.get('candidates') or None,
        'draftFiles': d.get('files') or ({'launch-sheet.json': f'{SP}/launch-sheet/launch-sheet.json'} if d['sheet'] == 'launch-sheet' else None),
        'limits': {'nameMax32': (d['nameLen'] or 0) <= 32 if drafted else None, 'symbolMax10': (d['tickerLen'] or 0) <= 10 if drafted else None,
                   'cashtagClickableOnX': (tk.isalpha() and len(tk) <= 6) if drafted else None},
        'image': r['image'], 'image512': r['image512'],
        'imageUnder2MB': r['image']['under2MB'] if has_img else None,
        'realCat': r['realCat'], 'virality': r['virality'], 'sourceLinks': r['sourceLinks'], 'researchNote': r['researchNote'],
        'siteDisclaimer': r['siteDisclaimer'], 'sitePortrait': r['sitePortrait'] if r['siteHasCat'] else None,
        'missing': missing,
    }
    if drafted:
        url = f'{SITE}/cat/{tk.lower()}'
        wp = t['xPostWaiting']['text']
        kit['text'] = {
            'website': url, 'websiteLen': len(url), 'websiteWorkingToday': (f'{SITE}/#cat={tk}' if r['siteHasCat'] else None),
            'metadataDescription': t['metadataDescription'], 'metadataDescriptionLen': t['metadataDescriptionLen'],
            'xPostWaiting': wp, 'xPostWaitingWeighted': t['xPostWaiting']['weighted'], 'xPostWaitingStory': t['xPostWaiting']['storyUsed'],
            'xIntentWaiting': 'https://x.com/intent/tweet?text=' + enc(wp),
            'xPostAdoptedTemplate': t['xPostAdopted']['text'], 'xPostAdoptedWeightedWorstCase': t['xPostAdopted']['weightedWith44CharMint'],
            'xPostAdoptedDisclosure': t['xPostAdopted']['disclosure'],
            'xIntentAdoptedTemplate': 'https://x.com/intent/tweet?text=' + enc(t['xPostAdopted']['text']).replace(enc('{MINT}'), '{MINT}'),
            'xDisplayName': t['xDisplayName'], 'xBio': t['xBio'], 'xBioLen': t['xBioLen'], 'xBioVariant': t['xBioVariant'],
            'xHandleSuggestion': t['xHandleSuggestion'], 'xHandleNote': 'availability not checked (X not readable from here); the adopter picks the handle',
            'checksPass': t['pass'],
            'checks': {'ownWords_checkFields': t['checks']['ownWords_checkFields']['ok'], 'ownWords_pairTerms_launchClaims': t['checks']['ownWords_pairTerms_launchClaims']['ok'],
                       'ownWords_otherPairs': t['checks']['ownWords_otherPairs']['ok'], 'disclosureOnlyExpectedHits': not t['checks']['disclosure_unexpected'],
                       'hype': t['checks']['hype'], 'fullPostRuleHits': t['checks']['fullPost_rules_hit'], 'pairTerms': t['checks']['pairTermsUsed']},
        }
        kit['stonkfunForm'] = {'launchOn': 'LaunchLab (fixed)', 'holderRewardsTax': 'None (Standard)', 'devBuy': 'empty',
                               'tokenName': d['name'], 'symbol': tk, 'tokenImage': (r['image'] or {}).get('path'),
                               'website': url, 'x': 'blank, or the adopter\'s own x.com/<handle> if it exists before launch (permanent)', 'telegram': 'blank',
                               'quoteToken': {'category': pairs_live[r['quoteMint']]['categoryLabel'], 'search': r['quoteMint'],
                                              'how': 'open the quote-token picker, paste the mint into search, pick the one match (sheet 1 names the xStocks tab; other tab labels INFERRED from categoryLabel)'}}
        kit['assets'] = {'tokenImage': (r['image'] or {}).get('path') or f'{KIT_OUT}/{tk}/token-1024.png (to generate)',
                         'banner': f'{KIT_OUT}/{tk}/banner-1500x500.png', 'bannerJpg': f'{KIT_OUT}/{tk}/banner-1500x500.jpg',
                         'avatar': f'{KIT_OUT}/{tk}/avatar-400.png', 'ogCard': f'{KIT_OUT}/{tk}/og-1200x630.jpg (optional)',
                         'bannerText': [f'${tk}', d['name'], 'lives at catcoinsanctuary.com'],
                         'prototype': proto.get(tk)}
    else:
        kit['text'] = None; kit['stonkfunForm'] = None
        kit['assets'] = {'bannerText': ['$<TICKER>', '<name>', 'lives at catcoinsanctuary.com'], 'prototype': None}
    rows.append(kit)

from collections import Counter
cnt = Counter(k['status'] for k in rows)
plan = {
    'summary': 'Composite every banner and avatar with PIL from the cat\'s own token image (0 credits, ~2 s each); spend generation credits only on the 67 token images that do not exist yet; generate all text from fixed templates checked by content-rules.mjs.',
    'steps': [
        {'step': 1, 'what': 'Finish sheet-2 picks (name, ticker, description with disclosure) for the not-picked cats; rename TTWO SAVEPAW', 'cats': cnt['not-picked'],
         'owner': 'launch-sheet-2 workflow', 'cost': 'none', 'blocking': True},
        {'step': 2, 'what': 'Generate the missing 1024x1024 token images with the sheet-1 recipe (Higgsfield gpt_image_2_5, 1:1, same style reference c0dc6227-9a1e-4375-9933-5cb61d2a5aec, prompt "The same stylized low-poly cat style as the reference ... {look} Sitting, three-quarter front view, centered, full body, on a soft warm dusk background (deep plum to amber glow), no text, no letters, no logos, no brand marks."); save PNG + 512 JPEG',
         'cats': cnt['text-ready-no-image'] + cnt['not-picked'], 'cost': f"~{0.25 * (cnt['text-ready-no-image'] + cnt['not-picked']):.2f} credits at the task-given ~0.25/image (+~20% for retries); price not exposed by models_explore",
         'recipeSource': f'{SP}/launch-sheet/images/_work/batch1.json', 'blocking': True},
        {'step': 3, 'what': 'Banner 1500x500 per cat: PIL composite (scene cmc-banner-b.png at 0.94 flush right + mirrored strip + plum wash; token image in a cream-ringed medallion over the scene mascot; $TICKER, name (auto-fit 1-2 lines, shrunk until >= 8 px clear of X\'s avatar circle), "lives at catcoinsanctuary.com"). Save PNG and JPEG q90.',
         'cats': len(rows), 'cost': '0 credits; ~2 s/cat measured (~3 min for 91)', 'tool': f'{A}/tools/kits/banner.py', 'blocking': False},
        {'step': 4, 'what': 'Avatar 400x400 = LANCZOS resize of the token image (PNG ~0.2 MB measured)', 'cats': len(rows), 'cost': '0', 'tool': f'{A}/tools/kits/banner.py'},
        {'step': 5, 'what': 'Optional 1200x630 og card for the per-cat page (same compositing code, different canvas) so X link previews show the cat, not the site-wide og-image.jpg', 'cats': len(rows), 'cost': '0'},
        {'step': 6, 'what': 'Text: X posts (waiting + adopted), bio, display name, metadata description from the fixed templates; re-run text.mjs after every pick change; all must pass', 'cats': len(rows), 'cost': '0', 'tool': f'{A}/tools/kits/text.mjs'},
        {'step': 7, 'what': 'Per-cat page at the kit website URL (static cat/<ticker>.html with per-cat og tags, opening the 3D garden card). Must exist, at exactly that path, before the first adoption: the URL is written into permanent metadata.', 'cats': len(rows), 'owner': 'site rebuild', 'blocking': True},
        {'step': 8, 'what': 'Only for a self-built (non-form) launch: pre-upload image + metadata JSON (description = story + disclosure, extensions.website) to Arweave; see research-stonkfun.md', 'cats': len(rows), 'cost': 'see research-stonkfun.md (Irys ~0.00003 SOL per 1.3 MB)'},
    ],
    'generatedArtAlternative': {'what': 'Higgsfield-generated banners', 'cost': f'~{0.25 * len(rows):.2f} credits for {len(rows)} banners (task-given price)',
                                'whyNot': ['no native 3:1 aspect (widest is 21:9; VERIFIED models_explore), so every banner needs a crop or outpaint',
                                           'the cat would be re-drawn and drift from its token image (identity must match the coin)',
                                           'lettering still has to be set in PIL (generated text is unreliable and the sheet prompts forbid text)',
                                           'each output needs a human check for stray logos/marks; the PIL composite reuses already-checked art']},
}
limits = {
    'stonkfunForm': {'name': 'maxLength 32', 'symbol': 'maxLength 10', 'image': 'image/png,image/jpeg,image/webp; <= 2097152 bytes ("2 MB")',
                     'website': 'optional; <= 200 chars; public https URL, no port/credentials; blank -> DEFAULT_LAUNCH_WEBSITE (StonkFun)',
                     'x': 'optional; host x.com/www.x.com/twitter.com/www.twitter.com and a profile path', 'telegram': 'optional; t.me/telegram.me',
                     'description': 'no field on the form (StonkFun writes "<name> was launched on StonkFun.")',
                     'status': 'VERIFIED', 'evidence': [f'{A}/raw/pretty/3f11vexa51nkb.js lines 17-70, 1762, 1782, 1837-1841, 1883-1924', f'{A}/raw/js/0074w00n0gm92.js (MAX_IMAGE_BYTES 2097152)', f'{A}/research-stonkfun.md section on the form']},
    'onChain': {'name': '<= 32 bytes', 'symbol': '<= 10 bytes', 'uri': '<= 200 bytes', 'status': 'VERIFIED in research-launcher.md (encoder refuses too_long)'},
    'xPost': {'max': 280, 'weighting': 'twitter-text v3: URL = 23; code points 0-4351, 8192-8205, 8208-8223, 8242-8247 weigh 1; others 2', 'status': 'VERIFIED (twitter-text 3.1.0 dist/configs.js)', 'evidence': f'{A}/raw/kits/twitter-text-3.1.0-configs.js'},
    'cashtag': {'rule': '$ + 1-6 letters (optional ._xx) autolinks; longer or with digits stays plain text', 'status': 'VERIFIED in twitter-text 3.1.0 regexp/cashtag.js; INFERRED that x.com renders the same', 'evidence': f'{A}/raw/kits/twitter-text-3.1.0-cashtag.js'},
    'xIntent': {'url': 'https://x.com/intent/tweet?text=<encoded>[&url=]', 'status': 'VERIFIED (docs.x.com web intents / post button)', 'evidence': [f'{A}/raw/kits/xdocs-web-intents.md', f'{A}/raw/kits/xdocs-post-button.md']},
    'xProfile': {'bio': 160, 'displayName': 50, 'avatar': '400x400 recommended', 'header': '1500x500 recommended; avatar overlays lower-left (x 20-150, y 110-240 at 600x200)',
                 'status': 'INFERRED (task-given / widely documented; help.x.com pages returned a Cloudflare challenge)', 'evidence': [f'{A}/raw/kits/x-help-customize-profile.html', f'{A}/raw/kits/xdoc_help.x.com_en_managing-your-account_common-x-profile-questions.html', f'{SP}/logo/big/final/make.py (avatar geometry)']},
}
out = {
    'generatedAt': datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
    'snapshotNote': 'launch-sheet-2 was still being written when this ran; re-run the four scripts to refresh.',
    'sources': {'sitePlanned': '/home/user/cat-sanctuary/data/planned.json (read-only)', 'siteInfo': '/home/user/cat-sanctuary/data/cats-info.json (read-only)',
                'sheet1': f'{SP}/launch-sheet/launch-sheet.json', 'sheet2': f'{SP}/launch-sheet-2/<SYM>-pick.json | -coins.json | -check.out.json',
                'restStocks': f'{SP}/stockcats/rest-stocks.json', 'pairs': [f'{SP}/stockcats/stonkfun-pairs.json', f'{A}/raw/api/pairs-ready.json (live 17:42 UTC)'],
                'notes': f'{SP}/stockcats/notes/<SYM>.md', 'contentRules': '/home/user/Cat-Intelligence-Agency/bots/lib/content-rules.mjs + src/lib/stockcats.mjs LAUNCH_CLAIMS'},
    'counts': {'cats': len(rows), 'byCategory': dict(Counter(k['category'] for k in rows)), 'byStatus': dict(cnt),
               'withTokenImage': sum(1 for k in rows if k['image']), 'textChecksPass': sum(1 for k in rows if k['text'] and k['text']['checksPass']),
               'drafted': sum(1 for k in rows if k['text']), 'launchLabReadyPairs': sum(1 for k in rows if k['quote']['launchLabReady']),
               'cashtagClickable': sum(1 for k in rows if k['limits']['cashtagClickableOnX'])},
    'limits': limits,
    'templates': {
        'xPostWaiting': ['{name} is up for adoption at Catcoin Sanctuary. ${TICKER}', '[{story} | {first sentence of story} | omitted: longest that fits]', '{website}', '{disclosure full, else core}'],
        'xPostAdopted': ['I adopted {name} at Catcoin Sanctuary. ${TICKER}', '[{story} | {first sentence} | omitted]', 'CA {mint}', '{website}', '{disclosure full, else core}'],
        'fitRule': 'lines joined with one newline; first variant whose X-weighted length <= 276 (4-char margin); mint measured at 44 chars',
        'xBio': ['{name}, adopted at Catcoin Sanctuary. {disclosure full}', '{name}, adopted at Catcoin Sanctuary. {disclosure core}', '{name} of Catcoin Sanctuary. {disclosure core}', 'Adopted at Catcoin Sanctuary. {disclosure core}', '{disclosure core}'],
        'xBioRule': 'first variant <= 160 characters',
        'disclosureFull': 'A cat coin priced in {pair}. Not affiliated with {issuers} or StonkFun. No intrinsic value; not financial advice.',
        'disclosureCore': 'Not affiliated with {issuers} or StonkFun. No intrinsic value; not financial advice.',
        'metadataDescription': '{story} {disclosure full}',
        'afterAdoption': {'gmgn': 'https://gmgn.ai/sol/token/{mint}', 'fomo': 'https://fomo.family/tokens/solana/{mint}', 'stonkfun': 'https://www.stonkfun.xyz/token/{mint}',
                          'solscanToken': 'https://solscan.io/token/{mint}', 'solscanTx': 'https://solscan.io/tx/{signature}', 'siteTag': 'adopted by {first4}…{last4 of adopter wallet}',
                          'status': 'VERIFIED: URL shapes from /home/user/cat-sanctuary/assets/collection.js lines 430-452 (BUY_SITES, stonkfun/solscan links); siteTag format is a proposal'},
        'website': SITE + '/cat/{ticker lower case}', 'displayName': '{name}', 'handle': '{TICKER}cat (<= 15), or {TICKER} when it already ends in CAT',
        'bannedInOwnWords': 'content-rules checkFields lists + the pair\'s own terms + other pairs\' terms + LAUNCH_CLAIMS (stock, xstock, share, equity, backed, dividend, collateral, dev buy, no dev, fair launch, stealth, renounced, lp burned, locked) + no-hype list (moon, pump, gem, 100x, lfg, wagmi, gains, profit, returns, guaranteed, safe, locked, burned, backed, buy now, ...)',
        'brandMask': '"Catcoin Sanctuary" is masked to "Sanctuary" before checkTerms: "catcoin" = cat+coin hits COINx\'s pair term COIN (VERIFIED by the checker run)',
    },
    'plan': plan,
    'keyFindings': [
        {'claim': f"Only {cnt['ready-text-and-image']} of {len(rows)} cats (sheet-1 xStocks) have name+ticker+description+1024 image; sheet 2 has {cnt['text-ready-no-image']} picks with no image and {cnt['not-picked']} with candidates only; 0 images exist for any sheet-2 cat", 'status': 'VERIFIED', 'evidence': [f'{A}/raw/kits/base-inventory.json', f'{SP}/launch-sheet-2/']},
        {'claim': 'No cat has a banner, 400px avatar, X text or per-cat page yet', 'status': 'VERIFIED', 'evidence': ['/home/user/cat-sanctuary/assets/', f'{SP}/launch-sheet/images/']},
        {'claim': 'The 24 token images are PNG 1024x1024 RGB, 1.083-1.279 MB, all under StonkFun MAX_IMAGE_BYTES 2097152 (png/jpeg/webp accepted)', 'status': 'VERIFIED', 'evidence': [f'{A}/raw/js/0074w00n0gm92.js', f'{A}/raw/pretty/3f11vexa51nkb.js:1837-1841']},
        {'claim': 'StonkFun form: name maxLength 32, symbol maxLength 10, website <=200 public https, X link must be x.com/twitter.com with a profile path, no description field', 'status': 'VERIFIED', 'evidence': [f'{A}/raw/pretty/3f11vexa51nkb.js:17-70,1762,1782,1883-1924', f'{A}/research-stonkfun.md']},
        {'claim': 'All 91 quote mints are launchable + launchLabReady, Token-2022; decimals 8 xStock / 6 Sunrise / 9 PreStock', 'status': 'VERIFIED', 'evidence': [f'{A}/raw/api/pairs-ready.json']},
        {'claim': f"All {sum(1 for k in rows if k['text'])} drafted cats' X posts (<=276 weighted), bios (<=160) and own words pass content-rules checkFields, pair/other-pair terms, LAUNCH_CLAIMS and a no-hype list; disclosure hits only brand/endorsement/financial_promise", 'status': 'VERIFIED', 'evidence': [f'{A}/raw/kits/text-checks.json', f'{A}/tools/kits/text.mjs']},
        {'claim': '"Catcoin Sanctuary" must be masked before checkTerms: catcoin = cat+coin hits COINx pair term COIN', 'status': 'VERIFIED', 'evidence': [f'{A}/tools/kits/text.mjs']},
        {'claim': 'Only 5 tickers (PEWTER, PINROW, COBBLE, TOUSLE, HUBBUB) are clickable cashtags per twitter-text 3.1.0 ($ + 1-6 letters); x.com assumed to match', 'status': 'VERIFIED (library) / INFERRED (x.com)', 'evidence': [f'{A}/raw/kits/twitter-text-3.1.0-cashtag.js']},
        {'claim': 'Collision: GMEx SAVEPAWS "Save Point the Tabby" vs TTWO SAVEPAW "Savepoint the Silver Cat" (rename TTWO, as launch-sheet.md already notes); CARTONPAW vs TARTANPAW flag only', 'status': 'VERIFIED', 'evidence': [f'{A}/raw/kits/collision-scan.txt', f'{SP}/launch-sheet/launch-sheet.md']},
        {'claim': 'Only working per-cat link today is https://catcoinsanctuary.com/#cat=<TICKER> (24 cats); every hash link shares the site-wide og-image, so a permanent /cat/<ticker> page with per-cat og tags should exist before the first adoption', 'status': 'VERIFIED (current) / INFERRED (recommendation, GitHub Pages extensionless .html)', 'evidence': ['/home/user/cat-sanctuary/assets/ui/main.js:60,177-179', '/home/user/cat-sanctuary/assets/residents.js:95', '/home/user/cat-sanctuary/index.html:11-20']},
        {'claim': 'PIL banner prototype: 1.7-2.4 s/cat, PNG 856-886 KB, JPEG q90 158-172 KB, avatar 400 PNG 180-217 KB, lettering 8-89 px clear of the X avatar circle; 0 credits', 'status': 'VERIFIED', 'evidence': [f'{A}/raw/kits/proto/proto-results.json', f'{A}/raw/kits/proto/proto-sheet.jpg']},
        {'claim': 'Sheet-1 image recipe: Higgsfield gpt_image_2_5, 1:1, style reference c0dc6227-..., low-poly prompt with "no text, no letters, no logos, no brand marks"', 'status': 'VERIFIED', 'evidence': [f'{SP}/launch-sheet/images/_work/batch1.json']},
        {'claim': 'Higgsfield gpt_image models have no 3:1 aspect (max 21:9) and the catalog shows no price; ~0.25 credits/image is task-given', 'status': 'VERIFIED (aspects) / INFERRED (price)', 'evidence': [f'{A}/raw/kits/higgsfield-models-gpt-image.json']},
        {'claim': 'X bio 160 / display name 50 / avatar 400x400 / header 1500x500 limits could not be read (help.x.com Cloudflare challenge)', 'status': 'INFERRED', 'evidence': [f'{A}/raw/kits/x-help-customize-profile.html']},
    ],
    'reportNote': 'research-kits.md was not written: this subagent environment refuses report .md files; the narrative is in the workflow result summary. Generated fragments: raw/kits/tables.md (91-row table), raw/kits/descriptions.md, raw/kits/sample.md (3-cat sample).',
    'sample': SAMPLE,
    'collisions': COLLISIONS,
    'cats': rows,
}
json.dump(out, open(f'{A}/kits-inventory.json', 'w'), indent=1, ensure_ascii=False)

# ---------------- Markdown fragments ----------------
def short(m): return f'`{m}`'
L = []
L.append('| # | Cat id (ticker) | Stock (StonkFun symbol / pair name) | Quote mint | Token name (len/32) | Ticker (len/10) | Description len (story + disclosure) | 1024 image (MB) | Virality / source link | Missing |')
L.append('|---|---|---|---|---|---|---|---|---|---|')
for k in rows:
    d = k['draft']; im = k['image']
    stock = f"{k['stock']} ({k['stonkfunSymbol']} / {k['stonkfunPairName']})"
    if k['text']:
        name = f"{d['name']} ({d['nameLen']})"; tick = f"{d['ticker']} ({d['tickerLen']})"; desc = f"{d['descriptionLen']} ({d['storyLen']} + {len(d['disclosure'] or '')})"
    else:
        name = 'not picked: ' + ' / '.join(f"{c['name']}" for c in (k['candidates'] or [])[:3]); tick = ' / '.join(c['ticker'] for c in (k['candidates'] or [])[:3]); desc = '-'
    img = f"`launch-sheet/images/{d['ticker']}.png` ({im['mb']}, {im['format']} {im['width']}x{im['height']})" if im else 'none'
    v = k['virality']['top']
    vir = f"{k['virality']['count']}: {v['label']} = {v['value']} ([src]({v['source']}), {v['date']})" if v else 'Not measured'
    sl = k['sourceLinks'][0] if k['sourceLinks'] else None
    src = f"; link: [{sl['label'][:48]}]({sl['url']})" if sl else ''
    miss = []
    if k['status'] == 'not-picked': miss.append('**pick**')
    if not im: miss.append('**image**')
    tag = {'SAVEPAW': '**rename (clashes with SAVEPAWS)**', 'SAVEPAWS': 'keep; TTWO SAVEPAW renames', 'CARTONPAW': 'similar ticker to TARTANPAW (flag)', 'TARTANPAW': 'similar ticker to CARTONPAW (flag)'}.get(d.get('ticker'))
    if tag: miss.insert(0, tag)
    miss += ['banner', 'avatar']
    if not k['text']: miss += ['post', 'bio']
    miss.append('page')
    L.append(f"| {k['n']} | {k['id'] or '-'} | {stock} | {short(k['quote']['mint'])} | {name} | {tick} | {desc} | {img} | {vir}{src} | {', '.join(miss)} |")
open(f'{A}/raw/kits/tables.md', 'w').write('\n'.join(L) + '\n')

# full descriptions of the drafted cats
D = []
for k in rows:
    if k['text']:
        D.append(f"- **{k['id']}** ({k['stock']}): {k['draft']['description']}")
open(f'{A}/raw/kits/descriptions.md', 'w').write('\n'.join(D) + '\n')

# 3-cat sample
S = []
for tk in SAMPLE:
    k = next(x for x in rows if x['id'] == tk); t = k['text']; f = k['stonkfunForm']
    S.append(f"### {k['draft']['name']} (${tk}), {k['stock']} ({k['category']})\n")
    S.append('StonkFun form (every field is permanent once launched):\n')
    S.append(f"- Token name: `{f['tokenName']}` ({k['draft']['nameLen']}/32)")
    S.append(f"- Symbol: `{f['symbol']}` ({k['draft']['tickerLen']}/10)")
    S.append(f"- Token image: `{f['tokenImage'] or 'NOT YET GENERATED (sheet 2 has no image)'}`" + (f" ({k['image']['bytes']:,} bytes, {k['image']['format']} {k['image']['width']}x{k['image']['height']}, under the 2,097,152-byte limit)" if k['image'] else ''))
    S.append(f"- Website: `{t['website']}` ({t['websiteLen']}/200; " + (f"works today only as `{t['websiteWorkingToday']}`)" if t['websiteWorkingToday'] else "not live: this cat is not on the site yet)"))
    S.append(f"- X: blank, or the adopter's own `https://x.com/<handle>` if it exists before launch. Telegram: blank.")
    S.append(f"- Quote token: StonkFun category {f['quoteToken']['category']}; paste `{f['quoteToken']['search']}` into the picker's search and pick the one match")
    S.append(f"- Holder rewards tax: None (Standard). Dev buy: empty.\n")
    S.append(f"Metadata description ({t['metadataDescriptionLen']} chars; reaches chain only on a self-built launch, see research-stonkfun.md):\n\n> {t['metadataDescription']}\n")
    S.append(f"X post, before adoption (\"help this cat find a home\" button; {t['xPostWaitingWeighted']}/280 weighted):\n\n```text\n{t['xPostWaiting']}\n```\n")
    S.append(f"One-click intent: `{t['xIntentWaiting']}`\n")
    S.append(f"X post, after adoption (success screen fills in the mint; worst case {t['xPostAdoptedWeightedWorstCase']}/280 weighted with a 44-char mint):\n\n```text\n{t['xPostAdoptedTemplate']}\n```\n")
    S.append(f"X profile kit: display name `{t['xDisplayName']}` ({len(t['xDisplayName'])}/50); handle suggestion `@{t['xHandleSuggestion']}` (availability unchecked); bio ({t['xBioLen']}/160, variant {t['xBioVariant']}):\n\n> {t['xBio']}\n")
    ptxt = k['assets']['bannerText']
    S.append(f"Avatar: the token image at 400x400. Header: the 1500x500 banner with the lines {', '.join(repr(x) for x in ptxt)} over the sanctuary scene.\n")
    c = t['checks']
    S.append(f"Checks (text.mjs): own words pass checkFields = {c['ownWords_checkFields']}, pair terms + LAUNCH_CLAIMS = {c['ownWords_pairTerms_launchClaims']}, other pairs = {c['ownWords_otherPairs']}; disclosure hits only its expected words = {c['disclosureOnlyExpectedHits']}; hype words = {c['hype'] or 'none'}; whole-post rule hits (expected: disclosure + link) = {', '.join(c['fullPostRuleHits'])}; pair terms held back: {', '.join(c['pairTerms'])}. Cashtag clickable on X: {k['limits']['cashtagClickableOnX']}.\n")
open(f'{A}/raw/kits/sample.md', 'w').write('\n'.join(S) + '\n')
print(json.dumps(out['counts']))
