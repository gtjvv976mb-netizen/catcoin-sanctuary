import json,re
P={c['ticker']:c for c in json.load(open('/home/user/cat-sanctuary/data/planned.json'))['cats']}
M=json.load(open('pmids.json')); T=list(M)
BAD=re.compile(r'comes from|\bsits\b|\blies\b|\bnaps\b|\bleaps\b|\bchases\b|stands up|poster|follows the|echo|\blives\b|\bdozes\b|Cat Sanctuary',re.I)
def clean(s):
    ss=re.split(r'(?<=\.)\s+',s); return ' '.join(x for x in ss if not BAD.search(x))
reqs=[]
for i,t in enumerate(T):
    if i<12: continue
    lk=clean(P[t]['look'])
    reqs.append({'index':7000+i,'params':{'model':'gpt_image_2_5','quality':'medium','aspect_ratio':'1:1','prompt':
      f"A realistic, true-to-life photograph: the exact same animal as in the reference image, now a real living animal with real fur, whiskers and eyes, keeping exactly the same coat colours, markings, pattern placement, eye colour, body type and any collar or outfit. {lk} Sitting upright facing the camera, full body, centred, looking at the viewer. Warm soft studio light, softly blurred warm-toned background. No text, no logo, no people, no props.",
      'medias':[{'role':'image_references','value':M[t]}]}})
for k in range(0,len(reqs),12): json.dump(reqs[k:k+12],open(f'preqB{k//12}.json','w'))
print(len(reqs))
