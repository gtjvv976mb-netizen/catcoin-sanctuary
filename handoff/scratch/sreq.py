import json,sys
ids=json.load(open('qids.json'))
q=json.load(open('/home/user/cat-sanctuary/scripts/cat-models.queue.json'))['remaining']
P="Exact same cat as the reference (same colours, markings, face, eyes, any hat or clothing; drop held props), full body, standing on all four legs like a real cat: horizontal back, four paws flat, gap under the belly, head up, tail out behind. Side 3/4 view, head to the right. Plain light grey background, no ground, no text."
out=[]
for a in sys.argv[1:]:
    n=int(a); t=q[n]['id'] if q[n]['kind']=='stock' else q[n]['symbol']
    out.append({'index':600+n,'params':{'model':'gpt_image_2_5','quality':'medium','aspect_ratio':'1:1','prompt':P,'medias':[{'role':'image_references','value':ids[t]}]}})
print(json.dumps(out,separators=(',',':')))
