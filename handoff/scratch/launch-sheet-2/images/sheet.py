import json,os,sys
from PIL import Image, ImageDraw
S=os.path.dirname(os.path.abspath(__file__))
looks=json.load(open(os.path.join(S,'looks.json')))
a,b=int(sys.argv[1]),int(sys.argv[2])
ts=[looks[i][0] for i in range(a,b)]
W=256;cols=4;rows=(len(ts)+cols-1)//cols
im=Image.new('RGB',(W*cols,(W+18)*rows),'white');d=ImageDraw.Draw(im)
for k,t in enumerate(ts):
    p=os.path.join(S,t+'-512.jpg')
    if not os.path.exists(p): continue
    x,y=(k%cols)*W,(k//cols)*(W+18)
    im.paste(Image.open(p).resize((W,W)),(x,y+18)); d.text((x+4,y+3),f"{a+k} {t}",fill='black')
im.save(os.path.join(S,f'_sheet_{a}_{b}.jpg'),quality=85)
