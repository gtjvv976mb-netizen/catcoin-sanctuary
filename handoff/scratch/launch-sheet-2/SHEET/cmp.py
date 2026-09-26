import json,sys
F={c['ticker']:c for c in json.load(open('EDITOR/final.json'))}
L=dict(json.load(open('images/looks.json')))
for fn in sys.argv[1:]:
  for c in json.load(open(fn)):
    t=c['ticker']; f=F.get(t)
    if not f: print('NOT IN FINAL', t); continue
    for k in ['name','description','look','coat']:
      if c[k]!=f[k]: print(t,k,'DIFF vs final.json'); 
    if c['look']!=L.get(t): print(t,'look DIFF vs looks.json')
    print(t,'ok' , len(c['name']), len(c['description']))
