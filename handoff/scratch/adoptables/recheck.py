import json,subprocess,urllib.parse,time
L=json.load(open('adoptables.json'))[:25]
def get(u):
    for i in range(3):
        o=subprocess.run(['curl','-sS','-m','25',u],capture_output=True,text=True).stdout
        try: return json.loads(o)
        except: time.sleep(2)
    return 'ERR'
res={}
for c in L:
    t=c['suggestedTicker']
    j=get('https://lite-api.jup.ag/tokens/v2/search?query='+urllib.parse.quote(t))
    s=get('https://www.stonkfun.xyz/api/public/v1/tokens?q='+urllib.parse.quote(t)+'&pageSize=100')
    if j=='ERR' or s=='ERR': res[t]='ERR'; print(t,'ERR'); continue
    h=[x['id'] for x in j if (x.get('symbol') or '').upper().lstrip('$')==t]+[x['mint'] for x in (s.get('data') or {}).get('tokens',[]) if (x.get('symbol') or '').upper()==t]
    res[t]=h; print(t,h,flush=True)
json.dump(res,open('recheck.json','w'),indent=1)
