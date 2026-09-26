import sys
from PIL import Image,ImageDraw
out,ids=sys.argv[1],sys.argv[2:]
W=256;im=Image.new('RGB',(W*4,W*((len(ids)+1)//2)),'white');d=ImageDraw.Draw(im)
for k,t in enumerate(ids):
  x=(k%2)*2*W;y=(k//2)*W
  for j,p in enumerate(['../launch-sheet-2/images/%s-512.jpg'%t,'stand/%s.png'%t]):
    try: im.paste(Image.open(p).convert('RGB').resize((W,W)),(x+j*W,y))
    except Exception as e: pass
  d.text((x+4,y+4),t,fill='red')
im.save(out)
