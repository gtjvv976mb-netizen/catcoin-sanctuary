import json,sys
q=json.load(open('/home/user/cat-sanctuary/scripts/cat-models.queue.json'))['remaining']
V=['FRONT view, facing the camera','LEFT side profile, head pointing to the left edge','BACK view, seen from behind','RIGHT side profile, head pointing to the right edge']
out=[]
for a in sys.argv[1:]:
    n=int(a); ref=json.load(open('jobs.json'))[str(600+n)]
    for v in range(4):
        out.append({'index':2000+n*10+v,'params':{'model':'gpt_image_2_5','quality':'medium','aspect_ratio':'1:1','prompt':f'Orthographic turnaround {V[v]}. Exact same cat as the reference, same standing pose, colours, markings, face, outfit. Full body, centred. Plain light grey background, no text.','medias':[{'role':'image_references','value':ref}]}})
print(json.dumps(out,separators=(',',':')))
