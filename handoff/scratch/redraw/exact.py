import json,os,re
S='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/launch-sheet'
B={e['ticker']:e for e in json.load(open(S+'/../redraw/launch-sheet.before.json'))}
C=dict(HARRUMPH='Coinbase',PEWTER='Robinhood',SNOWCURL='Tesla',MOATCAT='Berkshire Hathaway',COUCHCAP='Meta',WARMSPOT='SpaceX',SOCKFOOT='NVIDIA',HALFSMILE='Microsoft')
ST=dict(
HARRUMPH="Harrumph, a fluffy flat-faced grey cat with a grumpy pout, glares at pigeons all morning.",
PEWTER="Pewter, a silver-grey tabby with striped cheeks and a white chin, rolls in the catmint.",
SNOWCURL="Snowcurl, a sleek white cat, holds her curl-tipped tail high and washes her face in shade.",
MOATCAT="A white calico who guards the garden pond like a moat.",
COUCHCAP="A fluffy brown tabby with golden eyes who claims the sofa each evening, remote in paw.",
WARMSPOT="Warmspot, a tuxedo cat with a white nose stripe, always finds the one warm spot in the snow.",
SOCKFOOT="Sockfoot, a grey tabby with a white bib and four white socks, is first up at dawn.",
HALFSMILE="A grey-and-white cat with grey-green eyes and a crooked, pleased grin.")
RESTORE=['look','whyLook','basis','checks','finalRecheck','imageJobId','imageUrl','imageBytes','imageSize','image','imageJpg512']
d=json.load(open(S+'/launch-sheet.json'))
for e in d:
  t=e['ticker']
  if t not in C: continue
  o=B[t]; c=C[t]
  for k in RESTORE:
    if k in o: e[k]=o[k]
    else: e.pop(k,None)
  e.pop('coat',None)
  if 'coat' in o: e['coat']=o['coat']
  tr=f"Fan tribute to {c}'s cat. Not affiliated with or endorsed by {c}."
  e['tribute']=tr; e['story']=ST[t]
  e['description']=f"{ST[t]} {tr} {e['disclosure']}"
  assert len(e['description'])<=280, (t,len(e['description']))
  e['artLicence']=f"CC BY 4.0 (credit: Catcoin Sanctuary) covers this drawing only. The depicted cat's look belongs to {c}: a fan tribute, not affiliated with or endorsed by {c}."
  e['checks']=re.sub(r'description \d+/280, story \d+/160', f"description {len(e['description'])}/280, story {len(ST[t])}/160", e['checks'])
  e['basis']=o['basis']+f" Owner's ruling 2026-09-25: the exact look is kept as a fan tribute; the story was shortened to fit the line '{tr}' before the disclosure."
  if os.path.exists(e['image']): e['imageBytes']=os.path.getsize(e['image'])
json.dump(d,open(S+'/launch-sheet.json','w'),indent=2,ensure_ascii=False)
m=json.load(open(S+'/images/manifest.json'))
for x in m:
  if x['ticker'] in C:
    o=B[x['ticker']]
    x['job_id']=o['imageJobId']; x['result_url']=o['imageUrl']; x['png_bytes']=os.path.getsize(x['png']); x['jpg_bytes']=os.path.getsize(x['jpg512'])
    x['note']="exact-look fan tribute (owner's ruling 2026-09-25); the redrawn original-cat version is in images/redrawn-originals/"
json.dump(m,open(S+'/images/manifest.json','w'),indent=1)
for e in d:
  if e['ticker'] in C: print(e['ticker'],len(e['description']),len(e['story']))
