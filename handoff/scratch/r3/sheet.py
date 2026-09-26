# usage: sheet.py out.jpg cols tile url...
import sys,io,urllib.request
from PIL import Image
out,cols,t=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]); us=sys.argv[4:]
rows=(len(us)+cols-1)//cols; S=Image.new('RGB',(cols*t,rows*t),'white')
for i,u in enumerate(us):
    try:
        im=Image.open(io.BytesIO(urllib.request.urlopen(u).read()) if u.startswith('http') else u).convert('RGB'); im.thumbnail((t,t))
        S.paste(im,((i%cols)*t,(i//cols)*t))
    except Exception as e: print(u,e)
S.save(out,quality=85)
