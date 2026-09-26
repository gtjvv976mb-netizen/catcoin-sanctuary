import json,subprocess,urllib.parse,re
C=json.load(open('cands.json')); W=json.load(open('web.json'))
bad=('Radware','Farcaster','Buy, Sell','Munich Mouser','WoWS','Laura','Funko','Just Funky','It\'s me')
import time
def curl(u):
    for i in range(4):
        o=subprocess.run(['curl','-sS','-m','25','-A','CatSanctuaryResearch/1.0 (brillantesken98 research)',u],capture_output=True,text=True).stdout
        if o.strip().startswith('{'): return o
        time.sleep(3+i*3)
    return '{}'
for cid,c in C.items():
    W[cid]=[s for s in W.get(cid,[]) if not s['title'].startswith(bad)]
    if any('wikipedia' in s['url'] for s in W[cid]): continue
    nm=c['catName'].split(' (')[0].split(' &')[0].replace('Mr. ','').replace('Mrs ','')
    q=f'{nm} cat {c["owner"].split(" (")[0]}'
    d=json.loads(curl('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=4&srsearch='+urllib.parse.quote(q)) or '{}')
    for r in d.get('query',{}).get('search',[]):
        t=r['title']
        e=json.loads(curl('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles='+urllib.parse.quote(t)))
        txt=list(e.get('query',{}).get('pages',{'x':{}}).values())[0].get('extract','')
        key=re.sub(r'[^a-z]','',nm.lower())
        flat=re.sub(r'[^a-z]','',txt.lower())
        if len(key)>=3 and key in flat and ('cat' in txt.lower() or 'feline' in txt.lower()):
            W[cid].append({'url':'https://en.wikipedia.org/wiki/'+t.replace(' ','_'),'title':t+' - Wikipedia','matched':key}); break
    print(cid,[s['title'][:40] for s in W[cid]],flush=True)
json.dump(W,open('web.json','w'),indent=1)
