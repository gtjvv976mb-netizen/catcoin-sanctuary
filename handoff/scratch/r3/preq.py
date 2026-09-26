import json
P={c['ticker']:c for c in json.load(open('/home/user/cat-sanctuary/data/planned.json'))['cats']}
L=dict(json.load(open('/home/user/cat-sanctuary/data/lore.json'))['cats'])
T=[t for t in P if t not in L]
M=open('mids.txt').read().split()
assert len(T)==len(M)
json.dump(dict(zip(T,M)),open('pmids.json','w'),indent=0)
reqs=[]
for i,t in enumerate(T):
    c=P[t]
    reqs.append({'index':7000+i,'params':{'model':'gpt_image_2_5','quality':'medium','aspect_ratio':'1:1','prompt':
      f"A realistic, true-to-life photograph of a real cat: the exact same cat as in the reference image, now a real living animal with real fur, whiskers and eyes, keeping exactly the same coat colours, markings, pattern placement, eye colour and body type. {c['look']} Sitting upright facing the camera, full body, centred, looking at the viewer. Warm soft studio light, softly blurred warm-toned background. No text, no people, no props, no clothing unless described.",
      'medias':[{'role':'image_references','value':M[i]}]}})
for k in range(0,len(reqs),12): json.dump(reqs[k:k+12],open(f'preq{k//12}.json','w'))
print(len(T))
