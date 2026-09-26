import json, datetime
C = json.load(open('cands.json')); FX = json.load(open('fx.json')); W = json.load(open('web.json'))
D = json.load(open('dex_filtered.json')); T = json.load(open('tickers.json'))
NOW = '2026-09-26'
DROP_TWEETS = {'https://twitter.com/drinkglenturret/status/976069275411734529'}

REJECT = {
 'orangey': 'No verifiable X post: the only post found (@The_Lowry) is private/protected on fxtwitter.',
 'orion': 'Weak proof: only a fan design post ("The Galaxy Is on Orion\'s Belt"); no official or media X post naming the cat.',
 'spot': 'Weak proof: the X post found (@TrekCore "Meow.") does not name Spot; no official post found.',
 'masya': 'No acceptable X proof: only a Grok reply names Masya; the Catizen post quotes Vitalik ("only cats") without naming a cat.',
 'mrschippy': 'X post found (@InspireExplore) is about Perce Blackborow and does not name Mrs Chippy; no other verifiable post.',
 'bellini': 'Only one 2011 tweet by Ed Sheeran; no reliable web source for the story and no known look.',
 'morrissey': 'No reliable web source found for the story; owner (Russell Brand) is subject of serious allegations - reputational risk.',
 'jiji': 'Already coined: JIJI (Solana, AYCuzpHAELvsMyyQgQCA5tU4TPwmdnvskEacfwxjxgup) mcap ~$73.9k, 1,134 holders, $70k liquidity (Jupiter, 2026-09-26).',
 'toshi': 'Already coined: TOSHI (Base/Ethereum) mcap > $50M.',
 'nyan': 'Already coined: NYAN (Solana) mcap ~$477k; plus several others.',
}
EXTRA_REJECT = [
 ('Grumpy Cat (Tardar Sauce)', 'viral', 'Already coined: "Grumpy Cat" GCAT (Polygon) mcap ~$3.15M (DexScreener).'),
 ('Keyboard Cat', 'viral', 'Already coined: KEYCAT (Ethereum) mcap reported >$50k (DexScreener).'),
 ('Bongo Cat', 'viral', 'Already coined: BONGO (Solana) mcap ~$643k.'),
 ("Simon's Cat", 'tvmovie', "Already coined: Simon's Cat CAT (BSC) mcap ~$18.7M (official token)."),
 ('Doraemon', 'tvmovie', 'Already coined: Doraemon DORAE (Solana) mcap ~$54k.'),
 ('Top Cat', 'tvmovie', 'Already coined: TOPCAT (Solana) mcap ~$141k.'),
 ('Tom (Tom and Jerry)', 'tvmovie', 'Already coined: "Tom and Jerry" TJ (Solana) mcap ~$92k.'),
 ('Longcat', 'viral', 'Already coined: LONGCAT mcap ~$1.05M.'),
 ("Schrödinger (Elon Musk's cat)", 'crypto', 'Already coined: "Schrödinger Cat" (Solana) mcap ~$65.8M; also $DINGER community token.'),
 ("Hemule (Vitalik Buterin's cat)", 'crypto', 'Already coined: HEMULE (Ethereum) mcap ~$523k.'),
 ('Quantum Cats (Taproot Wizards)', 'crypto', 'Name collision with "Quantum Cat" QCAT (Solana) mcap ~$16.5M; collection cats are NFTs, not a single named cat.'),
 ("Hobbes (Ansem's cat)", 'crypto', "Already coined: \"Ansem's Cat\" HOBBES (Solana) mcap ~$110k."),
 ("Mochi (Brian Armstrong's cat)", 'crypto', 'Already coined: MOCHI (Base) mcap reported ~$49.7M (2024).'),
 ('Humphrey (Downing Street 1989-97)', 'company', 'No verifiable X post naming him found (only an unofficial account).'),
 ('Hamlet (Algonquin Hotel)', 'company', 'No verifiable X post found.'),
 ('Hermitage Museum cats', 'company', 'Group of cats, no single named cat with proof.'),
 ('Isis (Star Trek TOS)', 'tvmovie', 'No X post naming the cat found.'),
 ("Otto (Jerma985's pet)", 'celebrity', 'Otto is a dachshund, not a cat.'),
 ('Binance "even the cat loves it" cat', 'crypto', 'Official Binance post shows an unnamed cat; no lore.'),
]
OFFICIAL = {'taylorswift13','rickygervais','katyperry','MarthaStewart','edsheeran','Reuters','FLOTUS46Archive','hmtreasury','Sothebys','SkyNews','people','CNN','AKNewsNow',
 'Marvel','NECA_TOYS','DeadbyDaylight','HP_jp_official','HogwartsMystery','IGN','HouseofDragon','OriginalFunko','mental_floss','GKIDSfilms','KeanuMovie','CNES','APSphysics',
 'reuterspictures','GWR','AVMAvets','TAMU','Number10cat','CBSNews','OurPresidents','WJCLibrary42','ChartwellNT','Ukraine','nexta_tv','FelixhuddsCat','TPExpressTrains','JapanEmbDC',
 'BrutIndia','PopBase','GoPro','WDFMuseum','DisneyMusic','DisneyStudios','TWDCArchives','SmurfsMovie','TheSimpsons','TVLine','cartoonnetwork','cartoonbrew','BoomerangToons',
 'ParadeMagazine','Garfield','thepetethecat','CatsMusical','catsmovie','PasteMagazine','Dreamworks','Dexerto','KodanshaManga','NintendoAmerica','Pokemon','Polygon','SEGA',
 'RaceCrossWorlds','sonic_hedgehog','monsterhunter','A_i','gematsu','finalfantasyvii','sanrio','ABC7','TheMustacheCat','Venustwofacecat','dodo','IAMLILBUB','thetimes','JortsTheCat',
 'boredpanda','ColeTheBlackCat','WorldofWarships','WoWs_Legends','UberFacts','ChesterCheetah','github','scratch','GoNintendoTweet','PocketGamer','_RealTonyTiger','StudiocanalUK',
 'EW','7News','CryptoKitties','cabinetofficeuk','consequence','TheAtlantic','VanityFair','artukdotorg','StreetCatBob','qikipedia','WorldofGhibliUS','BrickFanatics','Rainmaker1973',
 'kateferguson4','PopCrave','MuggleNet','sunny1065lv','CloutNewsMedia','Loungefly','historydefined','volcaholic1','garius','RazAkkoc','docmilanfar','peachastro','mondomascots','LogoDecks','AITA_online'}

def xproof(cid):
    xs = []
    for u, v in FX.items():
        if v['id'] == cid and v.get('ok') and u not in DROP_TWEETS:
            try: d = datetime.datetime.strptime(v['date'], '%a %b %d %H:%M:%S %z %Y').strftime('%Y-%m-%d')
            except Exception: d = v['date']
            xs.append({'url': v['url'], 'handle': '@' + v['handle'], 'date': d, 'text': v['text'][:500], 'verifiedVia': 'api.fxtwitter.com ' + NOW})
    return xs

out, rej = [], []
for cid, c in C.items():
    if cid in REJECT:
        rej.append({'id': cid, 'catName': c['catName'], 'category': c['category'], 'owner': c['owner'], 'reason': REJECT[cid]}); continue
    xs = xproof(cid); web = [{'url': s['url'], 'title': s['title']} for s in W.get(cid, [])]
    if not xs:
        rej.append({'id': cid, 'catName': c['catName'], 'category': c['category'], 'owner': c['owner'], 'reason': 'No X post verified via fxtwitter.'}); continue
    if not web:
        rej.append({'id': cid, 'catName': c['catName'], 'category': c['category'], 'owner': c['owner'], 'reason': 'No reliable web source found.'}); continue
    hits = D.get(cid, [])
    coin = None
    if hits:
        h = max(hits, key=lambda h: h['mcap'] or 0)
        if (h['mcap'] or 0) > 50000 and cid != 'luna':
            rej.append({'id': cid, 'catName': c['catName'], 'category': c['category'], 'owner': c['owner'], 'reason': f"Already coined: {h['name']} ({h['symbol']}, {h['chain']}, {h['contract']}) mcap ~${h['mcap']:,}"}); continue
        coin = {'chain': h['chain'], 'contract': h['contract'], 'name': h['name'], 'symbol': h['symbol'], 'mcap': h['mcap'],
                'mcapNote': 'mcap 0 = no live market data (dead or unpriced pump.fun token)' if not h['mcap'] else 'USD, DexScreener/Jupiter ' + NOW,
                'otherMatches': len(hits) - 1}
    off = [x for x in xs if x['handle'][1:] in OFFICIAL]
    wiki = any('wikipedia.org' in w['url'] for w in web)
    conf = 'high' if off and (wiki or len(web) >= 2) else ('medium' if off or wiki else 'low')
    notes = c['sens']
    if cid == 'luna':
        notes += ' Possible name conflict: "LUNA CAT" LUCAT on Base (0xd6387007D080753bD4A510892C446F1Fc62CAc2C) mcap ~$82.6k, zero volume; not clearly about Sailor Moon\'s Luna.'
        conf = 'medium'
    if cid in ('jinx', 'tubbs', 'snagglepuss', 'happy', 'stimpy', 'heathcliff', 'macavity'): conf = 'low' if conf != 'high' else 'medium'
    tk = T.get(cid, {})
    score = c['viral'] * 10 + {'high': 8, 'medium': 4, 'low': 0}[conf] + min(len(xs), 2) * 2 + min(len(web), 2) * 2 + (2 if c['real'] else 0)
    out.append({'id': cid, 'catName': c['catName'], 'category': c['category'], 'owner': c['owner'], 'realCat': c['real'],
                'story': c['story'][:500], 'proof': {'x': xs, 'web': web}, 'existingCoin': coin,
                'suggestedName': c['name'][:32], 'suggestedTicker': tk.get('ticker'),
                'tickerCheck': ('free on Jupiter, StonkFun and DexScreener (exact symbol) ' + NOW) if tk.get('ticker') else 'no free candidate found',
                'look': c['look'], 'pairSuggestion': c['pair'], 'sensitivityNotes': notes, 'confidence': conf, 'strength': score})
out.sort(key=lambda o: -o['strength'])
for i, o in enumerate(out, 1): o['rank'] = i
for n, cat, r in EXTRA_REJECT: rej.append({'id': None, 'catName': n, 'category': cat, 'reason': r})
json.dump(out, open('adoptables.json', 'w'), indent=1, ensure_ascii=False)
json.dump(rej, open('rejected.json', 'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(len(out), Counter(o['category'] for o in out), 'rejected', len(rej))
for o in out[:25]: print(o['rank'], o['catName'], o['category'], o['suggestedTicker'], o['confidence'], (o['existingCoin'] or {}).get('mcap'))
