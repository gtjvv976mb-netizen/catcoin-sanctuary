# mkviews.py base refidx_start n prefix  -> writes prefix{k}.json with index base+i*10+v, ref = jobs[refidx_start+i]
import json,sys
base,rs,n,pre=int(sys.argv[1]),int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
skip=set(int(x) for x in sys.argv[5].split(',')) if len(sys.argv)>5 else set()
j=json.load(open('jobs.json'))
V=['FRONT view, facing the camera','LEFT side profile, head pointing to the left edge','BACK view, seen from behind','RIGHT side profile, head pointing to the right edge']
R=[]
for i in range(n):
    if i in skip: continue
    ref=j[str(rs+i)]
    for v in range(4):
        R.append({'index':base+i*10+v,'params':{'model':'gpt_image_2_5','quality':'medium','aspect_ratio':'1:1','prompt':f'Orthographic turnaround {V[v]}. Exact same animal as the reference: same standing pose on all four legs, colours, markings, face, fur, outfit. Full body, centred. Plain light grey background, no shadow, no text.','medias':[{'role':'image_references','value':ref}]}})
for k in range(0,len(R),12): json.dump(R[k:k+12],open(f'{pre}{k//12}.json','w'),separators=(',',':'))
print(len(R),(len(R)+11)//12)
