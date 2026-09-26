import sys
from PIL import Image, ImageDraw
keys=sys.argv[2:]; out=sys.argv[1]
cols=2; tw,th=640,360; ph=360
rows=(len(keys)+cols-1)//cols
im=Image.new("RGB",(cols*(tw+ph),rows*th),"white"); d=ImageDraw.Draw(im)
for i,k in enumerate(keys):
    x=(i%cols)*(tw+ph); y=(i//cols)*th
    im.paste(Image.open(f"assets/ingame/{k}.jpg").resize((tw,th)),(x,y))
    im.paste(Image.open(f"assets/portraits/{k}.jpg").convert("RGB").resize((ph,ph)),(x+tw,y))
    d.text((x+8,y+8),k,fill="black")
im.save(out,quality=80)
