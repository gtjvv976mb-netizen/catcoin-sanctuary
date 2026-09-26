import json, sys, os, urllib.request, io
from PIL import Image
S=os.path.dirname(os.path.abspath(__file__))
looks=json.load(open(os.path.join(S,'looks.json')))
rows=[l.rstrip('\n').split('\t') for l in open(os.path.join(S,'results.tsv')) if l.strip()]
for idx,job,url in rows:
    t=looks[int(idx)][0]
    png=os.path.join(S,t+'.png'); jpg=os.path.join(S,t+'-512.jpg')
    if os.path.exists(png) and os.path.exists(jpg) and open(os.path.join(S,'.src-'+t),'r').read()==job if os.path.exists(os.path.join(S,'.src-'+t)) else False:
        continue
    data=None
    for a in range(3):
        try:
            data=urllib.request.urlopen(url,timeout=60).read(); break
        except Exception as e:
            print('retry',t,e)
    if data is None: print('FAIL',t); continue
    im=Image.open(io.BytesIO(data)); im.load()
    if im.format=='PNG':
        open(png,'wb').write(data)
    else:
        im.save(png,'PNG')
    rgb=im.convert('RGB').resize((512,512),Image.LANCZOS)
    rgb.save(jpg,'JPEG',quality=88,optimize=True,progressive=True)
    open(os.path.join(S,'.src-'+t),'w').write(job)
    print(t, im.format, im.size, os.path.getsize(png), os.path.getsize(jpg))
