import json,subprocess,urllib.parse,time
from concurrent.futures import ThreadPoolExecutor
x=json.load(open('adoptables.json'))
SKIP={'towser','yontama','minerva','ossie','eriktheread'}
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
cs=[c for c in x[25:] if c['confidence']!='low' and c['id'] not in SKIP]
res=dict(ThreadPoolExecutor(6).map(lambda c:(c['suggestedTicker'],taken(c['suggestedTicker'])),cs))
json.dump(res,open('recheck3.json','w'),indent=1)
print({k:v for k,v in res.items() if v})
