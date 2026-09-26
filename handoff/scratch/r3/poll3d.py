# probe glb urls for pending 3D ids with a wide window starting at a given ts
import json,sys,urllib.request
from concurrent.futures import ThreadPoolExecutor
f='jobs.json'; j=json.load(open(f))
B='https://d8j0ntlcm91z4.cloudfront.net/user_3FyGGgvr86P2yKo8RswRabCMo0c/hf_20260926_'
def sec(t): t=int(t); return t//10000*3600+t//100%100*60+t%100
def fmt(s): return f'{s//3600:02d}{s//60%60:02d}{s%60:02d}'
start=sec(sys.argv[1]); end=sec(sys.argv[2])
ids=[j[str(i)] for i in list(range(15000,15024))+list(range(16000,16065)) if str(i) in j and 'url:'+j[str(i)] not in j]
def head(u):
    try: return urllib.request.urlopen(urllib.request.Request(u,method='HEAD'),timeout=8).status==200
    except Exception: return False
found={}
def probe(jid):
    for s in range(start,end+1):
        u=B+fmt(s)+'_'+jid+'.glb'
        if head(u): return jid,u
    return jid,None
with ThreadPoolExecutor(32) as ex:
    for jid,u in ex.map(probe,ids):
        if u: found['url:'+jid]=u
j2=json.load(open(f)); j2.update(found); json.dump(j2,open(f,'w'),indent=0)
print('found',len(found),'of',len(ids))
