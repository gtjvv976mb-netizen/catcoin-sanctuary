import json,sys,re,subprocess,urllib.parse,time
def get(u):
    for i in range(3):
        r=subprocess.run(['curl','-sS','-m','25','-A','Mozilla/5.0',u],capture_output=True,text=True)
        try: return json.loads(r.stdout)
        except: time.sleep(2)
    return None
norm=lambda s:re.sub(r'[^a-z0-9]','',(s or '').lower())
def check(keys,syms=()):
    """keys: distinctive name strings; match if normalized token name contains key or symbol == key/sym"""
    nk=[norm(k) for k in keys]; ns=[norm(s) for s in syms]
    hits={}
    def consider(chain,addr,name,sym,mc,src):
        n,s=norm(name),norm(sym)
        if any(k and (k in n or k==s) for k in nk) or any(x and x==s for x in ns):
            k=(chain,addr)
            if k not in hits or (mc or 0)>(hits[k]['mcap'] or 0):
                hits[k]={'chain':chain,'contract':addr,'name':name,'symbol':sym,'mcap':round(mc) if mc else 0,'src':src}
    for q in list(keys)+list(syms):
        d=get('https://api.dexscreener.com/latest/dex/search?q='+urllib.parse.quote(q)) or {}
        for p in d.get('pairs') or []:
            b=p['baseToken']; consider(p['chainId'],b['address'],b['name'],b['symbol'],p.get('marketCap') or p.get('fdv'),'dexscreener')
        j=get('https://lite-api.jup.ag/tokens/v2/search?query='+urllib.parse.quote(q)) or []
        if isinstance(j,list):
            for t in j: consider('solana',t['id'],t['name'],t['symbol'],t.get('mcap') or t.get('fdv'),'jupiter:'+(t.get('launchpad') or ''))
    return sorted(hits.values(),key=lambda h:-(h['mcap'] or 0))
if __name__=='__main__':
    cands=json.load(open(sys.argv[1])); out={}
    try: out=json.load(open(sys.argv[2]))
    except: pass
    for c in cands:
        if c['id'] in out: continue
        h=check(c['keys'],c.get('syms',[]))
        out[c['id']]=h[:8]
        top=h[0] if h else None
        print(c['id'], (top['mcap'],top['name'],top['symbol'],top['chain']) if top else '-', flush=True)
        json.dump(out,open(sys.argv[2],'w'),indent=1)
