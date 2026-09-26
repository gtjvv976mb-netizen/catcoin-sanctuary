import json,sys,subprocess
# usage: vreq.py idx... (1000+i*10+v)
j=json.load(open('jobs.json'))
V=['FRONT view, facing the camera','LEFT side profile, head pointing to the left edge','BACK view, seen from behind','RIGHT side profile, head pointing to the right edge']
out=[]
for a in sys.argv[1:]:
    k=int(a); i=(k-1000)//10; v=k%10
    ref=j[str(200+i)]
    m='nano_banana_pro' if i in (6,23) else 'gpt_image_2_5'
    p={'model':m,'quality':'medium','aspect_ratio':'1:1','prompt':f'Orthographic turnaround {V[v]}. Exact same animal as the reference, same standing pose on all four legs, colours, markings, face, fur, outfit. Full body in frame, centred. Plain light grey background, no shadow, no text.','medias':[{'role':'image_references','value':ref}]}
    if m!='gpt_image_2_5': p.pop('quality'); p['prompt']+=' Exactly one animal in the image.'
    out.append({'index':k,'params':p})
print(json.dumps(out,separators=(',',':')))
