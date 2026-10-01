import sys; sys.path.insert(0,'asm')
from PIL import Image
import overlays as O
wm=Image.open('refs/wordmark-960.png').convert('RGBA')
k5=Image.open('keyframes/shot05.png'); photo=k5.crop((1640,120,2200,680))
sp=O.build('16x9', wm, photo)
tests=[(1.0,'shot01'),(7.0,'shot03'),(13.0,'shot05'),(15.6,'shot05'),(20.5,'shot07_start_v2'),(25.5,'shot08'),(29.6,'shot09'),(36.5,'shot10_end')]
tiles=[]
for t,k in tests:
    f=Image.open('keyframes/%s.png'%k).convert('RGB').resize((1920,1080),Image.LANCZOS)
    O.render(f,sp,t); f.save('qa/ov_%05.1f.jpg'%t,quality=88); tiles.append(f.resize((960,540)))
s=Image.new('RGB',(1920,2160))
for i,im in enumerate(tiles): s.paste(im,((i%2)*960,(i//2)*540))
s.save('qa/ov_sheet.jpg',quality=85)
