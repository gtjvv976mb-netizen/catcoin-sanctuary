import sys,os
from PIL import Image
# savelore.py src.png TICKER
src,t=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGB'); w,h=im.size; tw=int(h*1.5)
if tw<=w: im=im.crop(((w-tw)//2,0,(w-tw)//2+tw,h))
else: th=int(w/1.5); im=im.crop((0,(h-th)//2,w,(h-th)//2+th))
im=im.resize((1200,800),Image.LANCZOS)
out=f'/home/user/cat-sanctuary/assets/lore/{t}.webp'
for q in (80,72,64,56):
    im.save(out,'WEBP',quality=q,method=6)
    if os.path.getsize(out)<=200000: break
print(t,os.path.getsize(out))
