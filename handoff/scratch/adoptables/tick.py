import json,subprocess,urllib.parse,time,sys
C=json.load(open('cands.json'))
def get(u):
    for i in range(3):
        o=subprocess.run(['curl','-sS','-m','25',u],capture_output=True,text=True).stdout
        try: return json.loads(o)
        except: time.sleep(2)
    return None
def taken(t):
    t=t.upper(); hits=[]
    j=get('https://lite-api.jup.ag/tokens/v2/search?query='+urllib.parse.quote(t)) or []
    hits+=['jup:'+x['id'] for x in j if isinstance(x,dict) and (x.get('symbol') or '').upper().lstrip('$')==t]
    s=get('https://www.stonkfun.xyz/api/public/v1/tokens?q='+urllib.parse.quote(t)+'&pageSize=100') or {}
    hits+=['stonk:'+x['mint'] for x in (s.get('data') or {}).get('tokens',[]) if (x.get('symbol') or '').upper()==t]
    d=get('https://api.dexscreener.com/latest/dex/search?q='+urllib.parse.quote(t)) or {}
    hits+=['dex:'+p['chainId']+':'+p['baseToken']['address'] for p in d.get('pairs') or [] if p['baseToken']['symbol'].upper().lstrip('$')==t]
    return sorted(set(hits))
out={}
for cid,c in C.items():
    t=c.get('ticker')
    if not t: continue
    cands=[t,t+'CAT' if len(t)<=7 else t[:7]+'CAT', t[:8]+'X']
    for tt in cands:
        tt=tt[:10]; h=taken(tt)
        if not h: out[cid]={'ticker':tt,'checked':['jupiter','stonkfun','dexscreener'],'original':t}; break
        print(cid,tt,'TAKEN',h[:3],flush=True)
    else: out[cid]={'ticker':None,'original':t}
    print(cid,out[cid]['ticker'],flush=True)
json.dump(out,open('tickers.json','w'),indent=1)
