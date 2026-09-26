# ts.py lo-hi=HHMMSS ... probes +-4s, stores url:<jobid>
import json,sys,urllib.request
from concurrent.futures import ThreadPoolExecutor
f='jobs.json'; j=json.load(open(f))
B='https://d8j0ntlcm91z4.cloudfront.net/user_3FyGGgvr86P2yKo8RswRabCMo0c/hf_20260926_'
def sec(t): t=int(t); return t//10000*3600+t//100%100*60+t%100
def fmt(s): return f'{s//3600:02d}{s//60%60:02d}{s%60:02d}'
def probe(jid,ts,ext):
    for d in (range(0,W) if W>20 else [0,-1,1,-2,2,-3,3,-4,4,5,6,8,10]):
        u=B+fmt(sec(ts)+d)+'_'+jid+ext
        try:
            if urllib.request.urlopen(urllib.request.Request(u,method='HEAD'),timeout=10).status==200: return u
        except Exception: pass
    return None
W=int(sys.argv[1]) if sys.argv[1].isdigit() else 0
if W: sys.argv.pop(1)
tasks=[]
for a in sys.argv[1:]:
    r,ts=a.split('='); ext='.png'
    if ':' in ts: ts,ext=ts.split(':')
    lo,hi=(r.split('-')+[r])[:2]
    for i in range(int(lo),int(hi)+1):
        if str(i) in j and 'url:'+j[str(i)] not in j: tasks.append((j[str(i)],ts,ext,i))
with ThreadPoolExecutor(40) as ex:
    res=list(ex.map(lambda t:(t,probe(*t[:3])),tasks))
for t,u in res:
    if u: j['url:'+t[0]]=u
    else: print('MISS',t[3])
j2=json.load(open(f)); j2.update({k:v for k,v in j.items() if k.startswith('url:')}); json.dump(j2,open(f,'w'),indent=0); print('ok',len(res))
