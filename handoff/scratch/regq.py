import json,sys
S='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad'
J='/home/user/cat-sanctuary/scripts/cat-models.jobs.json'
jobs=json.load(open(S+'/jobs.json')); ids=json.load(open(S+'/qids.json'))
q=json.load(open('/home/user/cat-sanctuary/scripts/cat-models.queue.json'))['remaining']
d=json.load(open(J))
for a in sys.argv[1:]:
    n,url=a.split('=',1); n=int(n); t=q[n]['id']
    if q[n]['kind']!='stock':
        fam={c['contract']:c for c in json.load(open('/home/user/cat-sanctuary/data/famous.json'))['coins']}
        t=fam[t.split('-',1)[1]]['id']
    d[t]={"image_job":ids.get(t) or ids.get(q[n].get("symbol","")),"clean_job":jobs[str(600+n)],
      "view_jobs":{k:jobs[str(2000+n*10+v)] for v,k in enumerate(['front','left','back','right'])},
      "model_job":jobs[str(5000+n)],"model":"hunyuan3d_v3_image_to_3d (multiview front,left,back,right)",
      "faces":"~500k raw, packed ~20k","pose":"standing on all fours","source":"queue (site portrait or coin logo)",
      "status":"done","hd":True,"si":0.04,"si_lo":0.01,"tex":2048,"tex_lo":256,"q":78,"credits":16.25,
      "url":url if url.startswith('http') else 'https://d8j0ntlcm91z4.cloudfront.net/user_3FyGGgvr86P2yKo8RswRabCMo0c/hf_'+url}
    print(t)
json.dump(d,open(J,'w'),indent=1); open(J,'a').write('\n')
