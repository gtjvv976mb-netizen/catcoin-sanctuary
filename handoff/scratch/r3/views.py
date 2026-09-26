import json,sys
V=['FRONT view, facing the camera','LEFT side profile, head pointing to the left edge','BACK view, seen from behind','RIGHT side profile, head pointing to the right edge']
out=[]
for a in sys.argv[1:]:
    base,ref=a.split('=')
    for v in range(4):
        out.append({'index':int(base)+v,'params':{'model':'gpt_image_2_5','quality':'medium','aspect_ratio':'1:1','prompt':f'Orthographic turnaround {V[v]}. Exact same animal as the reference, same standing pose on all four legs, colours, markings, face, fur, outfit. Full body in frame, centred. Plain light grey background, no shadow, no text.','medias':[{'role':'image_references','value':ref}]}})
print(json.dumps(out))
