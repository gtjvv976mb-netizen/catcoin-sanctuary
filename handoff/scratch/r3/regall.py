# regall.py kind  -> registers all done models of kind (xs|ad) whose url is known
import json,sys
S='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad/r3/'
J='/home/user/cat-sanctuary/scripts/cat-models.jobs.json'
j=json.load(open(S+'jobs.json')); d=json.load(open(J)); kind=sys.argv[1]
V=['front','left','back','right']
if kind=='xs':
    M=json.load(open(S+'xsmids.json')); T=list(M); rows=[(t,M[t],10000+i,11000+i*10,15000+i) for i,t in enumerate(T)]; src="xStock redo (site's realistic portrait)"
else:
    meta=json.load(open(S+'ad/meta.json')); rows=[(meta[str(9000+i)]['ticker'],j[str(9000+i)],13000+i,14000+i*10,16000+i) for i in range(65)]; src="adoptable (realistic portrait from the real cat's proof photo or source page)"
n=0
for t,img,ci,vi,mi in rows:
    mj=j.get(str(mi)); u=j.get('url:'+mj) if mj else None
    if not u: continue
    prev=d.get(t,{})
    e={"image_job":img,"clean_job":j[str(ci)],"view_jobs":{V[v]:j[str(vi+v)] for v in range(4)},"model_job":mj,
       "model":"hunyuan3d_v3_image_to_3d (multiview front,left,back,right)","faces":"~500k raw, packed ~20k","pose":"standing on all fours",
       "source":src,"status":"done","hd":True,"si":0.03,"si_lo":0.01,"tex":2048,"tex_lo":256,"q":70,"credits":16.25,"url":u}
    if prev.get('model_job') and prev.get('model_job')!=mj and not prev.get('hd'): e['prev_model_job']=prev['model_job']
    for k in ('yaw','sa_lo'):
        if k in prev and prev.get('hd'): e[k]=prev[k]
    if prev.get('hd') and prev.get('model_job')==mj: continue
    d[t]=e; n+=1
json.dump(d,open(J,'w'),indent=1); open(J,'a').write('\n'); print(kind,n)
