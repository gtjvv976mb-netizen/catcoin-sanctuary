"""Build the base per-cat inventory (read-only over the sources). Writes adopt/raw/kits/base-inventory.json.
Sources: cat-sanctuary/data/planned.json + cats-info.json (READ-ONLY), launch-sheet/launch-sheet.json,
launch-sheet-2/*-pick.json / *-coins.json / *-check.out.json (partial, snapshot), stockcats/rest-stocks.json,
stockcats/stonkfun-pairs.json (12:39 UTC) and adopt/raw/api/pairs-ready.json (17:38 UTC), stockcats/notes/*.md."""
import json, os, re, glob, hashlib, datetime
from PIL import Image

SP = '/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad'
SITE = '/home/user/cat-sanctuary'
OUT = f'{SP}/adopt/raw/kits/base-inventory.json'

planned = json.load(open(f'{SITE}/data/planned.json'))
info = json.load(open(f'{SITE}/data/cats-info.json'))
sheet1 = json.load(open(f'{SP}/launch-sheet/launch-sheet.json'))
rest = json.load(open(f'{SP}/stockcats/rest-stocks.json'))
pairs_old = {p['mint']: p for p in json.load(open(f'{SP}/stockcats/stonkfun-pairs.json'))['data']['pairs']}
pairs_live = {p['mint']: p for p in json.load(open(f'{SP}/adopt/raw/api/pairs-ready.json'))['data']['pairs']}
L2 = f'{SP}/launch-sheet-2'
NOTES = f'{SP}/stockcats/notes'

s1_by_mint = {c['quoteMint']: c for c in sheet1}
site_cats = {c['pair']['mint']: c for c in planned['cats']}

def img_meta(path):
    if not path or not os.path.exists(path):
        return None
    im = Image.open(path)
    b = os.path.getsize(path)
    return {'path': path, 'bytes': b, 'mb': round(b / 1048576, 3), 'width': im.size[0], 'height': im.size[1],
            'format': im.format, 'mode': im.mode, 'square': im.size[0] == im.size[1],
            'under2MB': b <= 2097152, 'sha256_12': hashlib.sha256(open(path, 'rb').read()).hexdigest()[:12]}

DISC_RE = re.compile(r'(A cat coin priced in .*)$')
def split_desc(desc):
    m = DISC_RE.search(desc or '')
    if not m:
        return desc, None
    return desc[:m.start()].strip(), m.group(1).strip()

def issuers_from_disc(disc):
    m = re.search(r'Not affiliated with (.*?) or StonkFun\.', disc or '')
    return m.group(1) if m else None

def l2_files(sym):
    out = {}
    for k in ['pick.json', 'coins.json', 'check.out.json', 'pick-final.out.json', 'pick-check.out.json']:
        p = f'{L2}/{sym}-{k}'
        if os.path.exists(p):
            out[k] = p
    return out

TICK = re.compile(r'^[A-Z0-9]{2,10}$')

# merge tessera duplicates into the prestock row (rest-stocks.json says "Merged duplicates")
tessera = {s['stonkfun']: s for s in planned['stocks'] if s['category'] == 'tessera'}
rows = []
order = 0
for s in planned['stocks']:
    if s['category'] == 'tessera':
        continue
    order += 1
    mint = s['pair']['mint']
    pl, po = pairs_live.get(mint), pairs_old.get(mint)
    ci = info.get(s['stonkfun'], {})
    r = {
        'n': order,
        'category': s['category'],
        'stock': s['pair']['symbol'],
        'stonkfunSymbol': s['stonkfun'],
        'stonkfunPairName': (pl or po or {}).get('name'),
        'company': s['company'],
        'quoteMint': mint,
        'quoteTokenProgram': (pl or po or {}).get('tokenProgram'),
        'quoteDecimals': (pl or po or {}).get('decimals'),
        'launchable': (pl or {}).get('launchable'),
        'launchLabReady': (pl or {}).get('launchLabReady'),
        'symbolAmbiguous': (pl or {}).get('symbolAmbiguous'),
        'pairCheckedAt': '2026-09-25T17:38:50Z (adopt/raw/api/pairs-ready.json)' if pl else None,
        'alsoListedMint': tessera[s['stonkfun']]['pair']['mint'] if s['stonkfun'] in tessera and s['category'] == 'prestock' else None,
        'realCat': {'name': ci.get('realCatName') or s['realCat'].get('name'), 'strength': s['realCat'].get('strength'),
                    'linkType': s['realCat'].get('linkType'), 'basis': s['realCat'].get('basis')},
        'sourceLinks': [{'label': l['label'], 'url': l['url'], 'date': l.get('date')} for l in s.get('links', [])][:3],
        'virality': {'count': len(s.get('virality', [])),
                     'top': ({'label': s['virality'][0]['label'], 'value': s['virality'][0]['value'], 'source': s['virality'][0]['source'], 'date': s['virality'][0]['date']} if s.get('virality') else None)},
        'researchNote': (f'{NOTES}/{s["stonkfun"]}.md' if os.path.exists(f'{NOTES}/{s["stonkfun"]}.md') else None),
        'siteDisclaimer': s.get('disclaimer'),
    }
    # ---- the drafted coin
    c1 = s1_by_mint.get(mint)
    if c1:
        story, disc = c1['story'], c1['disclosure']
        r['draft'] = {'sheet': 'launch-sheet', 'status': 'final', 'order': c1['order'],
                      'name': c1['name'], 'ticker': c1['ticker'], 'description': c1['description'],
                      'story': story, 'disclosure': disc, 'look': c1.get('look'),
                      'imagePath': c1['image'], 'imageJpg512': c1.get('imageJpg512'), 'imageUrlHiggsfield': c1.get('imageUrl'),
                      'sheetChecks': 'launch-sheet.md: checkProposal ok; description flags only the disclosure; Jupiter/StonkFun ticker free (re-checked 2026-09-25 17:10 UTC)'}
    else:
        f = l2_files(s['stonkfun'])
        d = {'sheet': 'launch-sheet-2', 'files': f}
        if 'pick.json' in f:
            pk = json.load(open(f['pick.json']))
            pk = pk['pick'] if isinstance(pk.get('pick'), dict) else pk
            story, disc = split_desc(pk['description'])
            d.update({'status': 'picked-no-image', 'name': pk['name'], 'ticker': pk['ticker'], 'description': pk['description'],
                      'story': story, 'disclosure': disc, 'coat': pk.get('coat'), 'imagePath': None})
        else:
            cands = []
            if 'coins.json' in f:
                cands = [{'name': c['name'], 'ticker': c['ticker'], 'blurb': c.get('blurb')} for c in json.load(open(f['coins.json']))]
            elif 'check.out.json' in f:
                try:
                    co = json.load(open(f['check.out.json']))
                    for c in co.get('results', []):
                        cands.append({'name': c.get('name'), 'ticker': c.get('ticker'), 'blurb': None})
                except Exception:
                    pass
            d.update({'status': 'candidates-only' if cands else 'no-draft', 'candidates': cands, 'name': None, 'ticker': None,
                      'description': None, 'story': None, 'disclosure': None, 'imagePath': None})
        r['draft'] = d
    d = r['draft']
    d['nameLen'] = len(d['name']) if d.get('name') else None
    d['nameBytes'] = len(d['name'].encode()) if d.get('name') else None
    d['nameOk'] = (d['nameLen'] is not None and 3 <= d['nameLen'] <= 32)
    d['tickerLen'] = len(d['ticker']) if d.get('ticker') else None
    d['tickerOk'] = bool(d.get('ticker') and TICK.match(d['ticker']))
    d['descriptionLen'] = len(d['description']) if d.get('description') else None
    d['storyLen'] = len(d['story']) if d.get('story') else None
    d['issuersNamed'] = issuers_from_disc(d.get('disclosure'))
    r['image'] = img_meta(d.get('imagePath'))
    r['image512'] = img_meta(d.get('imageJpg512')) if d.get('imageJpg512') else None
    sc = site_cats.get(mint)
    r['sitePortrait'] = (f'{SITE}/{sc["portrait"]}' if sc else None)
    r['siteHasCat'] = bool(sc)
    rows.append(r)

# rest-stocks cross-check: every planned (non-tessera) stock present there?
rest_mints = {x['mint'] for x in rest}
for r in rows:
    r['inRestStocks'] = r['quoteMint'] in rest_mints or r['category'] == 'xstock'

json.dump({'generatedAt': datetime.datetime.utcnow().isoformat() + 'Z', 'count': len(rows), 'rows': rows}, open(OUT, 'w'), indent=1)
from collections import Counter
print(len(rows), Counter(r['category'] for r in rows), Counter(r['draft']['status'] for r in rows))
print('rest-stocks count', len(rest), 'rows not in rest (non-xstock):', [r['stock'] for r in rows if not r['inRestStocks']])
