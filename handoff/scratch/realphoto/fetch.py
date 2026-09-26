import json,re,subprocess,os,sys
R='/home/user/catcoin-sanctuary/data/'
p=json.load(open(R+'planned.json'))['cats'];a=json.load(open(R+'adoptables.json'))['cats'];f=json.load(open(R+'famous.json'))['coins']
items=[]
for c in p: items.append(('stock',c['ticker'],(c.get('proof') or {}).get('url') if (c.get('proof') or {}).get('kind')=='x' else None, c.get('proof')))
for c in a: items.append(('adopt',c['ticker'],c['proof']['url'],c['proof']))
for c in f:
  u=(c.get('viral') or {}).get('url') or ''
  m=re.search(r'(?:x|twitter)\.com/\w+/status/\d+',u)
  items.append(('famous',c['symbol'],('https://'+m[0].replace('twitter.com','x.com')) if m else None,None))
json.dump(items,open('items.json','w'),indent=1)
for kind,t,u,_ in items:
  if not u: continue
  out=f'raw/{t}.json'
  if os.path.exists(out): continue
  m=re.search(r'\.com/(\w+)/status/(\d+)',u)
  subprocess.run(['curl','-sS','--cacert','/root/.ccr/ca-bundle.crt','-m','25','-o',out,f'https://api.fxtwitter.com/{m[1]}/status/{m[2]}'])
