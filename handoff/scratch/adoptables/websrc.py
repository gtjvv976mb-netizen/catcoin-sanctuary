import json,subprocess,urllib.parse,re,html
C=json.load(open('cands.json')); fx=json.load(open('fx.json'))
def curl(u,extra=[]):
    r=subprocess.run(['curl','-sSL','-m','25','-A','Mozilla/5.0 (compatible; research)']+extra+[u],capture_output=True,text=True,errors='ignore'); return r.stdout
out={}
for cid,c in C.items():
    srcs=[]
    names=[c['catName'].split(' (')[0].split(' &')[0]]+c['keys']
    nk=[re.sub(r'[^a-z]','',n.lower()) for n in names if len(n)>=3]
    for t in c.get('wiki',[]):
        u='https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles='+urllib.parse.quote(t)
        try:
            d=json.loads(curl(u)); p=list(d['query']['pages'].values())[0]
            txt=p.get('extract','')
            flat=re.sub(r'[^a-z]','',txt.lower())
            hit=[n for n in nk if n and n in flat]
            if 'missing' not in p and hit:
                srcs.append({'url':'https://en.wikipedia.org/wiki/'+p['title'].replace(' ','_'),'title':p['title']+' - Wikipedia','matched':hit[0]})
        except Exception as e: pass
    # linked urls from verified tweets
    for u,v in fx.items():
        if v['id']!=cid or not v.get('ok'): continue
        h,i=re.search(r'x\.com/([^/]+)/status/(\d+)',v['url']).groups()
        try:
            t=json.loads(curl(f'https://api.fxtwitter.com/{h}/status/{i}'))['tweet']
            for f in t['raw_text'].get('facets',[]):
                if f.get('type')=='url' and f.get('replacement'):
                    r=subprocess.run(['curl','-sSL','-m','20','-A','Mozilla/5.0','-o','/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adoptables/pg.html','-w','%{url_effective} %{http_code}',f['replacement']],capture_output=True,text=True)
                    eff,code=r.stdout.rsplit(' ',1)
                    body=open('/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/adoptables/pg.html',errors='ignore').read() if code=='200' else ''
                    m=re.search(r'<title[^>]*>(.*?)</title>',body,re.S|re.I)
                    title=html.unescape(m.group(1).strip()) if m else ''
                    if code=='200' and title and not any(x in eff for x in ('x.com','twitter.com','instagram.com','youtube.com','youtu.be')):
                        srcs.append({'url':eff.split('?')[0],'title':title[:150],'via':'linked from '+v['url']})
        except Exception as e: pass
    out[cid]=srcs
    print(cid,len(srcs),[s['title'][:50] for s in srcs],flush=True)
json.dump(out,open('web.json','w'),indent=1)
