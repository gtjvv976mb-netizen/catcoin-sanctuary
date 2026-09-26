# reg.py KEY clean view0 view1 view2 view3 model url source [image_job]
import json,sys
J='/home/user/cat-sanctuary/scripts/cat-models.jobs.json'
d=json.load(open(J))
k,clean,v0,v1,v2,v3,m,url,src=sys.argv[1:10]; img=sys.argv[10] if len(sys.argv)>10 else None
d[k]={"image_job":img,"clean_job":clean,"view_jobs":{"front":v0,"left":v1,"back":v2,"right":v3},"model_job":m,
 "model":"hunyuan3d_v3_image_to_3d (multiview front,left,back,right)","faces":"~500k raw, packed ~20k","pose":"standing on all fours",
 "source":src,"status":"done","hd":True,"si":0.04,"si_lo":0.01,"tex":2048,"tex_lo":256,"q":78,"credits":16.25,"url":url}
json.dump(d,open(J,'w'),indent=1); open(J,'a').write('\n'); print(k)
