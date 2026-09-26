import json,sys
S='/tmp/claude-0/-home-user-Cat-Intelligence-Agency/8cd510ac-033d-555a-89da-fcd5d6945b07/scratchpad'
J='/home/user/cat-sanctuary/scripts/cat-models.jobs.json'
jobs=json.load(open(S+'/jobs.json'))
T=[c['ticker'] for c in json.load(open('/home/user/cat-sanctuary/data/adoptables.json'))['cats']]
d=json.load(open(J))
for a in sys.argv[1:]:
    i,url=a.split('=',1); i=int(i); t=T[i]
    d[t]={"image_job":jobs[str(i)],"clean_job":jobs[str(200+i)],
      "view_jobs":{k:jobs[str(1000+i*10+v)] for v,k in enumerate(['front','left','back','right'])},
      "model_job":jobs[str(3000+i)],"model":"hunyuan3d_v3_image_to_3d (multiview front,left,back,right)",
      "faces":"~500k raw, packed ~20k","pose":"standing on all fours","source":"adoptable (realistic portrait from the real cat's proof photo)",
      "status":"done","hd":True,"si":0.04,"si_lo":0.01,"tex":2048,"tex_lo":256,"q":78,"credits":16.25,
      "url":url if url.startswith('http') else 'https://d8j0ntlcm91z4.cloudfront.net/user_3FyGGgvr86P2yKo8RswRabCMo0c/hf_'+url}
    print(t)
json.dump(d,open(J,'w'),indent=1); open(J,'a').write('\n')
